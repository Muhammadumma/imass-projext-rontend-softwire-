/**
 * Types and interfaces for the Smart Hand Sanitizer Monitoring & Control System
 * Based on SRS Blueprint specifications and ESP32 Firmware Integration
 */

export type HealthStatus = 'HEALTHY' | 'WARNING' | 'CRITICAL' | 'OFFLINE';

export type ErrorCode = 'E_OBSTRUCT' | 'E_DRYRUN' | 'E_TIMEOUT' | 'E_PUMPFAIL' | null;

export type PowerState = 'ONLINE' | 'SHUTDOWN';

export interface DispenseEvent {
  event_id: number;
  timestamp: string; // ISO 8601 YYYY-MM-DDTHH:MM:SSZ
  status: 'SUCCESS' | 'UNSUCCESSFUL';
  error_code: ErrorCode;
  distance_cm: number;
  dispense_duration_ms: number;
  volume_ml: number;
  tank_level_after_percent: number;
  notes?: string;
}

export interface SystemTelemetry {
  system: {
    uptime_sec: number;
    wifi_rssi_dbm: number;
    free_heap_bytes: number;
    health_status: HealthStatus;
    power_state: PowerState;
    chip_temp_c?: number;
    ip_address?: string;
    nvs_cycles?: number;
    reconnect_attempts?: number;
  };
  sanitizer: {
    remaining_percent: number;
    volume_dispensed_today_ml: number;
    daily_limit_ml: number;
    daily_limit_reached: boolean;
    current_level_mm?: number;
    max_tank_depth_mm?: number;
    total_capacity_ml?: number;
    remaining_volume_ml?: number;
  };
}

export interface UsageStats {
  summary: {
    total_triggers: number;
    successful_dispenses: number;
    unsuccessful_dispenses: number;
    success_rate_percent: number;
    lifetime_dispenses: number;
    lifetime_volume_ml: number;
  };
  error_breakdown: {
    E_OBSTRUCT: number;
    E_DRYRUN: number;
    E_TIMEOUT: number;
    E_PUMPFAIL: number;
  };
  peak_hour: string;
  hourly_distribution: Array<{
    hour: number;
    label: string;
    count: number;
    volume_ml: number;
    successful: number;
    unsuccessful: number;
  }>;
}

export interface DeviceConfig {
  dispense_duration_ms: number; // default: 800 ms
  sensor_threshold_cm: number; // default: 10.0 cm
  sensor_min_distance_cm: number; // default: 3.0 cm
  daily_limit_ml: number; // default: 1500.0 ml
  per_user_limit_ml: number; // default: 3.0 ml
  flow_rate_ml_per_sec: number; // pump calibration: default 3.75 ml/s
  alert_email: string; // default: ndctem24012@jigpoly.edu.ng
  telegram_webhook_url: string;
  fail_safe_enabled: boolean;
  max_tank_depth_mm: number;
  total_tank_capacity_ml: number;
}

export interface SerialLog {
  id: string;
  timestamp: string;
  level: 'INFO' | 'WARN' | 'ERROR' | 'DEBUG';
  tag: string;
  message: string;
}

export interface AlertNotification {
  id: string;
  timestamp: string;
  priority: 'NOTICE' | 'WARNING' | 'CRITICAL' | 'ERROR';
  condition: string;
  action_taken: string;
  channel: 'Web UI Badge' | 'Webhook / Email' | 'Dashboard Toast' | 'Telegram / Web UI' | 'Local LED Status';
  active: boolean;
  details?: string;
}

export interface HardwareState {
  hand_present: boolean;
  hand_distance_cm: number;
  hand_held_duration_ms: number;
  relay_active: boolean;
  pump_running: boolean;
  wifi_connected: boolean;
  simulated_pump_failure: boolean;
  simulated_sensor_blocked: boolean;
  sensor_blocked_duration_sec: number;
  red_led_flashing: boolean;
  green_led_active: boolean;
  blue_wifi_led: boolean;
  fluid_level_mm: number;
}
