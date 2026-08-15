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

// Model history worth knowing before changing these:
// - gemini-1.5-pro/-flash and 2.5-pro/-flash are retired on this key (404,
//   "no longer available to new users"), so don't reach for them.
// - gemini-pro-latest resolves to gemini-3.1-pro, which has a free-tier
//   quota of literally 0 (429 "limit: 0" on every request — not a rate
//   limit that clears). Pro is unusable without billing.
// Flash models are multimodal, so extraction still reads images/PDFs fine.
//
// These are LISTS, not single models, because the free tier's daily quota
// is per-model ("GenerateRequestsPerDayPerProjectPerModel", 20/day). When
// the first model's daily allowance is spent, geminiService falls through
// to the next one, which has its own separate 20 — verified by hitting the
// quota on gemini-flash-latest while all three fallbacks still answered.
// Order is best-first: -latest tracks Google's current flash, and the
// lite variants trade some accuracy for a separate quota pool.
const EXTRACTION_MODELS = [
  "gemini-flash-latest",
  "gemini-3.5-flash",
  "gemini-flash-lite-latest",
];

const CHAT_MODELS = [
  "gemini-flash-latest",
  "gemini-3.5-flash",
  "gemini-flash-lite-latest",
];

function getExtractionModel(modelName = EXTRACTION_MODELS[0]) {
  return genAI.getGenerativeModel({
    model: modelName,
    generationConfig: {
      temperature: 0.1, // low temp: we want faithful reads, not creative ones
      responseMimeType: "application/json",
      // Explicit, not left to the SDK/model default. A prescription with
      // several medications or a lab report with a full CBC+lipid panel
      // produces a long JSON body (every field carries its own confidence
      // + field_flags array) — an unset/low default risks the response
      // getting cut off mid-object, which then fails JSON.parse with a
      // confusing "not valid JSON" error that doesn't explain why.
      maxOutputTokens: 8192,
    },
  });
}

function getChatModel(modelName = CHAT_MODELS[0]) {
  return genAI.getGenerativeModel({
    model: modelName,
    generationConfig: {
      temperature: 0.4,
      maxOutputTokens: 2048,
    },
  });
}

module.exports = {
  getExtractionModel,
  getChatModel,
  EXTRACTION_MODELS,
  CHAT_MODELS,
};
