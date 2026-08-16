// controllers/chatController.js
//
// POST /chat — receives a patient message + context, gets a guardrailed
// reply from chatService, and persists both turns to ChatLog. If the
// caller doesn't pass `history` explicitly, it's pulled from ChatLog by
// patientId — this is what lets chatService's multi-turn circumvention
// guard (turnAskedForDiagnosis) actually work across a real session instead
// of only within one request (see chatLogModel.js's header, which flagged
// this as the reason the model exists).
//
// patientContext shape is still a placeholder until confirmed with
// Sarhak & Sufiyaan (Sync: meds/trend-flag interface — see BACKEND_HANDOFF.md).

const { getChatResponse } = require("../services/chatService");
const ChatLog = require("../models/chatLogModel");

const HISTORY_LIMIT = 10; // last N turns — enough for the circumvention guard without unbounded growth

async function handleChat(req, res, next) {
  try {
    const { message, patientId, patientContext, history } = req.body;

    if (!message) {
      return res.status(400).json({ error: "message is required." });
    }

    let resolvedHistory = history;
    if (!resolvedHistory && patientId) {
      const recent = await ChatLog.find({ patientId }).sort({ createdAt: -1 }).limit(HISTORY_LIMIT);
      resolvedHistory = recent.reverse().map((entry) => ({ role: entry.role, text: entry.text }));
    }

    const { reply, isEmergency } = await getChatResponse(
      message,
      patientContext || {},
      resolvedHistory || []
    );

    if (patientId) {
      const language = patientContext?.language === "hi" ? "hi" : "en";
      await ChatLog.insertMany([
        { patientId, role: "user", text: message, language },
        { patientId, role: "model", text: reply, language },
      ]);
    }

    return res.json({ reply, isEmergency });
  } catch (err) {
    next(err);
  }
}

module.exports = { handleChat };
