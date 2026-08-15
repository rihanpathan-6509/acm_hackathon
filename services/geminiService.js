// services/geminiService.js
//
// Low-level Gemini call for extraction. Sends the image with the extraction
// system prompt (utils/promptTemplate.js) and validates the response against
// extractionSchema.js before returning it.
//
// Nothing here talks to Mongo or reminders/normalization — this module's
// only job is: image in, validated schema out.

const { getExtractionModel } = require("../config/gemini");
const { buildExtractionSystemPrompt } = require("../utils/promptTemplate");
const {
  ExtractionResult,
  computeRequiresManualReview,
} = require("../schemas/extractionSchema");

/**
 * @param {string} base64Image  raw base64 (no data: prefix)
 * @param {string} mimeType     e.g. "image/jpeg", "application/pdf"
 * @returns {Promise<import("zod").infer<typeof ExtractionResult>>}
 */
async function extractDocument(base64Image, mimeType) {
  const model = getExtractionModel();
  const prompt = buildExtractionSystemPrompt();

  const result = await model.generateContent([
    { text: prompt },
    { inlineData: { data: base64Image, mimeType } },
  ]);

  const rawText = result.response.text();

  let parsed;
  try {
    parsed = JSON.parse(rawText);
  } catch (err) {
    throw new Error(
      `Model did not return valid JSON. Raw response: ${rawText.slice(0, 500)}`
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
