import { useContext } from "react";
import { ToastContext } from "./ToastContext";

// Returns notify(message, tone), tone one of "error" | "success" | "info".
export function useToast() {
  const notify = useContext(ToastContext);
  if (!notify) throw new Error("useToast must be used within ToastProvider");
  return notify;
}
