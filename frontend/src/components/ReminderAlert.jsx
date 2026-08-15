import { useState } from "react";
import { useReminderAlerts } from "../hooks/useReminderAlerts";
import { markReminderTaken } from "../services/api";

// Mounted once at the app root (see App.jsx) so a reminder pops up
// regardless of which page the patient is currently on.
export default function ReminderAlert() {
  const { activeAlert, queueLength, dismiss } = useReminderAlerts();
  const [saving, setSaving] = useState(false);

  if (!activeAlert) return null;

  const handleTaken = async () => {
    setSaving(true);
    try {
      await markReminderTaken(activeAlert._id);
    } catch {
      // Marking "taken" failing shouldn't trap the patient behind a popup
      // they can't dismiss — still close it.
    } finally {
      setSaving(false);
      dismiss(activeAlert._id);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 px-4">
      <div className="bg-white rounded-2xl shadow-xl max-w-sm w-full p-6 animate-[pulse_2s_ease-in-out_1]">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
            <svg className="w-7 h-7 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
                d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
            </svg>
          </div>
          <div>
            <h2 className="font-bold text-gray-900 text-lg">
              {activeAlert.label || "Reminder"}
            </h2>
            <p className="text-sm text-gray-500">Scheduled for {activeAlert.scheduledTime}</p>
          </div>
        </div>

        {activeAlert.instructions && (
          <p className="text-sm text-gray-700 bg-gray-50 rounded-lg p-3 mb-4">
            {activeAlert.instructions}
          </p>
        )}

        {queueLength > 1 && (
          <p className="text-xs text-gray-400 mb-3">
            +{queueLength - 1} more reminder{queueLength - 1 > 1 ? "s" : ""} waiting
          </p>
        )}

        <div className="flex gap-2">
          <button
            onClick={handleTaken}
            disabled={saving}
            className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-700 transition-colors disabled:opacity-50"
          >
            {saving ? "Saving..." : "Mark as Taken"}
          </button>
          <button
            onClick={() => dismiss(activeAlert._id)}
            className="px-4 py-2 rounded-lg font-medium text-gray-600 hover:bg-gray-100 transition-colors"
          >
            Dismiss
          </button>
        </div>
      </div>
    </div>
  );
}
