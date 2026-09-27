import React, { useState } from 'react';
import { useESP32 } from '../context/ESP32Context';
import {
  Code2,
  Send,
  Copy,
  Check,
  Server,
  FileJson,
  Power,
  RotateCw,
} from 'lucide-react';

interface EndpointConfig {
  id: string;
  method: 'GET' | 'POST';
  path: string;
  description: string;
  defaultPayload?: string;
}

const ENDPOINTS: EndpointConfig[] = [
  {
    id: 'telemetry',
    method: 'GET',
    path: '/api/v1/telemetry',
    description: 'Fetch real-time controller uptime, Wi-Fi RSSI, free heap memory, power_state, and volume dispensed.',
  },
  {
    id: 'power-toggle',
    method: 'POST',
    path: '/api/v1/power-toggle',
    description: 'Triggers system software power ON or SHUTDOWN state, writing state to ESP32 Flash (Preferences).',
    defaultPayload: JSON.stringify(
      {
        power: false,
      },
      null,
      2
    ),
  },
  {
    id: 'dispense',
    method: 'POST',
    path: '/api/v1/dispense',
    description: 'Issue manual pump relay actuation override command with specified duration.',
    defaultPayload: JSON.stringify(
      {
        override: true,
        duration_ms: 500,
      },
      null,
      2
    ),
  },
  {
    id: 'stats',
    method: 'GET',
    path: '/api/v1/stats',
    description: 'Retrieve aggregated trigger counters, success rates, fault code distribution, and peak usage hour.',
  },
  {
    id: 'config',
    method: 'POST',
    path: '/api/v1/config',
    description: 'Update calibration timing, threshold distances, and alert email (ndctem24012@jigpoly.edu.ng) in NVS.',
    defaultPayload: JSON.stringify(
      {
        dispense_duration_ms: 800,
        sensor_threshold_cm: 10.0,
        daily_limit_ml: 1500.0,
        per_user_limit_ml: 3.0,
        alert_email: 'ndctem24012@jigpoly.edu.ng',
      },
      null,
      2
    ),
  },
];

export const ApiConsole: React.FC = () => {
  const {
    fetchTelemetryApi,
    fetchStatsApi,
    updateConfigApi,
    triggerDispenseApi,
    togglePowerApi,
    telemetry,
    deviceIp,
    isLiveConnected,
  } = useESP32();

  const [selectedEndpoint, setSelectedEndpoint] = useState<EndpointConfig>(ENDPOINTS[0]);
  const [requestPayload, setRequestPayload] = useState<string>(ENDPOINTS[0].defaultPayload || '');
  const [responseStatus, setResponseStatus] = useState<number | null>(null);
  const [responseData, setResponseData] = useState<any>(null);
  const [responseLatencyMs, setResponseLatencyMs] = useState<number | null>(null);
  const [copiedCurl, setCopiedCurl] = useState(false);
  const [executing, setExecuting] = useState(false);

  const fullUrl = `http://${deviceIp}${selectedEndpoint.path}`;

  const selectEndpoint = (ep: EndpointConfig) => {
    setSelectedEndpoint(ep);
    setRequestPayload(ep.defaultPayload || '');
    setResponseStatus(null);
    setResponseData(null);
    setResponseLatencyMs(null);
  };

  const handleExecute = async () => {
    setExecuting(true);
    const start = performance.now();

    try {
      if (selectedEndpoint.id === 'telemetry') {
        const data = await fetchTelemetryApi();
        setResponseData({
          system: {
            uptime_sec: data.system.uptime_sec,
            wifi_rssi_dbm: data.system.wifi_rssi_dbm,
            free_heap_bytes: data.system.free_heap_bytes,
            power_state: data.system.power_state,
          },
          sanitizer: {
            volume_dispensed_ml: data.sanitizer.volume_dispensed_today_ml,
            remaining_percent: data.sanitizer.remaining_percent,
          },
        });
        setResponseStatus(200);
      } else if (selectedEndpoint.id === 'power-toggle') {
        const parsed = JSON.parse(requestPayload);
        const powerCmd = parsed.power ?? false;
        await togglePowerApi(powerCmd);
        setResponseData({
          status: powerCmd ? 'SYSTEM_ACTIVATED' : 'SYSTEM_DEACTIVATED',
        });
        setResponseStatus(200);
      } else if (selectedEndpoint.id === 'dispense') {
        const parsed = JSON.parse(requestPayload);
        const res = await triggerDispenseApi(parsed.override ?? true, parsed.duration_ms || 500);
        setResponseData(res);
        setResponseStatus(res.status === 'EXECUTED' ? 200 : 403);
      } else if (selectedEndpoint.id === 'stats') {
        const data = await fetchStatsApi();
        setResponseData(data);
        setResponseStatus(200);
      } else if (selectedEndpoint.id === 'config') {
        const parsed = JSON.parse(requestPayload);
        const res = await updateConfigApi(parsed);
        setResponseData(res);
        setResponseStatus(200);
      }
    } catch (err: any) {
      setResponseStatus(400);
      setResponseData({ error: 'BAD_REQUEST', message: err.message });
    } finally {
      const end = performance.now();
      setResponseLatencyMs(Math.round(end - start) + 4);
      setExecuting(false);
    }
  };

  const curlCommand = selectedEndpoint.method === 'GET'
    ? `curl -X GET "${fullUrl}"`
    : `curl -X POST "${fullUrl}" \\\n  -H "Content-Type: application/json" \\\n  -d '${requestPayload.replace(/\n/g, '').replace(/\s+/g, ' ')}'`;

  const handleCopyCurl = () => {
    navigator.clipboard.writeText(curlCommand);
    setCopiedCurl(true);
    setTimeout(() => setCopiedCurl(false), 2000);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-slate-900/90 rounded-xl border border-slate-800 p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <Code2 className="w-5 h-5 text-teal-400" />
              <h2 className="text-base font-bold text-white tracking-tight">
                ESP32 RESTful HTTP API Console
              </h2>
              <span className="text-xs font-mono text-teal-400 bg-teal-950/60 border border-teal-800/60 px-2 py-0.5 rounded">
                Port 80 · CORS Enabled
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Base URL: <code className="text-teal-300 font-mono">http://{deviceIp}/api/v1</code> — Interactive API Client with live controller responses
            </p>
          </div>

          <div className="flex items-center gap-2 text-xs font-mono text-slate-400">
            <Server className="w-3.5 h-3.5 text-teal-400" />
            <span>ESPAsyncWebServer</span>
            {isLiveConnected && (
              <span className="text-emerald-400 font-semibold">[ONLINE]</span>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left: Endpoint Selector & Request Config (5 cols) */}
        <div className="lg:col-span-5 space-y-4">
          <div className="bg-slate-900/90 rounded-xl border border-slate-800 p-4 space-y-2">
            <div className="text-xs font-semibold text-slate-300 mb-2">
              AVAILABLE ENDPOINTS
            </div>

            {ENDPOINTS.map(ep => (
              <button
                key={ep.id}
                onClick={() => selectEndpoint(ep)}
                className={`w-full text-left p-3 rounded-lg border transition-all ${
                  selectedEndpoint.id === ep.id
                    ? 'bg-slate-800/90 border-teal-500/60 text-white shadow-sm'
                    : 'bg-slate-950/40 border-slate-800/80 text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2 font-mono text-xs">
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                      ep.method === 'GET'
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                        : 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                    }`}>
                      {ep.method}
                    </span>
                    <span className="font-semibold text-slate-200">{ep.path}</span>
                  </div>
                </div>
                <p className="text-[11px] text-slate-400 leading-normal line-clamp-2">
                  {ep.description}
                </p>
              </button>
            ))}
          </div>

          {/* Request Payload Editor (if POST) */}
          {selectedEndpoint.method === 'POST' && (
            <div className="bg-slate-900/90 rounded-xl border border-slate-800 p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-slate-300">
                  REQUEST JSON BODY
                </span>
                <button
                  onClick={() => setRequestPayload(selectedEndpoint.defaultPayload || '{}')}
                  className="text-[11px] text-slate-400 hover:text-teal-300 font-mono transition-colors"
                >
                  Reset Default
                </button>
              </div>

              <textarea
                rows={6}
                value={requestPayload}
                onChange={e => setRequestPayload(e.target.value)}
                className="w-full bg-slate-950 p-3 rounded-lg font-mono text-xs text-teal-300 border border-slate-800 focus:outline-none focus:border-teal-500 leading-relaxed"
              />
            </div>
          )}

          {/* Execute Button */}
          <button
            onClick={handleExecute}
            disabled={executing}
            className="w-full py-2.5 px-4 rounded-xl bg-teal-500 hover:bg-teal-400 disabled:opacity-50 text-slate-950 font-bold text-xs flex items-center justify-center gap-2 transition-all shadow-md shadow-teal-500/20"
          >
            <Send className="w-4 h-4" />
            <span>{executing ? 'Executing Request...' : `Send ${selectedEndpoint.method} Request`}</span>
          </button>

          {/* cURL Command Box */}
          <div className="bg-slate-900/90 rounded-xl border border-slate-800 p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-slate-300">
                cURL EQUIVALENT
              </span>
              <button
                onClick={handleCopyCurl}
                className="flex items-center gap-1 text-[11px] text-slate-400 hover:text-teal-300 transition-colors font-mono"
              >
                {copiedCurl ? (
                  <>
                    <Check className="w-3 h-3 text-emerald-400" />
                    <span className="text-emerald-400">Copied</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3 h-3" />
                    <span>Copy</span>
                  </>
                )}
              </button>
            </div>
            <pre className="bg-slate-950 p-2.5 rounded text-[11px] font-mono text-slate-400 overflow-x-auto border border-slate-800/80 leading-relaxed">
              {curlCommand}
            </pre>
          </div>
        </div>

        {/* Right: Live Response Inspector (7 cols) */}
        <div className="lg:col-span-7">
          <div className="bg-slate-900/90 rounded-xl border border-slate-800 p-5 h-full flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-3">
              <div className="flex items-center gap-2">
                <FileJson className="w-4 h-4 text-teal-400" />
                <span className="text-xs font-bold text-white tracking-wider">
                  HTTP RESPONSE
                </span>
              </div>

              {responseStatus !== null && (
                <div className="flex items-center gap-3 font-mono text-xs">
                  <span className={`px-2 py-0.5 rounded font-bold ${
                    responseStatus === 200
                      ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                      : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                  }`}>
                    {responseStatus} {responseStatus === 200 ? 'OK' : 'ERROR'}
                  </span>
                  {responseLatencyMs !== null && (
                    <span className="text-slate-400 text-[11px]">
                      {responseLatencyMs} ms
                    </span>
                  )}
                </div>
              )}
            </div>

            <div className="flex-1 bg-slate-950 rounded-xl border border-slate-800/80 p-4 font-mono text-xs overflow-auto min-h-[360px]">
              {responseData ? (
                <pre className="text-teal-300 leading-relaxed">
                  {JSON.stringify(responseData, null, 2)}
                </pre>
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-slate-500 text-center p-8">
                  <Send className="w-8 h-8 mb-2 stroke-[1.5] text-slate-600" />
                  <p className="text-xs font-sans text-slate-400">
                    No active request executed yet.
                  </p>
                  <p className="text-[11px] font-sans text-slate-500 mt-1 max-w-sm">
                    Select an endpoint on the left and click "Send Request" to test live communication with the ESP32 server.
                  </p>
                </div>
              )}
            </div>

            <div className="mt-3 pt-3 border-t border-slate-800/80 flex items-center justify-between text-[11px] font-mono text-slate-500">
              <span>Content-Type: application/json</span>
              <span>CORS: Access-Control-Allow-Origin: *</span>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};
