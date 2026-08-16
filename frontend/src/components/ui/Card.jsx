import { motion } from "framer-motion";

export default function Card({ children, className = "", hover = false, as: Comp, ...rest }) {
  const base = `bg-surface rounded-3xl border border-border shadow-card ${className}`;

  if (Comp) {
    return (
      <Comp className={base} {...rest}>
        {children}
      </Comp>
    );
  }

  if (!hover) {
    return (
      <div className={base} {...rest}>
        {children}
      </div>
    );
  }

  return (
    <motion.div
      whileHover={{ y: -3 }}
      transition={{ type: "spring", stiffness: 300, damping: 24 }}
      className={`${base} transition-shadow duration-200 hover:shadow-lifted`}
      {...rest}
    >
      {children}
    </motion.div>
  );
}
