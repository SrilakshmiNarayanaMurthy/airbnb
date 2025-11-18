require("dotenv").config();
const express = require("express");
const session = require("express-session");
const cors = require("cors");
const authRoutes = require("./routes/auth");
const path = require("path");
const listingRoutes = require("./routes/listings-sql");
const bookingRoutes = require("./routes/bookings");
const favoriteRoutes = require("./routes/favorites");
const ownerRoutes = require("./routes/owners");
const { startBookingConsumer } = require("./kafka/bookingConsumer");  //kafka

const { startStatusConsumer } = require("./kafka/bookingStatusConsumer");
const app = express();
const connectMongo = require("./mongo");
const MongoStore = require("connect-mongo");
const initSqlSchema = require("./sql-schema");



app.use("/uploads", express.static(path.join(__dirname, "uploads")));


// Allow frontend at localhost:5173
// Allow frontend origins during development. Use FRONTEND_ORIGINS env to override (comma-separated).
const allowedFrontend = (process.env.FRONTEND_ORIGINS || "http://localhost:5173,http://localhost:5174").split(",").map(s => s.trim());
app.use(cors({
  origin: function(origin, cb) {
    // allow non-browser tools (no origin) and allowed frontend origins
    if (!origin) return cb(null, true);
    if (allowedFrontend.indexOf(origin) !== -1) return cb(null, true);
    return cb(new Error('Not allowed by CORS'));
  },
  credentials: true,
}));

app.use(express.json());

// serve uploaded images  <— ADD THIS HERE
app.use("/uploads", express.static(path.join(__dirname, "uploads")));
// Session middleware
app.use(
  session({
    secret: process.env.SESSION_SECRET || "secret-key",
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({
      mongoUrl: process.env.MONGO_URL,
      dbName: "airbnb_lab"
    }),
    cookie: {
      maxAge: 1000 * 60 * 60 * 24,
      // In development we use the Vite proxy so API calls are same-site —
      // set SameSite to 'lax' to allow cookie on top-level navigations and XHR/fetch from same site.
      // SameSite=None requires Secure in modern browsers, which breaks plain HTTP dev flows.
      sameSite: process.env.NODE_ENV === 'production' ? 'lax' : 'lax',
      secure: process.env.NODE_ENV === 'production',
      httpOnly: true,
    }
  })
);

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

// Start Kafka consumer (Owner service side)
startBookingConsumer().catch((err) => {
  console.error("[Kafka] Consumer failed to start:", err.message);
});
startStatusConsumer();
connectMongo();
// ensure SQL schema (create tables if missing)
initSqlSchema().catch((err) => {
  console.error("SQL schema init failed:", err.message || err);
  // do not exit; allow server to start but many endpoints will fail without DB
});

app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));

