// services/reminderService.js
//
// STUB — turns a Medication's timing/duration/instructions into an actual
// reminder schedule (see BACKEND_HANDOFF.md §2b). Not implemented here
// since the scheduling design (cron? node-schedule? a queue?) is backend's
// call, not mine.

function scheduleReminders(medication) {
  throw new Error("reminderService not implemented yet — backend's to design");
}

module.exports = { scheduleReminders };
