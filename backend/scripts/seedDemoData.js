// scripts/seedDemoData.js
//
// Populates a realistic demo patient directly in MongoDB — no Gemini calls,
// so it costs nothing against the free tier's daily quota. Use this to
// rehearse the demo (dashboard, trends, reminders, chat context) without
// burning the extraction requests you'll want on stage.
//
//   node backend/scripts/seedDemoData.js
//   node backend/scripts/seedDemoData.js --reset   (wipe existing data first)
//
// Prints the patient id at the end; paste the one-liner it gives you into
// the browser console so the frontend points at this patient.

require("dotenv").config();
const mongoose = require("mongoose");
const { connectDB } = require("../config/mongodb");
const Patient = require("../models/patientModel");
const Medication = require("../models/medicationModel");
const LabMarker = require("../models/labMarkerModel");
const Reminder = require("../models/reminderModel");
const ChatLog = require("../models/chatLogModel");
const { scheduleReminders } = require("../services/reminderService");

// A chronic-care patient the demo narrative can actually lean on: creatinine
// creeping up while every individual reading still looks unremarkable, which
// is the "invisible in one PDF at a time" problem the pitch is about.
const MEDICATIONS = [
  { drugName: "Metformin", dose: "500 mg", timing: "BD", instructions: "after food", duration: "30 days" },
  { drugName: "Telmisartan", dose: "40 mg", timing: "OD", instructions: "after breakfast", duration: "30 days" },
  { drugName: "Atorvastatin", dose: "10 mg", timing: "HS", instructions: "at bedtime", duration: "30 days" },
  { drugName: "Paracetamol", dose: "500 mg", timing: "SOS", instructions: "if fever", duration: null },
];

// value = canonical/SI (what backend math uses), displayValue = conventional
// (what the chart shows) — see markerAliases.js for the conversions.
const MARKER_SERIES = [
  { markerKey: "hba1c", canonicalName: "HbA1c", canonicalUnit: "mmol/mol", displayUnit: "%",
    points: [["2026-02-10", 47.5, 6.5, false], ["2026-05-12", 53.0, 7.0, true], ["2026-08-12", 61.7, 7.8, true]] },
  { markerKey: "creatinine", canonicalName: "Serum Creatinine", canonicalUnit: "umol/l", displayUnit: "mg/dL",
    points: [["2026-02-10", 88.4, 1.0, null], ["2026-05-12", 106.1, 1.2, null], ["2026-08-12", 123.8, 1.4, null]] },
  { markerKey: "hemoglobin", canonicalName: "Hemoglobin", canonicalUnit: "g/l", displayUnit: "g/dL",
    points: [["2026-02-10", 132, 13.2, false], ["2026-05-12", 121, 12.1, false], ["2026-08-12", 112, 11.2, true]] },
  { markerKey: "potassium", canonicalName: "Potassium", canonicalUnit: "mmol/l", displayUnit: "mEq/L",
    points: [["2026-05-12", 4.1, 4.1, null], ["2026-08-12", 4.2, 4.2, null]] },
];

const LABS = ["Apollo Diagnostics", "Thyrocare", "Dr. Lal PathLabs"];

async function main() {
  const reset = process.argv.includes("--reset");
  await connectDB();

  if (reset) {
    await Promise.all([
      Patient.deleteMany({}), Medication.deleteMany({}),
      LabMarker.deleteMany({}), Reminder.deleteMany({}), ChatLog.deleteMany({}),
    ]);
    console.log("Cleared all existing data (--reset).");
  }

  const patient = await Patient.create({ name: "Sunita Devi" });

  for (const med of MEDICATIONS) {
    const saved = await Medication.create({
      ...med, patientId: patient._id, confidence: 0.97, fieldFlags: [], requiresManualReview: false,
    });
    // Go through the real scheduling logic rather than hand-writing
    // reminders, so seeded data matches what an upload actually produces.
    const { scheduled, created, reason } = await scheduleReminders(saved);
    console.log(
      `  ${med.drugName.padEnd(13)} ${scheduled ? `${created.length} reminder(s) @ ${created.map((c) => c.scheduledTime).join(", ")}` : `no auto-schedule (${reason.split("—")[0].trim()})`}`
    );
  }

  let readingCount = 0;
  for (const marker of MARKER_SERIES) {
    for (const [i, [date, value, displayValue, isAbnormal]] of marker.points.entries()) {
      await LabMarker.create({
        patientId: patient._id,
        markerKey: marker.markerKey,
        canonicalName: marker.canonicalName,
        value, canonicalUnit: marker.canonicalUnit,
        displayValue, displayUnit: marker.displayUnit,
        originalValue: String(displayValue), originalUnit: marker.displayUnit,
        date: new Date(date),
        labName: LABS[i % LABS.length], // different labs, to show normalization earning its keep
        isAbnormal, matchType: "exact", confidence: 0.95, needsReview: false,
      });
      readingCount++;
    }
  }

  console.log(`\nSeeded ${MEDICATIONS.length} medications and ${readingCount} lab readings.`);
  console.log(`Patient: ${patient.name} (${patient._id})`);
  console.log("\nPoint the frontend at this patient — paste into the browser console, then reload:");
  console.log(`  localStorage.setItem('chronicare_patient_id', '${patient._id}')`);

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
