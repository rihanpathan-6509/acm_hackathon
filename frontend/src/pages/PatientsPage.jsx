import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  getPatients,
  createPatient,
  getActivePatientId,
  setActivePatientId,
} from "../services/api";
import PatientTimeline from "../components/PatientTimeline";
import Card from "../components/ui/Card";
import Button from "../components/ui/Button";
import EmptyState from "../components/ui/EmptyState";
import { SkeletonRow } from "../components/ui/Skeleton";
import { useToast } from "../components/ui/useToast";

export default function PatientsPage() {
  const toast = useToast();
  const [patients, setPatients] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);
  const activeId = getActivePatientId();

  const load = () => {
    getPatients()
      .then((res) => setPatients(res.patients || []))
      .catch((err) => {
        setPatients([]);
        toast(err.message);
      });
  };

  useEffect(load, [toast]);

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!newName.trim()) return;
    setCreating(true);
    try {
      await createPatient(newName.trim());
      setNewName("");
      load();
    } catch (err) {
      toast(err.message);
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <header>
        <h1 className="text-3xl font-semibold text-ink tracking-tight">Patients</h1>
        <p className="mt-1.5 text-sm text-ink-soft">
          Every patient's medications, lab readings, and reminders are kept
          separately — pick one to view their history, or switch the app to
          act on them.
        </p>
      </header>

      <form onSubmit={handleCreate} className="flex gap-2">
        <input
          type="text"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="New patient name"
          className="flex-1 border border-stone-200 rounded-lg px-4 py-2 bg-surface focus:outline-none focus:ring-2 focus:ring-primary-300"
        />
        <Button type="submit" loading={creating} disabled={!newName.trim()}>
          {creating ? "Adding..." : "Add Patient"}
        </Button>
      </form>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-1 divide-y divide-stone-100 overflow-hidden">
          {patients === null && (
            <div className="divide-y divide-stone-100">
              <SkeletonRow />
              <SkeletonRow />
            </div>
          )}
          {patients?.length === 0 && (
            <EmptyState
              icon={
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5"
                    d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              }
              title="No patients yet"
              description="Add one above to get started."
            />
          )}
          {patients?.map((p, i) => {
            const isActive = p._id === activeId;
            const isSelected = p._id === selectedId;
            return (
              <motion.div
                key={p._id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25, delay: i * 0.05 }}
                onClick={() => setSelectedId(p._id)}
                className={`p-4 cursor-pointer transition-colors ${isSelected ? "bg-primary-50" : "hover:bg-stone-50"}`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <p className="font-medium text-ink">
                      {p.name}
                      {isActive && (
                        <span className="ml-2 text-xs font-medium px-1.5 py-0.5 rounded-full bg-success-100 text-success-700">
                          Active
                        </span>
                      )}
                    </p>
                    <p className="text-xs text-ink-soft/80">
                      Added {new Date(p.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                  {!isActive && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        setActivePatientId(p._id);
                      }}
                      className="whitespace-nowrap"
                    >
                      Switch to
                    </Button>
                  )}
                </div>
              </motion.div>
            );
          })}
        </Card>

        <Card className="lg:col-span-2 p-6">
          <h2 className="text-lg font-semibold text-ink mb-4">History Timeline</h2>
          {selectedId ? (
            // Keyed by patientId so switching patients remounts this
            // fresh (fixes clearing on switch) instead of resetting state
            // synchronously inside its effect.
            <PatientTimeline key={selectedId} patientId={selectedId} />
          ) : (
            <p className="text-sm text-ink-soft">Select a patient to view their history.</p>
          )}
        </Card>
      </div>
    </div>
  );
}
