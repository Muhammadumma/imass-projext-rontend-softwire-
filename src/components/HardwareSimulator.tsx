import React, { useState } from 'react';
import { useESP32 } from '../context/ESP32Context';
import {
  Cpu,
  Droplets,
  Play,
  Copy,
  Check,
  Download,
  Power,
  Mail,
  Terminal,
  Hand,
  CheckCircle,
  FileCode,
  Sparkles,
} from 'lucide-react';

// The Compulsory Complete Single-File C/C++ Firmware Code for ESP32
export const COMPLETE_SINGLE_FILE_ESP32_CODE = `/*
 * ======================================================================================
 * SMART HAND SANITIZER MONITORING & CONTROL SYSTEM
 * Single-File Production Firmware for ESP32
 *
 * Sender Email:    idrisalhajisunusi3@gmail.com
 * SMTP Password:   sundimina
 * Alert Recipient: ndctem24012@jigpoly.edu.ng (Jigawa State Polytechnic)
 *
 * Required Arduino IDE Libraries (Install via Library Manager):
 *   1. ESPAsyncWebServer (by me-no-dev / mathieucarbou)
 *   2. AsyncTCP (by me-no-dev / mathieucarbou)
 *   3. ArduinoJson (v6.x by Benoit Blanchon)
 *   4. ESP_Mail_Client (by Mobizt)
 * ======================================================================================
 */

#include <WiFi.h>
#include <ESPAsyncWebServer.h>
#include <ArduinoJson.h>
#include <Preferences.h>
#include <ESP_Mail_Client.h>

// --------------------------------------------------------------------------------------
// 1. HARDWARE PIN DEFINITIONS
// --------------------------------------------------------------------------------------
#define TRIG_PIN       5    // HC-SR04 Ultrasonic Trigger Pin (GPIO 5)
#define ECHO_PIN       18   // HC-SR04 Ultrasonic Echo Pin (GPIO 18)
#define RELAY_PIN      19   // Mini DC Water/Sanitizer Pump Relay (GPIO 19)
#define WATER_SENS_PIN 34   // Fluid Level Sensor ADC Pin (GPIO 34)

// --------------------------------------------------------------------------------------
// 2. SYSTEM DISPENSING & FLOW CALIBRATION
// --------------------------------------------------------------------------------------
#define DEFAULT_FLOW_RATE_ML_PER_SEC 3.75   // Flow rate: 3.75 ml/sec
#define DEFAULT_DISPENSE_TIME_MS     800    // Run time: 800ms -> ~3.0ml dispense
#define DEFAULT_DAILY_LIMIT_ML       1500.0 // Soft daily threshold
#define SENSOR_MIN_DIST_CM           3.0    // Minimum trigger distance (3.0 cm)
#define SENSOR_MAX_DIST_CM           10.0   // Maximum trigger distance (10.0 cm)
#define DEBOUNCE_DELAY_MS            1500   // Lockout interval between consecutive triggers

// --------------------------------------------------------------------------------------
// 3. WI-FI & SMTP NOTIFICATION CREDENTIALS
// --------------------------------------------------------------------------------------
const char* ssid     = "YOUR_WIFI_SSID";     // <-- Replace with your Wi-Fi name
const char* password = "YOUR_WIFI_PASSWORD"; // <-- Replace with your Wi-Fi password

#define SMTP_HOST      "smtp.gmail.com"
#define SMTP_PORT      465
#define SENDER_EMAIL   "idrisalhajisunusi3@gmail.com"
#define SENDER_PASS    "sundimina"
#define ALERT_EMAIL_TO "ndctem24012@jigpoly.edu.ng"

// --------------------------------------------------------------------------------------
// 4. GLOBAL OBJECTS & STATE VARIABLES
// --------------------------------------------------------------------------------------
AsyncWebServer server(80);
Preferences    prefs;
SMTPSession    smtpSession;

uint32_t totalTriggers         = 0;
uint32_t successfulDispenses   = 0;
uint32_t unsuccessfulDispenses = 0;
float    cumulativeVolumeMl    = 0.0;
bool     systemPoweredOn       = true; // Remote software power switch (ON/OFF)

unsigned long lastTriggerTime  = 0;
bool          startupEmailSent = false;

// --------------------------------------------------------------------------------------
// 5. HELPER: DISPATCH SMTP ALERT EMAIL
// --------------------------------------------------------------------------------------
void sendAlertEmail(String subject, String bodyMessage) {
    Serial.println("[SMTP] Preparing email dispatch to: " + String(ALERT_EMAIL_TO));

    Session_Config config;
    config.server.host_name = SMTP_HOST;
    config.server.port      = SMTP_PORT;
    config.login.email      = SENDER_EMAIL;
    config.login.password   = SENDER_PASS;
    config.login.user_domain = F("127.0.0.1");

    SMTP_Message message;
    message.sender.name  = F("Smart Hand Sanitizer Guard");
    message.sender.email = SENDER_EMAIL;
    message.subject      = subject;
    message.addRecipient(F("Jigawa Poly Admin"), ALERT_EMAIL_TO);
    message.text.content = bodyMessage.c_str();
    message.priority     = esp_mail_smtp_priority::esp_mail_smtp_priority_high;

    if (!smtpSession.connect(&config)) {
        Serial.println("[SMTP ERROR] Could not connect to mail server.");
        return;
    }

    if (!MailClient.sendMail(&smtpSession, &message)) {
        Serial.println("[SMTP ERROR] Sending failed: " + smtpSession.errorReason());
    } else {
        Serial.println("[SMTP SUCCESS] Alert successfully sent to " + String(ALERT_EMAIL_TO));
    }

    smtpSession.closeSession();
}

// --------------------------------------------------------------------------------------
// 6. HELPER: ULTRASONIC DISTANCE MEASUREMENT (HC-SR04)
// --------------------------------------------------------------------------------------
float getUltrasonicDistance() {
    digitalWrite(TRIG_PIN, LOW);
    delayMicroseconds(2);
    digitalWrite(TRIG_PIN, HIGH);
    delayMicroseconds(10);
    digitalWrite(TRIG_PIN, LOW);

    // Timeout at 26ms (~4.5 meters max range)
    long duration = pulseIn(ECHO_PIN, HIGH, 26000);
    if (duration == 0) return 999.0; // Out of range or sensor timeout

    // Sound speed in air: ~0.0343 cm/microsecond
    return (duration * 0.0343) / 2.0;
}

// --------------------------------------------------------------------------------------
// 7. HELPER: UPDATE FLASH PREFERENCES (NVS)
// --------------------------------------------------------------------------------------
void recordDispense(bool success, float volumeMl) {
    totalTriggers++;
    if (success) {
        successfulDispenses++;
        cumulativeVolumeMl += volumeMl;
    } else {
        unsuccessfulDispenses++;
    }

    prefs.putUInt("triggers", totalTriggers);
    prefs.putUInt("success", successfulDispenses);
    prefs.putUInt("fail", unsuccessfulDispenses);
    prefs.putFloat("volume", cumulativeVolumeMl);
}

// --------------------------------------------------------------------------------------
// 8. REST API INITIALIZATION (CORS ENABLED FOR WEB DASHBOARD)
// --------------------------------------------------------------------------------------
void setupApiServer() {
    // Enable Cross-Origin Resource Sharing (CORS) so browser dashboard can connect
    DefaultHeaders::Instance().addHeader("Access-Control-Allow-Origin", "*");
    DefaultHeaders::Instance().addHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    DefaultHeaders::Instance().addHeader("Access-Control-Allow-Headers", "Content-Type");

    // OPTIONS preflight handler
    server.onNotFound([](AsyncWebServerRequest *request) {
        if (request->method() == HTTP_OPTIONS) {
            request->send(200);
        } else {
            request->send(404, "application/json", "{\\"error\\":\\"Endpoint not found\\"}");
        }
    });

    // 1. GET /api/v1/telemetry
    server.on("/api/v1/telemetry", HTTP_GET, [](AsyncWebServerRequest *request) {
        DynamicJsonDocument doc(512);

        doc["system"]["uptime_sec"]      = millis() / 1000;
        doc["system"]["wifi_rssi_dbm"]   = WiFi.RSSI();
        doc["system"]["free_heap_bytes"] = ESP.getFreeHeap();
        doc["system"]["power_state"]     = systemPoweredOn ? "ONLINE" : "SHUTDOWN";
        doc["system"]["ip_address"]      = WiFi.localIP().toString();

        doc["sanitizer"]["volume_dispensed_ml"]   = cumulativeVolumeMl;
        doc["sanitizer"]["successful_dispenses"] = successfulDispenses;
        doc["sanitizer"]["total_triggers"]       = totalTriggers;

        String response;
        serializeJson(doc, response);
        request->send(200, "application/json", response);
    });

    // 2. GET /api/v1/stats
    server.on("/api/v1/stats", HTTP_GET, [](AsyncWebServerRequest *request) {
        DynamicJsonDocument doc(512);

        float successRate = totalTriggers > 0 ? ((float)successfulDispenses / totalTriggers) * 100.0 : 100.0;
        doc["summary"]["total_triggers"]       = totalTriggers;
        doc["summary"]["successful_dispenses"] = successfulDispenses;
        doc["summary"]["unsuccessful_dispenses"] = unsuccessfulDispenses;
        doc["summary"]["success_rate_percent"] = successRate;
        doc["summary"]["cumulative_volume_ml"] = cumulativeVolumeMl;

        String response;
        serializeJson(doc, response);
        request->send(200, "application/json", response);
    });

    // 3. POST /api/v1/power-toggle (Remotely power ON or SHUTDOWN system)
    server.on("/api/v1/power-toggle", HTTP_POST, [](AsyncWebServerRequest *request){}, NULL,
        [](AsyncWebServerRequest *request, uint8_t *data, size_t len, size_t index, size_t total) {
            DynamicJsonDocument doc(256);
            DeserializationError err = deserializeJson(doc, data);

            if (err) {
                request->send(400, "application/json", "{\\"error\\":\\"Invalid JSON\\"}");
                return;
            }

            systemPoweredOn = doc["power"]; // true = ON, false = OFF
            prefs.putBool("power", systemPoweredOn);

            if (!systemPoweredOn) {
                digitalWrite(RELAY_PIN, LOW); // Instantly de-energize pump relay
            }

            Serial.println("[POWER COMMAND] System Power set to: " + String(systemPoweredOn ? "ACTIVE" : "SHUTDOWN"));

            request->send(200, "application/json", systemPoweredOn ?
                "{\\"status\\":\\"SYSTEM_ACTIVATED\\",\\"power\\":true}" :
                "{\\"status\\":\\"SYSTEM_DEACTIVATED\\",\\"power\\":false}");
    });

    // 4. POST /api/v1/dispense (Manual pump relay test command)
    server.on("/api/v1/dispense", HTTP_POST, [](AsyncWebServerRequest *request){}, NULL,
        [](AsyncWebServerRequest *request, uint8_t *data, size_t len, size_t index, size_t total) {
            if (!systemPoweredOn) {
                request->send(403, "application/json", "{\\"status\\":\\"FAILED\\",\\"message\\":\\"System is powered off\\"}");
                return;
            }

            DynamicJsonDocument doc(256);
            deserializeJson(doc, data);
            int durationMs = doc["duration_ms"] | DEFAULT_DISPENSE_TIME_MS;
            if (durationMs > 2500) durationMs = 2500; // Safety clamp

            digitalWrite(RELAY_PIN, HIGH);
            delay(durationMs);
            digitalWrite(RELAY_PIN, LOW);

            float dispensedMl = (durationMs / 1000.0) * DEFAULT_FLOW_RATE_ML_PER_SEC;
            recordDispense(true, dispensedMl);

            request->send(200, "application/json", "{\\"status\\":\\"EXECUTED\\",\\"dispensed_ml\\":" + String(dispensedMl) + "}");
    });

    server.begin();
    Serial.println("[HTTP SERVER] REST API listening on port 80");
}

// --------------------------------------------------------------------------------------
// 9. SETUP FUNCTION
// --------------------------------------------------------------------------------------
void setup() {
    Serial.begin(115200);
    delay(200);
    Serial.println("\\n==================================================");
    Serial.println(" SMART HAND SANITIZER - JIGAWA STATE POLYTECHNIC ");
    Serial.println("==================================================");

    // Configure Pin Modes
    pinMode(TRIG_PIN, OUTPUT);
    pinMode(ECHO_PIN, INPUT);
    pinMode(RELAY_PIN, OUTPUT);
    pinMode(WATER_SENS_PIN, INPUT);

    digitalWrite(RELAY_PIN, LOW); // Relay off initially

    // Initialize Non-Volatile Storage (Preferences / NVS)
    prefs.begin("sanitizer", false);
    totalTriggers         = prefs.getUInt("triggers", 0);
    successfulDispenses   = prefs.getUInt("success", 0);
    unsuccessfulDispenses = prefs.getUInt("fail", 0);
    cumulativeVolumeMl    = prefs.getFloat("volume", 0.0);
    systemPoweredOn       = prefs.getBool("power", true);

    Serial.println("[NVS] Loaded cumulative volume: " + String(cumulativeVolumeMl) + " ml");
    Serial.println("[NVS] System Initial Power State: " + String(systemPoweredOn ? "ON" : "OFF"));

    // Connect to Wi-Fi
    Serial.print("[WIFI] Connecting to SSID: ");
    Serial.println(ssid);
    WiFi.mode(WIFI_STA);
    WiFi.begin(ssid, password);

    int wifiRetry = 0;
    while (WiFi.status() != WL_CONNECTED && wifiRetry < 30) {
        delay(500);
        Serial.print(".");
        wifiRetry++;
    }

    if (WiFi.status() == WL_CONNECTED) {
        Serial.println("\\n[WIFI SUCCESS] Connected! IP Address: " + WiFi.localIP().toString());
        Serial.println("[WIFI RSSI] " + String(WiFi.RSSI()) + " dBm");
    } else {
        Serial.println("\\n[WIFI WARNING] Wi-Fi connection timed out. Dispenser running in offline relay mode.");
    }

    // Launch Async REST API
    setupApiServer();

    // Send Boot Notification Email
    if (WiFi.status() == WL_CONNECTED) {
        String bootMsg = "Smart Hand Sanitizer Controller has booted successfully.\\n\\n"
                         "Assigned IP Address: " + WiFi.localIP().toString() + "\\n"
                         "Wi-Fi Signal: " + String(WiFi.RSSI()) + " dBm\\n"
                         "Cumulative Dispensed: " + String(cumulativeVolumeMl) + " ml\\n"
                         "System Status: " + String(systemPoweredOn ? "ACTIVE" : "SHUTDOWN") + "\\n\\n"
                         "Facility: Jigawa State Polytechnic";

        sendAlertEmail("[STARTUP NOTICE] Smart Sanitizer Online", bootMsg);
    }
}

// --------------------------------------------------------------------------------------
// 10. MAIN SYSTEM LOOP
// --------------------------------------------------------------------------------------
void loop() {
    // 1. Check if dispenser is shut down via remote software switch
    if (!systemPoweredOn) {
        digitalWrite(RELAY_PIN, LOW); // Force relay off
        delay(200);
        return;
    }

    // 2. Poll Ultrasonic HC-SR04 Sensor
    float distance = getUltrasonicDistance();

    // 3. Evaluate Hand Detection (Valid window: 3.0 cm <= d <= 10.0 cm)
    if (distance >= SENSOR_MIN_DIST_CM && distance <= SENSOR_MAX_DIST_CM) {
        // Enforce debouncing delay to prevent multiple accidental dispenses
        if (millis() - lastTriggerTime > DEBOUNCE_DELAY_MS) {
            lastTriggerTime = millis();

            Serial.println("[DISPENSE TRIGGER] Hand detected at " + String(distance, 1) + " cm. Firing pump relay.");

            // Energize Relay (Pump ON)
            digitalWrite(RELAY_PIN, HIGH);
            delay(DEFAULT_DISPENSE_TIME_MS);
            digitalWrite(RELAY_PIN, LOW);

            // Compute dispensed volume (V = Q * t)
            float dispensedMl = (DEFAULT_DISPENSE_TIME_MS / 1000.0) * DEFAULT_FLOW_RATE_ML_PER_SEC;
            recordDispense(true, dispensedMl);

            Serial.println("[DISPENSE COMPLETE] Volume: " + String(dispensedMl, 1) + " ml. Total: " + String(cumulativeVolumeMl, 1) + " ml");

            // Check if soft daily ceiling reached (e.g. 1500 ml)
            if (cumulativeVolumeMl >= DEFAULT_DAILY_LIMIT_ML && !startupEmailSent) {
                startupEmailSent = true;
                sendAlertEmail("[USAGE NOTICE] Daily Sanitizer Threshold Reached",
                               "Notice: Cumulative volume has reached " + String(cumulativeVolumeMl) + " ml. Please inspect reservoir levels.");
            }
        }
    }

    delay(50); // Stabilizing loop delay
}
`;

export const HardwareSimulator: React.FC = () => {
  const {
    hardware,
    telemetry,
    config,
    simulateHandTrigger,
    setHandDistance,
    systemPoweredOn,
    togglePowerApi,
    refillTank,
    drainTank,
  } = useESP32();

  const [interactiveDistance, setInteractiveDistance] = useState<number>(6.5);
  const [copiedCode, setCopiedCode] = useState<boolean>(false);
  const [lastActionResult, setLastActionResult] = useState<{
    success: boolean;
    message: string;
    code?: string;
  } | null>(null);

  const handleCopyCode = () => {
    navigator.clipboard.writeText(COMPLETE_SINGLE_FILE_ESP32_CODE);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2500);
  };

  const handleDownloadCode = () => {
    const blob = new Blob([COMPLETE_SINGLE_FILE_ESP32_CODE], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'SmartSanitizer.ino';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleDistanceChange = (dist: number) => {
    setInteractiveDistance(dist);
    setHandDistance(dist);
  };

  const triggerNormalSuccess = async () => {
    setInteractiveDistance(6.4);
    setLastActionResult(null);
    const res = await simulateHandTrigger(6.4, 800);
    setLastActionResult({
      success: res.success,
      message: res.success
        ? `Dispensed ${res.event.volume_ml} ml in 800ms. Relay GPIO 19 activated.`
        : `Unsuccessful: ${res.event.notes || res.event.error_code}`,
      code: res.event.error_code || undefined,
    });
  };

  const isValidZone =
    interactiveDistance >= config.sensor_min_distance_cm &&
    interactiveDistance <= config.sensor_threshold_cm;
  const isTooClose = interactiveDistance < config.sensor_min_distance_cm;

  const remainingPercent = telemetry.sanitizer.remaining_percent;

  return (
    <div className="space-y-6">
      {/* Test Bench Header */}
      <div className="bg-slate-900/90 rounded-xl border border-slate-800 p-5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <Cpu className="w-5 h-5 text-teal-400" />
              <h2 className="text-base font-bold text-white tracking-tight">
                Single-File ESP32 C/C++ Firmware & Hardware Bench
              </h2>
              <span className="text-xs font-mono text-teal-400 bg-teal-950/60 border border-teal-800/60 px-2 py-0.5 rounded">
                SmartSanitizer.ino
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Complete all-in-one code ready to flash via Arduino IDE. Configured with sender <strong className="text-teal-300 font-mono">idrisalhajisunusi3@gmail.com</strong> alerting <strong className="text-teal-300 font-mono">ndctem24012@jigpoly.edu.ng</strong>.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => togglePowerApi(!systemPoweredOn)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold font-mono border transition-colors ${
                systemPoweredOn
                  ? 'bg-emerald-950/80 border-emerald-700 text-emerald-300'
                  : 'bg-rose-950/80 border-rose-700 text-rose-300'
              }`}
            >
              <Power className="w-3.5 h-3.5" />
              <span>POWER: {systemPoweredOn ? 'ON' : 'OFF'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* COMPULSORY SINGLE-FILE C/C++ CODE SECTION */}
      <div className="bg-slate-900/95 rounded-xl border-2 border-teal-500/50 p-5 shadow-2xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <div>
            <div className="flex items-center gap-2">
              <FileCode className="w-5 h-5 text-teal-400" />
              <h3 className="text-base font-bold text-white tracking-tight">
                Complete Single-File Arduino Code (<code className="text-teal-300">SmartSanitizer.ino</code>)
              </h3>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              100% self-contained code. Includes REST API server, flash storage, ultrasonic debouncing, and direct SMTP notifications.
            </p>
          </div>

          {/* Primary Action Buttons */}
          <div className="flex items-center gap-2.5">
            <button
              onClick={handleCopyCode}
              className="flex items-center gap-2 px-4 py-2 bg-teal-500 hover:bg-teal-400 text-slate-950 rounded-xl text-xs font-bold transition-all shadow-md shadow-teal-500/20 active:scale-95"
            >
              {copiedCode ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              <span>{copiedCode ? 'COPIED TO CLIPBOARD!' : 'COPY ENTIRE CODE'}</span>
            </button>

            <button
              onClick={handleDownloadCode}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-medium border border-slate-700 transition-colors"
            >
              <Download className="w-4 h-4" />
              <span>Download .ino</span>
            </button>
          </div>
        </div>

        {/* Credentials summary banner */}
        <div className="mb-3 grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs font-mono">
          <div className="p-2.5 bg-slate-950 rounded-lg border border-slate-800">
            <span className="text-slate-500 block text-[10px]">SENDER GMAIL</span>
            <span className="text-teal-300 font-semibold truncate block">idrisalhajisunusi3@gmail.com</span>
          </div>

          <div className="p-2.5 bg-slate-950 rounded-lg border border-slate-800">
            <span className="text-slate-500 block text-[10px]">SMTP APP PASSWORD</span>
            <span className="text-amber-300 font-semibold block">sundimina</span>
          </div>

          <div className="p-2.5 bg-slate-950 rounded-lg border border-slate-800">
            <span className="text-slate-500 block text-[10px]">ALERT RECIPIENT</span>
            <span className="text-emerald-300 font-semibold truncate block">ndctem24012@jigpoly.edu.ng</span>
          </div>
        </div>

        {/* Single-File Code Display */}
        <div className="relative bg-slate-950 rounded-xl border border-slate-800 overflow-hidden">
          <div className="bg-slate-900/90 px-4 py-2 border-b border-slate-800 flex items-center justify-between text-xs text-slate-400 font-mono">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 inline-block" />
              <span className="text-slate-200 font-semibold">SmartSanitizer.ino (Single File)</span>
            </div>
            <span>340 Lines · C/C++</span>
          </div>

          <pre className="p-4 text-xs font-mono text-slate-200 overflow-x-auto max-h-[460px] leading-relaxed selection:bg-teal-500/30">
            {COMPLETE_SINGLE_FILE_ESP32_CODE}
          </pre>
        </div>

        {/* Arduino IDE Quick Setup Instructions */}
        <div className="mt-4 p-3.5 bg-slate-950/80 rounded-xl border border-slate-800 text-xs text-slate-400 space-y-2">
          <div className="font-semibold text-slate-200 flex items-center gap-1.5">
            <Terminal className="w-4 h-4 text-teal-400" />
            <span>Steps to Flash onto your ESP32 in Arduino IDE:</span>
          </div>
          <ol className="list-decimal list-inside space-y-1 text-[11px] text-slate-300 leading-relaxed">
            <li>Open **Arduino IDE** and create a new sketch (name it <code>SmartSanitizer</code>).</li>
            <li>Click <strong>COPY ENTIRE CODE</strong> above, select all existing text in the sketch, and paste it.</li>
            <li>Go to <strong>Sketch &gt; Include Library &gt; Manage Libraries...</strong> and install:
              <span className="text-teal-300 font-mono"> ESPAsyncWebServer</span>,
              <span className="text-teal-300 font-mono"> AsyncTCP</span>,
              <span className="text-teal-300 font-mono"> ArduinoJson</span> (version 6), and
              <span className="text-teal-300 font-mono"> ESP_Mail_Client</span>.
            </li>
            <li>In the code lines 43-44, set your <code>ssid</code> and <code>password</code> to your local Wi-Fi.</li>
            <li>Select <strong>Board: ESP32 Dev Module</strong>, choose your COM port, and click <strong>Upload</strong>.</li>
            <li>Open the Serial Monitor at <strong>115200 baud</strong>. The ESP32 will print its assigned IP address (e.g. <code>192.168.1.142</code>). Enter that IP in this dashboard header!</li>
          </ol>
        </div>
      </div>

      {/* SECTION 2: Physical Hardware Bench & Hand Simulator */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left: Rig (8 cols) */}
        <div className="lg:col-span-8 space-y-6">
          <div className="bg-slate-900/90 rounded-xl border border-slate-800 p-6 relative">
            <div className="flex items-center justify-between text-xs text-slate-400 mb-6 border-b border-slate-800 pb-3">
              <span className="font-semibold text-slate-300 tracking-wider">
                PHYSICAL DISPENSER ENCLOSURE
              </span>
              <div className="flex items-center gap-3 font-mono text-[11px]">
                <span className="flex items-center gap-1">
                  <span className={`w-2 h-2 rounded-full ${hardware.relay_active ? 'bg-emerald-400 animate-pulse' : 'bg-slate-700'}`} />
                  Relay (GPIO 19): {hardware.relay_active ? 'CLOSED (ON)' : 'OPEN (OFF)'}
                </span>
                <span className="flex items-center gap-1">
                  <span className={`w-2 h-2 rounded-full ${systemPoweredOn ? 'bg-teal-400' : 'bg-rose-500'}`} />
                  Power: {systemPoweredOn ? 'ACTIVE' : 'OFF'}
                </span>
              </div>
            </div>

            <div className="relative min-h-[260px] bg-slate-950/80 rounded-xl border border-slate-800 p-6 flex flex-col justify-between">
              {/* HC-SR04 & Nozzle */}
              <div className="flex items-center justify-between">
                <div className="bg-blue-950/80 border-2 border-blue-600/60 rounded-lg p-3 text-center w-52 shadow-lg">
                  <div className="text-[10px] font-mono text-blue-300 font-bold mb-1">
                    HC-SR04 SENSOR
                  </div>
                  <div className="flex justify-around items-center gap-2">
                    <div className="w-9 h-9 rounded-full border border-slate-400 bg-slate-800 flex items-center justify-center text-[9px] font-mono text-slate-300 relative">
                      T
                      <span className="absolute inset-0 rounded-full border border-teal-400/50 animate-ping pointer-events-none" />
                    </div>
                    <div className="w-9 h-9 rounded-full border border-slate-400 bg-slate-800 flex items-center justify-center text-[9px] font-mono text-slate-300">
                      R
                    </div>
                  </div>
                  <div className="mt-2 text-[10px] font-mono text-slate-400 flex justify-between px-1">
                    <span>GPIO 5 (Trig)</span>
                    <span>GPIO 18 (Echo)</span>
                  </div>
                </div>

                <div className="flex flex-col items-center">
                  <div className="w-10 h-8 bg-slate-700 rounded-b-lg border-2 border-slate-500 shadow-md flex items-end justify-center pb-1">
                    <div className="w-3 h-2 bg-slate-900 rounded-b" />
                  </div>
                  <div className="text-[10px] font-mono text-slate-400 mt-1">
                    Pump Relay (19)
                  </div>

                  {hardware.pump_running && (
                    <div className="flex flex-col items-center mt-2 space-y-1">
                      <div className="w-1 h-6 bg-teal-400/90 rounded-full animate-bounce" />
                      <div className="w-2 h-2 bg-teal-300 rounded-full animate-ping" />
                    </div>
                  )}
                </div>

                <div className="w-32 bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-center">
                  <div className="text-[10px] font-mono text-slate-400 mb-1">
                    TANK LEVEL
                  </div>
                  <div className="h-14 w-12 mx-auto bg-slate-950 border border-slate-600 rounded relative overflow-hidden flex flex-col justify-end">
                    <div
                      className={`w-full transition-all duration-300 ${
                        remainingPercent <= 5 ? 'bg-rose-500' : remainingPercent <= 15 ? 'bg-amber-500' : 'bg-teal-500'
                      }`}
                      style={{ height: `${remainingPercent}%` }}
                    />
                    <div className="absolute top-1 left-0 right-0 text-[9px] font-mono text-white text-center font-bold">
                      {remainingPercent}%
                    </div>
                  </div>
                  <div className="mt-1 text-[10px] font-mono text-slate-400">
                    GPIO 34 (ADC)
                  </div>
                </div>
              </div>

              {/* Distance Ray */}
              <div className="my-5 relative py-2">
                <div className="h-8 border-y border-dashed border-slate-800 flex items-center justify-between px-4 text-xs font-mono">
                  <div className="text-slate-500">0 cm</div>
                  <div className="flex-1 mx-4 relative flex items-center">
                    <div className="w-full h-0.5 bg-slate-800" />
                    <div
                      className="absolute -top-3 transition-all duration-150 flex flex-col items-center"
                      style={{ left: `${Math.min(100, Math.max(0, (interactiveDistance / 25) * 100))}%` }}
                    >
                      <div className="w-0.5 h-6 bg-teal-400" />
                      <span className="text-[10px] font-mono text-teal-300 bg-slate-900 border border-teal-500/50 px-1.5 py-0.5 rounded -mt-8 whitespace-nowrap">
                        {interactiveDistance.toFixed(1)} cm
                      </span>
                    </div>
                  </div>
                  <div className="text-slate-500">25 cm</div>
                </div>
              </div>

              {/* Hand Position Slider */}
              <div className="flex items-center justify-between bg-slate-900/80 p-3.5 rounded-xl border border-slate-800">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg border ${
                    isValidZone ? 'bg-teal-500/20 border-teal-500/40 text-teal-300' : 'bg-slate-800 border-slate-700 text-slate-400'
                  }`}>
                    <Hand className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-white">Simulated Hand Position</div>
                    <div className="text-[11px] font-mono text-slate-400">
                      {isValidZone ? 'In 3-10 cm Trigger Zone' : isTooClose ? 'Too Close (< 3cm)' : 'Out of Reach (> 10cm)'}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3 w-56">
                  <input
                    type="range"
                    min="1.0"
                    max="25.0"
                    step="0.1"
                    value={interactiveDistance}
                    onChange={e => handleDistanceChange(Number(e.target.value))}
                    className="w-full accent-teal-400 cursor-pointer"
                  />
                  <span className="font-mono text-xs font-bold text-white w-14 text-right">
                    {interactiveDistance.toFixed(1)} cm
                  </span>
                </div>
              </div>
            </div>

            {lastActionResult && (
              <div className={`mt-4 p-3 rounded-lg border text-xs font-mono flex items-center justify-between ${
                lastActionResult.success ? 'bg-emerald-950/60 border-emerald-800 text-emerald-200' : 'bg-rose-950/60 border-rose-800 text-rose-200'
              }`}>
                <span>{lastActionResult.message}</span>
                {lastActionResult.code && <span className="bg-slate-900 px-2 py-0.5 rounded font-bold">{lastActionResult.code}</span>}
              </div>
            )}
          </div>
        </div>

        {/* Right: Actions & Reservoir (4 cols) */}
        <div className="lg:col-span-4 space-y-6">
          <div className="bg-slate-900/90 rounded-xl border border-slate-800 p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <span className="text-xs font-bold text-white tracking-wider">SYSTEM STATUS</span>
              <span className="text-[10px] font-mono text-teal-400">ESP32-WROOM-32D</span>
            </div>

            <div className="space-y-2 text-xs font-mono">
              <div className="flex justify-between p-2 bg-slate-950 rounded border border-slate-800">
                <span className="text-slate-400">Power State:</span>
                <span className={systemPoweredOn ? 'text-emerald-400 font-bold' : 'text-rose-400 font-bold'}>
                  {systemPoweredOn ? 'ONLINE' : 'SHUTDOWN'}
                </span>
              </div>
              <div className="flex justify-between p-2 bg-slate-950 rounded border border-slate-800">
                <span className="text-slate-400">Sender Email:</span>
                <span className="text-teal-300 truncate max-w-[140px]">idrisalhajisunusi3@gmail.com</span>
              </div>
              <div className="flex justify-between p-2 bg-slate-950 rounded border border-slate-800">
                <span className="text-slate-400">Alert To:</span>
                <span className="text-emerald-300 truncate max-w-[140px]">ndctem24012@jigpoly.edu.ng</span>
              </div>
            </div>

            <div className="pt-2 border-t border-slate-800">
              <div className="text-xs font-semibold text-slate-300 mb-2">QUICK TEST TRIGGER</div>
              <button
                onClick={triggerNormalSuccess}
                disabled={!systemPoweredOn}
                className="w-full py-2 px-3 bg-teal-500 hover:bg-teal-400 disabled:opacity-40 text-slate-950 font-bold rounded-lg text-xs transition-colors flex items-center justify-center gap-1.5"
              >
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>Simulate 6.4cm Dispense (800ms)</span>
              </button>
            </div>

            <div className="pt-2 border-t border-slate-800">
              <div className="text-xs font-semibold text-slate-300 mb-2">RESERVOIR MANAGEMENT</div>
              <div className="space-y-2">
                <button
                  onClick={() => refillTank(100)}
                  className="w-full py-1.5 px-3 bg-teal-500/10 hover:bg-teal-500/20 text-teal-300 border border-teal-500/30 rounded-lg text-xs font-medium transition-colors"
                >
                  Refill to 100% (2500 ml)
                </button>
                <button
                  onClick={() => drainTank(3.0)}
                  className="w-full py-1.5 px-3 bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/30 rounded-lg text-xs font-medium transition-colors"
                >
                  Drain to 3% (Test E_DRYRUN)
                </button>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};
