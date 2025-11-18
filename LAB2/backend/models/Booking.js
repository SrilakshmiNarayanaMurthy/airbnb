const mongoose = require("mongoose");

const bookingSchema = new mongoose.Schema(
  {
    listing_id: { type: mongoose.Schema.Types.ObjectId, ref: "Listing" },
    user_id: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    status: { type: String, default: "pending" }, // pending / accepted / rejected
    check_in: Date,
    check_out: Date,
    guests: Number,
    total_price: Number,
  },
  { timestamps: true }
);

module.exports = mongoose.model("Booking", bookingSchema);
