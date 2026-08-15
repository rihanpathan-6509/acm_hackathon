// controllers/patientController.js
//
// Minimal patient create/list — NOT in the original file tree, added
// because medication/lab/reminder/chat all reference a patientId and there
// was no way to create one to test against. No access control here since
// middleware/auth.js is still a stub — add that once auth is decided.

const Patient = require("../models/patientModel");

async function create(req, res, next) {
  try {
    const { name } = req.body;
    const patient = await Patient.create({ name });
    res.status(201).json({ patient });
  } catch (err) {
    next(err);
  }
}

async function list(req, res, next) {
  try {
    const patients = await Patient.find().sort({ createdAt: -1 });
    res.json({ patients });
  } catch (err) {
    next(err);
  }
}

module.exports = { create, list };
