import React, { useState } from 'react';
import { useESP32 } from '../context/ESP32Context';
import {
  Sliders,
  Save,
  Play,
  CheckCircle2,
  Mail,
  Zap,
  Power,
  RotateCw,
} from 'lucide-react';

export const SystemControlPanel: React.FC = () => {
  const {
    config,
    updateConfigApi,
    triggerDispenseApi,
    refillTank,
    drainTank,
    telemetry,
    systemPoweredOn,
    togglePowerApi,
    isLiveConnected,
    deviceIp,
  } = useESP32();

  // Local form state
  const [formData, setFormData] = useState({
    dispense_duration_ms: config.dispense_duration_ms,
    sensor_threshold_cm: config.sensor_threshold_cm,
    daily_limit_ml: config.daily_limit_ml,
    per_user_limit_ml: config.per_user_limit_ml,
    flow_rate_ml_per_sec: config.flow_rate_ml_per_sec,
    alert_email: config.alert_email,
  });

  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [manualDuration, setManualDuration] = useState(500);
  const [manualDispensing, setManualDispensing] = useState(false);
  const [manualResult, setManualResult] = useState<{ status: string; dispensed_ml: number; message?: string } | null>(null);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSaveSuccess(false);

    await updateConfigApi({
      dispense_duration_ms: Number(formData.dispense_duration_ms),
      sensor_threshold_cm: Number(formData.sensor_threshold_cm),
      daily_limit_ml: Number(formData.daily_limit_ml),
      per_user_limit_ml: Number(formData.per_user_limit_ml),
      flow_rate_ml_per_sec: Number(formData.flow_rate_ml_per_sec),
      alert_email: formData.alert_email,
    });

    setSaving(false);
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 3000);
  };

  const handleManualDispense = async () => {
    setManualDispensing(true);
    setManualResult(null);

    const res = await triggerDispenseApi(true, manualDuration);
    setManualResult(res);
    setManualDispensing(false);
  };

  const estimatedSingleDispenseMl = (
    (Number(formData.flow_rate_ml_per_sec) || 3.75) *
    ((Number(formData.dispense_duration_ms) || 800) / 1000)
  ).toFixed(2);

  return (
    <div className="bg-slate-900/90 rounded-xl border border-slate-800 p-5 flex flex-col justify-between">
      <div>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Sliders className="w-4 h-4 text-teal-400" />
            <h3 className="text-sm font-semibold text-white tracking-tight">
              System Control & Power Switch
            </h3>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400 font-mono">
              Target: {deviceIp}
            </span>
          </div>
        </div>

        {/* Master Power Switch Row */}
        <div className="mb-4 p-3 bg-slate-950 rounded-xl border border-slate-800 flex items-center justify-between">
          <div>
            <div className="text-xs font-semibold text-white flex items-center gap-1.5">
              <Power className={`w-3.5 h-3.5 ${systemPoweredOn ? 'text-emerald-400' : 'text-rose-400'}`} />
              <span>Dispenser Power State: {systemPoweredOn ? 'ACTIVE' : 'DEACTIVATED'}</span>
            </div>
            <p className="text-[11px] text-slate-400 mt-0.5">
              {systemPoweredOn ? 'Relay and ultrasonic sensor active.' : 'Dispensing loop suspended.'}
            </p>
          </div>

          <button
            onClick={() => togglePowerApi(!systemPoweredOn)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold font-mono border transition-all ${
              systemPoweredOn
                ? 'bg-rose-950/80 hover:bg-rose-900/80 text-rose-300 border-rose-800'
                : 'bg-emerald-950/80 hover:bg-emerald-900/80 text-emerald-300 border-emerald-800'
            }`}
          >
            {systemPoweredOn ? 'Shut Down System' : 'Activate System'}
          </button>
        </div>

        <form onSubmit={handleSave} className="space-y-3.5 text-xs">
          {/* Dispense Duration */}
          <div>
            <div className="flex items-center justify-between text-slate-300 mb-1">
              <label htmlFor="duration-input" className="font-medium">Dispense Time (ms)</label>
              <span className="font-mono text-slate-400 text-[11px]">
                {formData.dispense_duration_ms} ms (~{estimatedSingleDispenseMl} ml)
              </span>
            </div>
            <input
              id="duration-input"
              type="number"
              min="200"
              max="2000"
              step="50"
              value={formData.dispense_duration_ms}
              onChange={e => setFormData({ ...formData, dispense_duration_ms: Number(e.target.value) })}
              className="w-full bg-slate-950/80 border border-slate-800 rounded-lg px-3 py-1.5 font-mono text-slate-200 focus:outline-none focus:border-teal-500"
            />
          </div>

          {/* Trigger Distance Threshold */}
          <div>
            <div className="flex items-center justify-between text-slate-300 mb-1">
              <label htmlFor="distance-input" className="font-medium">Trig Distance (cm)</label>
              <span className="font-mono text-slate-400 text-[11px]">
                Valid: 3.0 to {formData.sensor_threshold_cm} cm
              </span>
            </div>
            <input
              id="distance-input"
              type="number"
              min="5.0"
              max="25.0"
              step="0.5"
              value={formData.sensor_threshold_cm}
              onChange={e => setFormData({ ...formData, sensor_threshold_cm: Number(e.target.value) })}
              className="w-full bg-slate-950/80 border border-slate-800 rounded-lg px-3 py-1.5 font-mono text-slate-200 focus:outline-none focus:border-teal-500"
            />
          </div>

          {/* Daily Limit */}
          <div>
            <div className="flex items-center justify-between text-slate-300 mb-1">
              <label htmlFor="limit-input" className="font-medium">Daily Soft Limit (ml)</label>
              <span className="font-mono text-slate-400 text-[11px]">
                {formData.daily_limit_ml} ml ceiling
              </span>
            </div>
            <input
              id="limit-input"
              type="number"
              min="500"
              max="5000"
              step="100"
              value={formData.daily_limit_ml}
              onChange={e => setFormData({ ...formData, daily_limit_ml: Number(e.target.value) })}
              className="w-full bg-slate-950/80 border border-slate-800 rounded-lg px-3 py-1.5 font-mono text-slate-200 focus:outline-none focus:border-teal-500"
            />
          </div>

          {/* Per-User Limit */}
          <div>
            <div className="flex items-center justify-between text-slate-300 mb-1">
              <label htmlFor="per-user-input" className="font-medium">Per-User Limit (ml)</label>
              <span className="font-mono text-slate-400 text-[11px]">
                Max single dispense
              </span>
            </div>
            <input
              id="per-user-input"
              type="number"
              min="1.0"
              max="10.0"
              step="0.5"
              value={formData.per_user_limit_ml}
              onChange={e => setFormData({ ...formData, per_user_limit_ml: Number(e.target.value) })}
              className="w-full bg-slate-950/80 border border-slate-800 rounded-lg px-3 py-1.5 font-mono text-slate-200 focus:outline-none focus:border-teal-500"
            />
          </div>

          {/* Flow Rate Calibration */}
          <div>
            <div className="flex items-center justify-between text-slate-300 mb-1">
              <label htmlFor="flow-rate-input" className="font-medium">Pump Flow Rate Q (ml/s)</label>
              <span className="font-mono text-slate-400 text-[11px]">
                V = Q × t formula
              </span>
            </div>
            <input
              id="flow-rate-input"
              type="number"
              min="1.0"
              max="10.0"
              step="0.25"
              value={formData.flow_rate_ml_per_sec}
              onChange={e => setFormData({ ...formData, flow_rate_ml_per_sec: Number(e.target.value) })}
              className="w-full bg-slate-950/80 border border-slate-800 rounded-lg px-3 py-1.5 font-mono text-slate-200 focus:outline-none focus:border-teal-500"
            />
          </div>

          {/* Alert Notification Email */}
          <div>
            <div className="flex items-center justify-between text-slate-300 mb-1">
              <label htmlFor="email-input" className="font-medium">Facility Alert Email (SMTP)</label>
              <Mail className="w-3 h-3 text-slate-400" />
            </div>
            <input
              id="email-input"
              type="email"
              value={formData.alert_email}
              onChange={e => setFormData({ ...formData, alert_email: e.target.value })}
              className="w-full bg-slate-950/80 border border-slate-800 rounded-lg px-3 py-1.5 font-mono text-teal-300 focus:outline-none focus:border-teal-500"
            />
          </div>

          {/* Save Button */}
          <div className="pt-2">
            <button
              type="submit"
              disabled={saving}
              className="w-full flex items-center justify-center gap-1.5 bg-teal-500 hover:bg-teal-400 text-slate-950 font-semibold py-2 px-4 rounded-lg transition-colors"
            >
              <Save className="w-3.5 h-3.5" />
              <span>{saving ? 'Writing to Flash NVS...' : 'Save Configuration to ESP32'}</span>
            </button>

            {saveSuccess && (
              <div className="mt-2 text-center text-emerald-400 font-mono text-[11px] flex items-center justify-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>NVS parameter commit confirmed (200 OK)</span>
              </div>
            )}
          </div>
        </form>
      </div>

      {/* Manual Dispense Command Section */}
      <div className="mt-6 pt-4 border-t border-slate-800">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
            <Zap className="w-3.5 h-3.5 text-amber-400" />
            Manual Test Dispense
          </span>
          <span className="text-[11px] font-mono text-slate-400">
            POST /dispense
          </span>
        </div>

        <div className="flex items-center gap-2">
          <input
            type="number"
            min="100"
            max="1500"
            step="100"
            value={manualDuration}
            onChange={e => setManualDuration(Number(e.target.value))}
            className="w-24 bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 font-mono text-xs text-slate-200"
            title="Duration ms"
          />
          <span className="text-xs font-mono text-slate-400">ms</span>

          <button
            onClick={handleManualDispense}
            disabled={manualDispensing || !systemPoweredOn || telemetry.sanitizer.remaining_percent <= 5}
            className="flex-1 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed text-white py-1.5 px-3 rounded-lg text-xs font-medium transition-colors flex items-center justify-center gap-1.5 border border-slate-700"
          >
            <Play className="w-3 h-3 fill-current" />
            <span>{manualDispensing ? 'Triggering...' : 'Fire Relay'}</span>
          </button>
        </div>

        {manualResult && (
          <div className={`mt-2 p-2 rounded text-[11px] font-mono ${
            manualResult.status === 'EXECUTED'
              ? 'bg-emerald-950/50 border border-emerald-800 text-emerald-300'
              : 'bg-rose-950/50 border border-rose-800 text-rose-300'
          }`}>
            {manualResult.status === 'EXECUTED'
              ? `Status: EXECUTED | Dispensed: ${manualResult.dispensed_ml} ml`
              : `Status: FAILED | ${manualResult.message || 'Dispense locked'}`}
          </div>
        )}

        {/* Maintenance Actions */}
        <div className="mt-3 flex items-center gap-2 text-xs">
          <button
            onClick={() => refillTank(100)}
            className="flex-1 py-1.5 px-2 bg-slate-800/80 hover:bg-slate-700 text-teal-300 rounded border border-slate-700/60 transition-colors text-center"
          >
            Refill (100%)
          </button>
          <button
            onClick={() => drainTank(3.0)}
            className="flex-1 py-1.5 px-2 bg-slate-800/80 hover:bg-slate-700 text-rose-300 rounded border border-slate-700/60 transition-colors text-center"
            title="Drain tank to 3% to test E_DRYRUN lock"
          >
            Drain (3% Test)
          </button>
        </div>
      </div>
    </div>
  );
};
