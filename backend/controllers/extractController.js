// controllers/extractController.js
//
// POST /extract — receives an uploaded prescription/lab document (base64
// JSON body — see FRONTEND_HANDOFF.md), runs extraction, and for lab
// reports also runs normalization before responding, so the frontend gets
// normalized marker data in one round trip.
//
// Patients upload both photos and PDFs across a mix of extensions, so
// mimeType is validated against an allow-list here rather than assumed to
// be a single image type — Gemini's inlineData accepts any of these
// directly, no format-specific handling needed elsewhere in the pipeline.

const { extractDocument } = require("../services/extractionService");
const { buildMarkerTimeSeries } = require("../services/normalizationService");

const SUPPORTED_MIME_TYPES = [
  "image/jpeg", "image/jpg", "image/png", "image/webp",
  "image/heic", "image/heif", "application/pdf",
];

async function handleExtract(req, res) {
  try {
    const { base64Image, mimeType } = req.body;

    if (!base64Image || !mimeType) {
      return res.status(400).json({
        error: "base64Image and mimeType are required.",
      });
    }

    if (!SUPPORTED_MIME_TYPES.includes(mimeType.toLowerCase())) {
      return res.status(400).json({
        error: `Unsupported mimeType "${mimeType}". Supported: ${SUPPORTED_MIME_TYPES.join(", ")}.`,
      });
    }

    // documentType is no longer a caller input — the extraction prompt
    // determines input_type itself (see prompts/extractionPrompt.js TASK section).
    const extraction = await extractDocument(base64Image, mimeType);

    // Prescriptions: hand back as-is, backend turns this into reminders.
    if (extraction.input_type === "prescription") {
      return res.json({ extraction });
    }

    // Lab reports: also normalize before responding, since normalization
    // has no route of its own (see normalizationService.js header).
    // normalizationService is still a stub pending Step 2 research, so
    // don't let that block extraction, which already works.
    try {
      const { series, unresolved } = buildMarkerTimeSeries(extraction.lab_report);
      return res.json({ extraction, normalized: { series, unresolved } });
    } catch (normErr) {
      return res.json({ extraction, normalized: null, normalizationError: normErr.message });
    }
  } catch (err) {
    console.error("extractController error:", err);
    return res.status(500).json({ error: err.message });
  }
}

module.exports = { handleExtract };
