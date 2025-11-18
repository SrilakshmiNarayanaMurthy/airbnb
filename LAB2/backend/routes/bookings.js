// routes/bookings.js
const express = require("express");
const router = express.Router();

const { pool } = require("../db");
const { publishBookingCreated } = require("../kafka/bookingProducer");

// helper: convert dates
const toDate = (s) => {
  if (!s) return null;
  const dmy = /^(\d{2})-(\d{2})-(\d{4})$/.exec(s);
  if (dmy) return new Date(`${dmy[3]}-${dmy[2]}-${dmy[1]}`);
  const ymd = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (ymd) return new Date(s);
  return null;
};

const requireAuth = (req, res, next) => {
  const uid = req.session?.user?.id;
  if (!uid) return res.status(401).json({ error: "login required" });
  next();
};

// Create booking (SQL)
router.post("/", requireAuth, async (req, res) => {
  try {
    // DEBUG: log cookie and session for troubleshooting cross-origin auth
    try {
      console.log('DEBUG booking POST cookies:', req.headers.cookie);
      console.log('DEBUG booking POST session.user:', req.session?.user);
    } catch (e) {
      console.warn('DEBUG logging failed', e);
    }
    const { listing_id, start, end, guests = 1 } = req.body || {};
    const startDate = toDate(start);
    const endDate = toDate(end);
    const userId = req.session.user.id;

    if (!listing_id || !startDate || !endDate || !(startDate < endDate)) {
      return res.status(400).json({ error: "invalid input" });
    }

    // load listing from SQL
    const [listingRows] = await pool.query("SELECT * FROM listings WHERE id = ? LIMIT 1", [Number(listing_id)]);
    if (!listingRows.length) return res.status(404).json({ error: "listing not found" });
    const listing = listingRows[0];

    if (Number(guests) > (listing.max_guests || 0)) {
      return res.status(400).json({ error: "too many guests" });
    }

    const startStr = startDate.toISOString().slice(0,10);
    const endStr = endDate.toISOString().slice(0,10);

    // check conflicts with accepted bookings
    const [conflictB] = await pool.query(
      `SELECT 1 FROM bookings WHERE listing_id = ? AND status = 'accepted' AND NOT (check_out <= ? OR check_in >= ?) LIMIT 1`,
      [Number(listing_id), startStr, endStr]
    );

    // check blackouts
    const [conflictBl] = await pool.query(
      `SELECT 1 FROM listing_blackouts WHERE listing_id = ? AND NOT (end_date <= ? OR start_date >= ?) LIMIT 1`,
      [Number(listing_id), startStr, endStr]
    );

    if (conflictB.length || conflictBl.length) {
      return res.status(409).json({ error: "dates not available (booked/blackout)" });
    }

    const msPerDay = 1000 * 60 * 60 * 24;
    const nights = Math.max(0, Math.round((endDate - startDate) / msPerDay));
    const totalPrice = nights * (Number(listing.price_per_night) || 0);

    const [ins] = await pool.query(
      `INSERT INTO bookings (listing_id, user_mongo_id, status, check_in, check_out, guests, total_price) VALUES (?, ?, 'pending', ?, ?, ?, ?)`,
      [Number(listing_id), userId, startStr, endStr, Number(guests), totalPrice]
    );

    const bookingId = ins.insertId;

    const bookingEvent = {
      id: String(bookingId),
      travelerId: userId,
      ownerId: listing.owner_mongo_id || null,
      propertyId: String(listing.id),
      status: 'pending',
      totalPrice,
      checkIn: startDate.toISOString(),
      checkOut: endDate.toISOString(),
      guests: Number(guests),
      createdAt: new Date().toISOString(),
    };

    publishBookingCreated(bookingEvent).catch(err => console.error('[Kafka] publish error', err.message || err));

    res.status(201).json({ id: bookingId, nights, total_price: totalPrice, status: 'pending' });
  } catch (e) {
    console.error('POST /api/bookings error:', e);
    res.status(500).json({ error: 'server error' });
  }
});

// my bookings
router.get('/my', requireAuth, async (req, res) => {
  try {
    const userId = req.session.user.id;
    const [rows] = await pool.query(
      `SELECT b.id AS booking_id, b.status, b.check_in, b.check_out, b.guests, b.total_price, l.id AS listing_id, l.title, l.city, l.country, l.image_url, l.price_per_night
       FROM bookings b JOIN listings l ON l.id = b.listing_id
       WHERE b.user_mongo_id = ?
       ORDER BY b.created_at DESC LIMIT 200`,
      [userId]
    );

    const msPerDay = 1000 * 60 * 60 * 24;
    const out = rows.map(r => ({
      booking_id: r.booking_id,
      status: r.status,
      check_in: r.check_in,
      check_out: r.check_out,
      guests: r.guests,
      total_price: r.total_price,
      nights: Math.max(0, Math.round((new Date(r.check_out) - new Date(r.check_in)) / msPerDay)),
      listing_id: r.listing_id,
      title: r.title,
      city: r.city,
      country: r.country,
      image_url: r.image_url,
      price_per_night: r.price_per_night,
    }));

    res.json(out);
  } catch (e) {
    console.error('GET /api/bookings/my error:', e);
    res.status(500).json({ error: 'server error' });
  }
});

// history
router.get('/history', requireAuth, async (req, res) => {
  try {
    const userId = req.session.user.id;
    const [rows] = await pool.query(
      `SELECT b.id AS booking_id, b.check_in, b.check_out, b.guests, b.total_price, l.id AS listing_id, l.title, l.city, l.country, l.bedrooms, l.bathrooms, l.price_per_night, l.image_url, l.description
       FROM bookings b
       JOIN listings l ON l.id = b.listing_id
       WHERE b.user_mongo_id = ? AND b.check_out < CURDATE()
       ORDER BY b.check_in DESC LIMIT 200`,
      [userId]
    );

    const msPerDay = 1000 * 60 * 60 * 24;
    const out = rows.map(r => ({
      booking_id: r.booking_id,
      check_in: r.check_in,
      check_out: r.check_out,
      guests: r.guests,
      total_price: r.total_price,
      nights: Math.max(0, Math.round((new Date(r.check_out) - new Date(r.check_in)) / msPerDay)),
      listing_id: r.listing_id,
      title: r.title,
      city: r.city,
      country: r.country,
      bedrooms: r.bedrooms,
      bathrooms: r.bathrooms,
      price_per_night: r.price_per_night,
      image_url: r.image_url,
      description: r.description,
    }));

    res.json(out);
  } catch (e) {
    console.error('GET /api/bookings/history error:', e);
    res.status(500).json({ error: 'server error' });
  }
});

module.exports = router;
