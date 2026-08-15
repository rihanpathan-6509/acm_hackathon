// routes/labRoutes.js
const express = require("express");
const router = express.Router();
const labController = require("../controllers/labController");

router.post("/labs", labController.createMany);
router.get("/labs/:patientId", labController.listForPatient); // optional ?markerKey= filter

module.exports = router;
