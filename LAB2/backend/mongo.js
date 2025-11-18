// backend/mongo.js
const mongoose = require("mongoose");

async function connectMongo() {
  await mongoose.connect(process.env.MONGO_URL, {
    dbName: "airbnb_lab",
  });

  console.log("✅ MongoDB connected");
}

module.exports = connectMongo;
