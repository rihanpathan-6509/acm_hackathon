// models/labMarkerModel.js
//
// DRAFT — mirrors the normalized reading shape from
// services/normalizationService.js's buildMarkerTimeSeries() output (see
// BACKEND_HANDOFF.md §1). Stores BOTH canonical (SI) and display
// (conventional) units per reading — see WALKTHROUGH.md §7 for why that's
// deliberate, not redundant. Backend owns the real schema/indexing.

const mongoose = require("mongoose");

const labMarkerSchema = new mongoose.Schema(
  {
    patientId: { type: mongoose.Schema.Types.ObjectId, ref: "Patient", required: true },
    markerKey: { type: String, required: true }, // e.g. "hba1c"
    canonicalName: String,
    value: Number, // SI/canonical — for cross-marker math
    canonicalUnit: String,
    displayValue: Number, // conventional — for charting
    displayUnit: String,
    originalValue: String,
    originalUnit: String,
    date: Date,
    labName: String,
    isAbnormal: { type: Boolean, default: null },
    matchType: { type: String, enum: ["exact", "fuzzy"] },
    confidence: Number,
    needsReview: Boolean,
  },
  { timestamps: true }
);

labMarkerSchema.index({ patientId: 1, markerKey: 1, date: 1 });

module.exports = mongoose.model("LabMarker", labMarkerSchema);
