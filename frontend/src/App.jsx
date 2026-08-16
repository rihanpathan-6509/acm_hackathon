import {
  BrowserRouter as Router,
  Routes,
  Route,
  Link,
  useLocation,
} from "react-router-dom";
import { motion } from "framer-motion";
import Dashboard from "./pages/Dashboard";
import PatientsPage from "./pages/PatientsPage";
import Upload from "./components/Upload";
import ChatBox from "./components/ChatBox";
import ReminderAlert from "./components/ReminderAlert";

function NavLink({ to, children }) {
  const location = useLocation();
  const isActive = location.pathname === to;
  return (
    <Link
      to={to}
      className={`relative px-4 py-2 rounded-full text-sm font-medium transition-colors ${
        isActive
          ? "text-ink"
          : "text-ink-soft hover:text-ink hover:bg-stone-100"
      }`}
    >
      {isActive && (
        <motion.span
          layoutId="nav-pill"
          className="absolute inset-0 bg-primary-100 rounded-full -z-10"
          transition={{ type: "spring", stiffness: 400, damping: 32 }}
        />
      )}
      {children}
    </Link>
  );
}

// Enter-only transition: the incoming page fades/slides in immediately on
// its own key, with no dependency on an outgoing exit animation completing
// first. Deliberately not using AnimatePresence's mode="wait" crossfade here
// — that gates mounting the new route's content on an animation-frame-driven
// exit finishing, which can stall the page swap (e.g. a backgrounded tab
// pauses rAF) even though the URL has already changed. This trades a barely
// perceptible bit of crossfade polish for a page swap that's never stuck
// behind an animation.
function AnimatedRoutes() {
  const location = useLocation();
  return (
    <motion.div
      key={location.pathname}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22, ease: "easeOut" }}
    >
      <Routes location={location}>
        <Route path="/" element={<Dashboard />} />
        <Route path="/upload" element={<Upload />} />
        <Route path="/chat" element={<ChatBox />} />
        <Route path="/patients" element={<PatientsPage />} />
      </Routes>
    </motion.div>
  );
}

export default function App() {
  return (
    <Router>
      <div className="min-h-screen bg-bg font-sans text-ink">
        <nav className="bg-surface/80 backdrop-blur-md border-b border-border sticky top-0 z-50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between h-16 items-center gap-4">
              <Link to="/" className="flex items-center gap-2.5 shrink-0">
                <div className="w-8 h-8 bg-ink rounded-xl flex items-center justify-center">
                  <span className="text-primary-400 font-bold text-lg leading-none">◆</span>
                </div>
                <span className="text-lg font-bold text-ink tracking-tight">
                  Chronic<span className="text-primary-600">AI</span>
                </span>
              </Link>
              <div className="flex gap-0.5 sm:gap-1 rounded-full bg-bg/60 border border-border/60 p-1 overflow-x-auto">
                <NavLink to="/">Dashboard</NavLink>
                <NavLink to="/upload">Upload</NavLink>
                <NavLink to="/chat">Assistant</NavLink>
                <NavLink to="/patients">Patients</NavLink>
              </div>
              <Link
                to="/chat"
                className="hidden sm:inline-flex shrink-0 items-center gap-1.5 rounded-full bg-ink text-white text-sm font-medium px-5 py-2 transition-colors hover:bg-ink/90"
              >
                Ask AI
                <span className="text-primary-400 leading-none">→</span>
              </Link>
            </div>
          </div>
        </nav>

        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
          <AnimatedRoutes />
        </main>

        {/* Mounted at the app root, not inside Dashboard, so a reminder
            pops up no matter which page the patient is currently on. */}
        <ReminderAlert />
      </div>
    </Router>
  );
}
