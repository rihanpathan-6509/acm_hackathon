// services/geminiService.js
//
// Shared low-level Gemini client wrapper — the one place that actually
// calls the Gemini SDK, used by both extractionService.js (vision calls)
// and chatService.js (text chat calls). Neither of those should call
// config/gemini.js directly; they go through here so retry/logging lives
// in exactly one place.

const { getExtractionModel, getChatModel } = require("../config/gemini");

// The free tier returns transient 503 "high demand" fairly often — seen
// repeatedly during testing, and it cleared on retry every time. Retrying
// these matters most during a live demo, where a single blip otherwise
// looks like a broken feature.
const RETRYABLE_STATUSES = [429, 500, 502, 503, 504];
const MAX_ATTEMPTS = 4; // initial call + 3 retries
const BASE_DELAY_MS = 1000; // 1s, 2s, 4s (plus jitter)
const MAX_HINTED_DELAY_MS = 10000; // don't let a server hint stall the demo

function extractStatus(err) {
  // Newer SDK versions expose .status; older ones only put it in the
  // message, e.g. "[503 Service Unavailable] This model is currently...".
  if (typeof err?.status === "number") return err.status;
  const match = /\[(\d{3})\s/.exec(err?.message || "");
  return match ? Number(match[1]) : null;
}

// Gemini sometimes tells us exactly how long to wait ("Please retry in
// 9.14s" / RetryInfo retryDelay: "9s"). Prefer that over our own guess
// when it's present and not absurdly long.
function extractHintedDelayMs(err) {
  const message = err?.message || "";
  const retryIn = /retry in (\d+(?:\.\d+)?)s/i.exec(message);
  if (retryIn) return Math.min(Number(retryIn[1]) * 1000, MAX_HINTED_DELAY_MS);
  const retryDelay = /"retryDelay"\s*:\s*"(\d+(?:\.\d+)?)s"/.exec(message);
  if (retryDelay) return Math.min(Number(retryDelay[1]) * 1000, MAX_HINTED_DELAY_MS);
  return null;
}

// A 429 with "limit: 0" is a quota that doesn't exist rather than one
// that's temporarily exhausted (this is what gemini-pro-latest returns on
// the free tier — see config/gemini.js). Retrying that just wastes the
// user's time, since it will never succeed.
function isZeroQuota(err) {
  return /limit:\s*0\b/.test(err?.message || "");
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function withRetry(fn, label) {
  let lastError;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      const status = extractStatus(err);

      const worthRetrying =
        RETRYABLE_STATUSES.includes(status) && !isZeroQuota(err) && attempt < MAX_ATTEMPTS;

      if (!worthRetrying) throw err;

      const delay =
        extractHintedDelayMs(err) ??
        BASE_DELAY_MS * 2 ** (attempt - 1) + Math.floor(Math.random() * 250);

      console.warn(
        `${label}: ${status} on attempt ${attempt}/${MAX_ATTEMPTS}, retrying in ${delay}ms`
      );
      await sleep(delay);
    }
  }

  throw lastError;
}

/**
 * One-shot multimodal generation, used by extraction: prompt + optional
 * inline image data in, raw text out.
 * @param {string} prompt
 * @param {{ data: string, mimeType: string }} [inlineImage]
 */
async function generateExtraction(prompt, inlineImage) {
  const parts = [{ text: prompt }];
  if (inlineImage) parts.push({ inlineData: inlineImage });

  return withRetry(async () => {
    const model = getExtractionModel();
    const result = await model.generateContent(parts);
    return result.response.text();
  }, "generateExtraction");
}

/**
 * Multi-turn chat generation, used by the chat companion: system prompt +
 * prior turns + the latest user message in, reply text out.
 * @param {string} systemPrompt
 * @param {Array<{role: "user"|"model", text: string}>} history
 * @param {string} userMessage
 */
async function generateChatReply(systemPrompt, history, userMessage) {
  return withRetry(async () => {
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
  }, "generateChatReply");
}

module.exports = { generateExtraction, generateChatReply };
