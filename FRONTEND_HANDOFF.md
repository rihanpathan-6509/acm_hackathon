# Handoff to Frontend (Nikhil)

**From:** Rihan (AI/ML)
**Status:** extraction, marker normalization, and chat guardrails are all
built and locally verified — not yet tested against the live Gemini API, but
the shapes below are stable and you can build against them / mock them right
now without waiting on that.
**Repo:** [github.com/rihanpathan-6509/acm_hackathon](https://github.com/rihanpathan-6509/acm_hackathon)

---

## 1. Upload flow — `POST /api/extract`

**Request:**
```json
{ "base64Image": "<raw base64, no data: prefix>", "mimeType": "image/jpeg" }
```
You do **not** need to tell it whether it's a prescription or lab report —
the model figures that out itself and returns it in `input_type`.

**Supported `mimeType` values:** `image/jpeg`, `image/jpg`, `image/png`,
`image/webp`, `image/heic`, `image/heif`, `application/pdf` — anything else
gets a clean `400` instead of a confusing failure further down. Use the
browser's `file.type` (or a multipart upload's parsed mimetype) directly;
don't try to guess it from the file extension yourself.

**Size limit:** 25MB request body — since base64 inflates the original file
size by ~33%, that's roughly an 18MB original file ceiling. Multi-page PDF
lab reports are the most likely to hit this; worth a client-side size check
before upload so the patient gets an immediate "too large" message instead
of waiting on a slow upload that fails at the end.

**Response (prescription):**
```json
{
  "extraction": {
    "input_type": "prescription",
    "prescription": {
      "patient_name": "Rahul Sharma",
      "date": "2026-08-10",
      "medications": [
        { "drug_name": "Paracetamol", "dose": "500 mg", "timing": "BD",
          "instructions": "after food", "duration": "5 days",
          "confidence": 0.98, "field_flags": [] }
      ],
      "doctor_name": "Dr. Amit Patel", "clinic_name": "City Care Clinic",
      "overall_confidence": 0.98, "extraction_notes": null
    },
    "lab_report": null,
    "requires_manual_review": false
  }
}
```

**Response (lab report)** — same call, includes normalized trend data too:
```json
{
  "extraction": {
    "input_type": "lab_report",
    "lab_report": {
      "tests": [
        { "test_name": "Hemoglobin", "value": "11.2", "unit": "g/dL",
          "reference_range": "12.0-15.5", "is_abnormal": true,
          "confidence": 0.95, "field_flags": [] }
      ],
      "overall_confidence": 0.93
    },
    "requires_manual_review": false
  },
  "normalized": {
    "series": {
      "hba1c": [
        { "canonicalName": "HbA1c", "displayValue": 7, "displayUnit": "%",
          "date": "2026-08-01", "isAbnormal": true, "confidence": 0.95, "needsReview": false }
      ]
    },
    "unresolved": [
      { "rawTestName": "Random Marker XYZ", "reason": "No matching marker alias" }
    ]
  }
}
```

### The "please confirm" pattern — important for your upload/review UI

- If `requires_manual_review` is `true` on the extraction, show a "please
  confirm before we use this" state rather than silently accepting it.
- Each medication/test has its own `field_flags` array (e.g.
  `["drug_name", "timing"]`) — highlight *exactly those fields* as
  "we're not sure about this, please check," not the whole record.
- `confidence` is a 0–1 float per medication/test — a natural place for a
  subtle visual cue (e.g. anything under 0.7 gets a warning color).

---

## 2. Reminder display

From `prescription.medications`: `drug_name`, `dose`, `timing`,
`instructions`, `duration` — all raw strings as printed (e.g. `timing:
"BD"`, `instructions: "avoid dairy within 2 hours"`). Backend owns turning
these into an actual reminder schedule; you're just displaying what's on the
record plus whatever schedule backend computes from it.

## 3. Trend chart — use `displayValue` / `displayUnit`, not the canonical ones

Each normalized reading in `normalized.series[markerKey]` carries **two**
versions of the value:

- `value` + `canonicalUnit` — SI units (e.g. `mmol/mol`), for backend's
  internal math. **Don't chart this one.**
- `displayValue` + `displayUnit` — conventional units (`%`, `mg/dL`,
  `mEq/L`) that actually match what's printed on Indian lab reports and
  what patients recognize. **This is what the chart should render.**

Each marker's series is already sorted by date. `isAbnormal` (from the
source report) and `needsReview` (from normalization confidence) are both
booleans you can use for flagging a point on the chart without needing to
interpret the value yourself.

`normalized.unresolved` is a list of tests that couldn't be matched to any
known marker — worth a small "we didn't recognize this test" UI state
rather than silently dropping it, since dropping it hides data from the
patient.

## 4. Chat UI — `POST /api/chat`

**Request:**
```json
{
  "message": "Is my HbA1c reading serious?",
  "patientContext": {
    "patientMeds": [{ "drugName": "Metformin", "dose": "500 mg", "timing": "BD" }],
    "trendFlags": [{ "markerName": "HbA1c", "plainLanguageFlag": "rising over the last 3 months" }],
    "language": "en"
  },
  "history": [{ "role": "user", "text": "previous message" }, { "role": "model", "text": "previous reply" }]
}
```

**Response:**
```json
{ "reply": "I can't tell you whether that's serious — only your doctor can interpret it. In general, HbA1c tracks average blood sugar over ~3 months. Please discuss this reading with your doctor, who knows your full history." }
```

- `language` is `"en"` or `"hi"` — build a language toggle in the chat UI,
  the guardrail prompt handles both explicitly, with equal strictness in
  both by design.
- `history` is optional but recommended — the guardrail logic actually
  checks prior turns for diagnosis-probing questions and gets stricter on
  follow-ups if it finds one, so passing real conversation history makes the
  guardrails work better, not just the chat UX.
- Expect refusal-style replies sometimes even for reasonable-sounding
  questions ("is this serious?", "what does X mean?") — that's intentional,
  not a bug to report back to me.

## 5. You can start now — nothing here is blocked

All the shapes above are stable and code-verified against sample data. Mock
these JSON responses locally and build the upload flow, reminder UI, trend
chart, and chat UI against them — you don't need to wait for the real Gemini
integration or backend's Mongo layer to start.
