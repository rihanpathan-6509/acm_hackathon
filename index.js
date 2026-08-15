// index.js
//
// Standalone entrypoint so this slice can be run and tested on its own
// before it's wired into the team's main Express app. Sarhak & Sufiyaan
// will likely mount extractRoutes/chatRoutes into the main app instead of
// running this file directly — check with them before demo day.

require("dotenv").config();
const express = require("express");
const extractRoutes = require("./routes/extractRoutes");
const chatRoutes = require("./routes/chatRoutes");

const app = express();
app.use(express.json({ limit: "15mb" })); // base64 images need headroom

app.use("/api", extractRoutes);
app.use("/api", chatRoutes);

app.get("/health", (req, res) => res.json({ status: "ok" }));

const PORT = process.env.PORT || 4001;
app.listen(PORT, () => {
  console.log(`Rihan's AI/ML slice running standalone on port ${PORT}`);
});
