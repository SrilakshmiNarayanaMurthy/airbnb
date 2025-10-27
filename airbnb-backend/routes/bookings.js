// routes/bookings.js
const express = require("express"); //Brings in Express, your DB connection pool, and creates a sub-router that you’ll mount
const { pool } = require("../db");
const router = express.Router();

// --- helpers ------------------------------------------------------
//accepts date string from client
// convert "DD-MM-YYYY" -> "YYYY-MM-DD" (keeps YYYY-MM-DD as-is)
const toYMD = (s) => {
  if (!s) return "";
  const m1 = /^(\d{2})-(\d{2})-(\d{4})$/.exec(s);
  if (m1) return `${m1[3]}-${m1[2]}-${m1[1]}`;
  const m2 = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (m2) return s;
  return "";
};

const requireAuth = (req, res, next) => {
  const uid = req.session?.user?.id;
  if (!uid) return res.status(401).json({ error: "login required" });
  next();
};

// --- create booking (pending) -------------------------------------
// body: { listing_id, start, end, guests }
router.post("/", requireAuth, async (req, res) => {
  try {
    const { listing_id, start, end, guests = 1 } = req.body || {};
    const startY = toYMD(start);
    const endY   = toYMD(end);
    const userId = req.session.user.id;
    //needs listing, dates
    if (!listing_id || !startY || !endY || !(startY < endY)) {
      return res.status(400).json({ error: "invalid input" });
    }
    // Ensures listing exists from DB
    // 1) listing + capacity
    const [[listing]] = await pool.query(
      "SELECT id, max_guests FROM listings WHERE id = ?",
      [listing_id]
    );
    if (!listing) return res.status(404).json({ error: "listing not found" });
    if (Number(guests) > listing.max_guests) {
      return res.status(400).json({ error: "too many guests" });
    }

    // 2) conflict with ACCEPTED bookings only
    const [confBookings] = await pool.query(
      `SELECT 1 FROM bookings
       WHERE listing_id = ?
         AND status = 'accepted'
         AND NOT (check_out <= ? OR check_in >= ?)
       LIMIT 1`,
      [listing_id, startY, endY]
    );
    if (confBookings.length) {
      return res.status(409).json({ error: "dates not available (booked)" });
    }

    // 3) conflict with owner blackouts
    const [confBlackouts] = await pool.query(
      `SELECT 1 FROM listing_blackouts
       WHERE listing_id = ?
         AND NOT (end_date < ? OR start_date >= ?)
       LIMIT 1`,
      [listing_id, startY, endY]
    );
    if (confBlackouts.length) {
      return res.status(409).json({ error: "dates not available (blackout)" });
    }

    // 4) insert pending; compute price in SQL
    const sql = `
      INSERT INTO bookings (listing_id, user_id, check_in, check_out, guests, total_price, status)
      SELECT
        ?, ?, ?, ?, ?, DATEDIFF(?, ?) * l.price_per_night, 'pending'
      FROM listings l
      WHERE l.id = ?
    `;
    const params = [listing_id, userId, startY, endY, guests, endY, startY, listing_id];
    const [ins] = await pool.query(sql, params);
    //Computing total
    // 5) return computed values
    const [[calc]] = await pool.query(
      `SELECT GREATEST(DATEDIFF(?, ?),0) AS nights,
              (DATEDIFF(?, ?) * price_per_night) AS total_price
       FROM listings WHERE id=?`,
      [endY, startY, endY, startY, listing_id]
    );

    res.status(201).json({
      id: ins.insertId,
      nights: Number(calc.nights) || 0,
      total_price: Number(calc.total_price) || 0,
      status: "pending",
    });
  } catch (e) {
    console.error("POST /api/bookings error:", e);
    res.status(500).json({ error: "server error" });
  }
});

// --- my bookings for traveler (all statuses) ----------------------
router.get("/my", requireAuth, async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT
         b.id                         AS booking_id,
         b.status,
         b.check_in,
         b.check_out,
         b.guests,
         b.total_price,
         DATEDIFF(b.check_out, b.check_in) AS nights,
         l.id                         AS listing_id,
         l.title,
         l.city,
         l.country,
         l.image_url,
         l.price_per_night
       FROM bookings b
       JOIN listings l ON l.id = b.listing_id
       WHERE b.user_id = ?
       ORDER BY b.created_at DESC`,
      [req.session.user.id]
    );
    res.json(rows);
  } catch (e) {
    console.error("GET /api/bookings/my error:", e);
    res.status(500).json({ error: "server error" });
  }
});

// --- past trips (already used on History earlier) -----------------
router.get("/history", requireAuth, async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT
         b.id            AS booking_id,
         b.check_in,
         b.check_out,
         b.guests,
         b.total_price,
         DATEDIFF(b.check_out, b.check_in) AS nights,
         l.id            AS listing_id,
         l.title,
         l.city,
         l.country,
         l.bedrooms,
         l.bathrooms,
         l.price_per_night,
         l.image_url,
         l.description
       FROM bookings b
       JOIN listings l ON l.id = b.listing_id
       WHERE b.user_id = ? AND b.check_out < CURDATE()
       ORDER BY b.check_in DESC`,
      [req.session.user.id]
    );
    res.json(rows);
  } catch (e) {
    console.error("GET /api/bookings/history error:", e);
    res.status(500).json({ error: "server error" });
  }
});

module.exports = router;
