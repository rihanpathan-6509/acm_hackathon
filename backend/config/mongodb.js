// config/mongodb.js
//
// MongoDB connection setup. Generic Mongoose boilerplate — the actual
// schema design (models/) and connection preferences are backend's call
// (Sarhak & Sufiyaan), not mine. Adjust MONGODB_URI / connection options to
// whatever you're actually running.

const mongoose = require("mongoose");

async function connectDB() {
  if (!process.env.MONGODB_URI) {
    throw new Error(
      "MONGODB_URI is missing. Add it to your .env before starting the server."
    );
  }
  await mongoose.connect(process.env.MONGODB_URI);
  console.log("MongoDB connected");
}

module.exports = { connectDB };
