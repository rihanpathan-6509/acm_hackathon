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

// Shared in-flight request. Without this, every component that calls
// getOrCreatePatientId() on mount races the others: they all read an empty
// localStorage before any of them finishes writing to it, so each one
// POSTs its own patient. That created 4 patients per page load (2
// components x StrictMode's double-mount) and silently split data across
// them — uploads saved under one id while the dashboard read another.
let inFlightPatientId = null;

// No auth yet on the backend (middleware/auth.js is a stub) — one patient
// per browser for now, created once via POST /patients and cached in
// localStorage. Replace this with real auth-derived identity once that
// exists; every other function here just takes a patientId as a plain
// argument, so nothing downstream needs to change when it does.
export async function getOrCreatePatientId() {
  const cached = localStorage.getItem(PATIENT_ID_KEY);
  if (cached) return cached;

  // Callers that arrive while a create is already running share its result
  // instead of starting another. Safe because the check-and-assign below is
  // synchronous, so no caller can slip between them.
  if (inFlightPatientId) return inFlightPatientId;

  inFlightPatientId = (async () => {
    try {
      const { patient } = await request("/patients", {
        method: "POST",
        body: JSON.stringify({ name: "Demo Patient" }),
      });
      localStorage.setItem(PATIENT_ID_KEY, patient._id);
      return patient._id;
    } finally {
      inFlightPatientId = null;
    }
  })();

  return inFlightPatientId;
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
// `reminderTimes` (optional ["HH:MM", ...]) is the patient's own choice of
// when to be reminded — omit it to use the timing-based default (BD -> 8am/
// 8pm, etc.).
export async function saveMedication(patientId, medication, requiresManualReview, reminderTimes) {
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
      ...(reminderTimes?.length ? { reminderTimes } : {}),
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

// A standalone reminder not tied to any medication — e.g. "check blood
// pressure", "take a walk".
export async function createReminder(patientId, label, scheduledTime, instructions) {
  return request("/reminders", {
    method: "POST",
    body: JSON.stringify({ patientId, label, scheduledTime, instructions }),
  });
}

export async function updateReminder(id, updates) {
  return request(`/reminders/${id}`, {
    method: "PATCH",
    body: JSON.stringify(updates),
  });
}

export async function markReminderTaken(id) {
  return request(`/reminders/${id}/taken`, { method: "PATCH" });
}

export async function deactivateReminder(id) {
  return request(`/reminders/${id}/deactivate`, { method: "PATCH" });
}

export async function getPatients() {
  return request("/patients");
}

export async function createPatient(name) {
  return request("/patients", { method: "POST", body: JSON.stringify({ name }) });
}

export function getActivePatientId() {
  return localStorage.getItem(PATIENT_ID_KEY);
}

// Switches which patient the rest of the app (Dashboard, Chat, Upload) acts
// on. A full reload is simplest and safest here — every component reads
// the active id via getOrCreatePatientId() on mount, so a reload guarantees
// nothing is left showing stale data from the previous patient.
export function setActivePatientId(patientId) {
  localStorage.setItem(PATIENT_ID_KEY, patientId);
  window.location.href = "/";
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
