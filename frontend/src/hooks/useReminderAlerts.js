import { useEffect, useRef, useState, useCallback } from "react";
import { getReminders, getOrCreatePatientId } from "../services/api";

const POLL_INTERVAL_MS = 20000; // frequent enough that a reminder fires within ~20s of its minute, not so frequent it hammers the API
const FIRED_KEY = "chronicare_fired_reminders"; // { "<reminderId>:<YYYY-MM-DD>": true }

function nowHHMM() {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function todayKey(reminderId) {
  return `${reminderId}:${new Date().toISOString().slice(0, 10)}`;
}

function loadFired() {
  try {
    return JSON.parse(localStorage.getItem(FIRED_KEY) || "{}");
  } catch {
    return {};
  }
}

function saveFired(fired) {
  // Trim entries older than today so this doesn't grow forever — a
  // reminder only needs to remember "already fired" for the current day.
  const today = new Date().toISOString().slice(0, 10);
  const trimmed = Object.fromEntries(
    Object.entries(fired).filter(([key]) => key.endsWith(today))
  );
  localStorage.setItem(FIRED_KEY, JSON.stringify(trimmed));
}

// Short two-tone beep via Web Audio — no external audio file needed, so
// there's nothing to fetch and nothing that can 404.
function playAlertSound() {
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    const ctx = new Ctx();
    const playTone = (freq, startTime, duration) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, startTime);
      gain.gain.exponentialRampToValueAtTime(0.3, startTime + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);
      osc.connect(gain).connect(ctx.destination);
      osc.start(startTime);
      osc.stop(startTime + duration);
    };
    const t0 = ctx.currentTime;
    playTone(880, t0, 0.18);
    playTone(1108, t0 + 0.2, 0.22);
  } catch {
    // Web Audio blocked (e.g. no user interaction yet on this page load) —
    // the popup itself still shows, sound is a nice-to-have on top of it.
  }
}

/**
 * Polls the current patient's active reminders and surfaces a popup+sound
 * alert exactly once per reminder per day, at or shortly after its
 * scheduled time. Mount this once, near the app root, so it fires
 * regardless of which page the patient is on.
 */
export function useReminderAlerts() {
  const [queue, setQueue] = useState([]); // reminders waiting to be shown
  const firedRef = useRef(loadFired());

  const checkNow = useCallback(async () => {
    const patientId = await getOrCreatePatientId().catch(() => null);
    if (!patientId) return;

    const { reminders } = await getReminders(patientId).catch(() => ({ reminders: [] }));
    const current = nowHHMM();

    // "<=", not "===" — an exact-minute match means a reminder is silently
    // lost for the entire day if the tab isn't open in that specific
    // ~20s-polling window (confirmed live: a reminder set for the current
    // minute had already rolled past by the time the page loaded, and
    // never fired). "HH:MM" strings compare correctly lexicographically,
    // so this catches up on anything due earlier today that hasn't fired
    // yet, the first time the app is checked after its time arrives.
    const due = (reminders || []).filter(
      (r) => r.scheduledTime <= current && !firedRef.current[todayKey(r._id)]
    );
    if (due.length === 0) return;

    for (const r of due) firedRef.current[todayKey(r._id)] = true;
    saveFired(firedRef.current);

    setQueue((prev) => [...prev, ...due]);
    playAlertSound();
    if (window.Notification && Notification.permission === "granted") {
      for (const r of due) {
        new Notification(`Reminder: ${r.label || "Medication"}`, {
          body: r.instructions || `Scheduled for ${r.scheduledTime}`,
        });
      }
    }
  }, []);

  useEffect(() => {
    if (window.Notification && Notification.permission === "default") {
      Notification.requestPermission().catch(() => {});
    }
    checkNow();
    const id = setInterval(checkNow, POLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, [checkNow]);

  const dismiss = useCallback((reminderId) => {
    setQueue((prev) => prev.filter((r) => r._id !== reminderId));
  }, []);

  return { activeAlert: queue[0] || null, queueLength: queue.length, dismiss };
}
