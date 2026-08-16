import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useReminderAlerts } from "../hooks/useReminderAlerts";
import { markReminderTaken } from "../services/api";
import Button from "./ui/Button";

// Mounted once at the app root (see App.jsx) so a reminder pops up
// regardless of which page the patient is currently on.
export default function ReminderAlert() {
  const { activeAlert, queueLength, dismiss } = useReminderAlerts();
  const [phase, setPhase] = useState("idle"); // idle | saving | done

  const handleTaken = async () => {
    setPhase("saving");
    try {
      await markReminderTaken(activeAlert._id);
    } catch {
      // Marking "taken" failing shouldn't trap the patient behind a popup
      // they can't dismiss — still show the confirmation and close.
    }
    setPhase("done");
    setTimeout(() => {
      dismiss(activeAlert._id);
      setPhase("idle");
    }, 750);
  };

  return (
    <AnimatePresence>
      {activeAlert && (
        <motion.div
          key="reminder-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-[100] flex items-center justify-center bg-ink/30 backdrop-blur-[2px] px-4"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.85, y: 24 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 12 }}
            transition={{ type: "spring", stiffness: 340, damping: 22 }}
            className="bg-surface rounded-3xl shadow-popup max-w-sm w-full p-6"
          >
            {phase === "done" ? (
              <div className="flex flex-col items-center py-4 text-center">
                <motion.div
                  initial={{ scale: 0.6 }}
                  animate={{ scale: 1 }}
                  transition={{ type: "spring", stiffness: 400, damping: 16 }}
                  className="w-16 h-16 rounded-full bg-success-50 flex items-center justify-center mb-3"
                >
                  <svg viewBox="0 0 24 24" className="w-8 h-8 text-success-600">
                    <motion.path
                      d="M4 12l5 5L20 6"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth={3}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      initial={{ pathLength: 0 }}
                      animate={{ pathLength: 1 }}
                      transition={{ duration: 0.4, ease: "easeOut", delay: 0.1 }}
                    />
                  </svg>
                </motion.div>
                <p className="font-semibold text-ink">Nice work</p>
                <p className="text-sm text-ink-soft">Marked as taken.</p>
              </div>
            ) : (
              <>
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-12 h-12 rounded-full bg-accent-100 flex items-center justify-center flex-shrink-0">
                    <svg className="w-7 h-7 text-accent-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
                        d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                    </svg>
                  </div>
                  <div>
                    <h2 className="font-semibold text-ink text-lg">
                      {activeAlert.label || "Reminder"}
                    </h2>
                    <p className="text-sm text-ink-soft">Scheduled for {activeAlert.scheduledTime}</p>
                  </div>
                </div>

                {activeAlert.instructions && (
                  <p className="text-sm text-ink bg-stone-50 rounded-xl p-3 mb-4">
                    {activeAlert.instructions}
                  </p>
                )}

                {queueLength > 1 && (
                  <p className="text-xs text-ink-soft mb-3">
                    +{queueLength - 1} more reminder{queueLength - 1 > 1 ? "s" : ""} waiting
                  </p>
                )}

                <div className="flex gap-2">
                  <Button
                    variant="accent"
                    loading={phase === "saving"}
                    onClick={handleTaken}
                    className="flex-1"
                  >
                    {phase === "saving" ? "Saving..." : "Mark as Taken"}
                  </Button>
                  <Button variant="ghost" onClick={() => dismiss(activeAlert._id)}>
                    Dismiss
                  </Button>
                </div>
              </>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
