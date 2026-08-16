import { useEffect, useState, useMemo } from "react";
import { getLabs, getOrCreatePatientId } from "../services/api";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { SkeletonChart } from "./ui/Skeleton";
import EmptyState from "./ui/EmptyState";

function formatDate(value) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString(undefined, { month: "short", year: "numeric" });
}

function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  const point = payload[0].payload;
  return (
    <div className="rounded-xl bg-ink text-white text-xs px-3 py-2 shadow-lifted">
      <p className="text-white/60 mb-0.5">{formatDate(label)}</p>
      <p className="font-semibold">
        {point.canonicalName || "Value"}: {point.displayValue} {point.displayUnit}
      </p>
      {(point.isAbnormal || point.needsReview) && (
        <p className="text-danger-300 mt-0.5">Flagged on report</p>
      )}
    </div>
  );
}

export default function TrendChart() {
  const [labMarkers, setLabMarkers] = useState([]);
  const [selectedMarker, setSelectedMarker] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Fetch every marker, not just HbA1c — this used to hardcode
    // markerKey: "hba1c", so uploading a report containing anything else
    // (creatinine, hemoglobin, ...) saved fine but showed nothing here.
    getOrCreatePatientId()
      .then((patientId) => getLabs(patientId))
      .then((res) => setLabMarkers(res.labMarkers || []))
      .catch(() => setLabMarkers([]))
      .finally(() => setLoading(false));
  }, []);

  // Group readings by marker so each one gets its own trend line.
  const byMarker = useMemo(() => {
    const groups = {};
    for (const reading of labMarkers) {
      if (!groups[reading.markerKey]) groups[reading.markerKey] = [];
      groups[reading.markerKey].push(reading);
    }
    for (const key of Object.keys(groups)) {
      groups[key].sort((a, b) => new Date(a.date) - new Date(b.date));
    }
    return groups;
  }, [labMarkers]);

  const markerKeys = Object.keys(byMarker);

  // Default to the first marker that actually has data, but don't fight the
  // user's choice once they've picked one.
  const activeMarker =
    selectedMarker && byMarker[selectedMarker] ? selectedMarker : markerKeys[0];
  const chartData = activeMarker ? byMarker[activeMarker] : [];
  const markerLabel = chartData[0]?.canonicalName || activeMarker || "";

  const renderCustomDot = (props) => {
    const { cx, cy, payload } = props;
    if (payload.isAbnormal || payload.needsReview) {
      return (
        <circle cx={cx} cy={cy} r={6} fill="var(--color-danger-500)" stroke="white" strokeWidth={2} />
      );
    }
    return <circle cx={cx} cy={cy} r={4} fill="var(--color-primary-500)" />;
  };

  if (loading) return <SkeletonChart />;

  return (
    <div className="p-6">
      <div className="flex items-center justify-between gap-4 mb-4 flex-wrap">
        <h2 className="text-lg font-semibold text-ink flex items-center gap-2">
          <svg className="w-5 h-5 text-primary-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z"
            ></path>
          </svg>
          Health Trends{markerLabel ? ` (${markerLabel})` : ""}
        </h2>

        {markerKeys.length > 1 && (
          <select
            value={activeMarker}
            onChange={(e) => setSelectedMarker(e.target.value)}
            className="text-sm border border-stone-200 rounded-lg px-2.5 py-1.5 bg-surface focus:outline-none focus:ring-2 focus:ring-primary-300"
          >
            {markerKeys.map((key) => (
              <option key={key} value={key}>
                {byMarker[key][0]?.canonicalName || key}
              </option>
            ))}
          </select>
        )}
      </div>

      {chartData.length === 0 && (
        <EmptyState
          icon={
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5"
                d="M7 12l3-3 3 3 4-4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
            </svg>
          }
          title="No lab readings yet"
          description="Upload a lab report to see a trend here."
        />
      )}

      {chartData.length === 1 && (
        <p className="text-sm text-ink-soft mb-4">
          Only one reading so far — upload another report to see a trend line.
        </p>
      )}

      {chartData.length > 0 && (
        <div className="w-full h-[300px]">
          <ResponsiveContainer>
            <LineChart data={chartData} margin={{ top: 10, right: 10, bottom: 0, left: -20 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e7e4e1" />
              <XAxis
                dataKey="date"
                tickFormatter={formatDate}
                axisLine={false}
                tickLine={false}
                tick={{ fill: "#78716c", fontSize: 12 }}
                dy={10}
              />
              <YAxis axisLine={false} tickLine={false} tick={{ fill: "#78716c", fontSize: 12 }} />
              <Tooltip content={<ChartTooltip />} />
              <Line
                type="monotone"
                dataKey="displayValue"
                stroke="var(--color-primary-500)"
                strokeWidth={3}
                dot={renderCustomDot}
                activeDot={{ r: 8, strokeWidth: 0, fill: "var(--color-primary-600)" }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
