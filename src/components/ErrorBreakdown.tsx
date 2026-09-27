import React from 'react';
import { useESP32 } from '../context/ESP32Context';
import { ShieldAlert, AlertTriangle, Clock, ZapOff, CheckCircle } from 'lucide-react';

export const ErrorBreakdown: React.FC = () => {
  const { stats } = useESP32();
  const errors = stats.error_breakdown;
  const totalErrors = stats.summary.unsuccessful_dispenses;

  const errorCards = [
    {
      code: 'E_OBSTRUCT',
      label: 'Sensor Blocked > 5s',
      count: errors.E_OBSTRUCT,
      icon: ShieldAlert,
      color: 'text-amber-400',
      borderColor: 'border-amber-500/30',
      bgColor: 'bg-amber-500/5',
      description: 'Continuous obstruction on HC-SR04 ultrasonic echo line for > 5000ms. Fail-safe lockout engaged.',
      action: 'Automatic lockout until beam is cleared.',
    },
    {
      code: 'E_DRYRUN',
      label: 'Tank Level < 5%',
      count: errors.E_DRYRUN,
      icon: AlertTriangle,
      color: 'text-rose-400',
      borderColor: 'border-rose-500/30',
      bgColor: 'bg-rose-500/5',
      description: 'Dispense commanded while reservoir level is depleted (< 5%). Pump hardware locked to prevent burn-in.',
      action: 'Relay output locked; refill required.',
    },
    {
      code: 'E_TIMEOUT',
      label: 'Hand Pulled Early (<200ms)',
      count: errors.E_TIMEOUT,
      icon: Clock,
      color: 'text-sky-400',
      borderColor: 'border-sky-500/30',
      bgColor: 'bg-sky-500/5',
      description: 'Hand departed sensor detection window (3-10 cm) before minimum debouncing threshold was fulfilled.',
      action: 'Cycle aborted without dispensing sanitizer.',
    },
    {
      code: 'E_PUMPFAIL',
      label: 'Relay Circuit Fault',
      count: errors.E_PUMPFAIL,
      icon: ZapOff,
      color: 'text-purple-400',
      borderColor: 'border-purple-500/30',
      bgColor: 'bg-purple-500/5',
      description: 'GPIO 19 relay open detection failure, voltage drop, or motor drive feedback wire open circuit.',
      action: 'Emergency circuit trip; log to LittleFS.',
    },
  ];

  return (
    <div className="bg-slate-900/90 rounded-xl border border-slate-800 p-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-white tracking-tight">
              Fault Code Diagnostics & Breakdown
            </h3>
            <span className="text-xs text-slate-400 font-mono">
              SRS Section 2.3
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            Real-time classification of unsuccessful sensor triggers and fail-safe triggers
          </p>
        </div>

        <div className="text-xs text-slate-300 font-mono">
          Total Fault Events: <strong className="text-white">{totalErrors}</strong>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
        {errorCards.map(item => {
          const Icon = item.icon;
          const pct = totalErrors > 0 ? ((item.count / totalErrors) * 100).toFixed(0) : '0';

          return (
            <div
              key={item.code}
              className={`rounded-lg border p-3.5 flex flex-col justify-between ${item.bgColor} ${item.borderColor}`}
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Icon className={`w-4 h-4 ${item.color}`} />
                    <span className="font-mono text-xs font-bold text-white">
                      {item.code}
                    </span>
                  </div>
                  <span className={`text-base font-bold font-mono ${item.color} tabular-nums`}>
                    {item.count}
                  </span>
                </div>

                <div className="text-xs font-medium text-slate-200 mb-1">
                  {item.label}
                </div>

                <p className="text-[11px] text-slate-400 leading-relaxed">
                  {item.description}
                </p>
              </div>

              <div className="mt-3 pt-2 border-t border-slate-800/80 flex items-center justify-between text-[11px]">
                <span className="text-slate-500 font-mono">Share: {pct}%</span>
                <span className="text-slate-400 truncate max-w-[130px]">{item.action}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
