import React, { useState, useMemo } from 'react';
import { useESP32 } from '../context/ESP32Context';
import { DispenseEvent } from '../types/iot';
import {
  Download,
  Filter,
  Search,
  CheckCircle,
  AlertTriangle,
  FileCode,
  X,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';

export const RecentEventLogs: React.FC = () => {
  const { events, exportJsonl, exportCsv } = useESP32();
  const [filterStatus, setFilterStatus] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedEvent, setSelectedEvent] = useState<DispenseEvent | null>(null);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const pageSize = 10;

  const filteredEvents = useMemo(() => {
    return events.filter(e => {
      // Filter status
      if (filterStatus === 'SUCCESS' && e.status !== 'SUCCESS') return false;
      if (filterStatus === 'FAULTS' && e.status !== 'UNSUCCESSFUL') return false;
      if (filterStatus === 'E_OBSTRUCT' && e.error_code !== 'E_OBSTRUCT') return false;
      if (filterStatus === 'E_DRYRUN' && e.error_code !== 'E_DRYRUN') return false;
      if (filterStatus === 'E_TIMEOUT' && e.error_code !== 'E_TIMEOUT') return false;
      if (filterStatus === 'E_PUMPFAIL' && e.error_code !== 'E_PUMPFAIL') return false;

      // Search query
      if (searchQuery.trim() !== '') {
        const query = searchQuery.toLowerCase();
        const matchesId = String(e.event_id).includes(query);
        const matchesCode = e.error_code?.toLowerCase().includes(query) || false;
        const matchesNotes = e.notes?.toLowerCase().includes(query) || false;
        const matchesTimestamp = e.timestamp.toLowerCase().includes(query);
        return matchesId || matchesCode || matchesNotes || matchesTimestamp;
      }

      return true;
    });
  }, [events, filterStatus, searchQuery]);

  const totalPages = Math.ceil(filteredEvents.length / pageSize) || 1;
  const paginatedEvents = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredEvents.slice(start, start + pageSize);
  }, [filteredEvents, currentPage]);

  const formatTimestamp = (iso: string) => {
    try {
      const d = new Date(iso);
      return d.toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
    } catch {
      return iso.split('T')[1]?.slice(0, 8) || iso;
    }
  };

  return (
    <div className="bg-slate-900/90 rounded-xl border border-slate-800 p-5 flex flex-col h-full">
      {/* Header and Controls */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 mb-4">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-white tracking-tight">
              Event Log Records
            </h3>
            <span className="text-xs text-slate-400 font-mono">
              SPIFFS / LittleFS .jsonl
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            Synchronized SNTP events with ultrasonic distance, pump telemetry, and fault codes
          </p>
        </div>

        {/* Action Buttons: Export */}
        <div className="flex items-center gap-2">
          <button
            onClick={exportJsonl}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors whitespace-nowrap"
            title="Download JSON Lines (.jsonl) as stored in ESP32 flash"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export .jsonl</span>
          </button>
          <button
            onClick={exportCsv}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors whitespace-nowrap"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 mb-4">
        {/* Filter Segmented Control */}
        <div className="flex items-center gap-1 p-1 bg-slate-950/60 rounded-lg border border-slate-800 w-full sm:w-auto overflow-x-auto">
          {[
            { id: 'ALL', label: 'All Events' },
            { id: 'SUCCESS', label: 'Success' },
            { id: 'FAULTS', label: 'Faults' },
            { id: 'E_TIMEOUT', label: 'Timeout' },
            { id: 'E_OBSTRUCT', label: 'Obstruct' },
            { id: 'E_DRYRUN', label: 'Dry Run' },
            { id: 'E_PUMPFAIL', label: 'Pump Fail' },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => {
                setFilterStatus(tab.id);
                setCurrentPage(1);
              }}
              className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                filterStatus === tab.id
                  ? 'bg-teal-500/20 text-teal-300 border border-teal-500/30'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Search Input */}
        <div className="relative w-full sm:w-56">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
          <input
            type="text"
            placeholder="Search event ID or code..."
            value={searchQuery}
            onChange={e => {
              setSearchQuery(e.target.value);
              setCurrentPage(1);
            }}
            className="w-full bg-slate-950/80 border border-slate-800 rounded-lg pl-8 pr-3 py-1.5 text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-teal-500"
          />
        </div>
      </div>

      {/* Table Container */}
      <div className="overflow-x-auto border border-slate-800 rounded-lg">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-950/70 border-b border-slate-800 text-slate-400 font-mono">
            <tr>
              <th className="py-2.5 px-3 font-semibold">ID</th>
              <th className="py-2.5 px-3 font-semibold">Time (SNTP)</th>
              <th className="py-2.5 px-3 font-semibold">Status / Code</th>
              <th className="py-2.5 px-3 font-semibold text-right">Distance</th>
              <th className="py-2.5 px-3 font-semibold text-right">Duration</th>
              <th className="py-2.5 px-3 font-semibold text-right">Volume</th>
              <th className="py-2.5 px-3 font-semibold text-right">Tank Level</th>
              <th className="py-2.5 px-3 font-semibold text-center">Inspect</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60 font-mono text-slate-300">
            {paginatedEvents.length > 0 ? (
              paginatedEvents.map(event => {
                const isSuccess = event.status === 'SUCCESS';

                return (
                  <tr
                    key={event.event_id}
                    className="hover:bg-slate-800/40 transition-colors"
                  >
                    <td className="py-2.5 px-3 font-semibold text-white">
                      #{event.event_id}
                    </td>

                    <td className="py-2.5 px-3 text-slate-400">
                      {formatTimestamp(event.timestamp)}
                    </td>

                    <td className="py-2.5 px-3 font-sans">
                      {isSuccess ? (
                        <span className="text-emerald-400 font-medium flex items-center gap-1 font-mono text-[11px]">
                          <CheckCircle className="w-3.5 h-3.5 shrink-0" />
                          SUCCESS
                        </span>
                      ) : (
                        <span className="text-rose-400 font-medium flex items-center gap-1 font-mono text-[11px]">
                          <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                          {event.error_code || 'FAULT'}
                        </span>
                      )}
                    </td>

                    <td className="py-2.5 px-3 text-right tabular-nums text-slate-300">
                      {event.distance_cm > 0 ? `${event.distance_cm.toFixed(1)} cm` : '—'}
                    </td>

                    <td className="py-2.5 px-3 text-right tabular-nums text-slate-300">
                      {event.dispense_duration_ms > 0 ? `${event.dispense_duration_ms} ms` : '0 ms'}
                    </td>

                    <td className="py-2.5 px-3 text-right tabular-nums font-semibold text-white">
                      {event.volume_ml.toFixed(1)} ml
                    </td>

                    <td className="py-2.5 px-3 text-right tabular-nums text-slate-300">
                      {event.tank_level_after_percent.toFixed(1)}%
                    </td>

                    <td className="py-2.5 px-3 text-center">
                      <button
                        onClick={() => setSelectedEvent(event)}
                        className="text-slate-400 hover:text-teal-300 transition-colors p-1"
                        title="View raw JSON payload"
                      >
                        <FileCode className="w-4 h-4 inline-block" />
                      </button>
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan={8} className="py-8 text-center text-slate-500 font-sans">
                  No event records match the selected filter query.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Bar */}
      <div className="mt-3 flex items-center justify-between text-xs text-slate-400">
        <div>
          Showing {paginatedEvents.length} of {filteredEvents.length} records
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
            disabled={currentPage === 1}
            className="p-1 rounded bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-700 text-slate-200"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="font-mono text-slate-300">
            {currentPage} / {totalPages}
          </span>
          <button
            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
            disabled={currentPage === totalPages}
            className="p-1 rounded bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-700 text-slate-200"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Raw JSON Payload Modal */}
      {selectedEvent && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-lg w-full p-5 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <FileCode className="w-4 h-4 text-teal-400" />
                <span className="text-sm font-semibold text-white">
                  Event #{selectedEvent.event_id} (LittleFS Record)
                </span>
              </div>
              <button
                onClick={() => setSelectedEvent(null)}
                className="text-slate-400 hover:text-white transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="mt-3">
              <pre className="bg-slate-950 p-3.5 rounded-lg text-xs font-mono text-teal-300 overflow-x-auto border border-slate-800 leading-relaxed">
                {JSON.stringify(
                  {
                    event_id: selectedEvent.event_id,
                    timestamp: selectedEvent.timestamp,
                    status: selectedEvent.status,
                    error_code: selectedEvent.error_code,
                    distance_cm: selectedEvent.distance_cm,
                    dispense_duration_ms: selectedEvent.dispense_duration_ms,
                    volume_ml: selectedEvent.volume_ml,
                    tank_level_after_percent: selectedEvent.tank_level_after_percent,
                    notes: selectedEvent.notes,
                  },
                  null,
                  2
                )}
              </pre>
            </div>

            <div className="mt-4 flex justify-end">
              <button
                onClick={() => setSelectedEvent(null)}
                className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-medium transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
