import { useEffect, useState } from "react";
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

export default function TrendChart() {
  const [chartData, setChartData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getOrCreatePatientId()
      .then((patientId) => getLabs(patientId, "hba1c"))
      .then((res) => setChartData(res.labMarkers || []))
      .catch(() => setChartData([]))
      .finally(() => setLoading(false));
  }, []);

  // Mongo serializes `date` as a full ISO timestamp
  // ("2026-08-01T00:00:00.000Z"), unlike the plain "2026-08-01" the old
  // mock returned — without this the axis renders unreadable raw strings.
  const formatDate = (value) => {
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return value;
    return d.toLocaleDateString(undefined, { month: "short", year: "numeric" });
  };

  const renderCustomDot = (props) => {
    const { cx, cy, payload } = props;
    if (payload.isAbnormal || payload.needsReview) {
      return (
        <circle
          cx={cx}
          cy={cy}
          r={6}
          fill="#ef4444"
          stroke="white"
          strokeWidth={2}
        />
      );
    }
    return <circle cx={cx} cy={cy} r={4} fill="#3b82f6" />;
  };

  return (
    <div className="p-6">
      <h2 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
        <svg
          className="w-5 h-5 text-blue-500"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z"
          ></path>
        </svg>
        Health Trends (HbA1c)
      </h2>

      {loading && (
        <p className="text-sm text-gray-500 mb-4">Loading...</p>
      )}

      {!loading && chartData.length === 0 && (
        <p className="text-sm text-gray-500 mb-4">
          No HbA1c readings yet — upload a lab report to see a trend here.
        </p>
      )}

      <div className="w-full h-[300px]">
        <ResponsiveContainer>
          <LineChart
            data={chartData}
            margin={{ top: 10, right: 10, bottom: 0, left: -20 }}
          >
            <CartesianGrid
              strokeDasharray="3 3"
              vertical={false}
              stroke="#e5e7eb"
            />
            <XAxis
              dataKey="date"
              tickFormatter={formatDate}
              axisLine={false}
              tickLine={false}
              tick={{ fill: "#6b7280", fontSize: 12 }}
              dy={10}
            />
            <YAxis
              axisLine={false}
              tickLine={false}
              tick={{ fill: "#6b7280", fontSize: 12 }}
            />
            <Tooltip
              contentStyle={{
                borderRadius: "8px",
                border: "none",
                boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1)",
              }}
              labelFormatter={formatDate}
              formatter={(value, name, props) => [
                `${value} ${props.payload.displayUnit}`,
                "Value",
              ]}
            />
            <Line
              type="monotone"
              dataKey="displayValue"
              stroke="#3b82f6"
              strokeWidth={3}
              dot={renderCustomDot}
              activeDot={{ r: 8, strokeWidth: 0 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
