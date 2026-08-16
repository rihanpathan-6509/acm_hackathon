import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { getMedications, getLabs, getReminders } from "../services/api";
import { SkeletonRow } from "./ui/Skeleton";
import EmptyState from "./ui/EmptyState";
import { useToast } from "./ui/useToast";

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
  medication: { dot: "bg-primary-500", label: "Medication" },
  lab: { dot: "bg-violet-400", label: "Lab Reading" },
  reminder: { dot: "bg-accent-500", label: "Reminder" },
};

export default function PatientTimeline({ patientId }) {
  const toast = useToast();
  const [events, setEvents] = useState(null); // null = loading

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
      .catch((err) => {
        setEvents([]);
        toast(err.message);
      });
  }, [patientId, toast]);

  if (events === null) {
    return (
      <div className="space-y-1">
        <SkeletonRow />
        <SkeletonRow />
        <SkeletonRow />
      </div>
    );
  }
  if (events.length === 0) {
    return (
      <EmptyState
        icon={
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5"
              d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        }
        title="No history yet"
        description="This patient's medications, labs, and reminders will show up here."
      />
    );
  }

  return (
    <motion.div
      initial="hidden"
      animate="show"
      variants={{ show: { transition: { staggerChildren: 0.05 } } }}
      className="space-y-4"
    >
      {events.map((event) => {
        const style = TYPE_STYLES[event.type];
        return (
          <motion.div
            key={event.id}
            variants={{ hidden: { opacity: 0, x: -8 }, show: { opacity: 1, x: 0 } }}
            className="flex gap-3"
          >
            <div className="flex flex-col items-center pt-1">
              <span className={`w-2.5 h-2.5 rounded-full ${style.dot}`} />
              <span className="flex-1 w-px bg-stone-200 mt-1" />
            </div>
            <div className="pb-4 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-medium text-ink-soft uppercase tracking-wide">
                  {style.label}
                </span>
                <span className="text-xs text-ink-soft/80">
                  {new Date(event.date).toLocaleDateString(undefined, {
                    day: "numeric", month: "short", year: "numeric",
                  })}
                </span>
                {event.flagged && (
                  <span className="text-xs font-medium px-1.5 py-0.5 rounded-full bg-danger-100 text-danger-700">
                    Flagged
                  </span>
                )}
              </div>
              <p className="font-medium text-ink mt-0.5">{event.title}</p>
              {event.detail && <p className="text-sm text-ink-soft">{event.detail}</p>}
            </div>
          </motion.div>
        );
      })}
    </motion.div>
  );
}
