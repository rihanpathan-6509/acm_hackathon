// services/chatService.js
//
// Chat companion logic. Builds the guardrailed system prompt (Step 3
// research — see utils/chatPromptTemplate.js) with current patient
// context, calls Gemini, and runs a post-hoc scan on the reply for
// diagnostic-language leakage before returning it (research section 4's
// "post-LLM output filter" — done here as a phrase-blocklist check rather
// than a second LLM call, since a full retry loop wasn't in budget).
//
// This module does NOT do emergency-keyword detection. That's backend's
// deterministic system, and it runs BEFORE this module is ever called (see
// chatPromptTemplate.js header). If you're tempted to add "if message
// contains 'chest pain' ..." here, don't — confirm the boundary with
// Sarhak & Sufiyaan instead (Sync 4 in the roadmap).

const { getChatModel } = require("../config/gemini");
const {
  buildChatSystemPrompt,
  turnAskedForDiagnosis,
  BANNED_PHRASES,
} = require("../utils/chatPromptTemplate");

const SAFE_FALLBACK_RESPONSE = {
  en: "I can't interpret that for you — only your doctor can. Please bring this up with them.",
  hi: "Main aapko iski vyakhya nahin kar sakta/sakti — sirf aapke doctor hi yeh bata sakte hain. Kripya yeh apne doctor se discuss karein.",
};

function containsBannedLanguage(text) {
  const lower = text.toLowerCase();
  return BANNED_PHRASES.some((phrase) => lower.includes(phrase));
}

/**
 * @param {string} userMessage
 * @param {object} patientContext  { patientMeds, trendFlags, language }
 *   Shape TBD with backend — this is the assumed shape until confirmed:
 *   patientMeds: [{ drugName, dose, timing }]
 *   trendFlags:  [{ markerName, plainLanguageFlag }]
 *   language: "en" | "hi"
 * @param {Array<{role: "user"|"model", text: string}>} history  prior turns, optional
 */
async function getChatResponse(userMessage, patientContext = {}, history = []) {
  // Multi-turn circumvention guard (research section 2): if an earlier turn
  // in this conversation already probed for a diagnosis, tell the model not
  // to answer around it this turn either.
  const priorTurnsAskedForDiagnosis = history
    .filter((turn) => turn.role === "user")
    .some((turn) => turnAskedForDiagnosis(turn.text));

  const systemPrompt = buildChatSystemPrompt({ ...patientContext, priorTurnsAskedForDiagnosis });
  const model = getChatModel();

  const chat = model.startChat({
    history: [
      { role: "user", parts: [{ text: systemPrompt }] },
      { role: "model", parts: [{ text: "Understood — I'll stay within those boundaries." }] },
      ...history.map((turn) => ({ role: turn.role, parts: [{ text: turn.text }] })),
    ],
  });

  const result = await chat.sendMessage(userMessage);
  const reply = result.response.text();

  if (containsBannedLanguage(reply)) {
    console.warn(
      "chatService: response contained banned diagnostic language, substituting safe fallback."
    );
    return SAFE_FALLBACK_RESPONSE[patientContext.language === "hi" ? "hi" : "en"];
  }

  return reply;
}

module.exports = { getChatResponse };
