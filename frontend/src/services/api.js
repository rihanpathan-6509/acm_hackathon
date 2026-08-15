// services/api.js
//
// Real backend calls, replacing the mocks this file used to export. Every
// function here matches the live API in this repo's backend/ (see
// BACKEND_HANDOFF.md / FRONTEND_HANDOFF.md for the full contracts) —
// nothing here is speculative.

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:4001/api";
const PATIENT_ID_KEY = "chronicare_patient_id";

async function request(path, options = {}) {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || `Request failed (${res.status})`);
  }
  return data;
}

// No auth yet on the backend (middleware/auth.js is a stub) — one patient
// per browser for now, created once via POST /patients and cached in
// localStorage. Replace this with real auth-derived identity once that
// exists; every other function here just takes a patientId as a plain
// argument, so nothing downstream needs to change when it does.
export async function getOrCreatePatientId() {
  const cached = localStorage.getItem(PATIENT_ID_KEY);
  if (cached) return cached;

  const { patient } = await request("/patients", {
    method: "POST",
    body: JSON.stringify({ name: "Demo Patient" }),
  });
  localStorage.setItem(PATIENT_ID_KEY, patient._id);
  return patient._id;
}

export async function extractDocument(base64Image, mimeType) {
  return request("/extract", {
    method: "POST",
    body: JSON.stringify({ base64Image, mimeType }),
  });
}

// Extraction returns snake_case (drug_name, field_flags — see
// utils/extractionSchema.js on the backend); the Medication model is
// camelCase. Mapped here once so callers don't have to think about it.
// `requiresManualReview` comes from the extraction's top-level flag, not
// the per-medication object — it isn't on `medication` itself.
export async function saveMedication(patientId, medication, requiresManualReview) {
  return request("/medications", {
    method: "POST",
    body: JSON.stringify({
      patientId,
      drugName: medication.drug_name,
      dose: medication.dose,
      timing: medication.timing,
      instructions: medication.instructions,
      duration: medication.duration,
      confidence: medication.confidence,
      fieldFlags: medication.field_flags,
      requiresManualReview: Boolean(requiresManualReview),
    }),
  });
}

// `series` is the `normalized.series` object from an /extract response —
// { markerKey: [reading, ...] }. Flattened here so the caller doesn't have
// to know the backend wants one flat array.
export async function saveLabReadings(patientId, series) {
  const readings = Object.values(series || {}).flat();
  if (readings.length === 0) return { labMarkers: [] };
  return request("/labs", {
    method: "POST",
    body: JSON.stringify({ patientId, readings }),
  });
}

export async function getMedications(patientId) {
  return request(`/medications/${patientId}`);
}

export async function getLabs(patientId, markerKey) {
  const query = markerKey ? `?markerKey=${encodeURIComponent(markerKey)}` : "";
  return request(`/labs/${patientId}${query}`);
}

export async function getReminders(patientId) {
  return request(`/reminders/${patientId}`);
}

export async function markReminderTaken(id) {
  return request(`/reminders/${id}/taken`, { method: "PATCH" });
}

export async function sendChatMessage(message, patientId, patientContext, history) {
  return request("/chat", {
    method: "POST",
    body: JSON.stringify({
      message,
      patientId,
      patientContext,
      history: (history || []).map((m) => ({ role: m.role, text: m.text })),
    }),
  });
}
