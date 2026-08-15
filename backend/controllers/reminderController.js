// controllers/reminderController.js
//
// Reminder read/update. Reminders are created by
// services/reminderService.scheduleReminders(), called from
// medicationController.create — not created directly through this
// controller.

const Reminder = require("../models/reminderModel");

async function listForPatient(req, res, next) {
  try {
    const { patientId } = req.params;
    const reminders = await Reminder.find({ patientId, active: true }).sort({ scheduledTime: 1 });
    res.json({ reminders });
  } catch (err) {
    next(err);
  }
}

async function markTaken(req, res, next) {
  try {
    const { id } = req.params;
    const reminder = await Reminder.findByIdAndUpdate(id, { lastSentAt: new Date() }, { new: true });
    if (!reminder) return res.status(404).json({ error: "Reminder not found." });
    res.json({ reminder });
  } catch (err) {
    next(err);
  }
}

async function deactivate(req, res, next) {
  try {
    const { id } = req.params;
    const reminder = await Reminder.findByIdAndUpdate(id, { active: false }, { new: true });
    if (!reminder) return res.status(404).json({ error: "Reminder not found." });
    res.json({ reminder });
  } catch (err) {
    next(err);
  }
}

module.exports = { listForPatient, markTaken, deactivate };
