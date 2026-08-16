import { motion } from "framer-motion";
import Spinner from "./Spinner";

const VARIANTS = {
  // Chronicle's signature: a confident near-black pill for the main action.
  primary:
    "bg-ink text-white shadow-soft hover:bg-ink/90 disabled:bg-ink/30",
  // Teal-tinted quiet action, pairs with the ink primary.
  secondary:
    "bg-primary-50 text-primary-700 hover:bg-primary-100 disabled:text-primary-300 disabled:bg-primary-50",
  // Outlined pill — Chronicle's second-tier CTA on light backgrounds.
  outline:
    "bg-surface text-ink border border-border hover:border-ink/30 hover:bg-bg disabled:text-ink-soft/40",
  ghost:
    "bg-transparent text-ink-soft hover:bg-stone-100 hover:text-ink disabled:text-stone-300",
  destructive:
    "bg-danger-600 text-white shadow-soft hover:bg-danger-700 disabled:bg-danger-300",
  // Warm terracotta — celebratory/confirming actions (mark as taken, confirm
  // & save), distinct from primary's everyday actions.
  accent:
    "bg-accent-600 text-white shadow-soft hover:bg-accent-700 disabled:bg-accent-300",
};

const SIZES = {
  sm: "text-sm px-3.5 py-1.5 gap-1.5",
  md: "text-sm px-5 py-2.5 gap-2",
  lg: "text-base px-7 py-3 gap-2",
};

export default function Button({
  variant = "primary",
  size = "md",
  loading = false,
  disabled = false,
  children,
  className = "",
  ...rest
}) {
  const isDisabled = disabled || loading;
  return (
    <motion.button
      whileTap={isDisabled ? undefined : { scale: 0.97 }}
      transition={{ type: "spring", stiffness: 500, damping: 30 }}
      disabled={isDisabled}
      className={`inline-flex items-center justify-center rounded-full font-medium transition-colors duration-150 disabled:cursor-not-allowed ${VARIANTS[variant]} ${SIZES[size]} ${className}`}
      {...rest}
    >
      {loading && <Spinner className="w-4 h-4" />}
      {children}
    </motion.button>
  );
}
