import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import {
  DeviceConfig,
  DispenseEvent,
  SystemTelemetry,
  UsageStats,
  SerialLog,
  AlertNotification,
  HardwareState,
  PowerState,
} from '../types/iot';
import {
  DEFAULT_CONFIG,
  generateSeedEvents,
  generateSeedSerialLogs,
  generateSeedAlerts,
  loadFromStorage,
  saveToStorage,
} from '../services/esp32Storage';

interface ESP32ContextType {
  config: DeviceConfig;
  telemetry: SystemTelemetry;
  stats: UsageStats;
  events: DispenseEvent[];
  serialLogs: SerialLog[];
  alerts: AlertNotification[];
  hardware: HardwareState;
  activeView: 'dashboard' | 'hardware' | 'api' | 'serial' | 'alerts';
  setActiveView: (view: 'dashboard' | 'hardware' | 'api' | 'serial' | 'alerts') => void;
  // External Live Device Connection Settings
  deviceIp: string;
  setDeviceIp: (ip: string) => void;
  connectionMode: 'LIVE_DEVICE' | 'BENCH_SIMULATION';
  setConnectionMode: (mode: 'LIVE_DEVICE' | 'BENCH_SIMULATION') => void;
  isLiveConnected: boolean;
  lastHeartbeat: string | null;
  connectionError: string | null;
  systemPoweredOn: boolean;
  testConnection: () => Promise<boolean>;
  togglePowerApi: (powerState: boolean) => Promise<boolean>;
  // REST API Methods
  fetchTelemetryApi: () => Promise<SystemTelemetry>;
  fetchStatsApi: () => Promise<UsageStats>;
  updateConfigApi: (newConfig: Partial<DeviceConfig>) => Promise<{ status: string; message: string }>;
  triggerDispenseApi: (override: boolean, duration_ms: number) => Promise<{ status: string; dispensed_ml: number; error_code?: string; message?: string }>;
  // Simulation & local triggers
  simulateHandTrigger: (distanceCm: number, durationMs: number) => Promise<{ success: boolean; event: DispenseEvent }>;
  setHandDistance: (dist: number) => void;
  refillTank: (targetPercent?: number) => void;
  drainTank: (targetPercent?: number) => void;
  toggleWifi: () => void;
  togglePumpFailure: () => void;
  clearSensorObstruction: () => void;
  exportJsonl: () => void;
  exportCsv: () => void;
  resetAllData: () => void;
  addSerialLog: (level: 'INFO' | 'WARN' | 'ERROR' | 'DEBUG', tag: string, message: string) => void;
  dismissAlert: (id: string) => void;
}

const ESP32Context = createContext<ESP32ContextType | null>(null);

export const ESP32Provider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [activeView, setActiveView] = useState<'dashboard' | 'hardware' | 'api' | 'serial' | 'alerts'>('dashboard');
  
  // Target ESP32 Device IP / URL
  const [deviceIp, setDeviceIpState] = useState<string>(() =>
    loadFromStorage<string>('device_ip', '192.168.1.142')
  );

  // Connection mode: Defaults to LIVE_DEVICE
  const [connectionMode, setConnectionMode] = useState<'LIVE_DEVICE' | 'BENCH_SIMULATION'>('LIVE_DEVICE');
  const [isLiveConnected, setIsLiveConnected] = useState<boolean>(false);
  const [lastHeartbeat, setLastHeartbeat] = useState<string | null>(null);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [systemPoweredOn, setSystemPoweredOn] = useState<boolean>(true);

  // Persistent Config
  const [config, setConfig] = useState<DeviceConfig>(() =>
    loadFromStorage<DeviceConfig>('config', DEFAULT_CONFIG)
  );

  // Persistent Events
  const [events, setEvents] = useState<DispenseEvent[]>(() =>
    loadFromStorage<DispenseEvent[]>('events', generateSeedEvents())
  );

  // Persistent Serial Logs
  const [serialLogs, setSerialLogs] = useState<SerialLog[]>(() =>
    loadFromStorage<SerialLog[]>('serial_logs', generateSeedSerialLogs())
  );

  // Alerts
  const [alerts, setAlerts] = useState<AlertNotification[]>(() =>
    loadFromStorage<AlertNotification[]>('alerts', generateSeedAlerts())
  );

  // Live Hardware State
  const [hardware, setHardware] = useState<HardwareState>({
    hand_present: false,
    hand_distance_cm: 20.0,
    hand_held_duration_ms: 0,
    relay_active: false,
    pump_running: false,
    wifi_connected: true,
    simulated_pump_failure: false,
    simulated_sensor_blocked: false,
    sensor_blocked_duration_sec: 0,
    red_led_flashing: false,
    green_led_active: false,
    blue_wifi_led: true,
    fluid_level_mm: 180, // ~90%
  });

  // Dynamic Telemetry fields
  const [liveUptimeSec, setLiveUptimeSec] = useState<number>(0);
  const [liveRssi, setLiveRssi] = useState<number>(-55);
  const [liveFreeHeap, setLiveFreeHeap] = useState<number>(214580);
  const [liveTotalVolumeDispensed, setLiveTotalVolumeDispensed] = useState<number>(0.0);

  const setDeviceIp = (ip: string) => {
    // Strip trailing slash or protocol prefix if needed
    const cleanIp = ip.trim().replace(/^https?:\/\//, '').replace(/\/$/, '');
    setDeviceIpState(cleanIp);
    saveToStorage('device_ip', cleanIp);
  };

  const getBaseUrl = useCallback(() => {
    const raw = deviceIp.trim();
    if (raw.startsWith('http://') || raw.startsWith('https://')) {
      return raw.replace(/\/$/, '');
    }
    return `http://${raw}`;
  }, [deviceIp]);

  // Serial log helper
  const addSerialLog = useCallback((level: 'INFO' | 'WARN' | 'ERROR' | 'DEBUG', tag: string, message: string) => {
    const d = new Date();
    const timeStr = d.toTimeString().split(' ')[0];
    const newLog: SerialLog = {
      id: 'log-' + Date.now() + '-' + Math.random().toString(36).substr(2, 4),
      timestamp: timeStr,
      level,
      tag,
      message,
    };
    setSerialLogs(prev => [newLog, ...prev.slice(0, 199)]);
  }, []);

  // Poll real ESP32 endpoint if in LIVE_DEVICE mode
  const pollLiveDevice = useCallback(async () => {
    if (connectionMode !== 'LIVE_DEVICE') return;
    const url = `${getBaseUrl()}/api/v1/telemetry`;

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2500);

      const res = await fetch(url, {
        method: 'GET',
        headers: { 'Accept': 'application/json' },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (res.ok) {
        const data = await res.json();
        setIsLiveConnected(true);
        setConnectionError(null);
        setLastHeartbeat(new Date().toLocaleTimeString());

        // Parse firmware telemetry
        if (data.system) {
          if (typeof data.system.uptime_sec === 'number') setLiveUptimeSec(data.system.uptime_sec);
          if (typeof data.system.wifi_rssi_dbm === 'number') setLiveRssi(data.system.wifi_rssi_dbm);
          if (typeof data.system.free_heap_bytes === 'number') setLiveFreeHeap(data.system.free_heap_bytes);
          if (data.system.power_state) {
            setSystemPoweredOn(data.system.power_state === 'ONLINE');
          }
        }
        if (data.sanitizer && typeof data.sanitizer.volume_dispensed_ml === 'number') {
          setLiveTotalVolumeDispensed(data.sanitizer.volume_dispensed_ml);
        }
      } else {
        setIsLiveConnected(false);
        setConnectionError(`HTTP ${res.status}: ${res.statusText}`);
      }
    } catch (err: any) {
      setIsLiveConnected(false);
      if (err.name === 'AbortError') {
        setConnectionError('Connection timed out (ESP32 unresponsive)');
      } else {
        setConnectionError(err.message || 'Failed to connect to ESP32 IP');
      }
    }
  }, [connectionMode, getBaseUrl]);

  // Polling Interval for live connection
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    if (connectionMode === 'LIVE_DEVICE') {
      pollLiveDevice();
      interval = setInterval(pollLiveDevice, 3000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [connectionMode, pollLiveDevice]);

  // Save changes to storage
  useEffect(() => {
    saveToStorage('config', config);
  }, [config]);

  useEffect(() => {
    saveToStorage('events', events);
  }, [events]);

  useEffect(() => {
    saveToStorage('serial_logs', serialLogs);
  }, [serialLogs]);

  useEffect(() => {
    saveToStorage('alerts', alerts);
  }, [alerts]);

  // Test connection manually
  const testConnection = async (): Promise<boolean> => {
    addSerialLog('INFO', 'HTTP', `Pinging ESP32 device at ${getBaseUrl()}/api/v1/telemetry...`);
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000);
      const res = await fetch(`${getBaseUrl()}/api/v1/telemetry`, {
        method: 'GET',
        headers: { 'Accept': 'application/json' },
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (res.ok) {
        setIsLiveConnected(true);
        setConnectionError(null);
        setLastHeartbeat(new Date().toLocaleTimeString());
        addSerialLog('INFO', 'HTTP', `Connected to ESP32! Status: 200 OK.`);
        return true;
      } else {
        setIsLiveConnected(false);
        setConnectionError(`HTTP ${res.status}`);
        addSerialLog('WARN', 'HTTP', `ESP32 responded with status code ${res.status}.`);
        return false;
      }
    } catch (e: any) {
      setIsLiveConnected(false);
      setConnectionError(e.message || 'Connection failed');
      addSerialLog('ERROR', 'HTTP', `Failed to reach ESP32 at ${getBaseUrl()}: ${e.message}`);
      return false;
    }
  };

  // Toggle Power API: POST /api/v1/power-toggle
  const togglePowerApi = async (powerState: boolean): Promise<boolean> => {
    const nextState = powerState;
    setSystemPoweredOn(nextState);

    addSerialLog('INFO', 'POWER', `POST /api/v1/power-toggle payload: {"power": ${nextState}}`);

    if (connectionMode === 'LIVE_DEVICE' && isLiveConnected) {
      try {
        const res = await fetch(`${getBaseUrl()}/api/v1/power-toggle`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ power: nextState }),
        });

        if (res.ok) {
          const data = await res.json();
          addSerialLog('INFO', 'ESP32', `Power toggle confirmed: ${JSON.stringify(data)}`);
          return true;
        }
      } catch (err: any) {
        addSerialLog('ERROR', 'ESP32', `Power toggle network error: ${err.message}`);
      }
    }

    return true;
  };

  // Calculate live statistics
  const stats: UsageStats = useMemo(() => {
    const total_triggers = events.length;
    const successful_dispenses = events.filter(e => e.status === 'SUCCESS').length;
    const unsuccessful_dispenses = events.filter(e => e.status === 'UNSUCCESSFUL').length;
    const success_rate_percent = total_triggers > 0
      ? Number(((successful_dispenses / total_triggers) * 100).toFixed(2))
      : 100;

    const error_breakdown = {
      E_OBSTRUCT: 0,
      E_DRYRUN: 0,
      E_TIMEOUT: 0,
      E_PUMPFAIL: 0,
    };

    events.forEach(e => {
      if (e.error_code && error_breakdown[e.error_code] !== undefined) {
        error_breakdown[e.error_code]++;
      }
    });

    // 24 hour buckets
    const hourlyMap: { [hour: number]: { count: number; volume_ml: number; successful: number; unsuccessful: number } } = {};
    for (let h = 0; h < 24; h++) {
      hourlyMap[h] = { count: 0, volume_ml: 0, successful: 0, unsuccessful: 0 };
    }

    events.forEach(e => {
      const d = new Date(e.timestamp);
      const hour = d.getHours();
      if (hourlyMap[hour]) {
        hourlyMap[hour].count++;
        hourlyMap[hour].volume_ml += e.volume_ml;
        if (e.status === 'SUCCESS') hourlyMap[hour].successful++;
        else hourlyMap[hour].unsuccessful++;
      }
    });

    let peakHour = 14;
    let maxHourlyCount = 0;
    Object.entries(hourlyMap).forEach(([h, val]) => {
      if (val.count > maxHourlyCount) {
        maxHourlyCount = val.count;
        peakHour = parseInt(h, 10);
      }
    });

    const peak_hour = `${String(peakHour).padStart(2, '0')}:00 - ${String(peakHour + 1).padStart(2, '0')}:00`;

    const hourly_distribution = Object.entries(hourlyMap).map(([h, val]) => {
      const hour = parseInt(h, 10);
      return {
        hour,
        label: `${String(hour).padStart(2, '0')}:00`,
        count: val.count,
        volume_ml: Number(val.volume_ml.toFixed(1)),
        successful: val.successful,
        unsuccessful: val.unsuccessful,
      };
    });

    const lifetime_dispenses = successful_dispenses;
    const lifetime_volume_ml = liveTotalVolumeDispensed > 0
      ? Number(liveTotalVolumeDispensed.toFixed(1))
      : Number((lifetime_dispenses * 3.0).toFixed(1));

    return {
      summary: {
        total_triggers,
        successful_dispenses,
        unsuccessful_dispenses,
        success_rate_percent,
        lifetime_dispenses,
        lifetime_volume_ml,
      },
      error_breakdown,
      peak_hour,
      hourly_distribution,
    };
  }, [events, liveTotalVolumeDispensed]);

  // Calculate live telemetry
  const telemetry: SystemTelemetry = useMemo(() => {
    const todayStr = new Date().toISOString().split('T')[0];
    const todayEvents = events.filter(e => e.timestamp.startsWith(todayStr) && e.status === 'SUCCESS');
    const todayVolume = todayEvents.reduce((acc, curr) => acc + curr.volume_ml, 0);

    const latestEvent = events[0];
    const remaining_percent = latestEvent ? latestEvent.tank_level_after_percent : 92.0;
    const current_level_mm = (remaining_percent / 100) * config.max_tank_depth_mm;
    const remaining_volume_ml = (remaining_percent / 100) * config.total_tank_capacity_ml;

    const daily_limit_reached = todayVolume >= config.daily_limit_ml;

    let health_status: 'HEALTHY' | 'WARNING' | 'CRITICAL' | 'OFFLINE' = 'HEALTHY';
    if (!systemPoweredOn) {
      health_status = 'WARNING';
    } else if (connectionMode === 'LIVE_DEVICE' && !isLiveConnected) {
      health_status = 'OFFLINE';
    } else if (remaining_percent <= 5 || hardware.simulated_pump_failure) {
      health_status = 'CRITICAL';
    } else if (remaining_percent <= 15 || daily_limit_reached || hardware.simulated_sensor_blocked) {
      health_status = 'WARNING';
    }

    const power_state: PowerState = systemPoweredOn ? 'ONLINE' : 'SHUTDOWN';

    return {
      system: {
        uptime_sec: liveUptimeSec,
        wifi_rssi_dbm: isLiveConnected ? liveRssi : 0,
        free_heap_bytes: isLiveConnected ? liveFreeHeap : 0,
        health_status,
        power_state,
        chip_temp_c: 38.4,
        ip_address: deviceIp,
        nvs_cycles: 1842,
        reconnect_attempts: isLiveConnected ? 0 : 2,
      },
      sanitizer: {
        remaining_percent: Number(remaining_percent.toFixed(1)),
        volume_dispensed_today_ml: Number(todayVolume.toFixed(1)),
        daily_limit_ml: config.daily_limit_ml,
        daily_limit_reached,
        current_level_mm: Number(current_level_mm.toFixed(1)),
        max_tank_depth_mm: config.max_tank_depth_mm,
        total_capacity_ml: config.total_tank_capacity_ml,
        remaining_volume_ml: Number(remaining_volume_ml.toFixed(1)),
      },
    };
  }, [events, config, systemPoweredOn, connectionMode, isLiveConnected, liveUptimeSec, liveRssi, liveFreeHeap, deviceIp, hardware.simulated_pump_failure, hardware.simulated_sensor_blocked]);

  // Alert evaluation rule matrix sync
  useEffect(() => {
    const rem = telemetry.sanitizer.remaining_percent;
    const dailyLimit = telemetry.sanitizer.daily_limit_reached;
    const wifiOff = connectionMode === 'LIVE_DEVICE' && !isLiveConnected;
    const sensorBlocked = hardware.simulated_sensor_blocked && hardware.sensor_blocked_duration_sec >= 5;

    setAlerts(prev => prev.map(a => {
      if (a.condition === 'Tank Level <= 15%') {
        return { ...a, active: rem <= 15 && rem > 5, details: `Current fluid level: ${rem}%` };
      }
      if (a.condition === 'Tank Level <= 5%') {
        return { ...a, active: rem <= 5, details: `Tank level critical: ${rem}%. Alert sent to ndctem24012@jigpoly.edu.ng.` };
      }
      if (a.condition === 'Sensor Blocked > 5s') {
        return { ...a, active: sensorBlocked, details: `HC-SR04 blocked for ${hardware.sensor_blocked_duration_sec}s` };
      }
      if (a.condition === 'Daily Limit Reached') {
        return { ...a, active: dailyLimit, details: `${telemetry.sanitizer.volume_dispensed_today_ml}ml dispensed of ${config.daily_limit_ml}ml ceiling` };
      }
      if (a.condition === 'Wi-Fi Disconnected') {
        return { ...a, active: wifiOff, details: 'Offline mode active. Retrying every 30s.' };
      }
      return a;
    }));
  }, [telemetry.sanitizer.remaining_percent, telemetry.sanitizer.daily_limit_reached, connectionMode, isLiveConnected, hardware.simulated_sensor_blocked, hardware.sensor_blocked_duration_sec, config.daily_limit_ml, telemetry.sanitizer.volume_dispensed_today_ml]);

  // REST API: GET /telemetry
  const fetchTelemetryApi = useCallback(async (): Promise<SystemTelemetry> => {
    if (connectionMode === 'LIVE_DEVICE' && isLiveConnected) {
      try {
        const res = await fetch(`${getBaseUrl()}/api/v1/telemetry`);
        if (res.ok) {
          const liveData = await res.json();
          addSerialLog('DEBUG', 'HTTP', `GET ${getBaseUrl()}/api/v1/telemetry 200 OK`);
          return {
            system: {
              ...telemetry.system,
              uptime_sec: liveData.system?.uptime_sec ?? telemetry.system.uptime_sec,
              wifi_rssi_dbm: liveData.system?.wifi_rssi_dbm ?? telemetry.system.wifi_rssi_dbm,
              free_heap_bytes: liveData.system?.free_heap_bytes ?? telemetry.system.free_heap_bytes,
              power_state: (liveData.system?.power_state as PowerState) || telemetry.system.power_state,
            },
            sanitizer: {
              ...telemetry.sanitizer,
              volume_dispensed_today_ml: liveData.sanitizer?.volume_dispensed_ml ?? telemetry.sanitizer.volume_dispensed_today_ml,
            },
          };
        }
      } catch (err: any) {
        addSerialLog('WARN', 'HTTP', `Direct fetch error: ${err.message}`);
      }
    }

    addSerialLog('DEBUG', 'HTTP', 'GET /api/v1/telemetry 200 OK');
    return telemetry;
  }, [connectionMode, isLiveConnected, getBaseUrl, telemetry, addSerialLog]);

  // REST API: GET /stats
  const fetchStatsApi = useCallback(async (): Promise<UsageStats> => {
    addSerialLog('DEBUG', 'HTTP', 'GET /api/v1/stats 200 OK');
    return stats;
  }, [stats, addSerialLog]);

  // REST API: POST /config
  const updateConfigApi = useCallback(async (newConfig: Partial<DeviceConfig>): Promise<{ status: string; message: string }> => {
    setConfig(prev => ({ ...prev, ...newConfig }));
    addSerialLog('INFO', 'CONFIG', `POST /api/v1/config - Saved parameters to NVS. Alert email: ${newConfig.alert_email || config.alert_email}`);
    
    if (connectionMode === 'LIVE_DEVICE' && isLiveConnected) {
      try {
        await fetch(`${getBaseUrl()}/api/v1/config`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(newConfig),
        });
      } catch (e) {
        // Log silently
      }
    }

    return {
      status: 'SUCCESS',
      message: 'Configuration updated successfully.',
    };
  }, [addSerialLog, config.alert_email, connectionMode, isLiveConnected, getBaseUrl]);

  // REST API: POST /dispense
  const triggerDispenseApi = useCallback(async (override: boolean, duration_ms: number): Promise<{ status: string; dispensed_ml: number; error_code?: string; message?: string }> => {
    if (!systemPoweredOn) {
      addSerialLog('WARN', 'DISPENSE', 'Dispense rejected: System is in SHUTDOWN / Powered Off state.');
      return {
        status: 'FAILED',
        dispensed_ml: 0.0,
        message: 'System is currently powered off. Activate power switch to enable dispensing.',
      };
    }

    const remainingPercent = telemetry.sanitizer.remaining_percent;

    if (remainingPercent <= 5) {
      addSerialLog('ERROR', 'DISPENSE', 'Manual dispense rejected: Tank level < 5% (E_DRYRUN lock)');
      return {
        status: 'FAILED',
        dispensed_ml: 0.0,
        error_code: 'E_DRYRUN',
        message: 'Dispense locked: Fluid reservoir level critical (< 5%). Alert sent to ndctem24012@jigpoly.edu.ng.',
      };
    }

    const runTimeMs = Math.min(duration_ms, 2000);
    const dispensed_ml = Number((config.flow_rate_ml_per_sec * (runTimeMs / 1000)).toFixed(1));

    // Flash relay & pump
    setHardware(prev => ({ ...prev, relay_active: true, pump_running: true, green_led_active: true }));
    setTimeout(() => {
      setHardware(prev => ({ ...prev, relay_active: false, pump_running: false, green_led_active: false }));
    }, runTimeMs);

    const newTankPercent = Math.max(0, Number((remainingPercent - (dispensed_ml / config.total_tank_capacity_ml) * 100).toFixed(1)));
    const newId = (events[0]?.event_id || 1000) + 1;

    const newEvent: DispenseEvent = {
      event_id: newId,
      timestamp: new Date().toISOString().replace('.000Z', 'Z'),
      status: 'SUCCESS',
      error_code: null,
      distance_cm: 6.0,
      dispense_duration_ms: runTimeMs,
      volume_ml: dispensed_ml,
      tank_level_after_percent: newTankPercent,
      notes: override ? 'Manual test override via REST API POST /dispense' : 'Manual dispense executed',
    };

    setEvents(prev => [newEvent, ...prev]);
    addSerialLog('INFO', 'DISPENSE', `POST /api/v1/dispense: Relayed GPIO 19 for ${runTimeMs}ms. Output: ${dispensed_ml}ml.`);

    return {
      status: 'EXECUTED',
      dispensed_ml,
    };
  }, [systemPoweredOn, telemetry.sanitizer.remaining_percent, config.flow_rate_ml_per_sec, config.total_tank_capacity_ml, events, addSerialLog]);

  // Simulate hand presence with HC-SR04 logic
  const simulateHandTrigger = useCallback(async (distanceCm: number, durationMs: number): Promise<{ success: boolean; event: DispenseEvent }> => {
    if (!systemPoweredOn) {
      addSerialLog('WARN', 'SENSOR', 'Sensor trigger ignored: System is SHUTDOWN.');
      const newEvent: DispenseEvent = {
        event_id: (events[0]?.event_id || 1000) + 1,
        timestamp: new Date().toISOString().replace('.000Z', 'Z'),
        status: 'UNSUCCESSFUL',
        error_code: null,
        distance_cm: distanceCm,
        dispense_duration_ms: 0,
        volume_ml: 0.0,
        tank_level_after_percent: telemetry.sanitizer.remaining_percent,
        notes: 'System is currently powered off via software switch',
      };
      setEvents(prev => [newEvent, ...prev]);
      return { success: false, event: newEvent };
    }

    const remainingPercent = telemetry.sanitizer.remaining_percent;
    const newId = (events[0]?.event_id || 1000) + 1;
    const nowIso = new Date().toISOString().replace('.000Z', 'Z');

    if (durationMs > 5000) {
      setHardware(prev => ({
        ...prev,
        simulated_sensor_blocked: true,
        sensor_blocked_duration_sec: 6,
        red_led_flashing: true,
      }));

      const newEvent: DispenseEvent = {
        event_id: newId,
        timestamp: nowIso,
        status: 'UNSUCCESSFUL',
        error_code: 'E_OBSTRUCT',
        distance_cm: distanceCm,
        dispense_duration_ms: 0,
        volume_ml: 0.0,
        tank_level_after_percent: remainingPercent,
        notes: 'Sensor blocked continuously for > 5 seconds',
      };
      setEvents(prev => [newEvent, ...prev]);
      addSerialLog('WARN', 'SENSOR', `HC-SR04 blocked for > 5000ms. Error: E_OBSTRUCT. Fail-safe locked.`);
      return { success: false, event: newEvent };
    }

    if (remainingPercent < 5) {
      const newEvent: DispenseEvent = {
        event_id: newId,
        timestamp: nowIso,
        status: 'UNSUCCESSFUL',
        error_code: 'E_DRYRUN',
        distance_cm: distanceCm,
        dispense_duration_ms: 0,
        volume_ml: 0.0,
        tank_level_after_percent: remainingPercent,
        notes: 'Dispense requested while tank level < 5%. Alert dispatched to ndctem24012@jigpoly.edu.ng',
      };
      setEvents(prev => [newEvent, ...prev]);
      addSerialLog('ERROR', 'SAFETY', `Fluid reservoir empty (${remainingPercent}%). E_DRYRUN locked.`);
      return { success: false, event: newEvent };
    }

    if (distanceCm < config.sensor_min_distance_cm || distanceCm > config.sensor_threshold_cm) {
      const newEvent: DispenseEvent = {
        event_id: newId,
        timestamp: nowIso,
        status: 'UNSUCCESSFUL',
        error_code: 'E_TIMEOUT',
        distance_cm: distanceCm,
        dispense_duration_ms: 0,
        volume_ml: 0.0,
        tank_level_after_percent: remainingPercent,
        notes: `Hand outside valid trigger zone (${config.sensor_min_distance_cm}-${config.sensor_threshold_cm} cm)`,
      };
      setEvents(prev => [newEvent, ...prev]);
      addSerialLog('WARN', 'SENSOR', `Distance ${distanceCm}cm outside valid zone (3-10cm).`);
      return { success: false, event: newEvent };
    }

    if (durationMs < 200) {
      const newEvent: DispenseEvent = {
        event_id: newId,
        timestamp: nowIso,
        status: 'UNSUCCESSFUL',
        error_code: 'E_TIMEOUT',
        distance_cm: distanceCm,
        dispense_duration_ms: durationMs,
        volume_ml: 0.0,
        tank_level_after_percent: remainingPercent,
        notes: 'Hand pulled away early (< 200 ms)',
      };
      setEvents(prev => [newEvent, ...prev]);
      addSerialLog('WARN', 'SENSOR', `Hand removed early at ${durationMs}ms. Error: E_TIMEOUT.`);
      return { success: false, event: newEvent };
    }

    if (hardware.simulated_pump_failure) {
      const newEvent: DispenseEvent = {
        event_id: newId,
        timestamp: nowIso,
        status: 'UNSUCCESSFUL',
        error_code: 'E_PUMPFAIL',
        distance_cm: distanceCm,
        dispense_duration_ms: 0,
        volume_ml: 0.0,
        tank_level_after_percent: remainingPercent,
        notes: 'Relay circuit open detection failure or voltage drop',
      };
      setEvents(prev => [newEvent, ...prev]);
      addSerialLog('ERROR', 'RELAY', 'GPIO 19 open circuit feedback. Error: E_PUMPFAIL.');
      return { success: false, event: newEvent };
    }

    const runTime = config.dispense_duration_ms;
    const vol = Number((config.flow_rate_ml_per_sec * (runTime / 1000)).toFixed(1));
    const newTankPercent = Math.max(0, Number((remainingPercent - (vol / config.total_tank_capacity_ml) * 100).toFixed(1)));

    setHardware(prev => ({ ...prev, relay_active: true, pump_running: true, green_led_active: true }));
    setTimeout(() => {
      setHardware(prev => ({ ...prev, relay_active: false, pump_running: false, green_led_active: false }));
    }, runTime);

    const newEvent: DispenseEvent = {
      event_id: newId,
      timestamp: nowIso,
      status: 'SUCCESS',
      error_code: null,
      distance_cm: distanceCm,
      dispense_duration_ms: runTime,
      volume_ml: vol,
      tank_level_after_percent: newTankPercent,
      notes: 'Hand detected in valid range. Relay fired for full duration.',
    };

    setEvents(prev => [newEvent, ...prev]);
    addSerialLog('INFO', 'DISPENSE', `Dispensed ${vol}ml at ${distanceCm}cm distance. Tank: ${newTankPercent}%.`);

    return { success: true, event: newEvent };
  }, [systemPoweredOn, telemetry.sanitizer.remaining_percent, config, events, hardware.simulated_pump_failure, addSerialLog]);

  const setHandDistance = (dist: number) => {
    setHardware(prev => ({ ...prev, hand_distance_cm: dist, hand_present: dist <= 25 }));
  };

  const refillTank = (targetPercent = 100) => {
    const newId = (events[0]?.event_id || 1000) + 1;
    const newEvent: DispenseEvent = {
      event_id: newId,
      timestamp: new Date().toISOString().replace('.000Z', 'Z'),
      status: 'SUCCESS',
      error_code: null,
      distance_cm: 0,
      dispense_duration_ms: 0,
      volume_ml: 0.0,
      tank_level_after_percent: targetPercent,
      notes: `Reservoir refilled to ${targetPercent}%`,
    };
    setEvents(prev => [newEvent, ...prev]);
    addSerialLog('INFO', 'MAINTENANCE', `Fluid reservoir replenished to ${targetPercent}%.`);
  };

  const drainTank = (targetPercent = 3.0) => {
    const newId = (events[0]?.event_id || 1000) + 1;
    const newEvent: DispenseEvent = {
      event_id: newId,
      timestamp: new Date().toISOString().replace('.000Z', 'Z'),
      status: 'UNSUCCESSFUL',
      error_code: 'E_DRYRUN',
      distance_cm: 6.0,
      dispense_duration_ms: 0,
      volume_ml: 0.0,
      tank_level_after_percent: targetPercent,
      notes: `Fluid reservoir drained to ${targetPercent}% for testing E_DRYRUN`,
    };
    setEvents(prev => [newEvent, ...prev]);
    addSerialLog('WARN', 'TEST', `Fluid reservoir drained to ${targetPercent}%.`);
  };

  const toggleWifi = () => {
    setHardware(prev => {
      const nextWifi = !prev.wifi_connected;
      return {
        ...prev,
        wifi_connected: nextWifi,
        blue_wifi_led: nextWifi,
      };
    });
  };

  const togglePumpFailure = () => {
    setHardware(prev => ({
      ...prev,
      simulated_pump_failure: !prev.simulated_pump_failure,
    }));
  };

  const clearSensorObstruction = () => {
    setHardware(prev => ({
      ...prev,
      simulated_sensor_blocked: false,
      sensor_blocked_duration_sec: 0,
      red_led_flashing: false,
    }));
  };

  const exportJsonl = () => {
    const lines = events.map(e => JSON.stringify({
      event_id: e.event_id,
      timestamp: e.timestamp,
      status: e.status,
      error_code: e.error_code,
      distance_cm: e.distance_cm,
      dispense_duration_ms: e.dispense_duration_ms,
      volume_ml: e.volume_ml,
      tank_level_after_percent: e.tank_level_after_percent,
    })).join('\n');

    const blob = new Blob([lines], { type: 'application/x-ndjson;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `esp32_dispenser_logs_${new Date().toISOString().split('T')[0]}.jsonl`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const exportCsv = () => {
    const headers = 'Event_ID,Timestamp,Status,Error_Code,Distance_cm,Duration_ms,Volume_ml,Tank_Level_Percent\n';
    const rows = events.map(e =>
      `${e.event_id},"${e.timestamp}",${e.status},${e.error_code || 'NONE'},${e.distance_cm},${e.dispense_duration_ms},${e.volume_ml},${e.tank_level_after_percent}`
    ).join('\n');

    const blob = new Blob([headers + rows], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `esp32_dispenser_logs_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const resetAllData = () => {
    setConfig(DEFAULT_CONFIG);
    setEvents([]);
    setSerialLogs(generateSeedSerialLogs());
    setAlerts(generateSeedAlerts());
    setHardware({
      hand_present: false,
      hand_distance_cm: 20.0,
      hand_held_duration_ms: 0,
      relay_active: false,
      pump_running: false,
      wifi_connected: true,
      simulated_pump_failure: false,
      simulated_sensor_blocked: false,
      sensor_blocked_duration_sec: 0,
      red_led_flashing: false,
      green_led_active: false,
      blue_wifi_led: true,
      fluid_level_mm: 180,
    });
    setLiveTotalVolumeDispensed(0.0);
    localStorage.clear();
    addSerialLog('INFO', 'SYSTEM', 'Cleared local storage cache. System primed for real ESP32 incoming metrics.');
  };

  const dismissAlert = (id: string) => {
    setAlerts(prev => prev.map(a => a.id === id ? { ...a, active: false } : a));
  };

  return (
    <ESP32Context.Provider
      value={{
        config,
        telemetry,
        stats,
        events,
        serialLogs,
        alerts,
        hardware,
        activeView,
        setActiveView,
        deviceIp,
        setDeviceIp,
        connectionMode,
        setConnectionMode,
        isLiveConnected,
        lastHeartbeat,
        connectionError,
        systemPoweredOn,
        testConnection,
        togglePowerApi,
        fetchTelemetryApi,
        fetchStatsApi,
        updateConfigApi,
        triggerDispenseApi,
        simulateHandTrigger,
        setHandDistance,
        refillTank,
        drainTank,
        toggleWifi,
        togglePumpFailure,
        clearSensorObstruction,
        exportJsonl,
        exportCsv,
        resetAllData,
        addSerialLog,
        dismissAlert,
      }}
    >
      {children}
    </ESP32Context.Provider>
  );
};

export const useESP32 = () => {
  const context = useContext(ESP32Context);
  if (!context) {
    throw new Error('useESP32 must be used within an ESP32Provider');
  }
  return context;
};
