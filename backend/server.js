// server.js
//
// Single entrypoint for the app, mounting all route groups. Extract/chat
// routes are Rihan's (already built, verified against sample data) —
// medication/lab/reminder routes are stubs pending backend's design (see
// the STUB comments in each of those files).
//
// MongoDB connection is attempted but NOT fatal if it fails or
// MONGODB_URI isn't set yet — the routes that actually need Mongo
// (medication/lab/reminder) are all stubs right now anyway, and extraction/
// chat don't touch the database at all. Once backend's real Mongo-backed
// routes land, this should probably become fatal again (see the TODO
// below) so the app doesn't silently run without a DB it actually needs.

require("dotenv").config();
const express = require("express");
const { errorHandler } = require("./middleware/errorHandler");
const { connectDB } = require("./config/mongodb");

const extractRoutes = require("./routes/extractRoutes");
const chatRoutes = require("./routes/chatRoutes");
const medicationRoutes = require("./routes/medicationRoutes");
const labRoutes = require("./routes/labRoutes");
const reminderRoutes = require("./routes/reminderRoutes");

const app = express();
app.use(express.json({ limit: "15mb" })); // base64 images need headroom

app.use("/api", extractRoutes);
app.use("/api", chatRoutes);
app.use("/api", medicationRoutes);
app.use("/api", labRoutes);
app.use("/api", reminderRoutes);

app.get("/health", (req, res) => res.json({ status: "ok" }));

app.use(errorHandler);

const PORT = process.env.PORT || 4001;

if (require.main === module) {
  connectDB()
    .catch((err) => {
      // TODO: make this fatal (process.exit(1)) once medication/lab/reminder
      // routes actually depend on Mongo being up — right now they're stubs,
      // so a missing DB shouldn't block testing extraction/chat.
      console.warn(`MongoDB not connected (${err.message}) — extraction/chat still work, DB-backed routes won't.`);
    })
    .finally(() => {
      app.listen(PORT, () => console.log(`ChronicCare-AI server running on port ${PORT}`));
    });
}

module.exports = app;
