import React, { useState } from 'react';
import { useESP32 } from '../context/ESP32Context';
import { BarChart3, Clock, Flame } from 'lucide-react';

export const HourlyUsageChart: React.FC = () => {
  const { stats } = useESP32();
  const [hoveredHour, setHoveredHour] = useState<number | null>(null);

  const distribution = stats.hourly_distribution;
  const maxCount = Math.max(1, ...distribution.map(d => d.count));
  const activeBucket = hoveredHour !== null ? distribution.find(d => d.hour === hoveredHour) : null;

  return (
    <div className="bg-slate-900/90 rounded-xl border border-slate-800 p-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-6">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-white tracking-tight">
              Hourly Usage Distribution (Today)
            </h3>
            <span className="text-xs text-slate-400 font-mono">
              24-Hour SNTP Buckets
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            Aggregated hand sensor dispense activity across facility operating hours
          </p>
        </div>

        {/* Peak Hour Indicator */}
        <div className="flex items-center gap-2 self-start sm:self-auto text-xs bg-amber-500/10 border border-amber-500/30 text-amber-300 px-3 py-1.5 rounded-lg">
          <Flame className="w-3.5 h-3.5 text-amber-400 shrink-0" />
          <span>Peak Interval:</span>
          <span className="font-mono font-semibold text-amber-200">{stats.peak_hour}</span>
        </div>
      </div>

      {/* Bar Chart Container */}
      <div className="relative pt-6 pb-2">
        {/* Y-axis guide lines */}
        <div className="absolute inset-0 flex flex-col justify-between pointer-events-none text-[10px] font-mono text-slate-600">
          <div className="border-b border-slate-800/60 pb-1 flex justify-between">
            <span>{maxCount} triggers</span>
            <span>dispenses/hr</span>
          </div>
          <div className="border-b border-slate-800/40 pb-1">
            <span>{Math.round(maxCount / 2)}</span>
          </div>
          <div className="border-b border-slate-800/30 pb-1">
            <span>0</span>
          </div>
        </div>

        {/* Interactive Bars (24 hours) */}
        <div className="relative h-44 flex items-end gap-1 sm:gap-1.5 pt-4 z-10">
          {distribution.map(d => {
            const heightPercent = maxCount > 0 ? (d.count / maxCount) * 100 : 0;
            const isPeak = d.label.startsWith(stats.peak_hour.slice(0, 2));
            const isHovered = hoveredHour === d.hour;

            return (
              <div
                key={d.hour}
                onMouseEnter={() => setHoveredHour(d.hour)}
                onMouseLeave={() => setHoveredHour(null)}
                className="flex-1 flex flex-col items-center h-full justify-end group cursor-pointer"
              >
                {/* Bar */}
                <div className="w-full flex items-end justify-center h-full">
                  <div
                    className={`w-full max-w-[28px] rounded-t transition-all duration-300 ${
                      isHovered
                        ? 'bg-teal-300'
                        : isPeak
                        ? 'bg-amber-400'
                        : d.count > 0
                        ? 'bg-teal-600 group-hover:bg-teal-400'
                        : 'bg-slate-800/60'
                    }`}
                    style={{
                      height: `${Math.max(4, heightPercent)}%`,
                    }}
                  />
                </div>

                {/* X-axis tick (show every 2-3 hours on small screens, every 2 on larger) */}
                <span
                  className={`mt-2 text-[10px] font-mono transition-colors ${
                    isPeak
                      ? 'text-amber-300 font-semibold'
                      : isHovered
                      ? 'text-teal-300 font-semibold'
                      : d.hour % 2 === 0
                      ? 'text-slate-400'
                      : 'hidden sm:block text-slate-500'
                  }`}
                >
                  {String(d.hour).padStart(2, '0')}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Dynamic Hover Detail / Selected Hour State */}
      <div className="mt-4 pt-3 border-t border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs">
        {activeBucket ? (
          <div className="flex items-center gap-3">
            <span className="font-mono font-semibold text-teal-300">
              {activeBucket.label} - {String(activeBucket.hour + 1).padStart(2, '0')}:00
            </span>
            <span aria-hidden="true" className="text-slate-600">·</span>
            <span className="text-slate-300">
              <strong className="text-white font-mono">{activeBucket.count}</strong> total triggers
            </span>
            <span aria-hidden="true" className="text-slate-600">·</span>
            <span className="text-emerald-400 font-mono">
              {activeBucket.successful} OK
            </span>
            {activeBucket.unsuccessful > 0 && (
              <>
                <span aria-hidden="true" className="text-slate-600">·</span>
                <span className="text-rose-400 font-mono">
                  {activeBucket.unsuccessful} Fault
                </span>
              </>
            )}
            <span aria-hidden="true" className="text-slate-600">·</span>
            <span className="text-slate-400 font-mono">
              {activeBucket.volume_ml} ml dispensed
            </span>
          </div>
        ) : (
          <div className="flex items-center gap-2 text-slate-400">
            <Clock className="w-3.5 h-3.5 text-slate-500" />
            <span>Hover over any hourly bar to inspect volume and trigger success rates</span>
          </div>
        )}

        <div className="flex items-center gap-4 text-[11px] text-slate-400">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-sm bg-teal-600 inline-block" />
            <span>Normal Traffic</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-sm bg-amber-400 inline-block" />
            <span>Peak Interval</span>
          </div>
        </div>
      </div>
    </div>
  );
};
