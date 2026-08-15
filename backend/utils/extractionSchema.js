// utils/extractionSchema.js
//
// JS/Zod port of extraction_schema.py — Rihan's Perplexity-researched
// design, ported 1:1. Field names and structure must NOT drift from
// extraction_schema.py; if the Python version changes, mirror the change
// here and re-sync with Sarhak & Sufiyaan's Mongo schema.
//
// Design rule from the research: FLAG, DON'T GUESS.
// Every field that could be misread carries its own confidence score.
// Nothing here infers a diagnosis or a cause — it only reports what was
// written on the document.

const { z } = require("zod");

// ---------------------------------------------------------------------------
// PRESCRIPTION SCHEMA
// ---------------------------------------------------------------------------

const Medication = z.object({
  drug_name: z.string(),
  // Nullable like instructions/duration: real prescriptions genuinely omit
  // a numeric dose sometimes (e.g. "Crocin SOS" with no strength written),
  // and the prompt's own "flag, don't guess" rule means Gemini correctly
  // returns null there rather than inventing a number — the schema was the
  // thing out of sync, not the extraction.
  dose: z.string().nullable().default(null),
  timing: z.string(),
  instructions: z.string().nullable().default(null),
  duration: z.string().nullable().default(null),
  confidence: z.number().min(0).max(1),
  field_flags: z.array(z.string()).default([]),
});

const Prescription = z.object({
  patient_name: z.string().nullable().default(null),
  date: z.string().nullable().default(null), // ISO YYYY-MM-DD if determinable
  medications: z.array(Medication),
  doctor_name: z.string().nullable().default(null),
  clinic_name: z.string().nullable().default(null),
  overall_confidence: z.number().min(0).max(1),
  extraction_notes: z.string().nullable().default(null),
});

// ---------------------------------------------------------------------------
// LAB REPORT SCHEMA
// ---------------------------------------------------------------------------

const LabTest = z.object({
  test_name: z.string(),
  value: z.string(),
  unit: z.string(),
  reference_range: z.string().nullable().default(null),
  // True/false ONLY if the report itself flags it (H/L marker, bold,
  // asterisk). Null if the report doesn't say — never inferred by the model.
  is_abnormal: z.boolean().nullable().default(null),
  confidence: z.number().min(0).max(1),
  field_flags: z.array(z.string()).default([]),
});

const LabReport = z.object({
  patient_name: z.string().nullable().default(null),
  patient_id: z.string().nullable().default(null),
  tests: z.array(LabTest),
  collection_date: z.string().nullable().default(null),
  report_date: z.string().nullable().default(null),
  lab_name: z.string().nullable().default(null),
  overall_confidence: z.number().min(0).max(1),
  extraction_notes: z.string().nullable().default(null),
});

// ---------------------------------------------------------------------------
// TOP-LEVEL WRAPPER — what /extract actually returns
// ---------------------------------------------------------------------------

const ExtractionResult = z.object({
  input_type: z.enum(["prescription", "lab_report"]),
  prescription: Prescription.nullable().default(null),
  lab_report: LabReport.nullable().default(null),
  requires_manual_review: z.boolean(),
});

// Mirrors extraction_system_prompt.md's CONFIDENCE SCORING section exactly.
const CONFIDENCE_REVIEW_THRESHOLD = 0.7;

// requires_manual_review = true if overall_confidence < 0.7 OR field_flags
// is non-empty anywhere in the record.
function computeRequiresManualReview(record) {
  if (!record) return false;
  const items = record.medications || record.tests || [];
  const hasFlags = items.some((item) => (item.field_flags || []).length > 0);
  return record.overall_confidence < CONFIDENCE_REVIEW_THRESHOLD || hasFlags;
}

module.exports = {
  Medication,
  Prescription,
  LabTest,
  LabReport,
  ExtractionResult,
  CONFIDENCE_REVIEW_THRESHOLD,
  computeRequiresManualReview,
};
