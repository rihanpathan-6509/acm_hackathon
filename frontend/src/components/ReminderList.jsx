import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  getReminders,
  getOrCreatePatientId,
  createReminder,
  updateReminder,
  deactivateReminder,
} from "../services/api";
import Button from "./ui/Button";
import { SkeletonRow } from "./ui/Skeleton";
import EmptyState from "./ui/EmptyState";
import { useToast } from "./ui/useToast";

const TIME_TOKEN = /^([01]\d|2[0-3]):([0-5]\d)$/;

// This used to list Medications (drug name/dose/instructions) under the
// heading "Active Reminders" — which was fine for display, but had nothing
// to actually edit: no scheduledTime, no reminder id. Personalizing a time
// means showing the real Reminder documents instead.
export default function ReminderList() {
  const toast = useToast();
  const [patientId, setPatientId] = useState(null);
  const [reminders, setReminders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState(null);
  const [editTime, setEditTime] = useState("");

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
  };

  const saveEdit = async (reminder) => {
    if (!TIME_TOKEN.test(editTime)) {
      toast('Time must be "HH:MM" in 24-hour format.');
      return;
    }
    try {
      await updateReminder(reminder._id, { scheduledTime: editTime });
      setEditingId(null);
      load(patientId);
    } catch (err) {
      toast(err.message);
    }
  };

  const handleDeactivate = async (reminder) => {
    try {
      await deactivateReminder(reminder._id);
      load(patientId);
    } catch (err) {
      toast(err.message);
    }
  };

  const handleAddCustom = async (e) => {
    e.preventDefault();
    if (!newLabel.trim() || !TIME_TOKEN.test(newTime)) {
      toast('Label is required and time must be "HH:MM".');
      return;
    }
    setAdding(true);
    try {
      await createReminder(patientId, newLabel.trim(), newTime, newInstructions.trim() || undefined);
      setNewLabel("");
      setNewTime("");
      setNewInstructions("");
      setShowAddForm(false);
      load(patientId);
      toast("Reminder added.", "success");
    } catch (err) {
      toast(err.message);
    } finally {
      setAdding(false);
    }
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-ink flex items-center gap-2">
          <svg className="w-5 h-5 text-primary-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
              d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          Active Reminders
        </h2>
        <Button variant="ghost" size="sm" onClick={() => setShowAddForm((v) => !v)}>
          {showAddForm ? "Cancel" : "+ Add"}
        </Button>
      </div>

      <AnimatePresence initial={false}>
        {showAddForm && (
          <motion.form
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            onSubmit={handleAddCustom}
            className="mb-4 p-3.5 bg-primary-50 rounded-xl space-y-2 overflow-hidden"
          >
            <input
              type="text"
              value={newLabel}
              onChange={(e) => setNewLabel(e.target.value)}
              placeholder="What's this reminder for? (e.g. Check blood pressure)"
              className="w-full text-sm border border-stone-200 rounded-lg px-3 py-1.5 bg-surface focus:outline-none focus:ring-2 focus:ring-primary-300"
            />
            <div className="flex gap-2">
              <input
                type="time"
                value={newTime}
                onChange={(e) => setNewTime(e.target.value)}
                className="text-sm border border-stone-200 rounded-lg px-3 py-1.5 bg-surface focus:outline-none focus:ring-2 focus:ring-primary-300"
              />
              <input
                type="text"
                value={newInstructions}
                onChange={(e) => setNewInstructions(e.target.value)}
                placeholder="Notes (optional)"
                className="flex-1 text-sm border border-stone-200 rounded-lg px-3 py-1.5 bg-surface focus:outline-none focus:ring-2 focus:ring-primary-300"
              />
            </div>
            <Button type="submit" size="sm" loading={adding}>
              {adding ? "Adding..." : "Add Reminder"}
            </Button>
          </motion.form>
        )}
      </AnimatePresence>

      {loading ? (
        <div className="space-y-1">
          <SkeletonRow />
          <SkeletonRow />
          <SkeletonRow />
        </div>
      ) : reminders.length === 0 ? (
        <EmptyState
          icon={
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5"
                d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          }
          title="No active reminders"
          description="Add one above, or confirm an upload to schedule medication reminders."
        />
      ) : (
        <motion.div
          initial="hidden"
          animate="show"
          variants={{ show: { transition: { staggerChildren: 0.05 } } }}
          className="space-y-2.5"
        >
          {reminders.map((r) => (
            <motion.div
              key={r._id}
              layout
              variants={{ hidden: { opacity: 0, x: -8 }, show: { opacity: 1, x: 0 } }}
              className="p-3.5 bg-stone-50 rounded-xl border border-stone-100 hover:border-primary-200 transition-colors"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 className="font-semibold text-ink text-sm">{r.label || "Reminder"}</h3>
                  {r.instructions && (
                    <p className="text-sm text-ink-soft mt-0.5">{r.instructions}</p>
                  )}
                </div>

                {editingId === r._id ? (
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <input
                      type="time"
                      value={editTime}
                      onChange={(e) => setEditTime(e.target.value)}
                      className="text-sm border border-stone-200 rounded-md px-2 py-1 w-28 bg-surface"
                    />
                    <Button variant="secondary" size="sm" onClick={() => saveEdit(r)}>
                      Save
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => setEditingId(null)}>
                      Cancel
                    </Button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className="text-xs font-medium text-primary-700 bg-primary-100 px-2 py-0.5 rounded-full">
                      {r.scheduledTime}
                    </span>
                    <button
                      onClick={() => startEdit(r)}
                      className="text-xs text-ink-soft hover:text-ink transition-colors"
                      title="Edit time"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDeactivate(r)}
                      className="text-xs text-ink-soft hover:text-danger-600 transition-colors"
                      title="Remove"
                    >
                      Remove
                    </button>
                  </div>
                )}
              </div>
            </motion.div>
          ))}
        </motion.div>
      )}
    </div>
  );
}
