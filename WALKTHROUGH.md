# ChronicCare AI — AI/ML Pipeline: Complete Walkthrough

**For:** Rihan (so you can explain any of this to the team, or to judges, from memory)
**Covers:** everything built in `rihan-ai-ml/`, from why each piece exists to exactly how the code works.
**Companion doc:** `PROGRESS.md` is the short, team-facing status summary. This is the long version — read this one to actually understand the system.

---

## 0. How we got here (short version)

You own three pieces of ChronicCare AI (the merged hackathon product — see
`ChronicCare_AI_Merged_Plan.md`): the **extraction pipeline**, **marker
normalization**, and the **chat companion's guardrails**. Earlier attempts at
scaffolding this project filled in schema/prompt content that Claude
invented on its own, not from your actual research — you caught that and
asked to start over properly. Everything described below was rebuilt (or, for
extraction, corrected) to trace back to real research you ran on Perplexity,
one step at a time:

1. You researched **extraction** → I ported your findings into working code.
2. You researched **marker normalization** → same.
3. You researched **chat guardrails** → same.

Nothing in the three "brains" of this system (the schema, the two prompts,
the alias table, the guardrail logic) was invented without a research doc
behind it. Where I made an implementation judgment call not directly spelled
out in the research, it's called out explicitly in §7 (Decisions Made).

---

## 1. The problem, in one paragraph

Chronic-disease patients (diabetes, hypertension, thyroid, CKD) manage their
condition almost entirely alone between doctor visits. Two raw inputs exist —
**prescriptions** (photos, often handwritten) and **lab reports** (PDFs/photos,
any lab, any format) — and three things need to happen to them: turn
prescriptions into structured reminders, turn scattered lab reports into one
continuous trend per marker (even though different labs name and unit things
differently), and let patients ask questions about their own data without the
system ever crossing into diagnosis. That's extraction → normalization → chat,
your three pieces.

## 2. High-level architecture

```
 Prescription photo ──┐
                       ├──▶  EXTRACTION (Step 1)  ──▶  structured JSON
 Lab report (PDF/photo)┘        Gemini vision call         (schema-validated)
                                                                  │
                          ┌───────────────────────────────────────┤
                          ▼                                       ▼
                  prescription.medications              lab_report.tests
                  (→ backend's reminder engine)                  │
                                                                  ▼
                                              NORMALIZATION (Step 2)
                                          alias resolution + unit conversion
                                                                  │
                                                                  ▼
                                            per-marker time series
                                        (→ Nikhil's trend chart, Mongo)
                                                                  │
                          ┌───────────────────────────────────────┘
                          ▼
                  CHAT COMPANION (Step 3)
          guardrailed Q&A, aware of meds + trend flags
          (emergency detection stays backend's, separate system)
```

One extraction pipeline feeds two downstream consumers (reminders,
normalization/trends), and both feed the chat companion as context. That's
why the schema from Step 1 is the single most load-bearing file in your
slice — everything else depends on its shape staying stable.

---

## 3. Step 1 — Extraction

### What it does and why it's built this way

Given a photo of a prescription or a lab report, ask Gemini's vision model to
read it directly (no separate OCR stage — your research found that
multimodal LLM vision handles OCR + structuring in one call, which is enough
for a hackathon MVP and saves a whole pipeline stage) and return one strict
JSON shape. The core design rule, non-negotiable throughout: **flag, don't
guess**. If a field is unclear, the model still gives its best-effort
reading, but has to say so — via a confidence score and a flag — rather than
silently presenting a shaky read as certain.

### The schema (`schemas/extractionSchema.js`)

A Zod port of your researched `extraction_schema.py`, field-for-field
identical on purpose (so it can never quietly drift from what you actually
signed off on):

```
ExtractionResult
├── input_type: "prescription" | "lab_report"
├── prescription (nullable)
│   ├── patient_name, date, doctor_name, clinic_name
│   ├── medications: [{ drug_name, dose, timing, instructions, duration,
│   │                    confidence, field_flags[] }]
│   ├── overall_confidence
│   └── extraction_notes
├── lab_report (nullable)
│   ├── patient_name, patient_id, collection_date, report_date, lab_name
│   ├── tests: [{ test_name, value, unit, reference_range, is_abnormal,
│   │             confidence, field_flags[] }]
│   ├── overall_confidence
│   └── extraction_notes
└── requires_manual_review: boolean
```

Three design choices worth understanding, not just knowing:

- **`field_flags` is a list of field *names*, not a single blob.** So the app
  knows exactly which field to highlight as "please confirm" — not just that
  *something* in the record was shaky.
- **`overall_confidence` is the *lowest* field confidence, never an
  average.** One badly-read dose shouldn't get hidden by three well-read
  ones. `computeRequiresManualReview()` in this file implements that: true if
  `overall_confidence < 0.7` **or** any `field_flags` list is non-empty.
- **`is_abnormal` is only ever copied from an explicit marker printed on the
  report itself** (an "H"/"L" flag, bold, asterisk) — never computed by the
  model comparing the value to the reference range. That comparison would be
  the model doing clinical judgment, which is the one thing nothing in this
  product is allowed to do.

### The prompt (`utils/promptTemplate.js`)

`buildExtractionSystemPrompt()` builds the actual instruction sent alongside
every image, ported near-verbatim from your researched
`extraction_system_prompt.md`. It has:

- **7 hard rules** (flag-don't-guess, transcribe exactly without normalizing
  drug/test names yet, don't infer missing fields, `is_abnormal` boundary
  above, no clinical commentary, cross-reference drug names against
  `data/drugCatalog.js`, output *only* JSON).
- **Concrete confidence bands**, not vague guidance: 0.9–1.0 = clean printed
  text, 0.7–0.89 = minor ambiguity, 0.4–0.69 = genuine best-guess off bad
  handwriting, below 0.4 = essentially unreadable but still emit a flagged
  value.
- **3 worked examples** baked into the prompt itself — printed & unambiguous,
  handwritten & ambiguous, and a lab report where a value sits outside its
  printed range but `is_abnormal` stays `null` because the report didn't
  flag it. That third example exists specifically to stop the model from
  "helpfully" doing the abnormality judgment itself.

### The service (`services/geminiService.js`)

`extractDocument(base64Image, mimeType)`:

1. Builds the prompt, sends it + the image to Gemini (`gemini-1.5-pro`,
   temperature 0.1 — low on purpose, you want faithful reads, not creative
   ones — see `config/gemini.js`).
2. Parses the raw text as JSON (throws with the raw response attached if it
   isn't valid JSON — easier to debug than a silent failure).
3. **Recomputes `requires_manual_review` itself**, server-side, using
   `computeRequiresManualReview()` — it does not trust the model's own
   arithmetic on that field.
4. Validates the whole thing against the Zod `ExtractionResult` schema
   before returning it. If Gemini's output doesn't match the shape, the
   caller gets a clear validation error instead of malformed data leaking
   downstream.

### Worked example

Image: a lab report showing `Hemoglobin: 11.2 g/dL (Ref: 12.0-15.5) L` and
`Serum Creatinine: 1.4 mg/dL (Ref: 0.7-1.3)` (no flag printed on creatinine).

```json
{
  "input_type": "lab_report",
  "lab_report": {
    "tests": [
      { "test_name": "Hemoglobin", "value": "11.2", "unit": "g/dL",
        "reference_range": "12.0-15.5", "is_abnormal": true,
        "confidence": 0.95, "field_flags": [] },
      { "test_name": "Serum Creatinine", "value": "1.4", "unit": "mg/dL",
        "reference_range": "0.7-1.3", "is_abnormal": null,
        "confidence": 0.93, "field_flags": [] }
    ],
    "overall_confidence": 0.93
  },
  "requires_manual_review": false
}
```

Creatinine's `is_abnormal` is `null` even though 1.4 sits outside 0.7–1.3 —
because the report itself didn't mark it.

---

## 4. Step 2 — Marker Normalization

### What it does and why it's the hard piece

Different labs report the same test under different names and units:
"HbA1c" = "A1C" = "Glycated Hemoglobin"; a creatinine reading might come back
in mg/dL from one lab and µmol/L from another. Without resolving these to one
identity, a patient's values from three different labs over six months can't
sit on the same trend line — which is the entire point of the "Trendline"
half of the merged product. This is explicitly called out in the plan as
*"the hardest, most differentiating piece — protect time for it."*

Your research compared three approaches (full LOINC integration, embedding-
based fuzzy matching, a static alias lookup table) and the static table won
for this build size: 90–95% accuracy, under 10ms per lookup, buildable in
hours rather than days. LOINC and embeddings only pay off past ~50 markers or
highly diverse naming — you have 7 markers for a fixed disease set.

### The alias table (`utils/markerAliases.js`)

7 markers, matched to the demo's disease scope (diabetes / hypertension /
thyroid / CKD): **HbA1c, Serum Creatinine, Fasting Glucose, Hemoglobin, TSH,
Potassium, LDL Cholesterol**. Each entry has:

```js
hba1c: {
  canonicalName: "HbA1c",
  names: ["hba1c", "a1c", "glycated hemoglobin", ...],   // aliases to match against
  canonicalUnit: "mmol/mol",   // SI/IFCC — what gets stored, for consistent math
  displayUnit: "%",            // conventional — what the trend chart shows
  unitConversions: { "%": (v) => (v - 2.15) * 10.929, "mmol/mol": (v) => v },
  toDisplayUnit: (v) => v / 10.929 + 2.15,
}
```

Every marker carries **both** a canonical (SI) unit and a display
(conventional) unit — that was an explicit decision you made (§7) after I
flagged that the research's example table used SI units, which aren't what
Indian lab reports or patients actually see.

There's also an `AMBIGUOUS_BARE_NAMES` list (`"glucose"`, `"blood sugar"`,
`"blood glucose"`, `"t3"`) — test names that are clinically meaningless on
their own (fasting glucose and random glucose are different things
medically) and must never be silently resolved to one or the other.

### The normalization algorithm (`services/normalizationService.js`)

For each raw `{test_name, value, unit}` coming out of extraction:

1. **`normalize()`** — lowercases, strips lab-boilerplate prefixes (`S.`,
   `Sr.`, `Serum`, `Plasma`, `Blood`) and parenthetical suffixes
   (`"Creatinine (Sr)"` → `"creatinine"`). Deliberately does **not** strip
   "fasting" — the research's own pseudocode did, but that would silently
   merge "Fasting Glucose" and plain "Glucose" into the same string, which
   is exactly the ambiguity the research's own failure-mode table says
   should be flagged, not resolved.
2. **`resolveMarkerKey()`** — exact match against the alias table first. If
   nothing matches exactly, falls back to **fuzzy matching**: a Levenshtein
   edit-distance similarity score, threshold 85 (per research), catching
   typos like "Creactinine" → creatinine. If the cleaned name is in
   `AMBIGUOUS_BARE_NAMES`, returns `null` immediately — refuses to guess.
3. **`convertToCanonicalUnit()`** — applies the marker's conversion formula
   for whatever unit was printed. Throws if the unit isn't one it knows
   (e.g. an unexpected unit with no listed conversion) rather than silently
   storing a wrong number.
4. **`computeNormalizationConfidence()`** — ported from your research:
   starts at 1.0 for an exact match / 0.85 for a fuzzy match, multiplied by
   0.95 if a unit conversion was needed, multiplied by 0.9 if the source
   report had no printed reference range. Thresholds: **≥0.90 auto-accept,
   0.75–0.90 flag for review, below 0.75 require manual verification.**
5. Every resolved reading comes back with **both** units — `value` +
   `canonicalUnit` (SI, for any cross-marker math or DB storage) and
   `displayValue` + `displayUnit` (conventional, for the UI).

`buildMarkerTimeSeries(labReport)` runs this over every test in one lab
report, groups results by marker, sorts each marker's series by date, and
separately returns anything that couldn't be resolved (`unresolved`) so
those never silently vanish — they're either shown for manual review or
logged, a decision still open with backend (see `PROGRESS.md`).

### Worked example (actually run against this code)

Input: `HbA1c 7.0%`, `S. Creatinine 1.2 mg/dL`, `Creactinine 1.1 mg/dL` (typo),
`Glucose 110 mg/dL` (bare — ambiguous).

| Input | Result |
|---|---|
| `HbA1c 7.0%` | → `hba1c`, exact match, **53.006 mmol/mol** (canonical) / **7% ** (display) |
| `S. Creatinine 1.2 mg/dL` | → `creatinine`, exact match after prefix strip, **106.08 µmol/L** / **1.2 mg/dL** |
| `Creactinine 1.1 mg/dL` | → `creatinine`, **fuzzy** match (typo), confidence 0.81, flagged for review |
| `Glucose 110 mg/dL` | → **unresolved**: "Ambiguous test name (e.g. fasting vs. random) — needs clarification, not a silent guess." |

---

## 5. Step 3 — Chat Companion Guardrails

### What it does and why it's dangerous to get wrong

The chat companion answers patient questions about diet, lifestyle, and
their own medications, aware of their current meds and latest trend flags.
The hard constraint, unchanged since the very first version of this plan:
**it must never diagnose, or reason from a symptom toward a cause.** Every
response has to either explain something the doctor already said, describe
the *shape* of the patient's own data without interpreting it medically, or
redirect to a doctor. A completely separate, deterministic, rule-based
system (backend's, not yours) handles actual emergency detection — the chat
companion must never try to duplicate that.

The genuinely hard part, per your research: a chatbot can *say* "I can't
diagnose you" while still leaking a de facto diagnosis in the same breath
("...but this sounds like it could be early kidney trouble"). The research's
distinction between a **strong refusal** and a **leaky refusal** is the core
of what got built here.

### The prompt (`utils/chatPromptTemplate.js`)

`buildChatSystemPrompt({ patientMeds, trendFlags, language, priorTurnsAskedForDiagnosis })`
assembles a prompt with four layers, straight from the research:

1. **Scope contract** — exactly 3 permitted actions (explain what the
   doctor/record already said, describe the data's shape without
   interpreting it, redirect to a doctor). Nothing else is allowed.
2. **An explicit banned-phrase list** — `"you may have"`, `"this sounds
   like"`, `"consistent with"`, `"typical of"`, `"likely"`, `"your symptoms
   suggest"`, `"probably nothing"`, etc. These are exactly the phrases that
   make a refusal leaky rather than strong.
3. **A mandatory structure** for anything diagnosis-adjacent: clear refusal
   → optional *population-level* education (not framed as being about this
   patient) → redirect to a doctor. Purely factual questions about the
   patient's own record skip this and get answered directly.
4. **A Hindi-parity instruction** — your research found that a soft, hedging
   refusal in Hindi ("main doctor nahin hoon, par shayad...") leaks a
   diagnosis just as easily as a leaky English one, and that safety tuning
   can be weaker in lower-resource languages generally. The prompt requires
   the Hindi refusal be exactly as direct as the English one and gives a
   model phrase to anchor the tone.

There's also an **`EMERGENCY BOUNDARY`** clause — but read this carefully,
it's a fallback, not a feature. Backend's deterministic keyword system runs
*before* this prompt is ever called and short-circuits entirely on a match
(the LLM never even sees the message). The clause in this prompt only
covers the rare case that pre-check misses something mid-conversation, and
even then it doesn't attempt triage — it just repeats "seek care / call
emergency services now" and stops. This still needs a sync with Sarhak &
Sufiyaan (Sync 4) so the wording can't drift from their actual keyword list.

### The multi-turn circumvention guard

Your research's own red-team examples showed the boundary can be walked
around across multiple turns — e.g. "What causes chest pain?" → "Which of
those are most likely in a 45-year-old?" — neither message alone looks like
a diagnosis request, but together they are one.

`turnAskedForDiagnosis(text)` in `chatPromptTemplate.js` checks a message
against a set of patterns pulled directly from the research's own
adversarial test list: `"what's wrong with me"`, `"is this serious"`,
`"should I be worried"`, `"what does X mean/suggest"`, `"which of those...
most likely"`, `"pretend you're my doctor"`, `"causes of..."`, etc.
`chatService.js` scans every prior user turn in the conversation with this
function; if any earlier turn probed for a diagnosis, the current turn's
prompt gets a `SESSION NOTE` telling the model not to answer around it —
even if this specific message looks unrelated or purely educational.

*(This heuristic is a second layer, not the primary defense — the
scope contract and banned-phrase rules in the base prompt apply to every
single turn regardless of whether this flag fires.)*

### The output filter (`services/chatService.js`)

After Gemini responds, `containsBannedLanguage()` scans the actual reply
text for the same banned phrases from the prompt — a cheap, deterministic
double-check that doesn't rely on the model perfectly following its own
instructions. If anything leaked through, the reply is thrown away and
replaced with a safe fallback message (English or Hindi), and a warning is
logged. This is the research's "post-LLM output filter" pattern, implemented
as a phrase-blocklist scan rather than a second LLM call — a full retry loop
wasn't worth the latency/complexity for a 2-day build.

### Worked example

**Good question:** *"What time should I take my metformin?"* → answered
directly and factually, no refusal needed (it's about the patient's own
medication record).

**Leading question:** *"My HbA1c has been rising — is that serious?"* →
refusal ("I can't tell you whether that's serious — only your doctor can
interpret it") → optional general note on what HbA1c tracks, framed
population-level → redirect to the doctor. If the model's actual response
somehow included a phrase like *"this is likely a sign of..."*, the
post-hoc filter in `chatService.js` would catch it and substitute the safe
fallback before the patient ever sees it.

---

## 6. File map

```
rihan-ai-ml/
├── config/gemini.js              Gemini client — extraction model (vision, temp 0.1)
│                                  + chat model (text, temp 0.4)
├── data/drugCatalog.js           ~40 common Indian generic drug names (cross-reference list)
├── schemas/extractionSchema.js   Zod port of extraction_schema.py — the shared contract
├── utils/
│   ├── promptTemplate.js         Extraction system prompt (Step 1)
│   ├── markerAliases.js          Marker alias table + unit conversions (Step 2)
│   └── chatPromptTemplate.js     Chat guardrail system prompt (Step 3)
├── services/
│   ├── geminiService.js          Calls Gemini for extraction, validates against schema
│   ├── normalizationService.js   Alias resolution + unit conversion + confidence scoring
│   └── chatService.js            Calls Gemini for chat, runs the output filter
├── controllers/
│   ├── extractController.js      POST /api/extract
│   └── chatController.js         POST /api/chat
├── routes/                       Express route wiring for the two controllers above
└── index.js                      Standalone Express app (npm start) for testing solo
```

## 7. Decisions made along the way (and why)

- **Canonical units: store both.** The research's own example alias table
  used SI/IFCC units (mmol/mol, µmol/L). I flagged that this doesn't match
  what Indian lab reports or patients actually see (%, mg/dL) and asked you
  directly rather than picking silently — you chose to store both: SI
  internally for consistent math, conventional for display. Implemented via
  `displayValue`/`displayUnit` + `toDisplayUnit()` on every marker.
- **Don't strip "fasting" as a normalization prefix.** The research's own
  pseudocode did this, but it would have collapsed "Fasting Glucose" and
  plain "Glucose" into one match — directly contradicting the research's own
  failure-mode table, which calls that exact ambiguity out as something to
  flag, not resolve. I fixed this rather than copying the research verbatim.
- **`documentType` is no longer a required client input to `/api/extract`.**
  The researched prompt design has the model determine `input_type` itself
  (see the prompt's TASK section) — so the earlier scaffold's requirement
  that the caller specify it upfront was dropped as redundant.
- **Emergency fallback clause included in the chat prompt, but kept
  strictly secondary.** The research recommends a "belt-and-suspenders"
  fallback in the LLM prompt alongside the primary deterministic check. This
  could in theory look like the chat companion "doing emergency detection,"
  which earlier project guidance explicitly said isn't yours to build — I
  judged this was still safe to include because it doesn't add new
  detection logic or judgment, it only repeats the same "call emergency
  services" instruction as a last-resort net, and flagged it needs Sync 4
  confirmation rather than treating it as settled.

## 8. What's verified vs. not yet tested

**Verified locally (hand-built sample data, no network calls):**
- Normalization: correct unit conversions, fuzzy-match typo correction,
  ambiguous names correctly refused, unresolved tests correctly surfaced.
- Chat guardrails: all of the research's own adversarial probe examples
  correctly detected by `turnAskedForDiagnosis`, ordinary med/diet questions
  correctly left undetected, banned-phrase output scan correctly
  distinguishes leaky vs. clean text.

**Not yet tested:**
- Nothing has called the real Gemini API yet — `node_modules` isn't
  installed and there's no `GEMINI_API_KEY` configured.
- No real prescription/lab report images have been run through extraction.
- The schema/normalization shapes haven't been signed off with Sarhak &
  Sufiyaan yet.

## 9. What's next

1. `npm install` in this directory, get a `GEMINI_API_KEY`, and actually run
   a real image through `/api/extract` end to end.
2. Sync the `ExtractionResult` and `buildMarkerTimeSeries` output shapes
   with Sarhak & Sufiyaan for the Mongo schema (see `PROGRESS.md`'s open
   sync points).
3. Confirm the emergency-keyword boundary and the patient-context shape for
   chat with backend (Sync 4).
4. Hand normalized sample marker data to Nikhil for the trend chart.
