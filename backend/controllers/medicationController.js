// controllers/medicationController.js
//
// Medication CRUD. `create` is also where reminders get scheduled — after
// saving a Medication, reminderService.scheduleReminders() creates the
// actual Reminder documents from its `timing`. If the medication still
// requires manual review (see schemas/extractionSchema.js's
// requires_manual_review), reminders are deliberately NOT auto-scheduled —
// the patient needs to confirm the read first (see BACKEND_HANDOFF.md §1).
//
// NOTE on field naming: extraction returns snake_case (drug_name,
// field_flags, requires_manual_review — see utils/extractionSchema.js);
// this model/controller uses camelCase (drugName, fieldFlags,
// requiresManualReview). Whoever calls this endpoint after a confirmed
// extraction needs to map field names — not done automatically here since
// extractController.js's job is read-only (image in, JSON out), not
// persistence.

const Medication = require("../models/medicationModel");
const { scheduleReminders } = require("../services/reminderService");

async function create(req, res, next) {
  try {
    const {
      patientId, drugName, dose, timing, instructions, duration,
      confidence, fieldFlags, requiresManualReview,
    } = req.body;

    if (!patientId || !drugName) {
      return res.status(400).json({ error: "patientId and drugName are required." });
    }

    const medication = await Medication.create({
      patientId, drugName, dose, timing, instructions, duration,
      confidence, fieldFlags, requiresManualReview,
    });

    const reminderResult = medication.requiresManualReview
      ? { created: [], scheduled: false, reason: "Skipped — medication requires manual review before scheduling." }
      : await scheduleReminders(medication);

    res.status(201).json({ medication, reminders: reminderResult });
  } catch (err) {
    next(err);
  }
}

async function listForPatient(req, res, next) {
  try {
    const { patientId } = req.params;
    const medications = await Medication.find({ patientId }).sort({ createdAt: -1 });
    res.json({ medications });
  } catch (err) {
    next(err);
  }
}

async function update(req, res, next) {
  try {
    const { id } = req.params;
    const medication = await Medication.findByIdAndUpdate(id, req.body, { new: true, runValidators: true });
    if (!medication) return res.status(404).json({ error: "Medication not found." });
    res.json({ medication });
  } catch (err) {
    next(err);
  }
}

async function remove(req, res, next) {
  try {
    const { id } = req.params;
    const medication = await Medication.findByIdAndDelete(id);
    if (!medication) return res.status(404).json({ error: "Medication not found." });
    res.json({ deleted: true });
  } catch (err) {
    next(err);
  }
}

module.exports = { create, listForPatient, update, remove };
