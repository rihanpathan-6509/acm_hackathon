import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import ReminderList from "../components/ReminderList";
import TrendChart from "../components/TrendChart";
import Card from "../components/ui/Card";

const container = {
  hidden: {},
  show: { transition: { staggerChildren: 0.08 } },
};

const item = {
  hidden: { opacity: 0, y: 14 },
  show: { opacity: 1, y: 0, transition: { duration: 0.3, ease: "easeOut" } },
};

export default function Dashboard() {
  return (
    <div className="space-y-10">
      <header className="pt-4 pb-2">
        <div className="inline-flex items-center gap-2 rounded-full border border-border bg-surface px-3.5 py-1.5 text-xs font-medium text-ink-soft">
          <span className="w-1.5 h-1.5 rounded-full bg-primary-500" />
          Your health, continuously understood
        </div>
        <h1 className="display-title mt-6 text-5xl sm:text-6xl text-ink max-w-3xl">
          Clarity on your health,{" "}
          <span className="text-primary-600">at the speed of AI.</span>
        </h1>
        <p className="mt-5 text-lg text-ink-soft max-w-xl leading-relaxed">
          Track your latest metrics, stay ahead of prescriptions, and ask
          questions about your reports in plain language.
        </p>
        <div className="mt-7 flex flex-wrap gap-3">
          <Link
            to="/upload"
            className="inline-flex items-center gap-2 rounded-full bg-ink text-white text-sm font-medium px-6 py-3 transition-colors hover:bg-ink/90"
          >
            Upload a report
            <span className="text-primary-400 leading-none">→</span>
          </Link>
          <Link
            to="/chat"
            className="inline-flex items-center gap-2 rounded-full bg-surface text-ink text-sm font-medium px-6 py-3 border border-border transition-colors hover:border-ink/30"
          >
            Ask the assistant
          </Link>
        </div>
      </header>

      <motion.div
        variants={container}
        initial="hidden"
        animate="show"
        className="grid grid-cols-1 lg:grid-cols-3 gap-6"
      >
        <motion.div variants={item} className="lg:col-span-2">
          <Card className="overflow-hidden">
            <TrendChart />
          </Card>
        </motion.div>

        <motion.div variants={item}>
          <Card className="overflow-hidden">
            <ReminderList />
          </Card>
        </motion.div>
      </motion.div>
    </div>
  );
}
