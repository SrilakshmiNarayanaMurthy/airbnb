const express = require("express");
const { body, validationResult } = require("express-validator");
const { pool } = require("../db");
const multer = require("multer");
const path = require("path");

const router = express.Router();

/* ---------- helpers ---------- */
function requireOwner(req, res, next) {
  if (!req.session?.user || req.session.user.role !== "owner") {
    return res.status(403).json({ error: "owner only" });
  }
  next();
}
async function assertOwnership(listingId, ownerId) {
  const [rows] = await pool.query("SELECT id FROM listings WHERE id=? AND owner_id=?", [listingId, ownerId]);
  return rows.length > 0;
}

/* ---------- health ---------- */
router.get("/ping", (_req, res) => res.json({ ok: true }));

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
      const ownerId = req.session.user.id;
      const [r] = await pool.query(
        `INSERT INTO listings
         (owner_id, title, city, country, price_per_night, max_guests, bedrooms, bathrooms, image_url, description, property_type, amenities, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
        [ownerId, title, city, country, price_per_night, max_guests, bedrooms, bathrooms, image_url, description, property_type, amenities]
      );
      res.status(201).json({ id: r.insertId });
    } catch (e) {
      console.error("POST /api/owners/listings error:", e);
      res.status(500).json({ error: "server error" });
    }
  }
);

/* ---------- my listings ---------- */
router.get("/listings", requireOwner, async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT id, title, city, country, price_per_night, max_guests, bedrooms, bathrooms,
              image_url, description, property_type, amenities, created_at
       FROM listings
       WHERE owner_id = ?
       ORDER BY created_at DESC`,
      [req.session.user.id]
    );
    res.json(rows);
  } catch (e) {
    console.error("GET /api/owners/listings error:", e);
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
      WHERE b.id=? AND l.owner_id=?`,
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
    const [rows] = await pool.query(
      `
      SELECT
        b.id, b.status, b.check_in, b.check_out, b.guests, b.total_price, b.created_at,
        l.id AS listing_id, l.title,
        u.name AS guest_name, u.email AS guest_email
      FROM bookings b
      JOIN listings l ON l.id = b.listing_id
      JOIN users u ON u.id = b.user_id
      WHERE l.owner_id = ?
        ${statusWhere}
      ORDER BY b.created_at DESC
      `,
      params
    );
    res.json(rows);
  } catch (e) {
    console.error("GET /api/owners/requests error:", e);
    res.status(500).json({ error: "server error" });
  }
});

// helper to load booking and confirm ownership
async function getOwnerBooking(bid, ownerId) {
  const [rows] = await pool.query(
    `SELECT b.*, l.owner_id
     FROM bookings b
     JOIN listings l ON l.id = b.listing_id
     WHERE b.id = ? AND l.owner_id = ?`,
    [bid, ownerId]
  );
  return rows[0];
}

// accept -> set status=accepted if no conflicts
router.post("/bookings/:id/accept", requireOwner, async (req, res) => {
  const bid = parseInt(req.params.id, 10);
  const b = await getOwnerBooking(bid, req.session.user.id);
  if (!b) return res.status(404).json({ error: "not found" });
  if (b.status === "accepted") return res.json({ ok: true });

  // conflict with another accepted booking?
  const [conf1] = await pool.query(
    `SELECT id FROM bookings
     WHERE listing_id = ?
       AND status = 'accepted'
       AND NOT (check_out <= ? OR check_in >= ?)`,
    [b.listing_id, b.check_in, b.check_out]
  );
  if (conf1.length) return res.status(409).json({ error: "conflict with another booking" });

  // conflict with blackouts?
  const [conf2] = await pool.query(
    `SELECT id FROM listing_blackouts
     WHERE listing_id = ?
       AND NOT (end_date < ? OR start_date >= ?)`,
    [b.listing_id, b.check_in, b.check_out]
  );
  if (conf2.length) return res.status(409).json({ error: "dates are blacked out" });

  await pool.query("UPDATE bookings SET status='accepted' WHERE id=?", [bid]);
  res.json({ ok: true, status: "accepted" });
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


module.exports = router;
