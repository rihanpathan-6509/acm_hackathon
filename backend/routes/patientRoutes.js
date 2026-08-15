// routes/patientRoutes.js
const express = require("express");
const router = express.Router();
const patientController = require("../controllers/patientController");

router.post("/patients", patientController.create);
router.get("/patients", patientController.list);

module.exports = router;
