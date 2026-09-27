import React, { useState } from 'react';
import { useESP32 } from '../context/ESP32Context';
import {
  Wifi,
  WifiOff,
  Cpu,
  Droplets,
  Terminal,
  Activity,
  Code2,
  BellRing,
  Play,
  Power,
  RotateCw,
  Sliders,
  CheckCircle2,
  XCircle,
  FileCode,
} from 'lucide-react';

export const Header: React.FC = () => {
  const {
    telemetry,
    activeView,
    setActiveView,
    triggerDispenseApi,
    refillTank,
    alerts,
    deviceIp,
    setDeviceIp,
    connectionMode,
    setConnectionMode,
    isLiveConnected,
    connectionError,
    lastHeartbeat,
    systemPoweredOn,
    togglePowerApi,
    testConnection,
  } = useESP32();

  const [dispensing, setDispensing] = useState(false);
  const [powerToggling, setPowerToggling] = useState(false);
  const [testingConn, setTestingConn] = useState(false);
  const [ipInput, setIpInput] = useState(deviceIp);
  const [showConnSettings, setShowConnSettings] = useState(false);

  const activeAlertCount = alerts.filter(a => a.active).length;

  const handleQuickDispense = async () => {
    setDispensing(true);
    await triggerDispenseApi(true, 800);
    setTimeout(() => setDispensing(false), 850);
  };

  const handleTogglePower = async () => {
    setPowerToggling(true);
    await togglePowerApi(!systemPoweredOn);
    setPowerToggling(false);
  };

  const handleTestConnect = async () => {
    setTestingConn(true);
    setDeviceIp(ipInput);
    await testConnection();
    setTestingConn(false);
  };

  const isFailSafe = telemetry.system.health_status === 'CRITICAL';

  return (
    <header className="sticky top-0 z-50 bg-slate-950/95 backdrop-blur-md border-b border-slate-800/80">
      {/* Power Off State Banner */}
      {!systemPoweredOn && (
        <div className="bg-amber-950/90 border-b border-amber-800 text-amber-200 px-4 py-1.5 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
            <span className="font-semibold">SYSTEM POWERED OFF (SHUTDOWN):</span>
            <span>Sensor dispensing loop suspended by remote software command.</span>
          </div>
          <button
            onClick={handleTogglePower}
            disabled={powerToggling}
            className="text-xs bg-amber-800 hover:bg-amber-700 text-white px-2.5 py-0.5 rounded transition-colors font-medium flex items-center gap-1"
          >
            <Power className="w-3 h-3" />
            <span>Power ON System</span>
          </button>
        </div>
      )}

      {/* Critical Fail-Safe Banner */}
      {isFailSafe && systemPoweredOn && (
        <div className="bg-rose-950/90 border-b border-rose-800 text-rose-200 px-4 py-1.5 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="inline-block w-2 h-2 rounded-full bg-rose-500 animate-ping" />
            <span className="font-semibold">CRITICAL FAIL-SAFE ENGAGED:</span>
            <span>
              {telemetry.sanitizer.remaining_percent <= 5
                ? 'Fluid reservoir level critical (< 5%). Pump execution locked (E_DRYRUN). Alert sent to ndctem24012@jigpoly.edu.ng.'
                : 'Relay open-circuit fault detected (E_PUMPFAIL). Output disabled.'}
            </span>
          </div>
          <button
            onClick={() => refillTank(100)}
            className="text-xs bg-rose-800 hover:bg-rose-700 text-white px-2.5 py-0.5 rounded transition-colors"
          >
            Refill Reservoir (100%)
          </button>
        </div>
      )}

      {/* Main Top Bar */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 gap-4">
          
          {/* Zone 1: Wordmark / Brand */}
          <div className="flex items-center gap-3 shrink-0">
            <div className="w-9 h-9 rounded-lg bg-teal-500/10 border border-teal-500/30 flex items-center justify-center text-teal-400">
              <Droplets className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-base font-bold tracking-tight text-white">
                  Smart Hygiene Monitor
                </span>
                <span className="text-[11px] font-mono text-teal-400 bg-teal-950/60 border border-teal-800/60 px-1.5 py-0.5 rounded">
                  ESP32 GATEWAY
                </span>
              </div>
              <div className="flex items-center gap-2 text-xs text-slate-400">
                <button
                  onClick={() => setShowConnSettings(!showConnSettings)}
                  className="font-mono text-[11px] text-teal-400 hover:text-teal-300 underline underline-offset-2 flex items-center gap-1"
                  title="Click to configure Target ESP32 Device IP"
                >
                  <span>IP: {deviceIp}</span>
                  <Sliders className="w-3 h-3" />
                </button>
                <span aria-hidden="true">·</span>
                <span className="text-[11px] font-mono text-slate-400">
                  ndctem24012@jigpoly.edu.ng
                </span>
              </div>
            </div>
          </div>

          {/* Zone 2: Navigation Links (Clean Segmented Tabs) */}
          <nav className="hidden lg:flex items-center gap-1 bg-slate-900/80 p-1 rounded-lg border border-slate-800">
            <button
              onClick={() => setActiveView('dashboard')}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                activeView === 'dashboard'
                  ? 'bg-teal-500/20 text-teal-300 border border-teal-500/30'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Activity className="w-3.5 h-3.5" />
              Telemetry & Overview
            </button>

            <button
              onClick={() => setActiveView('hardware')}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                activeView === 'hardware'
                  ? 'bg-teal-500/20 text-teal-300 border border-teal-500/30'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Cpu className="w-3.5 h-3.5" />
              Hardware & C++ Code
            </button>

            <button
              onClick={() => setActiveView('api')}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                activeView === 'api'
                  ? 'bg-teal-500/20 text-teal-300 border border-teal-500/30'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Code2 className="w-3.5 h-3.5" />
              REST API Console
            </button>

            <button
              onClick={() => setActiveView('serial')}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                activeView === 'serial'
                  ? 'bg-teal-500/20 text-teal-300 border border-teal-500/30'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Terminal className="w-3.5 h-3.5" />
              Serial Monitor
            </button>

            <button
              onClick={() => setActiveView('alerts')}
              className={`relative flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                activeView === 'alerts'
                  ? 'bg-teal-500/20 text-teal-300 border border-teal-500/30'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <BellRing className="w-3.5 h-3.5" />
              Alert Rules
              {activeAlertCount > 0 && (
                <span className="w-2 h-2 rounded-full bg-amber-400 inline-block" />
              )}
            </button>
          </nav>

          {/* Zone 3: Live Hardware Controls & Power Switch */}
          <div className="flex items-center gap-2.5 shrink-0">
            {/* Master Hardware Power ON/OFF Toggle */}
            <button
              onClick={handleTogglePower}
              disabled={powerToggling}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all border whitespace-nowrap ${
                systemPoweredOn
                  ? 'bg-emerald-950/80 hover:bg-emerald-900/80 text-emerald-300 border-emerald-700/60 shadow-sm shadow-emerald-950'
                  : 'bg-rose-950/80 hover:bg-rose-900/80 text-rose-300 border-rose-700/60 shadow-sm shadow-rose-950'
              }`}
              title="Remote Master Power Switch (POST /api/v1/power-toggle)"
            >
              <Power className={`w-3.5 h-3.5 ${systemPoweredOn ? 'text-emerald-400' : 'text-rose-400'}`} />
              <span>{systemPoweredOn ? 'POWER: ON' : 'POWER: OFF'}</span>
            </button>

            {/* Live Connection Badge */}
            <div
              onClick={() => setShowConnSettings(!showConnSettings)}
              className="hidden sm:flex items-center gap-2 bg-slate-900 border border-slate-800 hover:border-slate-700 cursor-pointer px-3 py-1.5 rounded-lg text-xs transition-colors"
              title="Click to check connection settings"
            >
              {isLiveConnected ? (
                <>
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span className="text-slate-200 font-medium font-mono">LIVE CONNECTED</span>
                  <span className="text-[10px] text-slate-500 font-mono">({lastHeartbeat})</span>
                </>
              ) : (
                <>
                  <span className="w-2 h-2 rounded-full bg-amber-500" />
                  <span className="text-slate-400 font-medium font-mono">
                    {connectionMode === 'LIVE_DEVICE' ? 'SEARCHING ESP32' : 'BENCH SIM'}
                  </span>
                </>
              )}
            </div>

            {/* Test Dispense Button */}
            <button
              onClick={handleQuickDispense}
              disabled={dispensing || !systemPoweredOn || isFailSafe}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all whitespace-nowrap ${
                dispensing
                  ? 'bg-teal-600 text-white animate-pulse'
                  : !systemPoweredOn || isFailSafe
                  ? 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700'
                  : 'bg-teal-500 hover:bg-teal-400 text-slate-950 shadow-sm shadow-teal-500/20'
              }`}
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>{dispensing ? 'Dispensing...' : 'Trigger Pump'}</span>
            </button>
          </div>

        </div>

        {/* Expandable ESP32 Target IP & Connection Settings Panel */}
        {showConnSettings && (
          <div className="py-3 px-4 mb-3 bg-slate-900/95 border border-slate-800 rounded-xl text-xs flex flex-col md:flex-row md:items-center justify-between gap-4 animate-in fade-in slide-in-from-top-2">
            <div className="flex-1">
              <div className="flex items-center gap-2 text-white font-semibold mb-1">
                <span>ESP32 Physical Hardware Connection</span>
                <span className="text-[11px] text-teal-400 font-mono">
                  {isLiveConnected ? 'Connected (200 OK)' : 'Awaiting Device Ping'}
                </span>
              </div>
              <p className="text-slate-400 text-[11px]">
                Enter the local IP address or mDNS hostname of your flashed ESP32 to establish real-time REST synchronization.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <div className="relative">
                <input
                  type="text"
                  value={ipInput}
                  onChange={e => setIpInput(e.target.value)}
                  placeholder="e.g. 192.168.1.142"
                  className="bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-xs font-mono text-slate-200 w-44 focus:outline-none focus:border-teal-500"
                />
              </div>

              <button
                onClick={handleTestConnect}
                disabled={testingConn}
                className="px-3 py-1.5 bg-teal-500 hover:bg-teal-400 disabled:opacity-50 text-slate-950 font-semibold rounded-lg text-xs transition-colors flex items-center gap-1.5"
              >
                <RotateCw className={`w-3 h-3 ${testingConn ? 'animate-spin' : ''}`} />
                <span>{testingConn ? 'Connecting...' : 'Connect'}</span>
              </button>

              <button
                onClick={() => setConnectionMode(connectionMode === 'LIVE_DEVICE' ? 'BENCH_SIMULATION' : 'LIVE_DEVICE')}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs border border-slate-700 transition-colors"
              >
                Mode: {connectionMode === 'LIVE_DEVICE' ? 'Live Hardware' : 'Simulator'}
              </button>
            </div>
          </div>
        )}

        {/* Mobile View Tab Selector */}
        <div className="flex lg:hidden overflow-x-auto pb-2 gap-2 text-xs border-t border-slate-800 pt-2">
          <button
            onClick={() => setActiveView('dashboard')}
            className={`px-3 py-1 rounded whitespace-nowrap ${activeView === 'dashboard' ? 'bg-teal-500/20 text-teal-300' : 'text-slate-400'}`}
          >
            Telemetry
          </button>
          <button
            onClick={() => setActiveView('hardware')}
            className={`px-3 py-1 rounded whitespace-nowrap ${activeView === 'hardware' ? 'bg-teal-500/20 text-teal-300' : 'text-slate-400'}`}
          >
            Hardware & C++ Code
          </button>
          <button
            onClick={() => setActiveView('api')}
            className={`px-3 py-1 rounded whitespace-nowrap ${activeView === 'api' ? 'bg-teal-500/20 text-teal-300' : 'text-slate-400'}`}
          >
            REST API
          </button>
          <button
            onClick={() => setActiveView('serial')}
            className={`px-3 py-1 rounded whitespace-nowrap ${activeView === 'serial' ? 'bg-teal-500/20 text-teal-300' : 'text-slate-400'}`}
          >
            Serial
          </button>
          <button
            onClick={() => setActiveView('alerts')}
            className={`px-3 py-1 rounded whitespace-nowrap ${activeView === 'alerts' ? 'bg-teal-500/20 text-teal-300' : 'text-slate-400'}`}
          >
            Alerts ({activeAlertCount})
          </button>
        </div>
      </div>
    </header>
  );
};
