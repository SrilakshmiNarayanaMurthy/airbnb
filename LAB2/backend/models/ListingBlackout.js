const mongoose = require("mongoose");

const listingBlackoutSchema = new mongoose.Schema(
  {
    listing_id: { type: mongoose.Schema.Types.ObjectId, ref: "Listing" },
    start: Date,
    end: Date,
  },
  { timestamps: true }
);

module.exports = mongoose.model("ListingBlackout", listingBlackoutSchema);
