// services/extractionService.js
//
// Extraction orchestration: builds the prompt (prompts/extractionPrompt.js),
// calls the shared Gemini wrapper (geminiService.generateExtraction),
// parses the JSON, recomputes requires_manual_review server-side, and
// validates the result against the schema (utils/extractionSchema.js)
// before returning it.
//
// Nothing here talks to Mongo or reminders/normalization — this module's
// only job is: image in, validated schema out.

const { generateExtraction } = require("./geminiService");
const { buildExtractionSystemPrompt } = require("../prompts/extractionPrompt");
const {
  ExtractionResult,
  computeRequiresManualReview,
} = require("../utils/extractionSchema");

/**
 * @param {string} base64Image  raw base64 (no data: prefix)
 * @param {string} mimeType     e.g. "image/jpeg", "application/pdf"
 * @returns {Promise<import("zod").infer<typeof ExtractionResult>>}
 */
async function extractDocument(base64Image, mimeType) {
  const prompt = buildExtractionSystemPrompt();
  const rawText = await generateExtraction(prompt, { data: base64Image, mimeType });

  let parsed;
  try {
    parsed = JSON.parse(rawText);
  } catch (err) {
    // Show the tail, not just the head — if this was a MAX_TOKENS
    // truncation that slipped past the finishReason check in
    // geminiService.js (e.g. an older SDK version that doesn't expose it),
    // the cutoff is only visible at the end of the response. The previous
    // head-only slice made every truncation and every genuine malformed-
    // JSON bug look identical and undiagnosable.
    const preview =
      rawText.length <= 800
        ? rawText
        : `${rawText.slice(0, 400)}\n...[${rawText.length - 800} chars omitted]...\n${rawText.slice(-400)}`;
    throw new Error(
      `Model did not return valid JSON (${err.message}). Response length: ${rawText.length} chars. Raw response:\n${preview}`
    );
  }

  // Recompute requires_manual_review server-side rather than trusting the
  // model's own arithmetic — mirrors extraction_system_prompt.md exactly.
  const record = parsed.prescription || parsed.lab_report;
  parsed.requires_manual_review = computeRequiresManualReview(record);

  const validated = ExtractionResult.safeParse(parsed);
  if (!validated.success) {
    throw new Error(
      `Extraction result failed schema validation: ${validated.error.message}`
    );
  }

  return validated.data;
}

module.exports = { extractDocument };
