// controllers/reminderController.js
//
// Reminder CRUD. Most reminders are created by
// services/reminderService.scheduleReminders() (called from
// medicationController.create) — but `create` here also supports
// standalone reminders the patient adds directly (not tied to any
// medication, e.g. "take a walk" or "check blood pressure"), and `update`
// lets a patient personalize a time instead of living with the default.

const Reminder = require("../models/reminderModel");
const { TIME_FORMAT } = require("../services/reminderService");

async function listForPatient(req, res, next) {
  try {
    const { patientId } = req.params;
    const reminders = await Reminder.find({ patientId, active: true }).sort({ scheduledTime: 1 });
    res.json({ reminders });
  } catch (err) {
    next(err);
  }
}

async function create(req, res, next) {
  try {
    const { patientId, label, scheduledTime, instructions } = req.body;

    if (!patientId || !label || !scheduledTime) {
      return res.status(400).json({ error: "patientId, label, and scheduledTime are required." });
    }
    if (!TIME_FORMAT.test(scheduledTime)) {
      return res.status(400).json({ error: 'scheduledTime must be "HH:MM" in 24-hour format.' });
    }

    const reminder = await Reminder.create({
      patientId, label, scheduledTime, instructions,
      source: "custom", medicationId: null, active: true,
    });
    res.status(201).json({ reminder });
  } catch (err) {
    next(err);
  }
}

async function update(req, res, next) {
  try {
    const { id } = req.params;
    const { scheduledTime, instructions, label } = req.body;

    if (scheduledTime !== undefined && !TIME_FORMAT.test(scheduledTime)) {
      return res.status(400).json({ error: 'scheduledTime must be "HH:MM" in 24-hour format.' });
    }

    const update = {};
    if (scheduledTime !== undefined) update.scheduledTime = scheduledTime;
    if (instructions !== undefined) update.instructions = instructions;
    if (label !== undefined) update.label = label;

    const reminder = await Reminder.findByIdAndUpdate(id, update, { new: true, runValidators: true });
    if (!reminder) return res.status(404).json({ error: "Reminder not found." });
    res.json({ reminder });
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

module.exports = { listForPatient, create, update, markTaken, deactivate };
