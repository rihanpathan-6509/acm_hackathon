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

// Vision-capable model — needed because extraction reads the
// prescription/lab image directly (no separate OCR stage).
const EXTRACTION_MODEL = "gemini-1.5-pro";

// Text model for the chat companion — no need for vision here.
const CHAT_MODEL = "gemini-1.5-flash";

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
