// models/medicationModel.js
//
// DRAFT — mirrors the Medication shape from utils/extractionSchema.js
// (see BACKEND_HANDOFF.md §1). Backend owns the real schema/indexing.

const mongoose = require("mongoose");

const medicationSchema = new mongoose.Schema(
  {
    patientId: { type: mongoose.Schema.Types.ObjectId, ref: "Patient", required: true },
    drugName: { type: String, required: true },
    dose: String,
    timing: String,
    instructions: String,
    duration: String,
    confidence: Number,
    fieldFlags: [String],
    requiresManualReview: { type: Boolean, default: false },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Medication", medicationSchema);
