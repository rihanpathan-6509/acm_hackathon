// utils/markerAliases.js
//
// Static alias lookup table — built from Step 2 research. A static table +
// string normalization was the recommended approach for this build size
// (90-95% accuracy, <10ms/lookup, hours not days), over full LOINC
// integration or embedding-based fuzzy matching, both of which only pay
// off past ~50 markers or highly diverse naming (see research's section 2
// tradeoff table: static lookup 2-4h build vs. embeddings 8-12h vs. LLM
// matching 4-6h with worse latency for no real accuracy gain at this scale).
//
// Units decision (asked separately, resolved as "store both"): every
// marker carries a canonicalUnit (SI/IFCC — what gets stored, so trend math
// stays consistent regardless of which unit a given lab used) AND a
// displayUnit (the conventional unit — %, mg/dL, mEq/L — that's actually
// printed on Indian reports and what patients recognize), with a
// toDisplayUnit() to go from canonical back to display. normalizationService
// computes and returns both; Nikhil's trend chart shows displayValue/
// displayUnit, anything doing cross-marker math uses value/canonicalUnit.

const MARKERS = {
  hba1c: {
    canonicalName: "HbA1c",
    names: [
      "hba1c", "a1c", "glycated hemoglobin", "glycosylated hemoglobin",
      "hemoglobin a1c", "hb a1c", "glycated hb",
    ],
    canonicalUnit: "mmol/mol",
    displayUnit: "%",
    referenceRange: { min: 20, max: 42 }, // non-diabetic range, mmol/mol (IFCC)
    unitConversions: {
      // NGSP % -> IFCC mmol/mol: (percent - 2.15) * 10.929
      "%": (v) => (v - 2.15) * 10.929,
      "mmol/mol": (v) => v,
    },
    // IFCC mmol/mol -> NGSP %: inverse of the above
    toDisplayUnit: (v) => v / 10.929 + 2.15,
  },
  creatinine: {
    canonicalName: "Serum Creatinine",
    names: [
      "creatinine", "s creatinine", "sr creatinine", "serum creatinine",
      "s creat", "sr creat", "creat",
    ],
    canonicalUnit: "umol/l",
    displayUnit: "mg/dL",
    referenceRange: { min: 62, max: 115 }, // umol/L
    unitConversions: {
      "mg/dl": (v) => v * 88.4,
      "umol/l": (v) => v,
      "µmol/l": (v) => v,
      // pitfall from research: some labs report mg/L, not mg/dL
      "mg/l": (v) => (v / 10) * 88.4,
    },
    toDisplayUnit: (v) => v / 88.4,
  },
  fastingGlucose: {
    canonicalName: "Fasting Glucose",
    // Deliberately its own marker, not folded into a generic "glucose" —
    // fasting vs. random is clinically meaningful. See AMBIGUOUS_BARE_NAMES
    // below and normalizationService.js for how a bare "Glucose" is handled.
    names: [
      "fasting glucose", "fasting blood sugar", "fbs",
      "fasting blood glucose", "fpg", "f blood sugar",
    ],
    canonicalUnit: "mmol/l",
    displayUnit: "mg/dL",
    referenceRange: { min: 3.9, max: 5.6 }, // mmol/L, fasting
    unitConversions: {
      "mg/dl": (v) => v * 0.0555,
      "mmol/l": (v) => v,
    },
    toDisplayUnit: (v) => v / 0.0555,
  },
  hemoglobin: {
    canonicalName: "Hemoglobin",
    names: ["hemoglobin", "haemoglobin", "hb", "hgb"],
    canonicalUnit: "g/l",
    displayUnit: "g/dL",
    unitConversions: {
      "g/dl": (v) => v * 10,
      "g/l": (v) => v,
    },
    toDisplayUnit: (v) => v / 10,
  },
  tsh: {
    canonicalName: "TSH",
    names: ["tsh", "thyroid stimulating hormone", "s tsh"],
    canonicalUnit: "miu/l",
    displayUnit: "mIU/L", // already the conventional unit in India — no conversion needed
    unitConversions: {
      "miu/l": (v) => v,
      "uiu/ml": (v) => v, // 1:1, numerically equivalent
      "µiu/ml": (v) => v,
    },
    toDisplayUnit: (v) => v,
  },
  potassium: {
    canonicalName: "Potassium",
    names: ["potassium", "s potassium", "serum potassium", "k+"],
    canonicalUnit: "mmol/l",
    displayUnit: "mEq/L", // more commonly printed than mmol/L on Indian reports
    unitConversions: {
      "meq/l": (v) => v, // 1:1 for a monovalent ion
      "mmol/l": (v) => v,
    },
    toDisplayUnit: (v) => v,
  },
  ldlCholesterol: {
    canonicalName: "LDL Cholesterol",
    names: ["ldl", "ldl cholesterol", "ldl-c", "low density lipoprotein"],
    canonicalUnit: "mmol/l",
    displayUnit: "mg/dL",
    unitConversions: {
      "mg/dl": (v) => v * 0.0259,
      "mmol/l": (v) => v,
    },
    toDisplayUnit: (v) => v / 0.0259,
  },
};

// Test names that are clinically ambiguous on their own (fasting vs. random
// vs. post-prandial glucose; "T3" as a standalone test vs. a thyroid-panel
// component) — normalizationService refuses to guess on these rather than
// silently picking one, per the research's failure-mode table (section 4).
const AMBIGUOUS_BARE_NAMES = ["glucose", "blood sugar", "blood glucose", "t3"];

module.exports = { MARKERS, AMBIGUOUS_BARE_NAMES };
