// routes/listings.js
const express = require("express");
const { pool } = require("../db");
const router = express.Router();

// ---- helpers ----
const toYMD = (s) => {
  if (!s) return "";
  const m1 = /^(\d{2})-(\d{2})-(\d{4})$/.exec(s); // DD-MM-YYYY
  if (m1) return `${m1[3]}-${m1[2]}-${m1[1]}`;
  const m2 = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s); // YYYY-MM-DD
  if (m2) return s;
  return "";
};
const validRange = (a, b) => a && b && a < b;

// GET /api/listings?city=&start=DD-MM-YYYY&end=DD-MM-YYYY&guests=1
router.get("/", async (req, res) => {
  try {
    let { city = "", start = "", end = "", guests = "1" } = req.query;

    const startYMD = toYMD(start);
    const endYMD = toYMD(end);
    const hasRange = validRange(startYMD, endYMD);

    const where = ["1=1"];
    const params = [];

    if (city) {
      where.push("(l.city LIKE ? OR l.country LIKE ?)");
      params.push(`%${city}%`, `%${city}%`);
    }

    const guestsNum = parseInt(guests, 10) || 1;
    where.push("l.max_guests >= ?");
    params.push(guestsNum);

    let sql = `
      SELECT
        l.id,
        l.title,
        l.city,
        l.country,
        l.max_guests,
        l.bedrooms,
        l.bathrooms,
        l.price_per_night,
        l.property_type,
        l.amenities,
        l.image_url,
        l.description,
        l.created_at
      FROM listings l
      WHERE ${where.join(" AND ")}
    `;

    if (hasRange) {
      // Exclude if there is ANY accepted booking overlapping [start, end)
      // or ANY owner blackout overlapping the same range
      sql += `
        AND NOT EXISTS (
          SELECT 1
          FROM bookings b
          WHERE b.listing_id = l.id
            AND b.status = 'accepted'
            AND NOT (b.check_out <= ? OR b.check_in >= ?)
        )
        AND NOT EXISTS (
          SELECT 1
          FROM listing_blackouts bo
          WHERE bo.listing_id = l.id
            AND NOT (bo.end_date < ? OR bo.start_date >= ?)
        )
      `;
      params.push(startYMD, endYMD, startYMD, endYMD);
    }

    sql += " ORDER BY l.id DESC LIMIT 100";

    const [rows] = await pool.query(sql, params);
    res.json(rows);
  } catch (e) {
    console.error("GET /api/listings error:", e);
    res.status(500).json({ error: "server error" });
  }
});

// Optional detail endpoint
router.get("/:id", async (req, res) => {
  try {
    const [rows] = await pool.query("SELECT * FROM listings WHERE id = ?", [
      req.params.id,
    ]);
    if (!rows.length) return res.status(404).json({ error: "not found" });
    res.json(rows[0]);
  } catch (e) {
    console.error("GET /api/listings/:id error:", e);
    res.status(500).json({ error: "server error" });
  }
});

module.exports = router;
