// routes/medicationRoutes.js
const express = require("express");
const router = express.Router();
const medicationController = require("../controllers/medicationController");

router.post("/medications", medicationController.create);
router.get("/medications/:patientId", medicationController.listForPatient);
router.patch("/medications/:id", medicationController.update);
router.delete("/medications/:id", medicationController.remove);

module.exports = router;
