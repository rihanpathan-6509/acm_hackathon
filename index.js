// index.js
//
// Standalone entrypoint so extraction/chat can be run and tested without a
// MongoDB connection — server.js (the real merged-app entrypoint, under
// backend/) requires one to boot at all. Kept at root deliberately, outside
// the backend/ tree, since it isn't part of the merged app's own structure.

require("dotenv").config();
const express = require("express");
const extractRoutes = require("./backend/routes/extractRoutes");
const chatRoutes = require("./backend/routes/chatRoutes");

const app = express();
app.use(express.json({ limit: "15mb" })); // base64 images need headroom

app.use("/api", extractRoutes);
app.use("/api", chatRoutes);

app.get("/health", (req, res) => res.json({ status: "ok" }));

const PORT = process.env.PORT || 4001;
app.listen(PORT, () => {
  console.log(`Rihan's AI/ML slice running standalone on port ${PORT}`);
});
