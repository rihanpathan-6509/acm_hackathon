import {
  BrowserRouter as Router,
  Routes,
  Route,
  Link,
  useLocation,
} from "react-router-dom";
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
      className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
        isActive
          ? "bg-blue-100 text-blue-700"
          : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
      }`}
    >
      {children}
    </Link>
  );
}

export default function App() {
  return (
    <Router>
      <div className="min-h-screen bg-gray-50 font-sans text-gray-900">
        <nav className="bg-white shadow-sm border-b border-gray-200 sticky top-0 z-50">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between h-16 items-center">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
                  <span className="text-white font-bold text-xl">+</span>
                </div>
                <span className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-indigo-600">
                  HealthDash
                </span>
              </div>
              <div className="flex space-x-2">
                <NavLink to="/">Dashboard</NavLink>
                <NavLink to="/upload">Upload</NavLink>
                <NavLink to="/chat">Assistant</NavLink>
                <NavLink to="/patients">Patients</NavLink>
              </div>
            </div>
          </div>
        </nav>

        <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/upload" element={<Upload />} />
            <Route path="/chat" element={<ChatBox />} />
            <Route path="/patients" element={<PatientsPage />} />
          </Routes>
        </main>

        {/* Mounted at the app root, not inside Dashboard, so a reminder
            pops up no matter which page the patient is currently on. */}
        <ReminderAlert />
      </div>
    </Router>
  );
}
