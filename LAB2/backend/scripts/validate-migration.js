// Simple validation script to check Mongo and SQL schema presence
const mongoose = require("mongoose");
const connectMongo = require("../mongo");
const { pool } = require("../db");

async function run() {
  try {
    console.log("Checking MongoDB connection...");
    await connectMongo();

    console.log("Connected to Mongo — checking users collection...");
    const colInfo = await mongoose.connection.db.listCollections({ name: "users" }).toArray();
    console.log("users collection present:", colInfo.length === 1);

    console.log("Checking SQL tables...");
    const [tables] = await pool.query("SHOW TABLES");
    const names = tables.map(r => Object.values(r)[0]);
    console.log("SQL tables:", names);

    const required = ["listings", "bookings", "listing_blackouts", "listing_photos", "favorites"];
    for (const t of required) {
      console.log(t, names.includes(t) ? "OK" : "MISSING");
    }

    console.log("Validation complete.");
    process.exit(0);
  } catch (e) {
    console.error("Validation failed:", e.message || e);
    process.exit(2);
  }
}

if (require.main === module) run();
