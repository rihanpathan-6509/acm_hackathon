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
 * Extracts the first complete, balanced top-level JSON value from a string
 * and parses it — tolerating trailing garbage after that value.
 *
 * Exists because responseMimeType: "application/json" is not an airtight
 * guarantee: observed in practice (not simulated) — a fully valid,
 * complete ExtractionResult followed by one stray extra "}", which made
 * JSON.parse reject an otherwise-perfect extraction. A strict parse can't
 * tell "one extra character after real JSON" apart from "actually
 * malformed", so it fails both identically. This walks the string tracking
 * brace/bracket depth (respecting quoted strings and escapes) to find
 * where the value actually ends, and parses only that substring — genuine
 * malformed/truncated JSON (no balanced value to find) still throws.
 * @param {string} text
 * @returns {any}
 */
function parseLenientJSON(text) {
  const trimmed = text.trim();
  const start = trimmed.search(/[{[]/);
  if (start === -1) {
    throw new Error("no JSON object or array found in response");
  }

  const open = trimmed[start];
  const close = open === "{" ? "}" : "]";
  let depth = 0;
  let inString = false;
  let escaped = false;
  let end = -1;

  for (let i = start; i < trimmed.length; i++) {
    const ch = trimmed[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (ch === "\\") escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') inString = true;
    else if (ch === open) depth++;
    else if (ch === close) {
      depth--;
      if (depth === 0) {
        end = i;
        break;
      }
    }
  }

  if (end === -1) {
    // Never found a balanced close — a genuinely incomplete/truncated
    // value, not extra trailing content. Let JSON.parse's own message
    // explain it rather than guessing further.
    return JSON.parse(trimmed);
  }

  return JSON.parse(trimmed.slice(start, end + 1));
}

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
    parsed = parseLenientJSON(rawText);
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

module.exports = { extractDocument, parseLenientJSON };
