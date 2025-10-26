// routes/bookings.js
const express = require("express");
const { pool } = require("../db");
const router = express.Router();

// convert "DD-MM-YYYY" → "YYYY-MM-DD" (accepts YYYY-MM-DD as-is)
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

// ---------- CREATE BOOKING (computes total_price in SQL) ----------
router.post("/", requireAuth, async (req, res) => {
  try {
    const { listing_id, start, end, guests = 1 } = req.body || {};
    const startY = toYMD(start);
    const endY   = toYMD(end);
    const userId = req.session.user.id;

    if (!listing_id || !startY || !endY || !(startY < endY)) {
      return res.status(400).json({ error: "invalid input" });
    }

    // 1) check listing + capacity
    const [[listing]] = await pool.query(
      "SELECT id, max_guests FROM listings WHERE id = ?",
      [listing_id]
    );
    if (!listing) return res.status(404).json({ error: "listing not found" });
    if (Number(guests) > listing.max_guests) {
      return res.status(400).json({ error: "too many guests" });
    }

    // 2) date conflict check
    const [conflict] = await pool.query(
      `SELECT 1 FROM bookings
       WHERE listing_id = ?
         AND NOT (check_out <= ? OR check_in >= ?)
       LIMIT 1`,
      [listing_id, startY, endY]
    );
    if (conflict.length) return res.status(409).json({ error: "dates not available" });

    // 3) insert using SQL-calculated price (DATEDIFF * price_per_night)
    // DATEDIFF(end, start) returns nights (end is exclusive)
    const sql = `
      INSERT INTO bookings (listing_id, user_id, check_in, check_out, guests, total_price)
      SELECT
        ?, ?, ?, ?, ?, DATEDIFF(?, ?) * l.price_per_night
      FROM listings l
      WHERE l.id = ?
    `;
    const params = [listing_id, userId, startY, endY, guests, endY, startY, listing_id];
    await pool.query(sql, params);

    // return computed numbers to the client for confirmation
    const [[calc]] = await pool.query(
      "SELECT DATEDIFF(?, ?) AS nights, (DATEDIFF(?, ?) * price_per_night) AS total_price FROM listings WHERE id=?",
      [endY, startY, endY, startY, listing_id]
    );

    console.log("BOOKED:", {
      listing_id, user_id: userId, nights: calc.nights, total_price: calc.total_price
    });

    res.json({ ok: true, nights: calc.nights, total_price: Number(calc.total_price) });
  } catch (e) {
    console.error("POST /api/bookings error:", e);
    res.status(500).json({ error: "server error" });
  }
});

// --- (optional) debug: see db + columns ---
// router.get("/debug", async (_req, res) => {
//   const [[db]] = await pool.query("SELECT DATABASE() AS db");
//   const [cols] = await pool.query("SHOW COLUMNS FROM bookings");
//   res.json({ db: db.db, columns: cols.map(c => c.Field) });
// });
// GET /api/bookings/history  – past trips for the logged-in user
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

