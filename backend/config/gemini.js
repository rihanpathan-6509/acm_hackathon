// config/gemini.js
// Single Gemini client instance shared by extraction (geminiService) and
// chat (chatService). Keep model choice + safety settings in one place so
// both consumers stay in sync.

const { GoogleGenerativeAI } = require("@google/generative-ai");

if (!process.env.GEMINI_API_KEY) {
  throw new Error(
    "GEMINI_API_KEY is missing. Add it to your .env before starting the server."
  );
}

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// gemini-1.5-pro/-flash were retired by Google (404 "no longer available to
// new users" as of this build) — same for 2.5-pro/2.5-flash on this key.
// Using the "-latest" aliases instead of a pinned version: Google's own
// deprecation message recommends this, and it means this file doesn't need
// another emergency fix the next time a dated model gets sunset.
//
// Both are flash, not pro: gemini-pro-latest resolves to gemini-3.1-pro,
// which has a free-tier quota of literally 0 (429 "limit: 0" on every
// request — not a rate limit that clears, it's simply unavailable without
// billing). Flash is multimodal too, so extraction still reads images/PDFs
// directly. If billing is ever enabled on this key, switching
// EXTRACTION_MODEL back to gemini-pro-latest is a one-line change worth
// testing — pro may read messy handwriting more accurately.
const EXTRACTION_MODEL = "gemini-flash-latest";

// Text model for the chat companion — no need for vision here.
const CHAT_MODEL = "gemini-flash-latest";

function getExtractionModel() {
  return genAI.getGenerativeModel({
    model: EXTRACTION_MODEL,
    generationConfig: {
      temperature: 0.1, // low temp: we want faithful reads, not creative ones
      responseMimeType: "application/json",
    },
  });
}

function getChatModel() {
  return genAI.getGenerativeModel({
    model: CHAT_MODEL,
    generationConfig: {
      temperature: 0.4,
    },
  });
}

module.exports = { getExtractionModel, getChatModel };
