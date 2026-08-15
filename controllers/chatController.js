// controllers/chatController.js
//
// POST /chat — receives a patient message + their current context (meds,
// trend flags, language, optional history) and returns a guardrailed
// companion response. Context shape is a placeholder until confirmed with
// Sarhak & Sufiyaan (Sync: meds/trend-flag interface).

const { getChatResponse } = require("../services/chatService");

async function handleChat(req, res) {
  try {
    const { message, patientContext, history } = req.body;

    if (!message) {
      return res.status(400).json({ error: "message is required." });
    }

    const reply = await getChatResponse(message, patientContext || {}, history || []);
    return res.json({ reply });
  } catch (err) {
    console.error("chatController error:", err);
    return res.status(500).json({ error: err.message });
  }
}

module.exports = { handleChat };
