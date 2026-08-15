// models/reminderModel.js
//
// DRAFT — reminder scheduling logic is backend's (services/reminderService.js);
// this just sketches a plausible shape derived from a Medication's timing/
// duration/instructions. Adjust freely — starting point, not a spec.

const mongoose = require("mongoose");

const reminderSchema = new mongoose.Schema(
  {
    patientId: { type: mongoose.Schema.Types.ObjectId, ref: "Patient", required: true },
    medicationId: { type: mongoose.Schema.Types.ObjectId, ref: "Medication", required: true },
    scheduledTime: String, // e.g. "08:00" — derived from `timing` by reminderService
    instructions: String,
    active: { type: Boolean, default: true },
    lastSentAt: Date,
  },
  { timestamps: true }
);

module.exports = mongoose.model("Reminder", reminderSchema);
