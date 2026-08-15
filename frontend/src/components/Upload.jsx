import React, { useState } from "react";
import { mockExtractPrescription, mockExtractLabReport } from "../services/api";

export default function Upload() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleLoadPrescription = async () => {
    setLoading(true);
    const res = await mockExtractPrescription();
    setData(res.extraction);
    setLoading(false);
  };

  const handleLoadLabReport = async () => {
    setLoading(true);
    const res = await mockExtractLabReport();
    setData(res.extraction);
    setLoading(false);
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <header className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 tracking-tight">
          Upload Document
        </h1>
        <p className="mt-2 text-sm text-gray-500">
          Simulate uploading a prescription or lab report to see the AI
          extraction in action.
        </p>
      </header>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
        <button
          onClick={handleLoadPrescription}
          disabled={loading}
          className="flex flex-col items-center justify-center p-6 bg-white border-2 border-dashed border-gray-300 rounded-xl hover:border-blue-500 hover:bg-blue-50 transition-all disabled:opacity-50"
        >
          <svg
            className="w-8 h-8 text-blue-500 mb-2"
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
            Simulate Prescription
          </span>
        </button>

        <button
          onClick={handleLoadLabReport}
          disabled={loading}
          className="flex flex-col items-center justify-center p-6 bg-white border-2 border-dashed border-gray-300 rounded-xl hover:border-green-500 hover:bg-green-50 transition-all disabled:opacity-50"
        >
          <svg
            className="w-8 h-8 text-green-500 mb-2"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z"
            ></path>
          </svg>
          <span className="font-semibold text-gray-700">
            Simulate Lab Report
          </span>
        </button>
      </div>

      {loading && (
        <div className="text-center text-gray-500 animate-pulse">
          Processing document...
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
                            {med.dose}
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
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Lab Report Display */}
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
                          {test.is_abnormal ? (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                              Abnormal
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                              Normal
                            </span>
                          )}
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
    </div>
  );
}
