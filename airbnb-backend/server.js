require("dotenv").config();
const express = require("express");
const session = require("express-session");
const cors = require("cors");
const authRoutes = require("./routes/auth");
const path = require("path");
const listingRoutes = require("./routes/listings");
const bookingRoutes = require("./routes/bookings");
const favoriteRoutes = require("./routes/favorites");
const ownerRoutes = require("./routes/owners");
const app = express();



// Allow frontend at localhost:5173
app.use(cors({
  origin: "http://localhost:5173",
  credentials: true,
}));

app.use(express.json());

// serve uploaded images  <— ADD THIS HERE
app.use("/uploads", express.static(path.join(__dirname, "uploads")));
// Session middleware
app.use(session({
  secret: process.env.SESSION_SECRET || "secret-key",
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false }, // set true in production with HTTPS
}));

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/listings", listingRoutes);
app.use("/api/bookings", bookingRoutes);
app.use("/api/favorites", favoriteRoutes);
app.use("/api/owners", ownerRoutes);
// Test route
app.get("/", (req, res) => {
  res.send("Backend is running");
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));

