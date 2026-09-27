import React from 'react';
import { useESP32 } from '../context/ESP32Context';
import {
  BellRing,
  AlertTriangle,
  AlertOctagon,
  ShieldAlert,
  Info,
  WifiOff,
  CheckCircle2,
  Mail,
  Send,
  Sliders,
} from 'lucide-react';

export const AlertingEngineView: React.FC = () => {
  const { alerts, config, telemetry, refillTank, drainTank, toggleWifi, simulateHandTrigger } = useESP32();

  const getPriorityStyle = (priority: string) => {
    switch (priority) {
      case 'CRITICAL':
        return 'bg-rose-500/10 text-rose-400 border-rose-500/30';
      case 'ERROR':
        return 'bg-red-500/10 text-red-400 border-red-500/30';
      case 'WARNING':
        return 'bg-amber-500/10 text-amber-400 border-amber-500/30';
      case 'NOTICE':
      default:
        return 'bg-sky-500/10 text-sky-400 border-sky-500/30';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-slate-900/90 rounded-xl border border-slate-800 p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <BellRing className="w-5 h-5 text-teal-400" />
              <h2 className="text-base font-bold text-white tracking-tight">
                Alerting Engine Rules & Decision Matrix
              </h2>
              <span className="text-xs font-mono text-teal-400 bg-teal-950/60 border border-teal-800/60 px-2 py-0.5 rounded">
                SRS Section 5
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Multi-channel alerting policies dispatching SMTP alerts to <strong className="text-teal-300 font-mono">ndctem24012@jigpoly.edu.ng</strong> upon critical reservoir depletion or faults.
            </p>
          </div>

          <div className="flex items-center gap-2 text-xs font-mono text-slate-400">
            <span>Alert Email: ndctem24012@jigpoly.edu.ng</span>
          </div>
        </div>
      </div>

      {/* Decision Matrix Table */}
      <div className="bg-slate-900/90 rounded-xl border border-slate-800 overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950 text-slate-400 font-mono border-b border-slate-800">
              <tr>
                <th className="py-3 px-4 font-semibold">Condition / Trigger</th>
                <th className="py-3 px-4 font-semibold">Priority Level</th>
                <th className="py-3 px-4 font-semibold">Action Taken</th>
                <th className="py-3 px-4 font-semibold">Notification Channel</th>
                <th className="py-3 px-4 font-semibold">Current State</th>
                <th className="py-3 px-4 font-semibold text-right">Simulation Trigger</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80 text-slate-300">
              {alerts.map(rule => {
                const isActive = rule.active;

                return (
                  <tr
                    key={rule.id}
                    className={`hover:bg-slate-800/30 transition-colors ${
                      isActive ? 'bg-slate-800/50' : ''
                    }`}
                  >
                    {/* Condition */}
                    <td className="py-3.5 px-4 font-medium text-white">
                      <div className="font-semibold text-slate-200">
                        {rule.condition}
                      </div>
                      <div className="text-[11px] font-mono text-slate-400 mt-0.5">
                        {rule.details}
                      </div>
                    </td>

                    {/* Priority Level */}
                    <td className="py-3.5 px-4">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold font-mono border ${getPriorityStyle(rule.priority)}`}>
                        {rule.priority}
                      </span>
                    </td>

                    {/* Action Taken */}
                    <td className="py-3.5 px-4 text-slate-300 max-w-xs leading-relaxed">
                      {rule.action_taken}
                    </td>

                    {/* Notification Channel */}
                    <td className="py-3.5 px-4 font-mono text-slate-400">
                      {rule.channel}
                    </td>

                    {/* Current State */}
                    <td className="py-3.5 px-4">
                      {isActive ? (
                        <div className="flex items-center gap-1.5 text-rose-400 font-medium">
                          <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping inline-block" />
                          <span>ACTIVE ALERT</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5 text-emerald-400">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Nominal</span>
                        </div>
                      )}
                    </td>

                    {/* Quick Trigger Button */}
                    <td className="py-3.5 px-4 text-right">
                      {rule.condition === 'Tank Level <= 15%' && (
                        <button
                          onClick={() => drainTank(14.0)}
                          className="px-2.5 py-1 text-xs rounded bg-slate-800 hover:bg-slate-700 text-amber-300 border border-slate-700 transition-colors"
                        >
                          Simulate 14%
                        </button>
                      )}
                      {rule.condition === 'Tank Level <= 5%' && (
                        <button
                          onClick={() => drainTank(4.0)}
                          className="px-2.5 py-1 text-xs rounded bg-slate-800 hover:bg-slate-700 text-rose-300 border border-slate-700 transition-colors"
                        >
                          Simulate 4% (Lock)
                        </button>
                      )}
                      {rule.condition === 'Sensor Blocked > 5s' && (
                        <button
                          onClick={() => simulateHandTrigger(2.0, 5500)}
                          className="px-2.5 py-1 text-xs rounded bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-colors"
                        >
                          Trigger Block
                        </button>
                      )}
                      {rule.condition === 'Daily Limit Reached' && (
                        <button
                          onClick={() => {
                            telemetry.sanitizer.volume_dispensed_today_ml = 1520;
                          }}
                          className="px-2.5 py-1 text-xs rounded bg-slate-800 hover:bg-slate-700 text-sky-300 border border-slate-700 transition-colors"
                        >
                          Cap Test
                        </button>
                      )}
                      {rule.condition === 'Wi-Fi Disconnected' && (
                        <button
                          onClick={toggleWifi}
                          className="px-2.5 py-1 text-xs rounded bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-colors"
                        >
                          Toggle Link
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Notification Dispatch Simulation Channels */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Email Dispatch Hook */}
        <div className="bg-slate-900/90 rounded-xl border border-slate-800 p-5">
          <div className="flex items-center gap-2 mb-3">
            <Mail className="w-4 h-4 text-teal-400" />
            <h3 className="text-sm font-semibold text-white">
              Automated SMTP Email Dispatch (ESP_Mail_Client)
            </h3>
          </div>
          <p className="text-xs text-slate-400 mb-3">
            Directly transmitted from ESP32 to <strong className="text-teal-300 font-mono">ndctem24012@jigpoly.edu.ng</strong> when critical events trigger:
          </p>
          <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 font-mono text-xs text-slate-300 space-y-1">
            <div className="text-teal-400">From: idrisalhajisunusi3@gmail.com (Auth: sundimina)</div>
            <div className="text-slate-400">To: ndctem24012@jigpoly.edu.ng (Jigawa State Polytechnic)</div>
            <div className="text-slate-500">Subject: [CRITICAL ALERT] Hand Sanitizer #1042 Reservoir Depleted</div>
            <div className="text-slate-300 pt-1">
              "Attention: Sanitizer dispenser reservoir level has dropped to {telemetry.sanitizer.remaining_percent}%. Relay pump locked (E_DRYRUN) to protect equipment. Please refill immediately."
            </div>
          </div>
        </div>

        {/* Telegram Webhook Hook */}
        <div className="bg-slate-900/90 rounded-xl border border-slate-800 p-5">
          <div className="flex items-center gap-2 mb-3">
            <Send className="w-4 h-4 text-sky-400" />
            <h3 className="text-sm font-semibold text-white">
              Telegram Bot Facility Alert Webhook
            </h3>
          </div>
          <p className="text-xs text-slate-400 mb-3">
            Facility operations channel alerted upon soft daily ceiling reach:
          </p>
          <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 font-mono text-xs text-slate-300 space-y-1">
            <div className="text-slate-500">Recipient: Facility Ops Group</div>
            <div className="text-slate-300 pt-1">
              "Daily threshold reach logged: {telemetry.sanitizer.volume_dispensed_today_ml} ml / {config.daily_limit_ml} ml ceiling."
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
