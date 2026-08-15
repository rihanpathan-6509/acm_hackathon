// services/normalizationService.js
//
// Marker normalization / alias-resolution engine (Step 2 of Rihan's
// roadmap — "the hardest, most differentiating piece"). Built from Step 2
// research: exact alias match first, then Levenshtein-based fuzzy match for
// typos (threshold 85, per research), then refuse to resolve names that are
// clinically ambiguous on their own rather than guessing.
//
// This has no controller/route of its own — extractController calls it
// internally right after extraction lands on a lab report.

const { MARKERS, AMBIGUOUS_BARE_NAMES } = require("../utils/markerAliases");

// Build a flat lookup: normalized alias string -> marker key, once at
// module load, so exact-match resolution is O(1) per lab test instead of
// scanning every marker's alias list on every call.
const ALIAS_LOOKUP = {};
for (const [markerKey, marker] of Object.entries(MARKERS)) {
  for (const alias of marker.names) {
    ALIAS_LOOKUP[normalize(alias)] = markerKey;
  }
}

// Strips lab-boilerplate prefixes ("S.", "Sr.", "Serum", "Plasma", "Blood")
// and parenthetical suffixes ("Creatinine (Sr)"). Deliberately does NOT
// strip "fasting" — the research's own pseudocode did, but that collapses
// "Fasting Glucose" and plain "Glucose" into the same normalized string,
// and fasting-vs-random is exactly the kind of ambiguity the research's own
// failure-mode table (section 4) says should be flagged, not silently
// resolved. Only strips boilerplate about who drew the sample, not what was
// measured or under what condition.
function normalize(str) {
  return str
    .toLowerCase()
    .replace(/^(s\.?|sr\.?|serum|plasma|blood)\s+/, "")
    .replace(/\s*\(.*\)\s*$/, "")
    .replace(/[.,]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

// Levenshtein edit distance -> similarity ratio (0-100). Backs the fuzzy
// fallback for typos ("Creactinine", "Haemoglobin") once exact match fails.
function similarityRatio(a, b) {
  const m = a.length;
  const n = b.length;
  if (m === 0 && n === 0) return 100;
  const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost);
    }
  }
  return (1 - dp[m][n] / Math.max(m, n)) * 100;
}

const FUZZY_MATCH_THRESHOLD = 85; // per research section 2

/**
 * Resolve a raw test name to a canonical marker key.
 * @returns {{ markerKey: string, matchType: "exact"|"fuzzy" } | null}
 *   null means "don't guess" — either nothing matched closely enough, or
 *   the name is clinically ambiguous on its own (see AMBIGUOUS_BARE_NAMES).
 */
function resolveMarkerKey(rawTestName) {
  const cleaned = normalize(rawTestName);

  if (AMBIGUOUS_BARE_NAMES.includes(cleaned)) return null;

  if (ALIAS_LOOKUP[cleaned]) {
    return { markerKey: ALIAS_LOOKUP[cleaned], matchType: "exact" };
  }

  let best = null;
  for (const [alias, markerKey] of Object.entries(ALIAS_LOOKUP)) {
    const score = similarityRatio(cleaned, alias);
    if (score >= FUZZY_MATCH_THRESHOLD && (!best || score > best.score)) {
      best = { markerKey, score };
    }
  }
  return best ? { markerKey: best.markerKey, matchType: "fuzzy" } : null;
}

/**
 * Convert a raw (value, unit) pair to the marker's canonical unit.
 * Throws if the unit isn't one we know how to convert — caller should
 * catch this and flag the reading rather than silently store a wrong value
 * (research's "non-standard unit with no listed conversion" failure mode).
 */
function convertToCanonicalUnit(markerKey, rawValue, rawUnit) {
  const marker = MARKERS[markerKey];
  const numericValue = parseFloat(rawValue);
  if (Number.isNaN(numericValue)) {
    throw new Error(`Value "${rawValue}" is not numeric — cannot normalize.`);
  }

  const unitKey = (rawUnit || marker.canonicalUnit).toLowerCase().trim();
  const converter = marker.unitConversions[unitKey];
  if (!converter) {
    throw new Error(
      `No known conversion for unit "${rawUnit}" on marker "${marker.canonicalName}".`
    );
  }

  return converter(numericValue);
}

// Confidence scoring, ported from research section 4's assign_confidence():
// exact match = 1.0, fuzzy match = 0.85, then multiplicative penalties for
// needing a unit conversion and for a missing reference range. Thresholds
// from the same section: >=0.90 auto-accept, 0.75-0.90 flag for review,
// below 0.75 require manual verification.
const CONFIDENCE_AUTO_ACCEPT = 0.9;
const CONFIDENCE_REVIEW_FLOOR = 0.75;

function computeNormalizationConfidence({ matchType, unitConverted, referenceRangePresent }) {
  let confidence = matchType === "exact" ? 1.0 : 0.85;
  if (unitConverted) confidence *= 0.95;
  if (!referenceRangePresent) confidence *= 0.9;
  return Math.round(confidence * 100) / 100;
}

function roundTo(value, decimals) {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

/**
 * Normalize a single extracted LabTest (utils/extractionSchema.js shape:
 * test_name, value, unit, reference_range, is_abnormal, ...) into a
 * canonical reading. Date/lab come from the parent LabReport, not the test
 * itself (extraction_schema.py keeps those at report level), so the caller
 * passes them through as reportContext.
 * @param {object} labTest
 * @param {{ date: string|null, labName: string|null }} reportContext
 * @returns {object} resolved reading, or { resolved: false, rawTestName, reason }
 */
function normalizeLabTest(labTest, reportContext = {}) {
  const match = resolveMarkerKey(labTest.test_name);
  if (!match) {
    const isAmbiguous = AMBIGUOUS_BARE_NAMES.includes(normalize(labTest.test_name));
    return {
      resolved: false,
      rawTestName: labTest.test_name,
      reason: isAmbiguous
        ? "Ambiguous test name (e.g. fasting vs. random) — needs clarification, not a silent guess."
        : "No matching marker alias — needs a new entry in markerAliases.js",
    };
  }

  const { markerKey, matchType } = match;
  const marker = MARKERS[markerKey];
  const unitConverted = (labTest.unit || "").toLowerCase().trim() !== marker.canonicalUnit;

  try {
    const value = convertToCanonicalUnit(markerKey, labTest.value, labTest.unit);
    const confidence = computeNormalizationConfidence({
      matchType,
      unitConverted,
      referenceRangePresent: Boolean(labTest.reference_range),
    });

    // "Store both" (asked separately, resolved): value/canonicalUnit is SI —
    // what any cross-marker math or DB storage should use. displayValue/
    // displayUnit is the conventional unit patients actually recognize — what
    // the trend chart should render.
    const displayValue = marker.toDisplayUnit ? roundTo(marker.toDisplayUnit(value), 3) : value;

    return {
      resolved: true,
      markerKey,
      canonicalName: marker.canonicalName,
      canonicalUnit: marker.canonicalUnit,
      value: roundTo(value, 3),
      displayValue,
      displayUnit: marker.displayUnit || marker.canonicalUnit,
      originalValue: labTest.value,
      originalUnit: labTest.unit,
      date: reportContext.date || null,
      labName: reportContext.labName || null,
      // Carried through as-is — normalization never invents this either.
      isAbnormal: labTest.is_abnormal,
      matchType,
      confidence,
      needsReview: confidence < CONFIDENCE_AUTO_ACCEPT,
      requiresManualVerification: confidence < CONFIDENCE_REVIEW_FLOOR,
    };
  } catch (err) {
    return {
      resolved: false,
      rawTestName: labTest.test_name,
      reason: err.message,
    };
  }
}

/**
 * Normalize one lab report's tests into per-marker readings, grouped for
 * the trend chart / Mongo write. Called once per extracted lab report;
 * cross-report time series accumulate downstream as each new report is
 * normalized and appended.
 * @param {object} labReport  extractionSchema.js LabReport shape
 * @returns {{ series: Record<string, object[]>, unresolved: object[] }}
 */
function buildMarkerTimeSeries(labReport) {
  const reportContext = {
    date: labReport.collection_date || labReport.report_date || null,
    labName: labReport.lab_name || null,
  };

  const series = {};
  const unresolved = [];

  for (const test of labReport.tests) {
    const result = normalizeLabTest(test, reportContext);
    if (!result.resolved) {
      unresolved.push(result);
      continue;
    }
    if (!series[result.markerKey]) series[result.markerKey] = [];
    series[result.markerKey].push(result);
  }

  for (const key of Object.keys(series)) {
    series[key].sort((a, b) => new Date(a.date) - new Date(b.date));
  }

  return { series, unresolved };
}

module.exports = {
  resolveMarkerKey,
  convertToCanonicalUnit,
  computeNormalizationConfidence,
  normalizeLabTest,
  buildMarkerTimeSeries,
  CONFIDENCE_AUTO_ACCEPT,
  CONFIDENCE_REVIEW_FLOOR,
};
