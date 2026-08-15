// routes/reminderRoutes.js
const express = require("express");
const router = express.Router();
const reminderController = require("../controllers/reminderController");

router.get("/reminders/:patientId", reminderController.listForPatient);
router.patch("/reminders/:id/taken", reminderController.markTaken);
router.patch("/reminders/:id/deactivate", reminderController.deactivate);

module.exports = router;
