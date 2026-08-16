// utils/labStatus.js
//
// Decides how a lab test's status badge should read. Two distinct sources,
// kept separate on purpose:
//
//   1. The lab's own H/L flag (`is_abnormal`). Authoritative — it's what the
//      lab printed. The AI never sets this by comparing value to range (that
//      boundary is the whole point of the extraction design), so it's null
//      whenever the report didn't flag the row.
//
//   2. A deterministic comparison of the printed value to the printed range,
//      done here in plain arithmetic — NOT the AI reasoning about anything.
//      Only used when the lab gave no flag. This is what stops an
//      out-of-range value (e.g. 215 against "0 - 200") from showing a green
//      "Normal" badge just because the report didn't stamp an H next to it.
//
// The range parser is deliberately conservative: it only handles clean
// "min - max", "< max", and "> min" forms. Anything descriptive or
// multi-part (e.g. HDL's ">60: Optimal 40-59: Near Optimal <40: Low")
// returns "unknown" rather than risk a wrong flag from mis-parsing.

// → "high" | "low" | "in-range" | "unknown"
export function compareToRange(rawValue, rawRange) {
  const value = parseFloat(rawValue);
  if (!Number.isFinite(value) || !rawRange) return "unknown";

  const range = String(rawRange).trim();

  const minMax = /^(-?\d+(?:\.\d+)?)\s*[-–]\s*(-?\d+(?:\.\d+)?)$/.exec(range);
  if (minMax) {
    const min = parseFloat(minMax[1]);
    const max = parseFloat(minMax[2]);
    if (value < min) return "low";
    if (value > max) return "high";
    return "in-range";
  }

  const upperOnly = /^[<≤]\s*(-?\d+(?:\.\d+)?)$/.exec(range);
  if (upperOnly) return value > parseFloat(upperOnly[1]) ? "high" : "in-range";

  const lowerOnly = /^[>≥]\s*(-?\d+(?:\.\d+)?)$/.exec(range);
  if (lowerOnly) return value < parseFloat(lowerOnly[1]) ? "low" : "in-range";

  return "unknown";
}

// Combined verdict for the status badge.
// tone: "red" | "amber" | "green" | "gray"
export function getLabTestStatus(test) {
  // The lab's own flag wins whenever it's present.
  if (test.is_abnormal === true) {
    return { label: "Abnormal", tone: "red", title: "Flagged as abnormal on the report" };
  }
  if (test.is_abnormal === false) {
    return { label: "Normal", tone: "green", title: "Marked normal on the report" };
  }

  // No flag from the lab — fall back to the printed range.
  const cmp = compareToRange(test.value, test.reference_range);
  if (cmp === "high") {
    return { label: "Above range", tone: "amber", title: "Higher than the range printed on your report — please confirm with your doctor" };
  }
  if (cmp === "low") {
    return { label: "Below range", tone: "amber", title: "Lower than the range printed on your report — please confirm with your doctor" };
  }
  if (cmp === "in-range") {
    return { label: "In range", tone: "green", title: "Within the range printed on your report" };
  }
  return { label: "Not flagged", tone: "gray", title: "The report didn't flag this, and its range couldn't be read automatically" };
}

export const TONE_CLASSES = {
  red: "bg-danger-100 text-danger-800",
  amber: "bg-warning-100 text-warning-800",
  green: "bg-success-100 text-success-800",
  gray: "bg-stone-100 text-ink-soft",
};
