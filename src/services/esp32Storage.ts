import { DeviceConfig, DispenseEvent, SerialLog, AlertNotification } from '../types/iot';

const STORAGE_KEY_PREFIX = 'esp32_sanitizer_';

export const DEFAULT_CONFIG: DeviceConfig = {
  dispense_duration_ms: 800,
  sensor_threshold_cm: 10.0,
  sensor_min_distance_cm: 3.0,
  daily_limit_ml: 1500.0,
  per_user_limit_ml: 3.0,
  flow_rate_ml_per_sec: 3.75, // 3.75 ml/s * 0.8s = 3.0 ml
  alert_email: 'ndctem24012@jigpoly.edu.ng',
  telegram_webhook_url: 'https://api.telegram.org/bot123456:ABC-DEF/sendMessage',
  fail_safe_enabled: true,
  max_tank_depth_mm: 200,
  total_tank_capacity_ml: 2500,
};

// Clean initial empty state for live device operation
export function generateSeedEvents(): DispenseEvent[] {
  // Returns empty initial events ready for live incoming telemetry from ESP32
  return [];
}

export function generateSeedSerialLogs(): SerialLog[] {
  const d = new Date();
  const timeStr = d.toTimeString().split(' ')[0];
  return [
    {
      id: 'log-boot-1',
      timestamp: timeStr,
      level: 'INFO',
      tag: 'SYSTEM',
      message: 'Dashboard initialized in Live External Connection mode. Ready to bind with ESP32 REST server.',
    },
    {
      id: 'log-boot-2',
      timestamp: timeStr,
      level: 'INFO',
      tag: 'EMAIL',
      message: 'Configured automated alert recipient: ndctem24012@jigpoly.edu.ng (Jigawa State Polytechnic).',
    },
    {
      id: 'log-boot-3',
      timestamp: timeStr,
      level: 'INFO',
      tag: 'NETWORK',
      message: 'Listening for live HTTP telemetry at configured ESP32 device endpoint (/api/v1/telemetry).',
    },
  ];
}

export function generateSeedAlerts(): AlertNotification[] {
  const now = new Date();
  return [
    {
      id: 'alert-1',
      timestamp: now.toISOString(),
      priority: 'WARNING',
      condition: 'Tank Level <= 15%',
      action_taken: 'Light dashboard alert active; keep system operational',
      channel: 'Web UI Badge',
      active: false,
      details: 'Nominal',
    },
    {
      id: 'alert-2',
      timestamp: now.toISOString(),
      priority: 'CRITICAL',
      condition: 'Tank Level <= 5%',
      action_taken: 'Lock pump execution (E_DRYRUN); dispatch SMTP alert to ndctem24012@jigpoly.edu.ng',
      channel: 'Webhook / Email',
      active: false,
      details: 'Safety relay lock ready',
    },
    {
      id: 'alert-3',
      timestamp: now.toISOString(),
      priority: 'ERROR',
      condition: 'Sensor Blocked > 5s',
      action_taken: 'Temporary sensor lockout; mark E_OBSTRUCT',
      channel: 'Dashboard Toast',
      active: false,
      details: 'Fail-safe timeout active on GPIO 18',
    },
    {
      id: 'alert-4',
      timestamp: now.toISOString(),
      priority: 'NOTICE',
      condition: 'Daily Limit Reached',
      action_taken: 'Log state; trigger daily usage flag to facility managers',
      channel: 'Telegram / Web UI',
      active: false,
      details: '0.0 ml dispensed today of 1500.0 ml ceiling',
    },
    {
      id: 'alert-5',
      timestamp: now.toISOString(),
      priority: 'WARNING',
      condition: 'Wi-Fi Disconnected',
      action_taken: 'Fallback to offline relay execution; retry Wi-Fi every 30s',
      channel: 'Local LED Status',
      active: false,
      details: 'WLAN link status monitor',
    },
  ];
}

// LocalStorage helpers
export function loadFromStorage<T>(key: string, fallback: T): T {
  try {
    const item = localStorage.getItem(STORAGE_KEY_PREFIX + key);
    if (!item) return fallback;
    return JSON.parse(item);
  } catch {
    return fallback;
  }
}

export function saveToStorage<T>(key: string, value: T): void {
  try {
    localStorage.setItem(STORAGE_KEY_PREFIX + key, JSON.stringify(value));
  } catch (e) {
    console.error('Failed to save to localStorage:', e);
  }
}
