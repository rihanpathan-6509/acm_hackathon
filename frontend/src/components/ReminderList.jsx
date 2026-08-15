import { useEffect, useState } from "react";
import { getMedications, getOrCreatePatientId } from "../services/api";

export default function ReminderList() {
  const [medications, setMedications] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getOrCreatePatientId()
      .then((patientId) => getMedications(patientId))
      .then((res) => setMedications(res.medications || []))
      .catch(() => setMedications([]))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="p-6">
      <h2 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
        <svg
          className="w-5 h-5 text-blue-500"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
          ></path>
        </svg>
        Active Reminders
      </h2>

      {loading ? (
        <p className="text-gray-500 text-sm">Loading...</p>
      ) : medications.length === 0 ? (
        <p className="text-gray-500 text-sm">No active reminders found.</p>
      ) : (
        <div className="space-y-4">
          {medications.map((med) => (
            <div
              key={med._id}
              className="p-4 bg-gray-50 rounded-lg border border-gray-100 hover:border-blue-200 transition-colors"
            >
              <h3 className="font-bold text-gray-900">
                {med.drugName}{" "}
                <span className="text-blue-600 font-medium">— {med.dose}</span>
              </h3>
              <div className="mt-2 space-y-1 text-sm text-gray-600">
                <p>
                  <span className="font-medium text-gray-700">Timing:</span>{" "}
                  {med.timing}
                </p>
                <p>
                  <span className="font-medium text-gray-700">
                    Instructions:
                  </span>{" "}
                  {med.instructions}
                </p>
                <p>
                  <span className="font-medium text-gray-700">Duration:</span>{" "}
                  {med.duration}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
