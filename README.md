# ChronicCare AI

Daily support tool for patients already under a doctor's care for a chronic
condition (diabetes, hypertension, thyroid, CKD). Upload a prescription or
lab report photo/PDF, get it extracted and normalized automatically, track
markers over time, and ask a guardrailed chat assistant about your own
medications and lab history — without it ever diagnosing anything.

Built for the 2nd NextGen Hackathon 2026, HealthTech & Bio-Innovation, and
now the base for the DECODE SIH build. See `BACKEND_HANDOFF.md` /
`FRONTEND_HANDOFF.md` for team sync notes (still useful for schema/contract
history, though most of what they flag as "TBD" is now built — see
Current status below).

## Current status

Full stack is real and wired end-to-end — nothing described below is a
mock or a stub unless explicitly called out.

**Working:**
- **Extraction** (`/api/extract`) — photo/PDF in, structured JSON out via
  Gemini, validated against a Zod schema. Handles both prescriptions and
  lab reports, auto-detecting which one it is.
- **Marker normalization** — resolves 30 lab markers (CBC panel, lipid
  panel, HbA1c, creatinine, TSH, electrolytes, etc.) from raw report text
  to canonical names/units, with unit conversion and abnormal-range
  detection. See `backend/utils/markerAliases.js`.
- **Medications, labs, reminders** — full CRUD against MongoDB
  (`medicationController.js`, `labController.js`, `reminderController.js`
  are real, not stubs — the handoff docs predate this).
- **Chat assistant** — guardrailed against giving diagnoses (phrase
  blocklist + multi-turn circumvention guard + structured refusal/
  redirection), now backed by the patient's actual medications and dated
  lab history, not placeholder data.
- **Gemini model fallback** — the free tier's daily quota is per-model
  (20/day); `geminiService.js` walks a fallback list (`gemini-flash-latest`
  → `gemini-3.5-flash` → `gemini-flash-lite-latest`) so the app degrades
  instead of dying at request 21.
- **Demo seed script** — `backend/scripts/seedDemoData.js --reset` seeds a
  realistic patient (meds + multi-marker, multi-lab trend data) with zero
  Gemini quota spent, for rehearsing without burning real requests.

**Frontend pages that exist but aren't routed yet:**
`ReminderList.jsx` and `TrendChart.jsx` are built components with real data
behind them, but `App.jsx` currently only routes `/` (Dashboard), `/upload`,
and `/chat` — there's no nav link or route mounting either component yet.
`frontend/src/pages/{ChatPage,ReminderPage,TrendsPage,UploadPage}.jsx` are
empty placeholder files left over from early scaffolding; the real page
logic lives directly in `components/` and is wired straight into `App.jsx`
instead. If Reminders/Trends are in the two-day scope, wiring the route +
nav link is what's actually left — the backend and component work is done.

## Layout

```
backend/
├── server.js                     Entrypoint — mounts all routes, MongoDB connection is fatal on failure
├── config/
│   ├── gemini.js                 Gemini client + model fallback lists + generationConfig
│   └── mongodb.js                MongoDB connection
├── middleware/
│   ├── upload.js                 Multer setup for multipart image uploads
│   ├── auth.js                   STUB — no real auth yet, one patient per browser via localStorage
│   └── errorHandler.js           Generic JSON error responses
├── routes/                       extractRoutes, chatRoutes, patientRoutes,
│                                  medicationRoutes, labRoutes, reminderRoutes — all real
├── controllers/                  One per route group above — all real, CRUD + business logic
├── services/
│   ├── geminiService.js          Shared Gemini call wrapper: retry, model fallback, truncation detection
│   ├── extractionService.js      Extraction orchestration — image in, validated schema out
│   ├── normalizationService.js   Marker alias resolution + unit conversion + confidence scoring
│   ├── reminderService.js        Turns a saved medication's timing into scheduled Reminder documents
│   └── chatService.js            Guardrailed chat companion logic
├── models/                       Mongoose schemas (patient, medication, labMarker, reminder, chatLog)
├── prompts/
│   ├── extractionPrompt.js       Extraction system prompt (flag-don't-guess rules, confidence bands)
│   └── chatPrompt.js             Chat companion guardrail prompt + patient data injection
├── scripts/
│   └── seedDemoData.js           Seeds a demo patient with zero Gemini quota spent
└── utils/
    ├── extractionSchema.js       Zod schema — source of truth for /api/extract's shape
    ├── drugCatalog.js            Common Indian generics, used to reduce hallucination
    ├── markerAliases.js          Alias/unit table: "HbA1c"/"A1C"/"Glycated Hb" -> one marker
    └── emergencyKeywords.js      Deterministic emergency-keyword pre-check, runs before the chat LLM

frontend/
├── src/
│   ├── App.jsx                   Router — currently only /, /upload, /chat are mounted
│   ├── components/
│   │   ├── Upload.jsx             Upload + extraction review UI
│   │   ├── ChatBox.jsx            Chat assistant UI, fetches live patient context per message
│   │   ├── TrendChart.jsx         Lab marker trend chart — built, not yet routed
│   │   └── ReminderList.jsx       Medication reminder list — built, not yet routed
│   ├── pages/
│   │   └── Dashboard.jsx          Only non-empty page file
│   ├── services/api.js            All backend API calls
│   └── utils/labStatus.js         Deterministic in-range/out-of-range check (doesn't touch is_abnormal's AI-flagged value)
```

## Running this

1. Set both env vars — **both are required**, not optional:
   - `GEMINI_API_KEY` in `.env` (root)
   - `MONGODB_URI` in `.env` (root) — `connectDB()` is fatal on failure;
     medication/lab/reminder genuinely depend on it now.
2. `npm run setup` (installs root + frontend deps), or manually:
   `npm install && npm --prefix frontend install`.
3. `npm run dev:all` — runs backend (nodemon, port 4001) and frontend
   (Vite, port 5173/5174) together. Individually: `npm run dev` /
   `npm run dev:frontend`.
4. Optional: `node backend/scripts/seedDemoData.js --reset` to seed demo
   data without spending Gemini quota.

**Port collision:** if you see `EADDRINUSE`, an older server instance is
still running (common after a crashed/killed process on Windows). Run
`npx kill-port 4001 5173 5174` first — `server.js` prints this same
instruction if it hits the error itself.

## Chat assistant data flow

`ChatBox.jsx` fetches the patient's real medications (`getMedications`) and
lab history (`getLabs`) fresh on every message and sends them as
`patientContext` to `/api/chat`. `chatPrompt.js` renders the dated lab
readings into the system prompt (`buildLabHistoryList`), so factual
questions like "what was my HDL in January" are answered from the patient's
actual record — or answered "not on file" if it genuinely isn't there.
Interpretation of what a value *means* is still refused and redirected to a
doctor; only factual recall of the patient's own record is permitted. See
the `YOUR ONLY PERMITTED ACTIONS` / `ABSOLUTE PROHIBITIONS` sections in
`backend/prompts/chatPrompt.js` for the exact boundary.

## Extraction: known behaviors, not bugs

- **`dose` can be `null`** — an SOS/PRN entry with no strength printed
  (e.g. "Crocin SOS") has a genuinely null dose; the schema and prompt both
  treat this as valid, not a missing-field error.
- **`is_abnormal` can be `null`** — the model only sets this from an
  explicit H/L flag printed on the report itself, never by comparing a
  value to its reference range. `frontend/src/utils/labStatus.js` layers a
  separate, deterministic (non-AI) range check on top for display, clearly
  distinguished from the lab's own flag.
- **Long documents can hit the output token limit** — `maxOutputTokens` is
  set explicitly (8192 for extraction) to leave headroom for
  multi-medication prescriptions and full CBC+lipid lab reports; if this
  is ever hit anyway, `geminiService.js` throws a specific `MAX_TOKENS`
  error rather than an opaque JSON-parse failure.

## Open sync points

See `BACKEND_HANDOFF.md` and `FRONTEND_HANDOFF.md` for full history —
most of what they list as open is now resolved; still worth confirming:

- Real patient auth (`middleware/auth.js` is still a stub — one patient
  per browser via localStorage for now).
- Whether Reminders/Trends make the two-day SIH build scope — if so, they
  need a route + nav link in `App.jsx`, not new backend/component work.
- `backend/utils/emergencyKeywords.js` — confirm the exact keyword list
  with whoever owns the deterministic emergency pre-check before a demo,
  so the chat guardrail's fallback wording can't drift from it.
