import { useEffect, useState } from "react";
import { getMedications, getLabs, getReminders } from "../services/api";

// Merges three separate collections (medications, lab readings, reminders)
// into one chronological feed. They have no shared "event" model on the
// backend — each is its own resource with its own date field — so the
// merge happens here rather than adding a bespoke timeline endpoint for
// what's fundamentally a read-only view concern.
function buildTimeline({ medications, labMarkers, reminders }) {
  const events = [];

  for (const m of medications) {
    events.push({
      id: `med-${m._id}`,
      date: m.createdAt,
      type: "medication",
      title: `${m.drugName}${m.dose ? ` — ${m.dose}` : ""}`,
      detail: [m.timing, m.instructions].filter(Boolean).join(" · "),
      flagged: m.requiresManualReview,
    });
  }

  for (const r of labMarkers) {
    events.push({
      id: `lab-${r._id}`,
      date: r.date,
      type: "lab",
      title: `${r.canonicalName}: ${r.displayValue} ${r.displayUnit}`,
      detail: r.labName || "",
      flagged: r.isAbnormal === true,
    });
  }

  // Reminder *creation* is the event worth showing on a history timeline —
  // "when did this get scheduled", not every daily firing, which would be
  // noise rather than history.
  for (const r of reminders) {
    events.push({
      id: `rem-${r._id}`,
      date: r.createdAt,
      type: "reminder",
      title: `Reminder set: ${r.label || "Untitled"}`,
      detail: `Daily at ${r.scheduledTime}${r.instructions ? ` · ${r.instructions}` : ""}`,
      flagged: false,
    });
  }

  return events
    .filter((e) => e.date)
    .sort((a, b) => new Date(b.date) - new Date(a.date));
}

const TYPE_STYLES = {
  medication: { dot: "bg-blue-500", label: "Medication" },
  lab: { dot: "bg-purple-500", label: "Lab Reading" },
  reminder: { dot: "bg-amber-500", label: "Reminder" },
};

export default function PatientTimeline({ patientId }) {
  const [events, setEvents] = useState(null); // null = loading
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!patientId) return;

    Promise.all([
      getMedications(patientId).catch(() => ({ medications: [] })),
      getLabs(patientId).catch(() => ({ labMarkers: [] })),
      getReminders(patientId).catch(() => ({ reminders: [] })),
    ])
      .then(([medsRes, labsRes, remRes]) => {
        setEvents(
          buildTimeline({
            medications: medsRes.medications || [],
            labMarkers: labsRes.labMarkers || [],
            reminders: remRes.reminders || [],
          })
        );
      })
      .catch((err) => setError(err.message));
  }, [patientId]);

  if (error) {
    return <p className="text-sm text-red-600">{error}</p>;
  }
  if (events === null) {
    return <p className="text-sm text-gray-500">Loading history...</p>;
  }
  if (events.length === 0) {
    return <p className="text-sm text-gray-500">No history yet for this patient.</p>;
  }

  return (
    <div className="space-y-4">
      {events.map((event) => {
        const style = TYPE_STYLES[event.type];
        return (
          <div key={event.id} className="flex gap-3">
            <div className="flex flex-col items-center pt-1">
              <span className={`w-2.5 h-2.5 rounded-full ${style.dot}`} />
              <span className="flex-1 w-px bg-gray-200 mt-1" />
            </div>
            <div className="pb-4 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-medium text-gray-400 uppercase tracking-wide">
                  {style.label}
                </span>
                <span className="text-xs text-gray-400">
                  {new Date(event.date).toLocaleDateString(undefined, {
                    day: "numeric", month: "short", year: "numeric",
                  })}
                </span>
                {event.flagged && (
                  <span className="text-xs font-medium px-1.5 py-0.5 rounded bg-red-100 text-red-700">
                    Flagged
                  </span>
                )}
              </div>
              <p className="font-medium text-gray-900 mt-0.5">{event.title}</p>
              {event.detail && <p className="text-sm text-gray-500">{event.detail}</p>}
            </div>
          </div>
        );
      })}
    </div>
  );
}
