// server.js
//
// Single entrypoint for the app, mounting all route groups. Extraction,
// chat, patient, medication, lab, and reminder are all real now — Mongo is
// wired up (config/mongodb.js, MONGODB_URI in .env) and the connection is
// fatal on failure, since medication/lab/reminder genuinely depend on it.

require("dotenv").config();
const express = require("express");
const { errorHandler } = require("./middleware/errorHandler");
const { connectDB } = require("./config/mongodb");

const extractRoutes = require("./routes/extractRoutes");
const chatRoutes = require("./routes/chatRoutes");
const patientRoutes = require("./routes/patientRoutes");
const medicationRoutes = require("./routes/medicationRoutes");
const labRoutes = require("./routes/labRoutes");
const reminderRoutes = require("./routes/reminderRoutes");

const app = express();
// 25MB: patients upload both photos and PDFs (multi-page lab reports can be
// sizable), and base64 encoding inflates the original file size by ~33%.
app.use(express.json({ limit: "25mb" }));

app.use("/api", extractRoutes);
app.use("/api", chatRoutes);
app.use("/api", patientRoutes);
app.use("/api", medicationRoutes);
app.use("/api", labRoutes);
app.use("/api", reminderRoutes);

app.get("/health", (req, res) => res.json({ status: "ok" }));

app.use(errorHandler);

const PORT = process.env.PORT || 4001;

if (require.main === module) {
  connectDB()
    .then(() => {
      app.listen(PORT, () => console.log(`ChronicCare-AI server running on port ${PORT}`));
    })
    .catch((err) => {
      console.error(`Failed to connect to MongoDB: ${err.message}`);
      process.exit(1);
    });
}

module.exports = app;
