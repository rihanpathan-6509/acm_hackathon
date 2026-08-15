// routes/extractRoutes.js
const express = require("express");
const router = express.Router();
const { handleExtract } = require("../controllers/extractController");

router.post("/extract", handleExtract);

module.exports = router;
