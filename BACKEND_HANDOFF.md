# Handoff to Backend (Sarhak & Sufiyaan)

**From:** Rihan (AI/ML)
**Status:** extraction, marker normalization, and chat guardrails are all built
and locally verified. Not yet tested against the live Gemini API.
**Repo:** [github.com/rihanpathan-6509/acm_hackathon](https://github.com/rihanpathan-6509/acm_hackathon) —
AI/ML code lives under `backend/` following the team-agreed structure.

---

## 1. What's ready for you to build against right now

### `/api/extract` output — for the patient record + medication + marker schema

```json
{
  "input_type": "prescription",
  "prescription": {
    "patient_name": "Rahul Sharma",
    "date": "2026-08-10",
    "medications": [
      {
        "drug_name": "Paracetamol",
        "dose": "500 mg",
        "timing": "BD",
        "instructions": "after food",
        "duration": "5 days",
        "confidence": 0.98,
        "field_flags": []
      }
    ],
    "doctor_name": "Dr. Amit Patel",
    "clinic_name": "City Care Clinic",
    "overall_confidence": 0.98,
    "extraction_notes": null
  },
  "lab_report": null,
  "requires_manual_review": false
}
```

For lab reports, `lab_report` is populated instead with `patient_name,
patient_id, tests[], collection_date, report_date, lab_name,
overall_confidence, extraction_notes`; each test has `test_name, value,
unit, reference_range, is_abnormal, confidence, field_flags`.

**Key field for you:** `requires_manual_review` — true if
`overall_confidence < 0.7` OR any `field_flags` list is non-empty anywhere
in the record. Your reminder-scheduling logic should treat a
`requires_manual_review: true` prescription as "don't auto-schedule
reminders yet, patient needs to confirm first."

Full schema: `backend/utils/extractionSchema.js`. Full prompt behind it:
`backend/prompts/extractionPrompt.js`.

### Normalized marker output — for the marker time-series schema

`buildMarkerTimeSeries(labReport)` (in `backend/services/normalizationService.js`)
runs automatically inside `backend/controllers/extractController.js` right after a lab report is
extracted, and the response includes it:

```json
{
  "extraction": { "...": "the lab_report ExtractionResult above" },
  "normalized": {
    "series": {
      "hba1c": [
        {
          "markerKey": "hba1c",
          "canonicalName": "HbA1c",
          "value": 53.006,
          "canonicalUnit": "mmol/mol",
          "displayValue": 7,
          "displayUnit": "%",
          "originalValue": "7.0",
          "originalUnit": "%",
          "date": "2026-08-01",
          "labName": "Apollo Diagnostics",
          "isAbnormal": true,
          "matchType": "exact",
          "confidence": 0.95,
          "needsReview": false,
          "requiresManualVerification": false
        }
      ]
    },
    "unresolved": [
      { "rawTestName": "Random Marker XYZ", "reason": "No matching marker alias — needs a new entry in markerAliases.js" }
    ]
  }
}
```

**Store both `value`/`canonicalUnit` (SI) and `displayValue`/`displayUnit`**
per reading — SI for consistent cross-marker math, display for whatever UI
renders it. This was a deliberate decision, not an oversight — please don't
collapse it to just one unit when designing the Mongo document shape.

If `extraction.lab_report` normalization throws (e.g. an unrecognized unit),
`extractController.js` (`backend/controllers/`) already catches it and still returns the extraction
— `normalized` comes back `null` with a `normalizationError` message instead
of failing the whole request. Worth mirroring that resilience if you wrap
this endpoint.

---

## 2. What we need from you

### a. MongoDB schema
Patient record + medication + marker time-series, shaped to match the two
JSON contracts above. Suggested collections: `patients`, `medications` (from
`prescription.medications`), `markerReadings` (from `normalized.series`,
one document per reading, indexed by `markerKey` + patient + date for the
trend query). **Draft Mongoose schemas already exist** at
`backend/models/{patient,medication,labMarker,reminder,chatLog}Model.js` —
mapped directly from the JSON shapes above so you don't have to start from a
blank page, but they're starting points for you to review/adjust, not final.

### b. Reminder scheduling logic
Off `prescription.medications` — you have `timing`, `instructions`,
`duration` as raw strings from the document (not normalized/parsed into a
schedule yet — that parsing is your logic, not mine). `backend/services/reminderService.js`
and `backend/controllers/reminderController.js` are empty stubs waiting on this.

### c. Rule-based emergency-keyword system
Deterministic, fixed keyword list → immediate "call emergency services now"
response. **This needs to run before the chat companion is ever called** —
my prompt (`backend/prompts/chatPrompt.js`) assumes this pre-check exists and
explicitly does not attempt emergency detection itself. **A draft starter
list exists** at `backend/utils/emergencyKeywords.js` (English + Hindi/Hinglish,
with a `matchesEmergencyKeyword()` function) — please review, adjust, and
take ownership of it rather than treating it as final; it's pulled from
Step 3 research, not clinically validated. See the open question below —
I need your actual final list so my prompt's fallback clause doesn't drift
from it.

### d. Expose patient meds + trend flags to the chat companion
`backend/services/chatService.js` currently assumes this shape for `patientContext`,
as a placeholder until you confirm the real interface (API call at request
time, vs. a context object the caller builds and passes in):

```json
{
  "patientMeds": [{ "drugName": "Metformin", "dose": "500 mg", "timing": "BD" }],
  "trendFlags": [{ "markerName": "HbA1c", "plainLanguageFlag": "rising over the last 3 months" }],
  "language": "en"
}
```

### e. How this mounts into the real app
`backend/server.js` is now the real merged-app entrypoint — it mounts
extract/chat routes alongside the medication/lab/reminder route stubs, and
requires a MongoDB connection (`config/mongodb.js`) to boot at all. `index.js`
still exists at the project root as a standalone runner for testing just
extraction/chat without needing Mongo running. Once you add real logic to
the medication/lab/reminder pieces, `server.js` should just work — nothing
else needs to change on my end for that.

---

## 3. Questions I need answered (blocking, not just FYI)

1. **Emergency keyword list + exact response text/number** — needed to keep
   my prompt's fallback clause in sync with your deterministic system.
2. **Where should `unresolved` markers surface?** A manual-review queue, or
   just logged for now? (See `normalized.unresolved` above.)
3. **Sign off on the two JSON shapes in §1** before you lock the Mongo
   schema — if either changes later it breaks your DB design, my
   normalization code, and Nikhil's UI all at once.

## 4. Repo structure

This repo currently only has my `rihan-ai-ml/` slice sitting at the root.
Before you push backend code here, let's agree: everyone's piece in one
repo root (needs different `package.json`s not to collide), or each
person's code in its own subfolder. Flag if you'd rather I move mine into a
subfolder first.
