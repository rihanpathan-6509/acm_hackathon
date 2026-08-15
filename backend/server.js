// server.js
//
// Main entrypoint for the merged ChronicCare-AI app, mounting all route
// groups. Extract/chat routes are Rihan's (already built, verified against
// sample data) — medication/lab/reminder routes are stubs pending backend's
// design (see the STUB comments in each of those files).
//
// index.js still exists alongside this as the standalone entrypoint for
// testing just the AI/ML slice in isolation (no Mongo dependency); this
// file is the real merged-app entrypoint, gated on a DB connection.

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
    .then(() => {
      app.listen(PORT, () => console.log(`ChronicCare-AI backend running on port ${PORT}`));
    })
    .catch((err) => {
      console.error("Failed to connect to MongoDB:", err.message);
      process.exit(1);
    });
}

module.exports = app;
