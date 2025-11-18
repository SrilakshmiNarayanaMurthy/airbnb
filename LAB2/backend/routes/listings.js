// routes/listings.js
const express = require("express");
const router = express.Router();

const Listing = require("../models/Listing");
const Booking = require("../models/Booking");
const ListingBlackout = require("../models/ListingBlackout");

// ---- helpers ----

// convert DD-MM-YYYY or YYYY-MM-DD → YYYY-MM-DD
function toYMD(s) {
  if (!s) return "";
  const m1 = /^(\d{2})-(\d{2})-(\d{4})$/.exec(s); // DD-MM-YYYY
  if (m1) return `${m1[3]}-${m1[2]}-${m1[1]}`;
  const m2 = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s); // YYYY-MM-DD
  if (m2) return s;
  return "";
}

function validRange(a, b) {
  return a && b && a < b;
}

function requireOwner(req, res, next) {
  if (!req.session?.user || req.session.user.role !== "owner") {
    return res.status(403).json({ error: "owner only" });
  }
  next();
}

// ------------- CREATE LISTING (Mongo) -------------
// POST /api/listings  (owners create)
router.post("/", requireOwner, async (req, res) => {
  try {
    const {
      title,
      description,
      price_per_night,
      max_guests,
      bedrooms,
      bathrooms,
      city,
      country,
      image_url,
      property_type,
      amenities,
    } = req.body || {};

    if (!title || !price_per_night || !max_guests) {
      return res
        .status(400)
        .json({ error: "title, price_per_night, max_guests required" });
    }

    const listing = await Listing.create({
      owner_id: req.session.user._id,           // ✅ owner from Mongo session
      title,
      description: description || "",
      price_per_night: Number(price_per_night),
      max_guests: Number(max_guests),
      bedrooms: Number(bedrooms) || 0,
      bathrooms: Number(bathrooms) || 0,
      city: city || "",
      country: country || "",
      image_url: image_url || "",
      property_type: property_type || "apartment",
      amenities: Array.isArray(amenities)
        ? amenities
        : typeof amenities === "string" && amenities.length
        ? amenities.split(",").map((a) => a.trim())
        : [],
    });

    res.status(201).json(listing);
  } catch (e) {
    console.error("POST /api/listings error:", e);
    res.status(500).json({ error: "server error" });
  }
});

// ------------- SEARCH LISTINGS (Mongo) -------------
// GET /api/listings?city=&start=&end=&guests=
router.get("/", async (req, res) => {
  try {
    let { city = "", start = "", end = "", guests = "1" } = req.query;

    const startYMD = toYMD(start);
    const endYMD = toYMD(end);
    const hasRange = validRange(startYMD, endYMD);

    const guestsNum = parseInt(guests, 10) || 1;

    // base Mongo filter
    const filter = {
      max_guests: { $gte: guestsNum },
    };

    if (city) {
      const regex = new RegExp(city, "i");
      filter.$or = [{ city: regex }, { country: regex }];
    }

    // first pull candidates
    let candidates = await Listing.find(filter)
      .sort({ createdAt: -1 })
      .limit(100)
      .lean();

    // if no date range, just return candidates
    if (!hasRange) {
      return res.json(candidates);
    }

    // exclude listings that have:
    //  - an accepted booking overlapping [startYMD, endYMD)
    //  - OR a blackout overlapping the same range
    const [startStr, endStr] = [startYMD, endYMD];

    const available = [];
    for (const l of candidates) {
      const hasBooking = await Booking.exists({
        listing_id: l._id,
        status: "accepted",
        // overlap condition: NOT (check_out <= start OR check_in >= end)
        check_in: { $lt: endStr },
        check_out: { $gt: startStr },
      });

      if (hasBooking) continue;

      const hasBlackout = await ListingBlackout.exists({
        listing_id: l._id,
        start_date: { $lt: endStr },
        end_date: { $gt: startStr },
      });

      if (hasBlackout) continue;

      available.push(l);
    }

    res.json(available);
  } catch (e) {
    console.error("GET /api/listings error:", e);
    res.status(500).json({ error: "server error" });
  }
});

// ------------- DETAIL (Mongo) -------------
// GET /api/listings/:id
router.get("/:id", async (req, res) => {
  try {
    const listing = await Listing.findById(req.params.id).lean();
    if (!listing) return res.status(404).json({ error: "not found" });
    res.json(listing);
  } catch (e) {
    console.error("GET /api/listings/:id error:", e);
    res.status(500).json({ error: "server error" });
  }
});

module.exports = router;
