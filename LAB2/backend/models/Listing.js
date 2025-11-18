const mongoose = require("mongoose");

const listingSchema = new mongoose.Schema(
  {
    owner_id: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    title: String,
    description: String,
    city: String,
    country: String,
    price_per_night: Number,
    max_guests: Number,
    bedrooms: Number,
    bathrooms: Number,
    image_url: String,
  },
  { timestamps: true }
);

module.exports = mongoose.model("Listing", listingSchema);
