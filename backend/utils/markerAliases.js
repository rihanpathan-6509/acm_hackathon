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

  // --- Rest of the lipid panel -------------------------------------------
  // LDL alone left most of a lipid profile unresolved.
  totalCholesterol: {
    canonicalName: "Total Cholesterol",
    names: ["total cholesterol", "cholesterol total", "cholesterol", "t cholesterol"],
    canonicalUnit: "mmol/l",
    displayUnit: "mg/dL",
    unitConversions: { "mg/dl": (v) => v * 0.0259, "mmol/l": (v) => v },
    toDisplayUnit: (v) => v / 0.0259,
  },
  hdlCholesterol: {
    canonicalName: "HDL Cholesterol",
    names: ["hdl", "hdl cholesterol", "hdl-c", "high density lipoprotein"],
    canonicalUnit: "mmol/l",
    displayUnit: "mg/dL",
    unitConversions: { "mg/dl": (v) => v * 0.0259, "mmol/l": (v) => v },
    toDisplayUnit: (v) => v / 0.0259,
  },
  triglycerides: {
    canonicalName: "Triglycerides",
    names: ["triglycerides", "triglyceride", "tg", "s triglycerides"],
    canonicalUnit: "mmol/l",
    displayUnit: "mg/dL",
    unitConversions: { "mg/dl": (v) => v * 0.0113, "mmol/l": (v) => v },
    toDisplayUnit: (v) => v / 0.0113,
  },

  // --- Complete Blood Count ----------------------------------------------
  // A CBC is one of the most commonly uploaded reports, and previously only
  // its Hemoglobin line resolved — everything else fell through to
  // `unresolved` and never reached the trend chart.
  //
  // Counts convert cells/cu.mm (what Indian labs print) to the SI 10^9/L by
  // dividing by 1000; indices and percentages have no meaningful SI
  // alternative, so canonical and display units are the same for those.
  wbc: {
    canonicalName: "Total Leucocyte Count",
    names: [
      "total leucocyte count", "total leukocyte count", "tlc", "wbc",
      "wbc count", "white blood cell count", "total wbc count", "leucocyte count",
    ],
    canonicalUnit: "10^9/l",
    displayUnit: "cells/cu.mm",
    unitConversions: {
      "cells/cu.mm": (v) => v / 1000, "cells/cumm": (v) => v / 1000,
      "/cu.mm": (v) => v / 1000, "cumm": (v) => v / 1000,
      "cells/ul": (v) => v / 1000, "cells/µl": (v) => v / 1000,
      "10^9/l": (v) => v, "x10^9/l": (v) => v,
    },
    toDisplayUnit: (v) => v * 1000,
  },
  platelets: {
    canonicalName: "Platelet Count",
    names: ["platelet count", "platelets", "plt", "platelet"],
    canonicalUnit: "10^9/l",
    displayUnit: "cells/cu.mm",
    unitConversions: {
      "cells/cu.mm": (v) => v / 1000, "cells/cumm": (v) => v / 1000,
      "/cu.mm": (v) => v / 1000, "cumm": (v) => v / 1000,
      "cells/ul": (v) => v / 1000, "cells/µl": (v) => v / 1000,
      "10^9/l": (v) => v, "x10^9/l": (v) => v,
      // Some Indian labs report platelets in lakhs (1 lakh = 100,000)
      "lakhs/cu.mm": (v) => v * 100, "lakh/cu.mm": (v) => v * 100,
    },
    toDisplayUnit: (v) => v * 1000,
  },
  rbc: {
    canonicalName: "RBC Count",
    names: ["rbc count", "rbc", "red blood cell count", "total rbc count", "erythrocyte count"],
    canonicalUnit: "10^12/l",
    displayUnit: "millions/cu.mm",
    unitConversions: {
      // millions/cu.mm and 10^12/L are numerically identical
      "millions/cu.mm": (v) => v, "million/cu.mm": (v) => v,
      "mill/cumm": (v) => v, "10^12/l": (v) => v, "x10^12/l": (v) => v,
    },
    toDisplayUnit: (v) => v,
  },
  hematocrit: {
    canonicalName: "Hematocrit (PCV)",
    names: ["hematocrit", "haematocrit", "pcv", "packed cell volume", "hct"],
    canonicalUnit: "%",
    displayUnit: "%",
    unitConversions: { "%": (v) => v },
    toDisplayUnit: (v) => v,
  },
  mcv: {
    canonicalName: "MCV",
    names: ["mcv", "mean corpuscular volume", "mean cell volume"],
    canonicalUnit: "fl",
    displayUnit: "fL",
    unitConversions: { fl: (v) => v },
    toDisplayUnit: (v) => v,
  },
  mch: {
    canonicalName: "MCH",
    names: ["mch", "mean corpuscular hemoglobin", "mean corpuscular haemoglobin"],
    canonicalUnit: "pg",
    displayUnit: "pg",
    unitConversions: { pg: (v) => v },
    toDisplayUnit: (v) => v,
  },
  mchc: {
    canonicalName: "MCHC",
    names: [
      "mchc", "mean corpuscular hemoglobin concentration",
      "mean corpuscular haemoglobin concentration",
    ],
    canonicalUnit: "g/dl",
    displayUnit: "g/dL",
    unitConversions: { "g/dl": (v) => v, "g/l": (v) => v / 10 },
    toDisplayUnit: (v) => v,
  },
  rdw: {
    canonicalName: "RDW",
    names: ["rdw", "red cell distribution width", "rdw-cv"],
    canonicalUnit: "%",
    displayUnit: "%",
    unitConversions: { "%": (v) => v },
    toDisplayUnit: (v) => v,
  },

  // Differential count — percentage and absolute are genuinely different
  // measurements (36.4 % vs 1201 cells/cu.mm), so each gets its own marker
  // rather than being merged onto one line. See NOISE_PARENTHETICAL in
  // normalizationService.js, which keeps "(DLC)" / "(Absolute)" intact so
  // these can be told apart.
  neutrophilsPercent: {
    canonicalName: "Neutrophils (%)",
    names: ["neutrophils (dlc)", "neutrophils %", "neutrophil %", "neutrophils percentage", "polymorphs"],
    canonicalUnit: "%", displayUnit: "%",
    unitConversions: { "%": (v) => v }, toDisplayUnit: (v) => v,
  },
  lymphocytesPercent: {
    canonicalName: "Lymphocytes (%)",
    names: ["lymphocytes (dlc)", "lymphocytes %", "lymphocyte %", "lymphocytes percentage"],
    canonicalUnit: "%", displayUnit: "%",
    unitConversions: { "%": (v) => v }, toDisplayUnit: (v) => v,
  },
  eosinophilsPercent: {
    canonicalName: "Eosinophils (%)",
    names: ["eosinophils (dlc)", "eosinophils %", "eosinophil %", "eosinophils percentage"],
    canonicalUnit: "%", displayUnit: "%",
    unitConversions: { "%": (v) => v }, toDisplayUnit: (v) => v,
  },
  monocytesPercent: {
    canonicalName: "Monocytes (%)",
    names: ["monocytes (dlc)", "monocytes %", "monocyte %", "monocytes percentage"],
    canonicalUnit: "%", displayUnit: "%",
    unitConversions: { "%": (v) => v }, toDisplayUnit: (v) => v,
  },
  basophilsPercent: {
    canonicalName: "Basophils (%)",
    names: ["basophils (dlc)", "basophils %", "basophil %", "basophils percentage"],
    canonicalUnit: "%", displayUnit: "%",
    unitConversions: { "%": (v) => v }, toDisplayUnit: (v) => v,
  },
  neutrophilsAbsolute: {
    canonicalName: "Neutrophils (Absolute)",
    names: ["neutrophils (absolute)", "absolute neutrophil count", "anc", "neutrophils absolute"],
    canonicalUnit: "10^9/l", displayUnit: "cells/cu.mm",
    unitConversions: {
      "cells/cu.mm": (v) => v / 1000, "cells/cumm": (v) => v / 1000,
      "cells/ul": (v) => v / 1000, "cells/µl": (v) => v / 1000, "10^9/l": (v) => v,
    },
    toDisplayUnit: (v) => v * 1000,
  },
  lymphocytesAbsolute: {
    canonicalName: "Lymphocytes (Absolute)",
    names: ["lymphocytes (absolute)", "absolute lymphocyte count", "alc", "lymphocytes absolute"],
    canonicalUnit: "10^9/l", displayUnit: "cells/cu.mm",
    unitConversions: {
      "cells/cu.mm": (v) => v / 1000, "cells/cumm": (v) => v / 1000,
      "cells/ul": (v) => v / 1000, "cells/µl": (v) => v / 1000, "10^9/l": (v) => v,
    },
    toDisplayUnit: (v) => v * 1000,
  },
  eosinophilsAbsolute: {
    canonicalName: "Eosinophils (Absolute)",
    names: ["eosinophils (absolute)", "absolute eosinophil count", "aec", "eosinophils absolute"],
    canonicalUnit: "10^9/l", displayUnit: "cells/cu.mm",
    unitConversions: {
      "cells/cu.mm": (v) => v / 1000, "cells/cumm": (v) => v / 1000,
      "cells/ul": (v) => v / 1000, "cells/µl": (v) => v / 1000, "10^9/l": (v) => v,
    },
    toDisplayUnit: (v) => v * 1000,
  },
  monocytesAbsolute: {
    canonicalName: "Monocytes (Absolute)",
    names: ["monocytes (absolute)", "absolute monocyte count", "amc", "monocytes absolute"],
    canonicalUnit: "10^9/l", displayUnit: "cells/cu.mm",
    unitConversions: {
      "cells/cu.mm": (v) => v / 1000, "cells/cumm": (v) => v / 1000,
      "cells/ul": (v) => v / 1000, "cells/µl": (v) => v / 1000, "10^9/l": (v) => v,
    },
    toDisplayUnit: (v) => v * 1000,
  },

  // --- Renal / metabolic --------------------------------------------------
  urea: {
    canonicalName: "Blood Urea",
    names: ["urea", "blood urea", "s urea", "bun", "blood urea nitrogen"],
    canonicalUnit: "mmol/l",
    displayUnit: "mg/dL",
    unitConversions: { "mg/dl": (v) => v * 0.357, "mmol/l": (v) => v },
    toDisplayUnit: (v) => v / 0.357,
  },
  uricAcid: {
    canonicalName: "Uric Acid",
    names: ["uric acid", "s uric acid", "serum uric acid"],
    canonicalUnit: "umol/l",
    displayUnit: "mg/dL",
    unitConversions: { "mg/dl": (v) => v * 59.48, "umol/l": (v) => v, "µmol/l": (v) => v },
    toDisplayUnit: (v) => v / 59.48,
  },
  sodium: {
    canonicalName: "Sodium",
    names: ["sodium", "s sodium", "serum sodium", "na+", "na"],
    canonicalUnit: "mmol/l",
    displayUnit: "mEq/L",
    unitConversions: { "meq/l": (v) => v, "mmol/l": (v) => v },
    toDisplayUnit: (v) => v,
  },
};

// Test names that are clinically ambiguous on their own (fasting vs. random
// vs. post-prandial glucose; "T3" as a standalone test vs. a thyroid-panel
// component) — normalizationService refuses to guess on these rather than
// silently picking one, per the research's failure-mode table (section 4).
//
// The bare differential names sit here for the same reason: "Neutrophils"
// with no qualifier could be the percentage or the absolute count, which
// are different measurements in different units. Qualified forms
// ("Neutrophils (DLC)", "Neutrophils (Absolute)") resolve normally.
const AMBIGUOUS_BARE_NAMES = [
  "glucose", "blood sugar", "blood glucose", "t3",
  "neutrophils", "lymphocytes", "eosinophils", "monocytes", "basophils",
];

module.exports = { MARKERS, AMBIGUOUS_BARE_NAMES };
