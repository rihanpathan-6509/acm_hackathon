import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { sendChatMessage, getOrCreatePatientId, getMedications, getLabs } from "../services/api";
import Card from "./ui/Card";
import Button from "./ui/Button";
import EmptyState from "./ui/EmptyState";

export default function ChatBox() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [language, setLanguage] = useState("en");
  const [loading, setLoading] = useState(false);
  const [patientId, setPatientId] = useState(null);

  useEffect(() => {
    getOrCreatePatientId().then(setPatientId).catch(() => {});
  }, []);

  const handleSend = async () => {
    if (!input.trim()) return;

    const userMessage = { role: "user", text: input };
    const currentHistory = [...messages, userMessage];
    setMessages(currentHistory);
    setInput("");
    setLoading(true);

    try {
      // Fetched fresh on every send (not cached in state) so a report the
      // patient just uploaded this session is already visible to the next
      // message, instead of needing a page reload.
      const [medsRes, labsRes] = await Promise.all([
        patientId ? getMedications(patientId).catch(() => ({ medications: [] })) : { medications: [] },
        patientId ? getLabs(patientId).catch(() => ({ labMarkers: [] })) : { labMarkers: [] },
      ]);

      const patientContext = {
        patientMeds: (medsRes.medications || []).map((m) => ({
          drugName: m.drugName,
          dose: m.dose,
          timing: m.timing,
        })),
        // trendFlags stays empty until a real trend-detection pass exists —
        // labReadings below already lets the model answer factual
        // "what was my X on date Y" questions without it.
        trendFlags: [],
        labReadings: (labsRes.labMarkers || []).map((r) => ({
          canonicalName: r.canonicalName,
          markerKey: r.markerKey,
          displayValue: r.displayValue,
          displayUnit: r.displayUnit,
          date: r.date,
          labName: r.labName,
        })),
        language: language,
      };

      const res = await sendChatMessage(input, patientId, patientContext, messages);
      setMessages([
        ...currentHistory,
        { role: "model", text: res.reply, isEmergency: res.isEmergency },
      ]);
    } catch (err) {
      setMessages([
        ...currentHistory,
        { role: "model", text: `Something went wrong: ${err.message}` },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="max-w-2xl mx-auto h-[calc(100vh-12rem)] flex flex-col overflow-hidden">
      <div className="px-6 py-4 border-b border-stone-100 bg-stone-50/60 flex justify-between items-center">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-primary-100 flex items-center justify-center">
            <svg className="w-6 h-6 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"
              ></path>
            </svg>
          </div>
          <div>
            <h2 className="font-semibold text-ink">Health Assistant</h2>
            <p className="text-xs text-success-600 flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-success-500 inline-block"></span>{" "}
              Online
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-ink-soft">Language:</label>
          <select
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
            className="text-sm border border-stone-200 rounded-lg px-2 py-1 bg-surface focus:outline-none focus:ring-2 focus:ring-primary-300"
          >
            <option value="en">English</option>
            <option value="hi">Hindi</option>
          </select>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-bg">
        {messages.length === 0 && (
          <div className="h-full flex items-center justify-center">
            <EmptyState
              icon={
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5"
                    d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
              }
              title="I'm your AI health assistant."
              description="Ask me about your uploaded reports or medications."
            />
          </div>
        )}

        {messages.map((msg, index) => (
          <motion.div
            key={index}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.22, ease: "easeOut" }}
            className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[80%] rounded-2xl px-5 py-3 ${
                msg.role === "user"
                  ? "bg-primary-600 text-white rounded-br-md"
                  : msg.isEmergency
                  ? "bg-danger-50 text-danger-800 border-2 border-danger-400 rounded-bl-md shadow-soft"
                  : "bg-surface text-ink border border-stone-200 rounded-bl-md shadow-soft"
              }`}
            >
              {msg.isEmergency && (
                <p className="font-semibold text-danger-700 mb-1">⚠ Possible emergency</p>
              )}
              {msg.text}
            </div>
          </motion.div>
        ))}

        {loading && (
          <div className="flex justify-start">
            <div className="bg-surface border border-stone-200 rounded-2xl rounded-bl-md px-5 py-4 shadow-soft flex items-center gap-2">
              <div className="w-2 h-2 bg-stone-400 rounded-full animate-bounce"></div>
              <div className="w-2 h-2 bg-stone-400 rounded-full animate-bounce" style={{ animationDelay: "0.2s" }}></div>
              <div className="w-2 h-2 bg-stone-400 rounded-full animate-bounce" style={{ animationDelay: "0.4s" }}></div>
            </div>
          </div>
        )}
      </div>

      <div className="p-4 bg-surface border-t border-stone-100">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSend()}
            placeholder="Type your health question..."
            className="flex-1 border border-stone-200 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-primary-300 focus:border-transparent"
          />
          <Button onClick={handleSend} disabled={!input.trim()} loading={loading}>
            {loading ? "Sending" : "Send"}
          </Button>
        </div>
      </div>
    </Card>
  );
}
