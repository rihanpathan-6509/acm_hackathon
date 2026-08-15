import { useState, useEffect, useRef } from "react";
import {
  extractDocument,
  saveMedication,
  saveLabReadings,
  getOrCreatePatientId,
} from "../services/api";
import { getLabTestStatus, TONE_CLASSES } from "../utils/labStatus";

const ACCEPTED_TYPES = [
  "image/jpeg", "image/jpg", "image/png", "image/webp",
  "image/heic", "image/heif", "application/pdf",
];
// ~18MB original file — the backend's 25MB JSON body limit divided back
// down from base64's ~33% size inflation.
const MAX_FILE_SIZE = 18 * 1024 * 1024;

function readFileAsBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result.split(",")[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// Mirrors backend/services/reminderService.js's TIMING_SCHEDULE — used only
// to pre-fill a sensible starting point in the editable field below, not as
// the source of truth (the backend applies its own default if the field is
// left blank). Keeping this a plain suggestion, not a duplicate of the real
// logic, is what makes "personalize the time" actually mean something: the
// patient is editing a starting guess, not fighting a second copy of the
// scheduling rules.
const SUGGESTED_TIMES = {
  od: "08:00", bd: "08:00, 20:00", tds: "08:00, 14:00, 20:00",
  tid: "08:00, 14:00, 20:00", qid: "08:00, 12:00, 16:00, 20:00", hs: "22:00",
};

function suggestTimes(timing) {
  return SUGGESTED_TIMES[(timing || "").toLowerCase().trim()] || "";
}

const TIME_TOKEN = /^([01]\d|2[0-3]):([0-5]\d)$/;

function parseReminderTimesInput(value) {
  return value
    .split(",")
    .map((t) => t.trim())
    .filter((t) => TIME_TOKEN.test(t));
}

export default function Upload() {
  const [patientId, setPatientId] = useState(null);
  const [data, setData] = useState(null);
  const [normalized, setNormalized] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [dragActive, setDragActive] = useState(false);
  const [saveState, setSaveState] = useState("idle"); // idle | saving | saved | error
  const [reminderSummary, setReminderSummary] = useState([]);
  const [reminderTimeInputs, setReminderTimeInputs] = useState({}); // { [medicationIndex]: "08:00, 20:00" }
  const fileInputRef = useRef(null);

  useEffect(() => {
    getOrCreatePatientId().catch((err) => setError(err.message)).then(setPatientId);
  }, []);

  const handleFile = async (file) => {
    if (!file) return;
    setError(null);
    setData(null);
    setNormalized(null);
    setSaveState("idle");
    setReminderSummary([]);

    if (!ACCEPTED_TYPES.includes(file.type)) {
      setError(`Unsupported file type "${file.type || "unknown"}". Upload a JPEG, PNG, WEBP, HEIC, or PDF.`);
      return;
    }
    if (file.size > MAX_FILE_SIZE) {
      setError(`File is too large (${(file.size / 1024 / 1024).toFixed(1)}MB). Max is ~18MB.`);
      return;
    }

    setLoading(true);
    try {
      const base64 = await readFileAsBase64(file);
      const res = await extractDocument(base64, file.type);
      setData(res.extraction);
      setNormalized(res.normalized || null);

      const meds = res.extraction?.prescription?.medications || [];
      const suggestions = {};
      meds.forEach((med, i) => { suggestions[i] = suggestTimes(med.timing); });
      setReminderTimeInputs(suggestions);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e) => handleFile(e.target.files?.[0]);

  const handleDrop = (e) => {
    e.preventDefault();
    setDragActive(false);
    handleFile(e.dataTransfer.files?.[0]);
  };

  const handleConfirmSave = async () => {
    if (!data || !patientId) return;
    setSaveState("saving");
    try {
      if (data.input_type === "prescription" && data.prescription) {
        const meds = data.prescription.medications;
        const results = await Promise.all(
          meds.map((med, i) => {
            const customTimes = parseReminderTimesInput(reminderTimeInputs[i] || "");
            return saveMedication(patientId, med, data.requires_manual_review, customTimes);
          })
        );
        setReminderSummary(
          results.map((r, i) => ({ drugName: meds[i].drug_name, ...r.reminders }))
        );
      } else if (data.input_type === "lab_report" && normalized?.series) {
        await saveLabReadings(patientId, normalized.series);
      }
      setSaveState("saved");
    } catch (err) {
      setError(err.message);
      setSaveState("error");
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <header className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 tracking-tight">
          Upload Document
        </h1>
        <p className="mt-2 text-sm text-gray-500">
          Upload a photo or PDF of a prescription or lab report — the AI
          figures out which one it is.
        </p>
      </header>

      <input
        ref={fileInputRef}
        type="file"
        accept={ACCEPTED_TYPES.join(",")}
        onChange={handleInputChange}
        className="hidden"
      />

      <div
        onClick={() => fileInputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDragActive(true);
        }}
        onDragLeave={() => setDragActive(false)}
        onDrop={handleDrop}
        className={`flex flex-col items-center justify-center p-10 bg-white border-2 border-dashed rounded-xl cursor-pointer transition-all ${
          dragActive
            ? "border-blue-500 bg-blue-50"
            : "border-gray-300 hover:border-blue-400 hover:bg-blue-50"
        }`}
      >
        <svg
          className="w-10 h-10 text-blue-500 mb-3"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
          ></path>
        </svg>
        <span className="font-semibold text-gray-700">
          Click to browse or drag a file here
        </span>
        <span className="text-xs text-gray-400 mt-1">
          JPEG, PNG, WEBP, HEIC, or PDF — up to ~18MB
        </span>
      </div>

      {loading && (
        <div className="text-center text-gray-500 animate-pulse">
          Processing document...
        </div>
      )}

      {error && (
        <div className="p-4 bg-red-50 border-l-4 border-red-400 rounded-r-md text-sm text-red-700">
          {error}
        </div>
      )}

      {data?.requires_manual_review && (
        <div className="p-4 bg-yellow-50 border-l-4 border-yellow-400 rounded-r-md flex items-start">
          <svg
            className="h-5 w-5 text-yellow-400 mt-0.5 mr-3"
            viewBox="0 0 20 20"
            fill="currentColor"
          >
            <path
              fillRule="evenodd"
              d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
              clipRule="evenodd"
            />
          </svg>
          <div>
            <h3 className="text-sm font-medium text-yellow-800">
              Attention Required
            </h3>
            <p className="text-sm text-yellow-700 mt-1">
              Please confirm the extracted details below before proceeding.
            </p>
          </div>
        </div>
      )}

      {normalized?.unresolved?.length > 0 && (
        <div className="p-4 bg-yellow-50 border-l-4 border-yellow-400 rounded-r-md text-sm text-yellow-700">
          <strong className="font-medium">Notice:</strong> some tests weren't
          recognized and won't appear on the trend chart:
          {normalized.unresolved.map((item, i) => (
            <span key={i} className="font-medium">
              {" "}
              {item.rawTestName}
            </span>
          ))}
        </div>
      )}

      {data && (
        <div className="bg-white shadow-sm border border-gray-200 rounded-xl overflow-hidden">
          {data.input_type === "prescription" && data.prescription && (
            <div className="p-6">
              <div className="border-b border-gray-100 pb-4 mb-4 flex justify-between items-end">
                <div>
                  <h3 className="text-lg font-bold text-gray-900">
                    Prescription Summary
                  </h3>
                  <p className="text-sm text-gray-500 mt-1">
                    Patient: {data.prescription.patient_name}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-medium text-gray-700">
                    {data.prescription.doctor_name}
                  </p>
                  <p className="text-xs text-gray-500">
                    {data.prescription.clinic_name}
                  </p>
                </div>
              </div>

              <h4 className="text-sm font-semibold text-gray-700 uppercase tracking-wider mb-3">
                Extracted Medications
              </h4>
              <div className="space-y-3">
                {data.prescription.medications.map((med, index) => {
                  const isLowConfidence = med.confidence < 0.7;
                  const flags = med.field_flags || [];

                  return (
                    <div
                      key={index}
                      className={`p-4 rounded-lg border ${isLowConfidence ? "bg-red-50 border-red-200" : "bg-gray-50 border-gray-200"}`}
                    >
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                        <div>
                          <span className="block text-xs text-gray-500 mb-1">
                            Drug Name
                          </span>
                          <span
                            className={`font-medium ${flags.includes("drug_name") ? "text-red-600 bg-red-100 px-1 py-0.5 rounded" : "text-gray-900"}`}
                          >
                            {med.drug_name}
                          </span>
                        </div>
                        <div>
                          <span className="block text-xs text-gray-500 mb-1">
                            Dose
                          </span>
                          <span
                            className={
                              flags.includes("dose")
                                ? "text-red-600 bg-red-100 px-1 py-0.5 rounded"
                                : "text-gray-900"
                            }
                          >
                            {med.dose || "Not stated"}
                          </span>
                        </div>
                        <div>
                          <span className="block text-xs text-gray-500 mb-1">
                            Timing
                          </span>
                          <span
                            className={
                              flags.includes("timing")
                                ? "text-red-600 bg-red-100 px-1 py-0.5 rounded"
                                : "text-gray-900"
                            }
                          >
                            {med.timing}
                          </span>
                        </div>
                        <div>
                          <span className="block text-xs text-gray-500 mb-1">
                            Confidence
                          </span>
                          <span
                            className={`${isLowConfidence ? "text-red-600 font-bold" : "text-green-600 font-medium"}`}
                          >
                            {(med.confidence * 100).toFixed(0)}%
                          </span>
                        </div>
                      </div>

                      <div className="mt-3 pt-3 border-t border-gray-200/70">
                        <label className="block text-xs text-gray-500 mb-1">
                          Reminder times (24h, comma-separated — leave blank to use the default for "{med.timing}")
                        </label>
                        <input
                          type="text"
                          value={reminderTimeInputs[index] ?? ""}
                          onChange={(e) =>
                            setReminderTimeInputs((prev) => ({ ...prev, [index]: e.target.value }))
                          }
                          placeholder="e.g. 08:00, 20:00"
                          className="w-full text-sm border border-gray-300 rounded-md px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {data.input_type === "lab_report" && data.lab_report && (
            <div className="p-6">
              <h3 className="text-lg font-bold text-gray-900 mb-4">
                Lab Report Summary
              </h3>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Test Name
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Result
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Reference Range
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Status
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {data.lab_report.tests.map((test, index) => (
                      <tr key={index}>
                        <td className="px-4 py-3 text-sm font-medium text-gray-900">
                          {test.test_name}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-700">
                          {test.value} {test.unit}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-500">
                          {test.reference_range}
                        </td>
                        <td className="px-4 py-3 text-sm">
                          {(() => {
                            const status = getLabTestStatus(test);
                            return (
                              <span
                                title={status.title}
                                className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${TONE_CLASSES[status.tone]}`}
                              >
                                {status.label}
                              </span>
                            );
                          })()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {data && (
        <div className="flex items-center gap-4 flex-wrap">
          <button
            onClick={handleConfirmSave}
            disabled={saveState === "saving" || saveState === "saved"}
            className="bg-blue-600 text-white px-6 py-2 rounded-lg font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saveState === "saving"
              ? "Saving..."
              : saveState === "saved"
                ? "Saved ✓"
                : "Confirm & Save"}
          </button>

          {saveState === "saved" && reminderSummary.length > 0 && (
            <div className="text-sm text-gray-600 space-y-1">
              {reminderSummary.map((r, i) => (
                <div key={i}>
                  <span className="font-medium text-gray-800">{r.drugName}:</span>{" "}
                  {r.scheduled
                    ? `reminders at ${r.created.map((c) => c.scheduledTime).join(", ")}${r.personalized ? " (your times)" : ""}`
                    : r.reason}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
