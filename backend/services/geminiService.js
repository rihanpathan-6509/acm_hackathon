// services/geminiService.js
//
// Shared low-level Gemini client wrapper — the one place that actually
// calls the Gemini SDK, used by both extractionService.js (vision calls)
// and chatService.js (text chat calls). Neither of those should call
// config/gemini.js directly; they go through here so there's one place to
// add retry/logging/rate-limiting later if needed.

const { getExtractionModel, getChatModel } = require("../config/gemini");

/**
 * One-shot multimodal generation, used by extraction: prompt + optional
 * inline image data in, raw text out.
 * @param {string} prompt
 * @param {{ data: string, mimeType: string }} [inlineImage]
 */
async function generateExtraction(prompt, inlineImage) {
  const model = getExtractionModel();
  const parts = [{ text: prompt }];
  if (inlineImage) parts.push({ inlineData: inlineImage });
  const result = await model.generateContent(parts);
  return result.response.text();
}

/**
 * Multi-turn chat generation, used by the chat companion: system prompt +
 * prior turns + the latest user message in, reply text out.
 * @param {string} systemPrompt
 * @param {Array<{role: "user"|"model", text: string}>} history
 * @param {string} userMessage
 */
async function generateChatReply(systemPrompt, history, userMessage) {
  const model = getChatModel();
  const chat = model.startChat({
    history: [
      { role: "user", parts: [{ text: systemPrompt }] },
      { role: "model", parts: [{ text: "Understood — I'll stay within those boundaries." }] },
      ...history.map((turn) => ({ role: turn.role, parts: [{ text: turn.text }] })),
    ],
  });
  const result = await chat.sendMessage(userMessage);
  return result.response.text();
}

module.exports = { generateExtraction, generateChatReply };
