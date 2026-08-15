// controllers/extractController.js
//
// POST /extract — receives an uploaded prescription/lab image (base64 or
// multipart, adjust to match Nikhil's upload flow), runs extraction, and
// for lab reports also runs normalization before responding, so the
// frontend gets normalized marker data in one round trip.

const { extractDocument } = require("../services/geminiService");
const { buildMarkerTimeSeries } = require("../services/normalizationService");

async function handleExtract(req, res) {
  try {
    const { base64Image, mimeType } = req.body;

    if (!base64Image || !mimeType) {
      return res.status(400).json({
        error: "base64Image and mimeType are required.",
      });
    }

    // documentType is no longer a caller input — the extraction prompt
    // determines input_type itself (see promptTemplate.js TASK section).
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
