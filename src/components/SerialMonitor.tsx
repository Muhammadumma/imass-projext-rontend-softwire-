import React, { useState } from 'react';
import { useESP32 } from '../context/ESP32Context';
import {
  Terminal,
  Trash2,
  Pause,
  Play,
  Filter,
  CheckCircle2,
  AlertTriangle,
  AlertOctagon,
  Info,
} from 'lucide-react';

export const SerialMonitor: React.FC = () => {
  const { serialLogs, addSerialLog } = useESP32();
  const [levelFilter, setLevelFilter] = useState<string>('ALL');
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const [customMsg, setCustomMsg] = useState<string>('');

  const filteredLogs = serialLogs.filter(log => {
    if (levelFilter === 'ALL') return true;
    return log.level === levelFilter;
  });

  const handleSendCustomLog = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customMsg.trim()) return;
    addSerialLog('INFO', 'USER_CLI', customMsg.trim());
    setCustomMsg('');
  };

  const getLevelStyle = (level: string) => {
    switch (level) {
      case 'ERROR':
        return 'text-rose-400 font-bold';
      case 'WARN':
        return 'text-amber-400 font-semibold';
      case 'DEBUG':
        return 'text-sky-400';
      case 'INFO':
      default:
        return 'text-emerald-400';
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="bg-slate-900/90 rounded-xl border border-slate-800 p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <Terminal className="w-5 h-5 text-teal-400" />
              <h2 className="text-base font-bold text-white tracking-tight">
                ESP32 FreeRTOS Serial Monitor
              </h2>
              <span className="text-xs font-mono text-teal-400 bg-teal-950/60 border border-teal-800/60 px-2 py-0.5 rounded">
                115200 Baud · UART0
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Live kernel output, NTP time locks, GPIO pin interrupts, NVS commits, and HTTP daemon access logs
            </p>
          </div>

          {/* Level Filter Tabs */}
          <div className="flex items-center gap-1 p-1 bg-slate-950 rounded-lg border border-slate-800 text-xs">
            {['ALL', 'INFO', 'WARN', 'ERROR', 'DEBUG'].map(lvl => (
              <button
                key={lvl}
                onClick={() => setLevelFilter(lvl)}
                className={`px-2.5 py-1 rounded font-mono font-medium transition-colors ${
                  levelFilter === lvl
                    ? 'bg-teal-500/20 text-teal-300 border border-teal-500/30'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {lvl}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Terminal Display */}
      <div className="bg-slate-950 rounded-xl border border-slate-800 shadow-2xl overflow-hidden flex flex-col font-mono text-xs">
        {/* Terminal Title Bar */}
        <div className="bg-slate-900 px-4 py-2.5 border-b border-slate-800 flex items-center justify-between text-slate-400">
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-rose-500/80 inline-block" />
            <span className="w-3 h-3 rounded-full bg-amber-500/80 inline-block" />
            <span className="w-3 h-3 rounded-full bg-emerald-500/80 inline-block" />
            <span className="text-[11px] text-slate-300 ml-2">/dev/ttyUSB0 (ESP32-WROOM-32D)</span>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsPaused(!isPaused)}
              className="flex items-center gap-1 text-[11px] text-slate-400 hover:text-white transition-colors"
            >
              {isPaused ? <Play className="w-3 h-3 text-emerald-400" /> : <Pause className="w-3 h-3" />}
              <span>{isPaused ? 'Resume' : 'Pause'}</span>
            </button>
          </div>
        </div>

        {/* Terminal Body */}
        <div className="p-4 h-[440px] overflow-y-auto space-y-1.5 divide-y divide-slate-900/60 select-text">
          {filteredLogs.map(log => (
            <div key={log.id} className="pt-1 flex items-start gap-2 leading-relaxed">
              <span className="text-slate-600 shrink-0">[{log.timestamp}]</span>
              <span className={`shrink-0 w-14 ${getLevelStyle(log.level)}`}>
                [{log.level}]
              </span>
              <span className="text-teal-400/90 shrink-0 font-semibold">
                [{log.tag}]:
              </span>
              <span className="text-slate-200 break-all">{log.message}</span>
            </div>
          ))}

          {filteredLogs.length === 0 && (
            <div className="text-slate-600 py-12 text-center">
              No serial logs found for filter [{levelFilter}].
            </div>
          )}
        </div>

        {/* Terminal Command Input Form */}
        <form onSubmit={handleSendCustomLog} className="p-3 bg-slate-900 border-t border-slate-800 flex items-center gap-2">
          <span className="text-teal-400 font-bold">&gt;</span>
          <input
            type="text"
            placeholder="Send command or test log to UART0 (e.g. 'gpio read 19', 'nvs get config')..."
            value={customMsg}
            onChange={e => setCustomMsg(e.target.value)}
            className="flex-1 bg-slate-950 border border-slate-800 rounded px-3 py-1.5 text-xs text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-teal-500 font-mono"
          />
          <button
            type="submit"
            className="px-4 py-1.5 bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold rounded text-xs transition-colors"
          >
            Send
          </button>
        </form>
      </div>
    </div>
  );
};
