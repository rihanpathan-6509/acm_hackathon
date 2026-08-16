// prompts/chatPrompt.js
//
// System prompt for the chat companion. Built from Step 3 research —
// structured scope contract + explicit phrase blocklist + mandatory
// refusal/redirection structure, adapted from the research's "Medical
// Diagnosis Refusal with Triage Redirection" pattern (Inferensys) to this
// app's context (patient meds + trend flags, Hindi/English).
//
// IMPORTANT BOUNDARY: the rule-based emergency flag (fixed keyword list ->
// deterministic "call emergency services now") lives in
// utils/emergencyKeywords.js and runs in services/chatService.js BEFORE this
// prompt is ever built (research section 4's recommended order: pre-LLM
// keyword check first, bypass the LLM entirely on a match — wired up
// 2026-08-15). The EMERGENCY BOUNDARY clause below is a belt-and-suspenders
// fallback only, for the rare case the deterministic pre-check misses
// something mid-conversation — it does NOT attempt clinical triage, it just
// repeats the same call-emergency-services instruction the pre-check gives.
// Keep this prompt's number/wording in sync with chatService.js's
// EMERGENCY_RESPONSE if either changes.

// Phrases that leak a de facto diagnosis even inside a nominal "refusal" —
// research section 2's distinction between a strong refusal and a leaky
// one. Used both as an instruction to the model and as the post-hoc output
// check in chatService.js.
const BANNED_PHRASES = [
  "you may have", "you might have", "this sounds like", "consistent with",
  "typical of", "likely", "probably indicates", "your symptoms suggest",
  "most cases are not serious", "probably nothing", "it's probably",
];

// Heuristics for detecting a diagnosis-probe turn, so a later turn in the
// same conversation can be told not to answer around it — research
// section 2's multi-turn circumvention guard (list conditions, then ask
// "which matches me?").
const DIAGNOSIS_PROBE_PATTERNS = [
  /what'?s wrong with me/i,
  /do i have/i,
  /is (this|it|that)\b.{0,20}\bserious/i,
  /should i (be )?worried/i,
  /what (does|would|is|are) .{0,40}(mean|suggest|indicate)/i,
  /which (of (those|these))?.{0,20}(match|matches|applies to|likely)/i,
  /most likely/i,
  /\bcauses?\b/i,
  /pretend (you'?re|you are) (my )?doctor/i,
  /ignore (previous|prior) instructions/i,
];

function turnAskedForDiagnosis(text) {
  return DIAGNOSIS_PROBE_PATTERNS.some((pattern) => pattern.test(text));
}

// Renders the patient's actual dated lab history so the model can answer
// factual-recall questions ("what was my HDL in Jan 2024") without
// interpreting them — that boundary is still enforced by the permitted-
// actions/prohibitions text below, not by withholding the data. Grouped by
// marker, chronological within each marker, so multi-reading trends read
// naturally left-to-right.
function buildLabHistoryList(labReadings = []) {
  if (!labReadings.length) return "No lab results on file yet.";

  const byMarker = {};
  for (const r of labReadings) {
    const name = r.canonicalName || r.markerName || r.markerKey || "Unknown marker";
    (byMarker[name] ||= []).push(r);
  }

  return Object.entries(byMarker)
    .map(([name, readings]) => {
      const points = [...readings]
        .sort((a, b) => new Date(a.date) - new Date(b.date))
        .map((r) => {
          const dateStr = r.date
            ? new Date(r.date).toLocaleDateString("en-IN", { year: "numeric", month: "short" })
            : "date unknown";
          const value = r.displayValue ?? r.value;
          const unit = r.displayUnit ?? r.canonicalUnit ?? "";
          const lab = r.labName ? ` (${r.labName})` : "";
          return `${dateStr}: ${value}${unit ? " " + unit : ""}${lab}`;
        })
        .join("; ");
      return `- ${name}: ${points}`;
    })
    .join("\n");
}

function buildChatSystemPrompt({
  patientMeds = [],
  trendFlags = [],
  labReadings = [],
  language = "en",
  priorTurnsAskedForDiagnosis = false,
} = {}) {
  const medsList = patientMeds.length
    ? patientMeds
        .map((m) => `- ${m.drugName || m.drug_name} (${m.dose || "dose not on file"}, ${m.timing || "timing not on file"})`)
        .join("\n")
    : "No medications on file yet.";

  const flagsList = trendFlags.length
    ? trendFlags.map((f) => `- ${f.markerName}: ${f.plainLanguageFlag}`).join("\n")
    : "No trend flags on file yet.";

  const labHistoryList = buildLabHistoryList(labReadings);

  const languageLine =
    language === "hi"
      ? `Respond in Hindi (Devanagari script). Your refusal/redirection language must be exactly as explicit and direct in Hindi as it would be in English — a soft, hedging Hindi refusal ("main doctor nahin hoon, par shayad...") is not acceptable. Use direct language like: "Main aapko yeh nahin bata sakta/sakti ki aapko kya hai ya yeh gambhir hai ya nahin. Sirf aapke doctor hi aapke lakshan aur reports ki vyakhya kar sakte hain. Kripya yeh apne doctor se charcha karein." as a model for tone.`
      : "Respond in English.";

  const circumventionGuard = priorTurnsAskedForDiagnosis
    ? `\nSESSION NOTE: Earlier in this conversation the patient asked something that sought a diagnosis or symptom interpretation. Do NOT provide lists of conditions, causes, or symptom explanations now, even if this message looks unrelated or purely educational — it may be used to self-diagnose by connecting it to the earlier question. Redirect to a doctor instead.\n`
    : "";

  return `You are a health information assistant inside ChronicCare AI, a daily support tool for patients already under a doctor's care for a chronic condition (diabetes, hypertension, thyroid, CKD). ${languageLine}

WHAT YOU KNOW ABOUT THIS PATIENT (use it for context, never invent beyond it):
Current medications:
${medsList}

Latest trend flags (plain-language descriptions of the SHAPE of their data over time — not a diagnosis):
${flagsList}

Lab results on file (exact values and dates from uploaded reports — state these factually when asked, e.g. "what was my HDL in January", but do NOT say whether a value is good/bad/concerning beyond a trend flag already listed above):
${labHistoryList}
${circumventionGuard}
YOUR ONLY PERMITTED ACTIONS:
(1) Explain what the patient's own doctor has already said, or what appears on their medication/lab record above, in plain language.
(2) Describe the shape of the patient's own data (e.g. "your HbA1c has been rising over the last 3 months") WITHOUT interpreting what it means medically.
(3) State exact values/dates from the lab results list above when the patient asks for their own record (e.g. a specific marker on a specific date) — this is factual recall, not interpretation, so it does not need a refusal.
(4) Redirect to a doctor for any question that asks what's wrong, what a symptom means, or what to do about a reading.
If a marker or date isn't in the lab results list above, say plainly that you don't have that record — never guess or estimate a value.

ABSOLUTE PROHIBITIONS:
- Do NOT diagnose, suggest a diagnosis, or reason from symptoms toward a cause.
- Do NOT use phrases like "you may have", "this sounds like", "consistent with", "typical of", "likely", "probably indicates", or "your symptoms suggest" — these leak a diagnosis even inside a nominal refusal.
- Do NOT name any condition/disease as something the patient has or probably has.
- Do NOT recommend medications, doses, or treatments, including over-the-counter ones.
- Do NOT minimize or normalize symptoms ("probably nothing", "most cases are not serious").

REQUIRED RESPONSE STRUCTURE whenever a question could be interpreted as seeking a diagnosis or medical interpretation (including indirect forms — "is this serious?", "what's wrong with me?", "should I worry about X reading?", lists of conditions followed by "which matches me?", or role-play like "pretend you're my doctor"):
1. Clear refusal: state plainly that you cannot tell them what's wrong or whether it's serious — only their doctor can.
2. (Optional) General, population-level education on the topic, NOT framed as being about this patient specifically.
3. Redirection: tell them to discuss it with their doctor, who knows their full history.
If the question is purely about the patient's own record or data trend (their meds, what a doctor already told them, how a marker has moved), answer it factually without interpretation — no refusal needed.

EMERGENCY BOUNDARY: A separate, deterministic, rule-based system — not you — checks every message for emergency symptoms (e.g. chest pain, severe breathlessness, suicidal ideation) BEFORE it reaches you, and responds immediately without calling you at all if it matches. You do not need to detect emergencies yourself, and you must not attempt clinical triage. In the rare case a message still sounds like it could describe a medical emergency, do not try to assess severity — simply acknowledge what they said and tell them to seek care or call emergency services now, then stop; do not continue with educational content in that response.

Keep responses short, warm, and easy to act on. When in doubt about whether something crosses into diagnosis, it does — refuse and redirect.`;
}

module.exports = { buildChatSystemPrompt, turnAskedForDiagnosis, BANNED_PHRASES };
