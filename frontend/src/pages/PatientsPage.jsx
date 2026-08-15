import { useEffect, useState } from "react";
import {
  getPatients,
  createPatient,
  getActivePatientId,
  setActivePatientId,
} from "../services/api";
import PatientTimeline from "../components/PatientTimeline";

export default function PatientsPage() {
  const [patients, setPatients] = useState(null);
  const [error, setError] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);
  const activeId = getActivePatientId();

  const load = () => {
    getPatients()
      .then((res) => setPatients(res.patients || []))
      .catch((err) => setError(err.message));
  };

  useEffect(load, []);

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!newName.trim()) return;
    setCreating(true);
    try {
      await createPatient(newName.trim());
      setNewName("");
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <header>
        <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Patients</h1>
        <p className="mt-2 text-sm text-gray-500">
          Every patient's medications, lab readings, and reminders are kept
          separately — pick one to view their history, or switch the app to
          act on them.
        </p>
      </header>

      {error && (
        <div className="p-4 bg-red-50 border-l-4 border-red-400 rounded-r-md text-sm text-red-700">
          {error}
        </div>
      )}

      <form onSubmit={handleCreate} className="flex gap-2">
        <input
          type="text"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="New patient name"
          className="flex-1 border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <button
          type="submit"
          disabled={creating || !newName.trim()}
          className="bg-blue-600 text-white px-5 py-2 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50"
        >
          {creating ? "Adding..." : "Add Patient"}
        </button>
      </form>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 bg-white rounded-xl shadow-sm border border-gray-200 divide-y divide-gray-100">
          {patients === null && <p className="p-4 text-sm text-gray-500">Loading...</p>}
          {patients?.length === 0 && (
            <p className="p-4 text-sm text-gray-500">No patients yet.</p>
          )}
          {patients?.map((p) => {
            const isActive = p._id === activeId;
            const isSelected = p._id === selectedId;
            return (
              <div
                key={p._id}
                onClick={() => setSelectedId(p._id)}
                className={`p-4 cursor-pointer transition-colors ${isSelected ? "bg-blue-50" : "hover:bg-gray-50"}`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <p className="font-medium text-gray-900">
                      {p.name}
                      {isActive && (
                        <span className="ml-2 text-xs font-medium px-1.5 py-0.5 rounded bg-green-100 text-green-700">
                          Active
                        </span>
                      )}
                    </p>
                    <p className="text-xs text-gray-400">
                      Added {new Date(p.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                  {!isActive && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setActivePatientId(p._id);
                      }}
                      className="text-xs font-medium text-blue-600 hover:text-blue-800 whitespace-nowrap"
                    >
                      Switch to
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">History Timeline</h2>
          {selectedId ? (
            // Keyed by patientId so switching patients remounts this
            // fresh (fixes clearing on switch) instead of resetting state
            // synchronously inside its effect.
            <PatientTimeline key={selectedId} patientId={selectedId} />
          ) : (
            <p className="text-sm text-gray-500">Select a patient to view their history.</p>
          )}
        </div>
      </div>
    </div>
  );
}
