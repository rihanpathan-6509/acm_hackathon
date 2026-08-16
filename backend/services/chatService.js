// services/chatService.js
//
// Chat companion logic. Runs the deterministic emergency-keyword pre-check
// (utils/emergencyKeywords.js) first and bypasses the LLM entirely on a
// match (research section 4's recommended order). Otherwise builds the
// guardrailed system prompt (prompts/chatPrompt.js) with current patient
// context, calls the shared Gemini wrapper (geminiService.generateChatReply),
// and runs a post-hoc scan on the reply for diagnostic-language leakage
// before returning it (research section 4's "post-LLM output filter" — done
// here as a phrase-blocklist check rather than a second LLM call).
//
// Emergency-keyword detection used to be described as "backend's" separate
// system that was assumed to run before this module — it never actually got
// wired up anywhere. Fixed 2026-08-15: wired in here since this is the
// single entry point every chat message already passes through.

const { generateChatReply } = require("./geminiService");
const {
  buildChatSystemPrompt,
  turnAskedForDiagnosis,
  BANNED_PHRASES,
} = require("../prompts/chatPrompt");
const { matchesEmergencyKeyword } = require("../utils/emergencyKeywords");

const SAFE_FALLBACK_RESPONSE = {
  en: "I can't interpret that for you — only your doctor can. Please bring this up with them.",
  hi: "Main aapko iski vyakhya nahin kar sakta/sakti — sirf aapke doctor hi yeh bata sakte hain. Kripya yeh apne doctor se discuss karein.",
};

// Deliberately does not name the matched category/condition back to the
// patient — that would edge toward triage/interpretation, which is exactly
// what this deterministic check is supposed to avoid. It just acknowledges
// and redirects to emergency care, same as chatPrompt.js's EMERGENCY
// BOUNDARY fallback clause does for anything this keyword list misses.
const EMERGENCY_RESPONSE = {
  en: "This sounds like it could be a medical emergency. Please call your local emergency number (India: 112 or 108) or go to the nearest emergency room right now — don't wait on a reply here.",
  hi: "Yeh ek medical emergency ho sakti hai. Kripya turant apni local emergency helpline par call karein (India: 112 ya 108) ya nazdeeki emergency room jaayein — is chat ka jawab wait mat kijiye.",
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
  const language = patientContext.language === "hi" ? "hi" : "en";

  // Deterministic pre-check, ahead of everything else: on a match, skip the
  // LLM entirely and return the fixed emergency response. No model call, no
  // interpretation — just acknowledge and redirect to real emergency care.
  const emergencyMatch = matchesEmergencyKeyword(userMessage);
  if (emergencyMatch.matched) {
    console.warn(
      `chatService: emergency keyword matched (category=${emergencyMatch.category}), bypassing LLM.`
    );
    return { reply: EMERGENCY_RESPONSE[language], isEmergency: true };
  }

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
    return { reply: SAFE_FALLBACK_RESPONSE[language], isEmergency: false };
  }

  return { reply, isEmergency: false };
}

module.exports = { getChatResponse };
