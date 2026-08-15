// controllers/labController.js
//
// Lab marker CRUD — separate from extraction+normalization (extractController
// already runs normalization live on upload and hands back the result; it
// doesn't persist anything). This controller is for saving normalized
// readings once the caller has confirmed them, and reading them back for
// the trend chart. `createMany`'s `readings` array is expected to be
// exactly what normalizationService.buildMarkerTimeSeries()'s series[key]
// entries look like — same field names, no remapping needed.

const LabMarker = require("../models/labMarkerModel");

async function createMany(req, res, next) {
  try {
    const { patientId, readings } = req.body;

    if (!patientId || !Array.isArray(readings) || readings.length === 0) {
      return res.status(400).json({ error: "patientId and a non-empty readings array are required." });
    }

    const docs = await LabMarker.insertMany(
      readings.map((reading) => ({ patientId, ...reading }))
    );

    res.status(201).json({ labMarkers: docs });
  } catch (err) {
    next(err);
  }
}

async function listForPatient(req, res, next) {
  try {
    const { patientId } = req.params;
    const { markerKey } = req.query;
    const filter = markerKey ? { patientId, markerKey } : { patientId };
    const labMarkers = await LabMarker.find(filter).sort({ date: 1 });
    res.json({ labMarkers });
  } catch (err) {
    next(err);
  }
}

module.exports = { createMany, listForPatient };
