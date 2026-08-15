// services/chatService.js
//
// Chat companion logic. Builds the guardrailed system prompt
// (prompts/chatPrompt.js) with current patient context, calls the shared
// Gemini wrapper (geminiService.generateChatReply), and runs a post-hoc
// scan on the reply for diagnostic-language leakage before returning it
// (research section 4's "post-LLM output filter" — done here as a
// phrase-blocklist check rather than a second LLM call).
//
// This module does NOT do emergency-keyword detection. That's backend's
// deterministic system (utils/emergencyKeywords.js + a pre-check that runs
// BEFORE this module is ever called — see prompts/chatPrompt.js header). If
// you're tempted to add "if message contains 'chest pain' ..." here, don't.

const { generateChatReply } = require("./geminiService");
const {
  buildChatSystemPrompt,
  turnAskedForDiagnosis,
  BANNED_PHRASES,
} = require("../prompts/chatPrompt");

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
  const reply = await generateChatReply(systemPrompt, history, userMessage);

  if (containsBannedLanguage(reply)) {
    console.warn(
      "chatService: response contained banned diagnostic language, substituting safe fallback."
    );
    return SAFE_FALLBACK_RESPONSE[patientContext.language === "hi" ? "hi" : "en"];
  }

  return reply;
}

module.exports = { getChatResponse };
