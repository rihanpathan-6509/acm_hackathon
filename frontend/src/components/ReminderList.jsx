import { useEffect, useState } from "react";
import {
  getReminders,
  getOrCreatePatientId,
  createReminder,
  updateReminder,
  deactivateReminder,
} from "../services/api";

const TIME_TOKEN = /^([01]\d|2[0-3]):([0-5]\d)$/;

// This used to list Medications (drug name/dose/instructions) under the
// heading "Active Reminders" — which was fine for display, but had nothing
// to actually edit: no scheduledTime, no reminder id. Personalizing a time
// means showing the real Reminder documents instead.
export default function ReminderList() {
  const [patientId, setPatientId] = useState(null);
  const [reminders, setReminders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState(null);
  const [editTime, setEditTime] = useState("");
  const [error, setError] = useState(null);

  const [showAddForm, setShowAddForm] = useState(false);
  const [newLabel, setNewLabel] = useState("");
  const [newTime, setNewTime] = useState("");
  const [newInstructions, setNewInstructions] = useState("");
  const [adding, setAdding] = useState(false);

  const load = (pid) => {
    getReminders(pid)
      .then((res) => setReminders(res.reminders || []))
      .catch(() => setReminders([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    getOrCreatePatientId().then((pid) => {
      setPatientId(pid);
      load(pid);
    });
  }, []);

  const startEdit = (reminder) => {
    setEditingId(reminder._id);
    setEditTime(reminder.scheduledTime);
    setError(null);
  };

  const saveEdit = async (reminder) => {
    if (!TIME_TOKEN.test(editTime)) {
      setError('Time must be "HH:MM" in 24-hour format.');
      return;
    }
    try {
      await updateReminder(reminder._id, { scheduledTime: editTime });
      setEditingId(null);
      load(patientId);
    } catch (err) {
      setError(err.message);
    }
  };

  const handleDeactivate = async (reminder) => {
    try {
      await deactivateReminder(reminder._id);
      load(patientId);
    } catch (err) {
      setError(err.message);
    }
  };

  const handleAddCustom = async (e) => {
    e.preventDefault();
    if (!newLabel.trim() || !TIME_TOKEN.test(newTime)) {
      setError('Label is required and time must be "HH:MM".');
      return;
    }
    setAdding(true);
    setError(null);
    try {
      await createReminder(patientId, newLabel.trim(), newTime, newInstructions.trim() || undefined);
      setNewLabel("");
      setNewTime("");
      setNewInstructions("");
      setShowAddForm(false);
      load(patientId);
    } catch (err) {
      setError(err.message);
    } finally {
      setAdding(false);
    }
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
          <svg className="w-5 h-5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
              d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          Active Reminders
        </h2>
        <button
          onClick={() => setShowAddForm((v) => !v)}
          className="text-sm font-medium text-blue-600 hover:text-blue-800"
        >
          {showAddForm ? "Cancel" : "+ Add"}
        </button>
      </div>

      {error && <p className="text-sm text-red-600 mb-3">{error}</p>}

      {showAddForm && (
        <form onSubmit={handleAddCustom} className="mb-4 p-3 bg-blue-50 rounded-lg space-y-2">
          <input
            type="text"
            value={newLabel}
            onChange={(e) => setNewLabel(e.target.value)}
            placeholder="What's this reminder for? (e.g. Check blood pressure)"
            className="w-full text-sm border border-gray-300 rounded-md px-3 py-1.5"
          />
          <div className="flex gap-2">
            <input
              type="time"
              value={newTime}
              onChange={(e) => setNewTime(e.target.value)}
              className="text-sm border border-gray-300 rounded-md px-3 py-1.5"
            />
            <input
              type="text"
              value={newInstructions}
              onChange={(e) => setNewInstructions(e.target.value)}
              placeholder="Notes (optional)"
              className="flex-1 text-sm border border-gray-300 rounded-md px-3 py-1.5"
            />
          </div>
          <button
            type="submit"
            disabled={adding}
            className="bg-blue-600 text-white text-sm px-4 py-1.5 rounded-md font-medium hover:bg-blue-700 disabled:opacity-50"
          >
            {adding ? "Adding..." : "Add Reminder"}
          </button>
        </form>
      )}

      {loading ? (
        <p className="text-gray-500 text-sm">Loading...</p>
      ) : reminders.length === 0 ? (
        <p className="text-gray-500 text-sm">No active reminders found.</p>
      ) : (
        <div className="space-y-3">
          {reminders.map((r) => (
            <div
              key={r._id}
              className="p-4 bg-gray-50 rounded-lg border border-gray-100 hover:border-blue-200 transition-colors"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 className="font-bold text-gray-900">{r.label || "Reminder"}</h3>
                  {r.instructions && (
                    <p className="text-sm text-gray-600 mt-0.5">{r.instructions}</p>
                  )}
                </div>

                {editingId === r._id ? (
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <input
                      type="time"
                      value={editTime}
                      onChange={(e) => setEditTime(e.target.value)}
                      className="text-sm border border-gray-300 rounded-md px-2 py-1 w-28"
                    />
                    <button
                      onClick={() => saveEdit(r)}
                      className="text-xs font-medium text-blue-600 hover:text-blue-800 px-1"
                    >
                      Save
                    </button>
                    <button
                      onClick={() => setEditingId(null)}
                      className="text-xs text-gray-400 hover:text-gray-600 px-1"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className="text-sm font-medium text-blue-600 bg-blue-100 px-2 py-0.5 rounded-full">
                      {r.scheduledTime}
                    </span>
                    <button
                      onClick={() => startEdit(r)}
                      className="text-xs text-gray-400 hover:text-gray-600"
                      title="Edit time"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDeactivate(r)}
                      className="text-xs text-gray-400 hover:text-red-600"
                      title="Remove"
                    >
                      Remove
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
