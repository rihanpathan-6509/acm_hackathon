import React from "react";
import ReminderList from "../components/ReminderList";
import TrendChart from "../components/TrendChart";

export default function Dashboard() {
  return (
    <div className="space-y-6">
      <header className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 tracking-tight">
          Patient Overview
        </h1>
        <p className="mt-2 text-sm text-gray-500">
          Track your latest health metrics and manage active prescriptions.
        </p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="p-1">
            <TrendChart />
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="p-1">
            <ReminderList />
          </div>
        </div>
      </div>
    </div>
  );
}
