// services/reminderService.js
//
// Turns a saved Medication's `timing` into actual Reminder documents.
// TIMING_SCHEDULE below is a reasonable DEFAULT mapping of common
// abbreviations to clock times (e.g. BD -> 8am/8pm) — not a clinically or
// product-validated schedule. Adjust the times themselves freely; the
// logic that consumes them (create one Reminder per scheduled time) is
// the part that shouldn't need to change.
//
// Called from medicationController right after a Medication is saved —
// not exposed as its own route (see BACKEND_HANDOFF.md: "off
// prescription.medications... that parsing is your logic").

const Reminder = require("../models/reminderModel");

// OD/BD/TDS/QID = how many times a day. HS = bedtime. SOS/PRN = as-needed,
// no fixed schedule — those intentionally produce zero reminder times.
const TIMING_SCHEDULE = {
  od: ["08:00"],
  "once daily": ["08:00"],
  bd: ["08:00", "20:00"],
  "twice daily": ["08:00", "20:00"],
  tds: ["08:00", "14:00", "20:00"],
  tid: ["08:00", "14:00", "20:00"],
  "thrice daily": ["08:00", "14:00", "20:00"],
  qid: ["08:00", "12:00", "16:00", "20:00"],
  hs: ["22:00"],
  sos: [],
  prn: [],
};

function resolveScheduleTimes(timing) {
  if (!timing) return [];
  const key = timing.toLowerCase().trim();
  return TIMING_SCHEDULE[key] || [];
}

/**
 * Create Reminder documents for a saved Medication. Unrecognized or
 * as-needed (SOS/PRN) timing produces no automatic reminders — the caller
 * should surface that to the patient/UI as "needs manual scheduling"
 * rather than the reminder silently never firing.
 * @param {object} medication  a saved Medication document (_id, patientId, timing, instructions)
 * @returns {Promise<{ created: object[], scheduled: boolean, reason?: string }>}
 */
async function scheduleReminders(medication) {
  const times = resolveScheduleTimes(medication.timing);

  if (times.length === 0) {
    return {
      created: [],
      scheduled: false,
      reason: medication.timing
        ? `No fixed schedule for timing "${medication.timing}" (as-needed, e.g. SOS/PRN, or an unrecognized abbreviation) — needs manual scheduling.`
        : "No timing on this medication — needs manual scheduling.",
    };
  }

  const created = await Reminder.insertMany(
    times.map((scheduledTime) => ({
      patientId: medication.patientId,
      medicationId: medication._id,
      scheduledTime,
      instructions: medication.instructions || null,
      active: true,
    }))
  );

  return { created, scheduled: true };
}

module.exports = { scheduleReminders, resolveScheduleTimes, TIMING_SCHEDULE };
