// models/patientModel.js
//
// DRAFT Mongoose schema — a starting point, not a spec. Backend owns the
// real patient-record design (identity fields depend on middleware/auth.js,
// which isn't decided yet).

const mongoose = require("mongoose");

const patientSchema = new mongoose.Schema(
  {
    name: { type: String },
    // TODO: real identity/auth fields once middleware/auth.js is decided.
  },
  { timestamps: true }
);

module.exports = mongoose.model("Patient", patientSchema);
