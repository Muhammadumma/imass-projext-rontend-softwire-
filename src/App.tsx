import React from 'react';
import { ESP32Provider, useESP32 } from './context/ESP32Context';
import { Header } from './components/Header';
import { MetricsCards } from './components/MetricsCards';
import { HourlyUsageChart } from './components/HourlyUsageChart';
import { ErrorBreakdown } from './components/ErrorBreakdown';
import { RecentEventLogs } from './components/RecentEventLogs';
import { SystemControlPanel } from './components/SystemControlPanel';
import { HardwareSimulator } from './components/HardwareSimulator';
import { ApiConsole } from './components/ApiConsole';
import { SerialMonitor } from './components/SerialMonitor';
import { AlertingEngineView } from './components/AlertingEngineView';
import { RotateCcw } from 'lucide-react';

const DashboardContent: React.FC = () => {
  const { activeView, resetAllData } = useESP32();

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      <Header />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {activeView === 'dashboard' && (
          <>
            {/* 1. Top Metrics Cards Grid */}
            <MetricsCards />

            {/* 2. Hourly Usage Distribution (Today) */}
            <HourlyUsageChart />

            {/* 3. Fault Code Diagnostics & Breakdown */}
            <ErrorBreakdown />

            {/* 4. Two-Column Split: Event Logs & System Control Panel */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Recent Event Logs (7 Cols) */}
              <div className="lg:col-span-7">
                <RecentEventLogs />
              </div>

              {/* System Control Panel (5 Cols) */}
              <div className="lg:col-span-5">
                <SystemControlPanel />
              </div>
            </div>
          </>
        )}

        {activeView === 'hardware' && <HardwareSimulator />}
        {activeView === 'api' && <ApiConsole />}
        {activeView === 'serial' && <SerialMonitor />}
        {activeView === 'alerts' && <AlertingEngineView />}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-900 bg-slate-950/60 py-6 text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span>ESP32-WROOM-32D Dual Core @ 240MHz</span>
            <span aria-hidden="true">·</span>
            <span>FreeRTOS Engine</span>
            <span aria-hidden="true">·</span>
            <span>LittleFS Storage</span>
            <span aria-hidden="true">·</span>
            <span>SNTP pool.ntp.org</span>
          </div>

          <div className="flex items-center gap-4">
            <button
              onClick={resetAllData}
              className="flex items-center gap-1.5 text-slate-400 hover:text-slate-200 transition-colors"
              title="Reset to initial SRS sample data baseline"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset Factory Baseline</span>
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default function App() {
  return (
    <ESP32Provider>
      <DashboardContent />
    </ESP32Provider>
  );
}
