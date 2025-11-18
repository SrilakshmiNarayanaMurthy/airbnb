const express = require("express");
const { body, validationResult } = require("express-validator");
const { pool } = require("../db");
const multer = require("multer");
const path = require("path");
const bcrypt = require("bcrypt");
const mongoose = require("mongoose");
const BookingModel = require("../models/Booking"); // kept as backup
const ListingBlackoutModel = require("../models/ListingBlackout"); // backup
const ListingModel = require("../models/Listing"); // backup
const User = require("../models/User");

const router = express.Router();

const { publishStatusUpdate } = require("../kafka/bookingStatusProducer");

/* ---------- helpers ---------- */
function requireOwner(req, res, next) {
  if (!req.session?.user || req.session.user.role !== "owner") {
    return res.status(403).json({ error: "owner only" });
  }
  next();
}

/* ---------- health ---------- */
router.get("/ping", (_req, res) => res.json({ ok: true }));

/* ---------- OWNER SIGNUP (public route) ---------- */
router.post(
  "/signup",
  body("name").notEmpty(),
  body("email").isEmail(),
  body("password").isLength({ min: 8 }),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { name, email, password, city = null, state = null, country = null } = req.body;

    try {
      // create owner in Mongo (auth lives in Mongo)
      const existing = await User.findOne({ email });
      if (existing) return res.status(400).json({ error: "email already in use" });

      const user = await User.create({
        name,
        email,
        password,
        role: "owner",
        city,
        state,
        country,
      });

      // session stores Mongo id (string)
      req.session.user = { id: user._id.toString(), name: user.name, email: user.email, role: "owner" };
      res.status(201).json({ id: user._id, name: user.name, email: user.email, role: "owner" });
    } catch (e) {
      console.error("POST /api/owners/signup error:", e);
      res.status(500).json({ error: "server error" });
    }
  }
);

/* ---------- create listing (type + amenities supported) ---------- */
router.post(
  "/listings",
  requireOwner,
  body("title").trim().notEmpty(),
  body("city").trim().notEmpty(),
  body("country").trim().notEmpty(),
  body("price_per_night").isFloat({ gt: 0 }),
  body("max_guests").isInt({ gt: 0 }),
  body("bedrooms").isInt({ gt: 0 }),
  body("bathrooms").isFloat({ gt: 0 }),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const {
      title, city, country,
      price_per_night, max_guests,
      bedrooms, bathrooms,
      image_url = null, description = null,
      property_type = null,
      amenities = null, // comma-separated string e.g. "wifi,ac,parking"
    } = req.body;

    try {
      const ownerMongoId = req.session.user.id;
      if (!ownerMongoId) return res.status(401).json({ error: "not logged in" });

      const amenitiesCsv = amenities ? amenities.split(",").map(a => a.trim()).filter(Boolean).join(",") : null;

      const [result] = await pool.query(
        `INSERT INTO listings (owner_mongo_id, title, description, price_per_night, max_guests, bedrooms, bathrooms, city, country, image_url, property_type, amenities)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [ownerMongoId, title, description, Number(price_per_night) || 0, Number(max_guests) || 1, Number(bedrooms) || 0, Number(bathrooms) || 0, city, country, image_url, property_type, amenitiesCsv]
      );

      res.status(201).json({ id: result.insertId });
    } catch (err) {
      console.error("owner create listing error:", err);
      res.status(500).json({ error: "server error" });
    }
  }
);

// Get all listings owned by the logged-in owner (MongoDB)
router.get("/listings", requireOwner, async (req, res) => {
  try {
    const ownerMongoId = req.session.user.id;
    const [rows] = await pool.query(
      `SELECT id, title, description, price_per_night, max_guests, bedrooms, bathrooms, city, country, image_url, property_type, amenities, created_at
       FROM listings WHERE owner_mongo_id = ? ORDER BY created_at DESC LIMIT 100`,
      [ownerMongoId]
    );

    const result = rows.map(r => ({
      id: r.id,
      title: r.title,
      city: r.city,
      country: r.country,
      price_per_night: r.price_per_night,
      max_guests: r.max_guests,
      bedrooms: r.bedrooms,
      bathrooms: r.bathrooms,
      image_url: r.image_url,
      description: r.description,
      property_type: r.property_type,
      amenities: r.amenities ? r.amenities.split(",").map(s => s.trim()).filter(Boolean) : [],
      created_at: r.created_at,
    }));

    res.json(result);
  } catch (err) {
    console.error("GET /api/owners/listings error:", err);
    res.status(500).json({ error: "server error" });
  }
});

/* ---------- update listing ---------- */
router.put(
  "/listings/:id",
  requireOwner,
  async (req, res) => {
    const id = Number(req.params.id);
    const ok = await assertOwnership(id, req.session.user.id);
    if (!ok) return res.status(404).json({ error: "not found" });

    const allowed = [
      "title","city","country","price_per_night","max_guests",
      "bedrooms","bathrooms","image_url","description","property_type","amenities"
    ];
    const fields = [];
    const values = [];
    for (const k of allowed) {
      if (k in req.body) { fields.push(`${k}=?`); values.push(req.body[k] ?? null); }
    }
    if (!fields.length) return res.json({ updated: false });

    values.push(id);
    try {
      const [r] = await pool.query(`UPDATE listings SET ${fields.join(",")} WHERE id=?`, values);
      res.json({ updated: r.affectedRows === 1 });
    } catch (e) {
      console.error("PUT /api/owners/listings/:id error:", e);
      res.status(500).json({ error: "server error" });
    }
  }
);

/* ---------- delete listing ---------- */
router.delete("/listings/:id", requireOwner, async (req, res) => {
  const id = Number(req.params.id);
  const ok = await assertOwnership(id, req.session.user.id);
  if (!ok) return res.status(404).json({ error: "not found" });
  const [r] = await pool.query("DELETE FROM listings WHERE id=?", [id]);
  res.json({ deleted: r.affectedRows === 1 });
});

/* ---------- photos: upload & list (multi) ---------- */
const photosStorage = multer.diskStorage({
  destination: path.join(__dirname, "..", "uploads"),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname || ".jpg");
    cb(null, `l${Date.now()}${Math.random().toString(16).slice(2)}${ext}`);
  },
});
const uploadPhotos = multer({
  storage: photosStorage,
  limits: { fileSize: 5 * 1024 * 1024, files: 10 }, // max 10 files x 5MB
  fileFilter: (_req, file, cb) => {
    const ok = ["image/jpeg", "image/png", "image/webp"].includes(file.mimetype);
    cb(ok ? null : new Error("Only JPG/PNG/WEBP"), ok);
  },
});

// helper: assert listing ownership by owner_mongo_id
async function assertOwnership(listingId, ownerMongoId) {
  const [rows] = await pool.query("SELECT id FROM listings WHERE id=? AND owner_mongo_id=?", [listingId, ownerMongoId]);
  return rows.length === 1;
}

router.get("/listings/:id/photos", requireOwner, async (req, res) => {
  const id = Number(req.params.id);
  const ok = await assertOwnership(id, req.session.user.id);
  if (!ok) return res.status(404).json({ error: "not found" });
  const [rows] = await pool.query("SELECT id, url, created_at FROM listing_photos WHERE listing_id=? ORDER BY id DESC", [id]);
  res.json(rows);
});

router.post("/listings/:id/photos", requireOwner, uploadPhotos.array("photos", 10), async (req, res) => {
  const id = Number(req.params.id);
  const ok = await assertOwnership(id, req.session.user.id);
  if (!ok) return res.status(404).json({ error: "not found" });

  const urls = req.files.map(f => `/uploads/${f.filename}`);
  if (urls.length === 0) return res.status(400).json({ error: "no files" });

  const values = urls.map(u => [id, u]);
  await pool.query("INSERT INTO listing_photos (listing_id, url) VALUES ?", [values]);
  res.json({ uploaded: urls.length, urls });
});

/* ---------- availability blackouts ---------- */
router.get("/listings/:id/blackouts", requireOwner, async (req, res) => {
  const id = Number(req.params.id);
  const ok = await assertOwnership(id, req.session.user.id);
  if (!ok) return res.status(404).json({ error: "not found" });
  const [rows] = await pool.query(
    "SELECT id, start_date, end_date FROM listing_blackouts WHERE listing_id=? ORDER BY start_date",
    [id]
  );
  res.json(rows);
});

router.post(
  "/listings/:id/blackouts",
  requireOwner,
  body("start_date").isISO8601().toDate(),
  body("end_date").isISO8601().toDate(),
  async (req, res) => {
    const id = Number(req.params.id);
    const ok = await assertOwnership(id, req.session.user.id);
    if (!ok) return res.status(404).json({ error: "not found" });

    const { start_date, end_date } = req.body;
    if (new Date(end_date) < new Date(start_date)) {
      return res.status(400).json({ error: "end before start" });
    }
    const [r] = await pool.query(
      "INSERT INTO listing_blackouts (listing_id, start_date, end_date) VALUES (?, ?, ?)",
      [id, start_date, end_date]
    );
    res.status(201).json({ id: r.insertId });
  }
);

router.delete("/blackouts/:bid", requireOwner, async (req, res) => {
  const bid = Number(req.params.bid);
  // ensure the blackout belongs to this owner's listing
  const [rows] = await pool.query(
    `SELECT b.id
       FROM listing_blackouts b
       JOIN listings l ON l.id = b.listing_id
      WHERE b.id=? AND l.owner_mongo_id=?`,
    [bid, req.session.user.id]
  );
  if (!rows.length) return res.status(404).json({ error: "not found" });
  const [r] = await pool.query("DELETE FROM listing_blackouts WHERE id=?", [bid]);
  res.json({ deleted: r.affectedRows === 1 });
});

/* ===== Booking management (owner) ===== */
function requireOwner(req, res, next) {
  if (!req.session?.user || req.session.user.role !== "owner") {
    return res.status(403).json({ error: "owner only" });
  }
  next();
}

// list requests for this owner's listings
// /api/owners/requests?status=pending|accepted|cancelled|all
router.get("/requests", requireOwner, async (req, res) => {
  const { status = "pending" } = req.query;
  const params = [req.session.user.id];
  let statusWhere = "";
  if (status !== "all") {
    statusWhere = " AND b.status = ? ";
    params.push(status);
  }

  try {
    // fetch bookings for listings owned by this owner (by owner_mongo_id)
    const [rows] = await pool.query(
      `SELECT b.id, b.status, b.check_in, b.check_out, b.guests, b.total_price, b.created_at, b.user_mongo_id, l.id AS listing_id, l.title
       FROM bookings b
       JOIN listings l ON l.id = b.listing_id
       WHERE l.owner_mongo_id = ? ${statusWhere}
       ORDER BY b.created_at DESC
       LIMIT 200`,
      params
    );

    // fetch user info from Mongo for all unique user_mongo_id
    const userIds = Array.from(new Set(rows.map(r => r.user_mongo_id).filter(Boolean)));
    const users = userIds.length ? await User.find({ _id: { $in: userIds } }).lean() : [];
    const userMap = new Map(users.map(u => [u._id.toString(), u]));

    const out = rows.map(r => {
      const u = userMap.get(String(r.user_mongo_id));
      return {
        id: r.id,
        status: r.status,
        check_in: r.check_in,
        check_out: r.check_out,
        guests: r.guests,
        total_price: r.total_price,
        created_at: r.created_at,
        listing_id: r.listing_id,
        title: r.title,
        guest_name: u ? u.name : null,
        guest_email: u ? u.email : null,
        user_mongo_id: r.user_mongo_id,
      };
    });

    res.json(out);
  } catch (e) {
    console.error("GET /api/owners/requests error:", e);
    res.status(500).json({ error: "server error" });
  }
});

// helper to load booking and confirm ownership (SQL)
async function getOwnerBooking(bid, ownerId) {
  const [rows] = await pool.query(
    `SELECT b.*, l.owner_mongo_id, l.id AS listing_id
     FROM bookings b JOIN listings l ON l.id = b.listing_id
     WHERE b.id = ? AND l.owner_mongo_id = ? LIMIT 1`,
    [Number(bid), ownerId]
  );
  return rows.length ? rows[0] : null;
}

// accept -> set status=accepted if no conflicts (SQL)
router.post("/bookings/:id/accept", requireOwner, async (req, res) => {
  try {
    const bid = Number(req.params.id);
    const ownerId = req.session.user.id;

    const b = await getOwnerBooking(bid, ownerId);
    if (!b) return res.status(404).json({ error: "not found" });
    if (b.status === 'accepted') return res.json({ ok: true, status: 'accepted' });

    // conflict with another accepted booking?
    const [conflict] = await pool.query(
      `SELECT 1 FROM bookings WHERE listing_id = ? AND status = 'accepted' AND id <> ? AND NOT (check_out <= ? OR check_in >= ?) LIMIT 1`,
      [b.listing_id, bid, b.check_in, b.check_out]
    );
    if (conflict.length) return res.status(409).json({ error: 'conflict with another booking' });

    // conflict with blackouts?
    const [confBlack] = await pool.query(
      `SELECT 1 FROM listing_blackouts WHERE listing_id = ? AND NOT (end_date <= ? OR start_date >= ?) LIMIT 1`,
      [b.listing_id, b.check_in, b.check_out]
    );
    if (confBlack.length) return res.status(409).json({ error: 'dates are blacked out' });

    // accept
    await pool.query("UPDATE bookings SET status='accepted' WHERE id=?", [bid]);
    return res.json({ ok: true, status: 'accepted' });
  } catch (e) {
    console.error("POST /api/owners/bookings/:id/accept error:", e);
    res.status(500).json({ error: "server error" });
  }
});



// cancel -> status=cancelled
router.post("/bookings/:id/cancel", requireOwner, async (req, res) => {
  const bid = parseInt(req.params.id, 10);
  const b = await getOwnerBooking(bid, req.session.user.id);
  if (!b) return res.status(404).json({ error: "not found" });
  if (b.status === "cancelled") return res.json({ ok: true });

  await pool.query("UPDATE bookings SET status='cancelled' WHERE id=?", [bid]);
  res.json({ ok: true, status: "cancelled" });
});


// --- approve / reject booking via Kafka ---------------------------------

// APPROVE booking
router.post("/requests/:id/approve", requireOwner, async (req, res) => {
  const bookingId = req.params.id;
  const ownerId = req.session.user.id;

  try {
    await publishStatusUpdate(bookingId, ownerId, "accepted");
    return res.json({ message: "Booking approved (event sent)" });
  } catch (err) {
    console.error("approve booking error:", err);
    return res.status(500).json({ error: "server error" });
  }
});

// REJECT booking
router.post("/requests/:id/reject", requireOwner, async (req, res) => {
  const bookingId = req.params.id;
  const ownerId = req.session.user.id;

  try {
    await publishStatusUpdate(bookingId, ownerId, "rejected");
    return res.json({ message: "Booking rejected (event sent)" });
  } catch (err) {
    console.error("reject booking error:", err);
    return res.status(500).json({ error: "server error" });
  }
});

// reject -> status=rejected (Mongo)
router.post("/bookings/:id/reject", requireOwner, async (req, res) => {
  try {
    const bid = Number(req.params.id);
    const b = await getOwnerBooking(bid, req.session.user.id);
    if (!b) return res.status(404).json({ error: 'not found' });

    await pool.query("UPDATE bookings SET status='rejected' WHERE id=?", [bid]);
    return res.json({ ok: true, status: 'rejected' });
  } catch (e) {
    console.error("POST /api/owners/bookings/:id/reject error:", e);
    res.status(500).json({ error: "server error" });
  }
});

module.exports = router;

