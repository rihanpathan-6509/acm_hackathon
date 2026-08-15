# Rihan's slice — ChronicCare AI (with Trendline)

Owned pieces: extraction schema, extraction pipeline, marker normalization
(the hard part), chat companion prompt/guardrails.

## Layout

```
config/gemini.js              Gemini client setup (extraction + chat both use this)
schemas/extractionSchema.js   Zod schema — source of truth for /extract's shape
data/drugCatalog.js           ~50 common Indian generics, used to reduce hallucination
utils/promptTemplate.js       Builds the extraction system prompt
services/geminiService.js     Calls Gemini, validates against extractionSchema
utils/markerAliases.js        Alias/unit table: "HbA1c"/"A1C"/"Glycated Hb" -> one marker
services/normalizationService.js  Resolves + converts raw lab tests into per-marker time series
utils/chatPromptTemplate.js   Chat companion guardrail prompt
services/chatService.js       Wires patient context into the prompt, calls Gemini
controllers/extractController.js  POST /extract handler (extraction + normalization)
controllers/chatController.js     POST /chat handler
routes/extractRoutes.js, routes/chatRoutes.js
index.js                      Standalone runner for testing this slice in isolation
```

## Before this plugs into the real repo

1. Set `GEMINI_API_KEY` in `.env`.
2. `npm install`.
3. `normalizationService.js` currently resolves 7 markers (HbA1c, Creatinine,
   Hemoglobin, TSH, Fasting Glucose, Potassium, LDL). Extend
   `utils/markerAliases.js` as real sample reports surface more test-name
   variants — this is expected to grow during Day 1 testing.

## Open sync points (see full roadmap for detail)

- **Sarhak & Sufiyaan** — sign off on `extractionSchema.js` shape before they
  build the Mongo schema (patient record + medication + marker time-series).
- **Sarhak & Sufiyaan** — confirm how `patientMeds`/`trendFlags` get exposed
  to `chatService.js` at inference time (API call vs. context object) —
  `chatController.js` currently assumes a `patientContext` object passed
  straight in the request body as a placeholder.
- **Sarhak & Sufiyaan** — confirm the emergency-keyword list so
  `chatPromptTemplate.js`'s boundary language doesn't drift from their
  deterministic emergency flag.
- **Nikhil** — hand off `normalized.series` shape (from `extractController.js`
  lab-report response) for the trend chart once a few real reports have run
  through it.
