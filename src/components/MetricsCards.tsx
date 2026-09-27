import React from 'react';
import { useESP32 } from '../context/ESP32Context';
import { Droplet, Gauge, CheckCircle2, Award, AlertTriangle, AlertCircle, Power } from 'lucide-react';

export const MetricsCards: React.FC = () => {
  const { telemetry, stats, refillTank, systemPoweredOn } = useESP32();

  const remainingPercent = telemetry.sanitizer.remaining_percent;
  const todayVolume = telemetry.sanitizer.volume_dispensed_today_ml;
  const dailyLimit = telemetry.sanitizer.daily_limit_ml;
  const volumeProgress = Math.min(100, (todayVolume / dailyLimit) * 100);

  // Status for tank level
  const isTankCritical = remainingPercent <= 5;
  const isTankWarning = remainingPercent <= 15 && !isTankCritical;

  // Tank bar color
  const tankBarColor = isTankCritical
    ? 'bg-rose-500'
    : isTankWarning
    ? 'bg-amber-500'
    : 'bg-teal-500';

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {/* 1. TANK LEVEL */}
      <div className="bg-slate-900/90 rounded-xl border border-slate-800 p-5 flex flex-col justify-between">
        <div>
          <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
            <span className="font-semibold tracking-wider text-slate-300">TANK LEVEL</span>
            <div className="flex items-center gap-1">
              <Droplet className={`w-3.5 h-3.5 ${isTankCritical ? 'text-rose-400' : isTankWarning ? 'text-amber-400' : 'text-teal-400'}`} />
              <span className="font-mono text-[11px] text-slate-400">
                {telemetry.sanitizer.current_level_mm || 180} / {telemetry.sanitizer.max_tank_depth_mm || 200} mm
              </span>
            </div>
          </div>

          <div className="flex items-baseline justify-between">
            <div className="text-3xl font-bold font-mono tracking-tight text-white tabular-nums">
              {remainingPercent.toFixed(1)}%
            </div>
            <div className="text-xs text-slate-400 font-mono tabular-nums">
              {telemetry.sanitizer.remaining_volume_ml?.toFixed(0) || 2250} ml left
            </div>
          </div>

          {/* Liquid Progress Bar */}
          <div className="relative mt-4">
            <div className="w-full bg-slate-800 h-3 rounded-full overflow-hidden">
              <div
                className={`h-full ${tankBarColor} transition-all duration-500 rounded-full`}
                style={{ width: `${Math.max(2, Math.min(100, remainingPercent))}%` }}
              />
            </div>

            {/* Threshold Line at 15% (Warning) */}
            <div
              className="absolute top-0 bottom-0 w-0.5 bg-amber-400/80 z-10 pointer-events-none"
              style={{ left: '15%' }}
              title="15% Warning Threshold"
            />
            {/* Threshold Line at 5% (Critical Lockout) */}
            <div
              className="absolute top-0 bottom-0 w-0.5 bg-rose-500 z-10 pointer-events-none"
              style={{ left: '5%' }}
              title="5% Lockout Threshold"
            />
          </div>
        </div>

        <div className="mt-3 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs">
          {isTankCritical ? (
            <div className="flex items-center gap-1.5 text-rose-400">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              <span>Pump locked (E_DRYRUN)</span>
            </div>
          ) : isTankWarning ? (
            <div className="flex items-center gap-1.5 text-amber-400">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
              <span>Low reservoir warning</span>
            </div>
          ) : (
            <span className="text-slate-400">Liquid sensor GPIO 34</span>
          )}

          <button
            onClick={() => refillTank(100)}
            className="text-[11px] text-teal-400 hover:text-teal-300 transition-colors underline underline-offset-2"
          >
            Refill (100%)
          </button>
        </div>
      </div>

      {/* 2. TODAY'S VOLUME */}
      <div className="bg-slate-900/90 rounded-xl border border-slate-800 p-5 flex flex-col justify-between">
        <div>
          <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
            <span className="font-semibold tracking-wider text-slate-300">TODAY'S VOLUME</span>
            <div className="flex items-center gap-1 text-slate-400">
              <Gauge className="w-3.5 h-3.5 text-sky-400" />
              <span className="font-mono text-[11px]">3.0 ml / disp</span>
            </div>
          </div>

          <div className="flex items-baseline justify-between">
            <div className="text-3xl font-bold font-mono tracking-tight text-white tabular-nums">
              {todayVolume.toFixed(1)} <span className="text-lg font-normal text-slate-400">ml</span>
            </div>
            <div className="text-xs text-slate-400 font-mono tabular-nums">
              of {dailyLimit.toFixed(0)} ml limit
            </div>
          </div>

          {/* Volume progress bar */}
          <div className="relative mt-4">
            <div className="w-full bg-slate-800 h-3 rounded-full overflow-hidden">
              <div
                className={`h-full ${
                  volumeProgress >= 100 ? 'bg-amber-500' : 'bg-sky-500'
                } transition-all duration-500 rounded-full`}
                style={{ width: `${Math.max(2, Math.min(100, volumeProgress))}%` }}
              />
            </div>
          </div>
        </div>

        <div className="mt-3 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
          <span>
            {dailyLimit - todayVolume > 0
              ? `${(dailyLimit - todayVolume).toFixed(1)} ml quota left`
              : 'Limit reached'}
          </span>
          <span className="font-mono text-[11px] text-slate-400">
            {volumeProgress.toFixed(1)}%
          </span>
        </div>
      </div>

      {/* 3. SUCCESS RATE */}
      <div className="bg-slate-900/90 rounded-xl border border-slate-800 p-5 flex flex-col justify-between">
        <div>
          <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
            <span className="font-semibold tracking-wider text-slate-300">SUCCESS RATE</span>
            <div className="flex items-center gap-1 text-emerald-400">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span className="font-mono text-[11px]">Formula: (S / T) * 100</span>
            </div>
          </div>

          <div className="flex items-baseline justify-between">
            <div className="text-3xl font-bold font-mono tracking-tight text-emerald-400 tabular-nums">
              {stats.summary.total_triggers > 0 ? `${stats.summary.success_rate_percent.toFixed(1)}%` : '100%'}
            </div>
            <div className="text-xs text-slate-400 font-mono tabular-nums">
              {stats.summary.successful_dispenses} S · {stats.summary.unsuccessful_dispenses} F
            </div>
          </div>

          {/* Success proportion bar */}
          <div className="mt-4 flex h-3 w-full bg-slate-800 rounded-full overflow-hidden">
            <div
              className="bg-emerald-500 transition-all duration-500"
              style={{ width: `${stats.summary.total_triggers > 0 ? stats.summary.success_rate_percent : 100}%` }}
            />
            <div
              className="bg-rose-500 transition-all duration-500"
              style={{ width: `${stats.summary.total_triggers > 0 ? 100 - stats.summary.success_rate_percent : 0}%` }}
            />
          </div>
        </div>

        <div className="mt-3 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
          <div className="flex items-center gap-1 font-mono text-[11px]">
            <span>{stats.error_breakdown.E_TIMEOUT} Timeout</span>
            <span aria-hidden="true">·</span>
            <span>{stats.error_breakdown.E_OBSTRUCT} Obstruct</span>
          </div>
          <span className="text-slate-400">
            {stats.summary.total_triggers} triggers
          </span>
        </div>
      </div>

      {/* 4. TOTAL DISPENSES & POWER STATE */}
      <div className="bg-slate-900/90 rounded-xl border border-slate-800 p-5 flex flex-col justify-between">
        <div>
          <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
            <span className="font-semibold tracking-wider text-slate-300">TOTAL DISPENSES</span>
            <div className="flex items-center gap-1">
              <Power className={`w-3.5 h-3.5 ${systemPoweredOn ? 'text-emerald-400' : 'text-rose-400'}`} />
              <span className={`font-mono text-[11px] font-bold ${systemPoweredOn ? 'text-emerald-400' : 'text-rose-400'}`}>
                {systemPoweredOn ? 'ONLINE' : 'SHUTDOWN'}
              </span>
            </div>
          </div>

          <div className="flex items-baseline justify-between">
            <div className="text-3xl font-bold font-mono tracking-tight text-white tabular-nums">
              {stats.summary.successful_dispenses}
            </div>
            <div className="text-xs text-slate-400 font-mono tabular-nums">
              Recorded Cycles
            </div>
          </div>

          <div className="mt-4 flex items-center justify-between text-xs bg-slate-800/60 p-2 rounded-lg border border-slate-700/50">
            <span className="text-slate-400">Preferences NVS:</span>
            <span className="font-mono font-semibold text-slate-200 tabular-nums">
              {stats.summary.lifetime_dispenses} stored
            </span>
          </div>
        </div>

        <div className="mt-3 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
          <span>Cumulative volume</span>
          <span className="font-mono font-medium text-slate-300 tabular-nums">
            {(stats.summary.lifetime_volume_ml / 1000).toFixed(2)} L
          </span>
        </div>
      </div>
    </div>
  );
};
