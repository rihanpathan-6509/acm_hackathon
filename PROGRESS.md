# ChronicCare AI — AI/ML Progress (Rihan)

**Last updated:** 2026-08-14

Status of the three pieces I own (extraction schema, marker normalization,
chat companion guardrails) per the merged plan. Each piece is built from my
own Perplexity research, not invented — see `extraction_schema.py` /
`extraction_system_prompt.md` for Step 1's source research.

---

## Step 1 — Extraction (prescriptions + lab reports): DONE, research-backed

- `schemas/extractionSchema.js` — Zod schema, ported field-for-field from
  my researched `extraction_schema.py`.
- `utils/promptTemplate.js` — the extraction system prompt, ported from my
  researched `extraction_system_prompt.md` (flag-don't-guess rules,
  confidence bands, 3 worked examples).
- `services/geminiService.js` — sends the image to Gemini, validates the
  response against the schema, recomputes `requires_manual_review` server-side.
- Output shape: `{ input_type, prescription, lab_report, requires_manual_review }`.
  Every field carries its own `confidence` + `field_flags`; `is_abnormal` on
  lab tests is only ever copied from an explicit marker on the report, never
  inferred.
- **Not yet tested against the real Gemini API** — needs `npm install` +
  `GEMINI_API_KEY`, and real sample prescription/lab images.

## Step 2 — Marker normalization: DONE, research-backed

- `utils/markerAliases.js` — static alias table, 7 markers covering the
  diabetes/hypertension/thyroid/CKD demo scope (HbA1c, Creatinine, Fasting
  Glucose, Hemoglobin, TSH, Potassium, LDL Cholesterol), with real
  unit-conversion formulas (e.g. HbA1c NGSP %  ↔ IFCC mmol/mol, creatinine
  mg/dL ↔ µmol/L).
- `services/normalizationService.js` — exact alias match → Levenshtein
  fuzzy match (85% threshold, catches typos like "Creactinine") → refuses
  to resolve names that are clinically ambiguous on their own (e.g. bare
  "Glucose" with no fasting/random qualifier) rather than guessing.
- Confidence scoring ported from research: exact/fuzzy match →
  unit-conversion penalty → missing-reference-range penalty, with
  ≥0.90 auto-accept / 0.75–0.90 flag-for-review / <0.75 manual-verification
  thresholds.
- Verified locally against sample data: correct HbA1c/creatinine
  conversions, typo correctly fuzzy-matched, ambiguous "Glucose" correctly
  refused instead of guessed, unknown test correctly left unresolved.
- **Units decision, resolved:** store both. Every normalized reading now
  carries `value`/`canonicalUnit` (SI/IFCC — for storage and any
  cross-marker math) and `displayValue`/`displayUnit` (%, mg/dL, mEq/L —
  the conventional units patients actually see on their reports). Nikhil's
  trend chart should render `displayValue`/`displayUnit`.

## Step 3 — Chat companion guardrails: DONE, research-backed

- `utils/chatPromptTemplate.js` — system prompt built from Step 3 research:
  a scope contract (only 3 permitted actions: explain what the doctor
  already said, describe the patient's own data trend without interpreting
  it, or redirect to a doctor), an explicit banned-phrase list ("you may
  have", "consistent with", "likely", etc. — phrases that leak a diagnosis
  even inside a nominal refusal), and a mandatory refusal → optional
  general education → redirect structure for anything diagnosis-adjacent.
- Multi-turn circumvention guard: `turnAskedForDiagnosis()` scans prior
  turns in the conversation for probe patterns (from the research's own
  red-team examples — "is this serious?", "what does X mean?", "pretend
  you're my doctor", "list conditions that cause X", etc.); if an earlier
  turn probed for a diagnosis, later turns get a session note telling the
  model not to answer around it.
- `services/chatService.js` — post-hoc output filter: scans the model's
  reply for the same banned phrases before returning it, and substitutes a
  safe fallback (in English or Hindi) if any slipped through.
- Hindi guardrail: the prompt explicitly requires the Hindi refusal be as
  direct as the English one, with a model phrase provided, since the
  research flagged that safety tuning can be weaker in lower-resource
  languages.
- **Emergency boundary, unchanged:** the rule-based emergency-keyword
  system stays backend's and runs *before* this prompt is ever called. The
  prompt has a belt-and-suspenders fallback clause (per research) for the
  rare case that pre-check misses something mid-conversation — it doesn't
  attempt triage, only repeats "seek care / call emergency services now."
  Still needs Sync 4 with Sarhak & Sufiyaan to confirm this can't drift
  from their actual keyword list/number.
- Verified locally: all of the research's own adversarial probe examples
  correctly flagged, ordinary med/diet questions correctly left unflagged,
  banned-phrase scan correctly catches leaky text and passes clean text.
- **Not yet tested against the real Gemini API** — same blocker as Step 1.

---

## File status at a glance

| File | Status |
|---|---|
| `schemas/extractionSchema.js` | ✅ real, research-backed |
| `utils/promptTemplate.js` | ✅ real, research-backed |
| `services/geminiService.js` | ✅ real, wired to the above |
| `data/drugCatalog.js` | ✅ real (flat list, not research-sensitive) |
| `utils/markerAliases.js` | ✅ real, research-backed |
| `services/normalizationService.js` | ✅ real, research-backed |
| `utils/chatPromptTemplate.js` | ✅ real, research-backed |
| `services/chatService.js` | ✅ real, wired to the above |
| `controllers/`, `routes/`, `index.js`, `config/gemini.js` | ✅ plumbing, not research-dependent |

## Not yet done / blockers

- `npm install` hasn't been run in this scaffold — no `node_modules` yet.
- No `GEMINI_API_KEY` configured, so nothing has actually called Gemini yet.
- No real sample prescription/lab report images tested through the
  pipeline — everything above is verified with hand-built sample data only.
- Schema/normalization shape hasn't been signed off with Sarhak & Sufiyaan
  yet (Sync 1 / Sync 2 in the roadmap).

## Open sync points with the team

- **Sarhak & Sufiyaan:** sign off on the `ExtractionResult` shape above for
  the Mongo schema; align on the normalized marker/time-series shape
  (`series`/`unresolved` from `buildMarkerTimeSeries`).
- **Nikhil:** sample normalized-marker output is ready to hand off for the
  trend chart component — blocked only on the canonical-unit decision above.
- **Sarhak & Sufiyaan (Sync 4):** confirm the exact emergency-keyword list
  and emergency number/instruction text, so the chat prompt's fallback
  clause can't drift from their deterministic system; also confirm the
  actual shape they'll pass in for patient meds + trend flags (the chat
  code currently assumes `{ patientMeds: [{drugName, dose, timing}],
  trendFlags: [{markerName, plainLanguageFlag}], language }` — see
  `chatService.js`).
- **Nikhil (chat UI):** input/output shape for `/api/chat` is stable —
  `{ message, patientContext, history }` in, `{ reply }` out — ready to
  build the chat UI against.
