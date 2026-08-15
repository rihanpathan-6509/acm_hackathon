# ChronicCare AI

Merged hackathon build (ChronicCare AI + Trendline) — 2nd NextGen Hackathon
2026, HealthTech & Bio-Innovation. See `BACKEND_HANDOFF.md` /
`FRONTEND_HANDOFF.md` for what's needed from each team.

## Layout

```
backend/
├── server.js                     Main entrypoint — mounts all routes, requires MongoDB to boot
├── config/
│   ├── gemini.js                 Gemini client setup (extraction + chat both use this)
│   └── mongodb.js                MongoDB connection
├── middleware/
│   ├── upload.js                 Multer setup for multipart image uploads
│   ├── auth.js                   STUB — patient auth strategy not decided yet
│   └── errorHandler.js           Generic JSON error responses
├── routes/                       extractRoutes.js, chatRoutes.js (real) +
│                                  medicationRoutes.js, labRoutes.js, reminderRoutes.js (stubs)
├── controllers/                  extractController.js, chatController.js (real) +
│                                  medication/lab/reminder controllers (stubs)
├── services/
│   ├── geminiService.js          Shared low-level Gemini call wrapper
│   ├── extractionService.js      Extraction orchestration — image in, validated schema out
│   ├── normalizationService.js   Marker alias resolution + unit conversion + confidence scoring
│   ├── reminderService.js        STUB — reminder scheduling, backend's to design
│   └── chatService.js            Guardrailed chat companion logic
├── models/                       DRAFT Mongoose schemas (patient, medication, labMarker, reminder, chatLog)
├── prompts/
│   ├── extractionPrompt.js       Extraction system prompt (flag-don't-guess rules, confidence bands)
│   └── chatPrompt.js             Chat companion guardrail prompt
└── utils/
    ├── extractionSchema.js       Zod schema — source of truth for /api/extract's shape
    ├── drugCatalog.js            ~50 common Indian generics, used to reduce hallucination
    ├── markerAliases.js          Alias/unit table: "HbA1c"/"A1C"/"Glycated Hb" -> one marker
    └── emergencyKeywords.js      DRAFT starter list for backend's emergency-detection system
```

## Owned pieces (Rihan, AI/ML)

Extraction schema + prompt, marker normalization (the hard part), chat
companion prompt/guardrails — all built from Perplexity research, not
invented.

## Running this

1. Set `GEMINI_API_KEY` in `.env`.
2. `npm install`.
3. `npm start` (runs `backend/server.js`). `MONGODB_URI` in `.env` is
   optional for now — extraction/chat don't touch the database, and the
   routes that do (medication/lab/reminder) are still stubs. It'll warn if
   Mongo isn't connected, not crash.

`normalizationService.js` currently resolves 7 markers (HbA1c, Creatinine,
Hemoglobin, TSH, Fasting Glucose, Potassium, LDL). Extend
`backend/utils/markerAliases.js` as real sample reports surface more
test-name variants.

## Open sync points

See `BACKEND_HANDOFF.md` and `FRONTEND_HANDOFF.md` for the full detail —
short version:

- **Sarhak & Sufiyaan** — sign off on `utils/extractionSchema.js`'s shape
  before building the real Mongo schema; confirm the emergency-keyword list
  (`utils/emergencyKeywords.js` is a draft, not final) and the
  `patientMeds`/`trendFlags` interface for `chatService.js`.
- **Nikhil** — `normalized.series` shape (from `extractController.js`'s
  lab-report response) is ready to build the trend chart against.
