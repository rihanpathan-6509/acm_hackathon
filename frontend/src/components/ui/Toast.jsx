import { useCallback, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ToastContext } from "./ToastContext";

const TONE_STYLES = {
  error: "border-danger-200 bg-danger-50 text-danger-800",
  success: "border-success-200 bg-success-50 text-success-800",
  info: "border-primary-200 bg-primary-50 text-primary-800",
};

let idCounter = 0;

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const dismiss = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const notify = useCallback(
    (message, tone = "error") => {
      const id = ++idCounter;
      setToasts((prev) => [...prev, { id, message, tone }]);
      setTimeout(() => dismiss(id), 5000);
    },
    [dismiss]
  );

  return (
    <ToastContext.Provider value={notify}>
      {children}
      <div className="fixed top-4 right-4 z-[200] flex flex-col items-end gap-2 pointer-events-none">
        <AnimatePresence>
          {toasts.map((t) => (
            <motion.div
              key={t.id}
              layout
              initial={{ opacity: 0, y: -12, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, x: 40, scale: 0.95 }}
              transition={{ type: "spring", stiffness: 400, damping: 30 }}
              className={`pointer-events-auto max-w-sm w-[min(24rem,calc(100vw-2rem))] rounded-xl border px-4 py-3 text-sm shadow-lifted flex items-start justify-between gap-3 ${TONE_STYLES[t.tone] || TONE_STYLES.info}`}
            >
              <span>{t.message}</span>
              <button
                onClick={() => dismiss(t.id)}
                className="opacity-60 hover:opacity-100 transition-opacity leading-none text-base"
                aria-label="Dismiss"
              >
                ×
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}
