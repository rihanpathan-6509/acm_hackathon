// models/reminderModel.js
//
// Reminders come from two sources: auto-scheduled off a Medication's
// timing (medicationId set, source "medication"), or added directly by the
// patient (medicationId null, source "custom" — e.g. "take a walk", not
// tied to any drug). `label` is stored directly rather than requiring a
// populate() on medicationId for display, since custom reminders have no
// medication to join against anyway.

const mongoose = require("mongoose");

const reminderSchema = new mongoose.Schema(
  {
    patientId: { type: mongoose.Schema.Types.ObjectId, ref: "Patient", required: true },
    medicationId: { type: mongoose.Schema.Types.ObjectId, ref: "Medication", default: null },
    source: { type: String, enum: ["medication", "custom"], default: "medication" },
    label: { type: String, default: null }, // drug name, or the patient's own text for a custom reminder
    scheduledTime: { type: String, required: true }, // "HH:MM", 24h
    instructions: String,
    active: { type: Boolean, default: true },
    lastSentAt: Date,
  },
  { timestamps: true }
);

module.exports = mongoose.model("Reminder", reminderSchema);
