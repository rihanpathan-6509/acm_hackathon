// models/chatLogModel.js
//
// DRAFT — conversation log for the chat companion. Persisting this is what
// lets chatService.js's multi-turn circumvention guard
// (turnAskedForDiagnosis) actually work across a real session instead of
// only within one in-memory request's `history` array.

const mongoose = require("mongoose");

const chatLogSchema = new mongoose.Schema(
  {
    patientId: { type: mongoose.Schema.Types.ObjectId, ref: "Patient", required: true },
    role: { type: String, enum: ["user", "model"], required: true },
    text: { type: String, required: true },
    language: { type: String, enum: ["en", "hi"], default: "en" },
  },
  { timestamps: true }
);

module.exports = mongoose.model("ChatLog", chatLogSchema);
