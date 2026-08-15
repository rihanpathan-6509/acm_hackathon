// services/reminderService.js
//
// Turns a saved Medication's `timing` into actual Reminder documents.
// TIMING_SCHEDULE below is a reasonable DEFAULT mapping of common
// abbreviations to clock times (e.g. BD -> 8am/8pm) — not a clinically or
// product-validated schedule. The patient can override it per-medication
// (see customTimes below) — the default only applies when they don't.
//
// Called from medicationController right after a Medication is saved —
// not exposed as its own route (see BACKEND_HANDOFF.md: "off
// prescription.medications... that parsing is your logic").

const Reminder = require("../models/reminderModel");

// OD/BD/TDS/QID = how many times a day. HS = bedtime. SOS/PRN = as-needed,
// no fixed schedule — those intentionally produce zero reminder times
// unless the patient sets their own via customTimes.
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

const TIME_FORMAT = /^([01]\d|2[0-3]):([0-5]\d)$/;

function resolveScheduleTimes(timing) {
  if (!timing) return [];
  const key = timing.toLowerCase().trim();
  return TIMING_SCHEDULE[key] || [];
}

/**
 * Create Reminder documents for a saved Medication.
 * @param {object} medication  a saved Medication document (_id, patientId, timing, instructions)
 * @param {string[]} [customTimes]  patient-chosen "HH:MM" times overriding
 *   the default schedule entirely — this is what makes a reminder
 *   personalized rather than always defaulting to 08:00/20:00/etc.
 *   Invalid entries are dropped rather than rejecting the whole request,
 *   since one typo shouldn't block saving a medication the patient already
 *   confirmed is correct.
 * @returns {Promise<{ created: object[], scheduled: boolean, reason?: string }>}
 */
async function scheduleReminders(medication, customTimes) {
  let times;
  let usedCustomTimes = false;

  if (Array.isArray(customTimes) && customTimes.length > 0) {
    const valid = customTimes.filter((t) => TIME_FORMAT.test(t));
    if (valid.length > 0) {
      times = valid;
      usedCustomTimes = true;
    }
  }

  if (!times) times = resolveScheduleTimes(medication.timing);

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
      source: "medication",
      label: medication.drugName,
      scheduledTime,
      instructions: medication.instructions || null,
      active: true,
    }))
  );

  return { created, scheduled: true, personalized: usedCustomTimes };
}

module.exports = { scheduleReminders, resolveScheduleTimes, TIMING_SCHEDULE, TIME_FORMAT };
