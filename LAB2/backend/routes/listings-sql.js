const express = require("express");
const router = express.Router();
const { pool } = require("../db");

// requireOwner middleware (uses session.user.role)
function requireOwner(req, res, next) {
  if (!req.session?.user || req.session.user.role !== "owner") {
    return res.status(403).json({ error: "owner only" });
  }
  next();
}

// Ensure listings table exists (minimal schema for lab)
(async () => {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS listings (
        id INT AUTO_INCREMENT PRIMARY KEY,
        owner_mongo_id VARCHAR(24) NOT NULL,
        title VARCHAR(255) NOT NULL,
        description TEXT,
        price_per_night DECIMAL(10,2) DEFAULT 0,
        max_guests INT DEFAULT 1,
        bedrooms INT DEFAULT 0,
        bathrooms INT DEFAULT 0,
        city VARCHAR(100),
        country VARCHAR(100),
        image_url VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB;
    `);
    console.log("✅ SQL listings table ready");
  } catch (e) {
    console.error("Failed to ensure listings table:", e.message || e);
  }
})();

// Create listing (owners create)
// POST /api/listings
router.post("/", requireOwner, async (req, res) => {
  try {
    const ownerMongoId = req.session.user?.id || req.session.user?._id;
    if (!ownerMongoId) return res.status(401).json({ error: "not logged in" });

    const {
      title,
      description = "",
      price_per_night = 0,
      max_guests = 1,
      bedrooms = 0,
      bathrooms = 0,
      city = "",
      country = "",
      image_url = "",
    } = req.body || {};

    if (!title) {
      return res.status(400).json({ error: "title required" });
    }

    const [result] = await pool.query(
      `INSERT INTO listings (owner_mongo_id, title, description, price_per_night, max_guests, bedrooms, bathrooms, city, country, image_url)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        ownerMongoId,
        title,
        description,
        Number(price_per_night) || 0,
        Number(max_guests) || 1,
        Number(bedrooms) || 0,
        Number(bathrooms) || 0,
        city,
        country,
        image_url,
      ]
    );

    res.status(201).json({ id: result.insertId, owner_mongo_id: ownerMongoId });
  } catch (e) {
    console.error("POST /api/listings (SQL) error:", e);
    res.status(500).json({ error: "server error" });
  }
});

// List listings (supports search + availability)
router.get("/", async (req, res) => {
  try {
    // support query params: city, start (YYYY-MM-DD), end (YYYY-MM-DD), guests
    const { city = "", start = "", end = "", guests = "1" } = req.query || {};
    const guestsNum = Number(guests) || 1;

    // basic filters
    const params = [guestsNum];
    let where = ` WHERE max_guests >= ? `;

    if (city) {
      where += ` AND (city LIKE ? OR country LIKE ?) `;
      params.push(`%${city}%`, `%${city}%`);
    }

    // If start/end provided and valid, exclude listings with accepted bookings or blackouts overlapping the range
    let dateFilter = "";
    if (start && end && start < end) {
      // for comparisons we use DATE strings (YYYY-MM-DD)
      // exclude listings with accepted bookings that overlap: NOT (b.check_out <= start OR b.check_in >= end)
      dateFilter = ` AND NOT EXISTS (
          SELECT 1 FROM bookings b WHERE b.listing_id = listings.id AND b.status = 'accepted' AND NOT (b.check_out <= ? OR b.check_in >= ?)
        ) AND NOT EXISTS (
          SELECT 1 FROM listing_blackouts bl WHERE bl.listing_id = listings.id AND NOT (bl.end_date <= ? OR bl.start_date >= ?)
        )`;
      params.push(start, end, start, end);
    }

    const sql = `SELECT id, owner_mongo_id, title, description, price_per_night, max_guests, bedrooms, bathrooms, city, country, image_url, property_type, amenities, created_at
       FROM listings ${where} ${dateFilter}
       ORDER BY created_at DESC
       LIMIT 200`;

    const [rows] = await pool.query(sql, params);
    res.json(rows);
  } catch (e) {
    console.error("GET /api/listings (SQL) error:", e);
    res.status(500).json({ error: "server error" });
  }
});

// GET /api/listings/:id
router.get("/:id", async (req, res) => {
  try {
    const id = Number(req.params.id) || 0;
    const [rows] = await pool.query(`SELECT * FROM listings WHERE id = ? LIMIT 1`, [id]);
    if (!rows.length) return res.status(404).json({ error: "not found" });
    res.json(rows[0]);
  } catch (e) {
    console.error("GET /api/listings/:id (SQL) error:", e);
    res.status(500).json({ error: "server error" });
  }
});

module.exports = router;
