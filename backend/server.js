// server.js
//
// Single entrypoint for the app, mounting all route groups. Extraction,
// chat, patient, medication, lab, and reminder are all real now — Mongo is
// wired up (config/mongodb.js, MONGODB_URI in .env) and the connection is
// fatal on failure, since medication/lab/reminder genuinely depend on it.

require("dotenv").config();
const express = require("express");
const cors = require("cors");
const { errorHandler } = require("./middleware/errorHandler");
const { connectDB } = require("./config/mongodb");

const extractRoutes = require("./routes/extractRoutes");
const chatRoutes = require("./routes/chatRoutes");
const patientRoutes = require("./routes/patientRoutes");
const medicationRoutes = require("./routes/medicationRoutes");
const labRoutes = require("./routes/labRoutes");
const reminderRoutes = require("./routes/reminderRoutes");

const app = express();

// Without this, every request from the frontend (a different origin —
// Vite dev server on :5173, or wherever it's deployed) gets silently
// blocked by the browser before it even reaches these routes. Comma-
// separated FRONTEND_URLS in .env for prod; localhost Vite ports covered
// by default for local dev.
const allowedOrigins = (process.env.FRONTEND_URLS || "http://localhost:5173,http://localhost:5174")
  .split(",")
  .map((origin) => origin.trim());
app.use(cors({ origin: allowedOrigins }));

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
      const server = app.listen(PORT, () =>
        console.log(`ChronicCare-AI server running on port ${PORT}`)
      );

      // Without this, a port collision prints a raw "Unhandled 'error'
      // event" stack trace that buries the one line that matters. Usually
      // it just means an older server is still running in another terminal.
      server.on("error", (err) => {
        if (err.code === "EADDRINUSE") {
          console.error(
            `\nPort ${PORT} is already in use — an older server is probably still running.\n` +
              `Stop it with Ctrl+C in its terminal, or free the port:\n` +
              `  Windows:  npx kill-port ${PORT}\n` +
              `  Or run this one elsewhere:  PORT=4002 npm start\n`
          );
        } else {
          console.error(`Server failed to start: ${err.message}`);
        }
        process.exit(1);
      });
    })
    .catch((err) => {
      console.error(`Failed to connect to MongoDB: ${err.message}`);
      process.exit(1);
    });
}

module.exports = app;
