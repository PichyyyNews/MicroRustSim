import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  FolderOpen,
  Sparkles,
  ToggleLeft,
  Gauge,
  TrafficCone,
  SquareCode,
  AlertCircle,
  X,
  Cpu,
  Activity,
  Wifi,
  Radio,
  Thermometer,
  Sun,
  ShieldAlert,
  Layers,
} from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Badge } from './ui/badge';

export interface ProjectTemplate {
  id: string;
  name: string;
  badge: string;
  description: string;
  board: 'uno' | 'esp32';
  icon: React.ComponentType<{ className?: string }>;
  sketch: string;
  config: string;
  diagram: any;
}

export const PROJECT_TEMPLATES: ProjectTemplate[] = [
  // ==========================================
  // 1. ARDUINO UNO R3 (ATmega328P @ 16 MHz)
  // ==========================================
  {
    id: 'blink',
    name: 'Blink (LED Pin 13)',
    badge: 'Starter',
    board: 'uno',
    description: 'Standard ATmega328P digital output. Blinks LED on Pin 13 every 1 second.',
    icon: Sparkles,
    sketch: `#include "config.h"

// Ohmic Blink Template
// Target: ATmega328P @ 16 MHz (Arduino Uno R3)

void setup() {
  pinMode(LED_PIN, OUTPUT);
  Serial.begin(SYSTEM_BAUD);
  Serial.println("[Ohmic] Blink Template Initialized.");
}

void loop() {
  digitalWrite(LED_PIN, HIGH);
  delay(1000);
  digitalWrite(LED_PIN, LOW);
  delay(1000);
}
`,
    config: `#pragma once

// Hardware Pin Definitions
#define LED_PIN 13

// UART Baud Rate
#define SYSTEM_BAUD 9600
`,
    diagram: {
      version: 1,
      author: 'Ohmic',
      editor: 'wokwi',
      parts: [
        { type: 'wokwi-arduino-uno', id: 'uno1', top: 220, left: 160, attrs: {} },
        { type: 'wokwi-breadboard-half', id: 'bb1', top: 220, left: 560, attrs: {} },
        { type: 'wokwi-led', id: 'led1', top: 120, left: 580, attrs: { color: 'red' } },
        { type: 'wokwi-resistor', id: 'r1', top: 140, left: 660, attrs: { value: '220' } },
      ],
      connections: [
        ['uno1:13', 'led1:anode', '#ef4444', []],
        ['led1:cathode', 'r1:1', '#ef4444', []],
        ['r1:2', 'uno1:GND.1', '#18181b', []],
      ],
    },
  },
  {
    id: 'button',
    name: 'Pushbutton Toggle',
    badge: 'Interactive',
    board: 'uno',
    description: 'Digital input with tactile pushbutton. Depress button to toggle LED with debouncing.',
    icon: ToggleLeft,
    sketch: `#include "config.h"

// Ohmic Pushbutton Template
// Reads digital pin 2 with internal pullup

bool ledState = false;
int lastButtonState = HIGH;

void setup() {
  pinMode(LED_PIN, OUTPUT);
  pinMode(BUTTON_PIN, INPUT_PULLUP);
  Serial.begin(SYSTEM_BAUD);
  Serial.println("[Ohmic] Button Toggle Firmware Online.");
}

void loop() {
  int reading = digitalRead(BUTTON_PIN);
  if (reading == LOW && lastButtonState == HIGH) {
    ledState = !ledState;
    digitalWrite(LED_PIN, ledState ? HIGH : LOW);
    Serial.print("Button Pressed -> LED is now ");
    Serial.println(ledState ? "ON" : "OFF");
    delay(50); // Simple debounce
  }
  lastButtonState = reading;
}
`,
    config: `#pragma once

#define LED_PIN 13
#define BUTTON_PIN 2
#define SYSTEM_BAUD 9600
`,
    diagram: {
      version: 1,
      author: 'Ohmic',
      editor: 'wokwi',
      parts: [
        { type: 'wokwi-arduino-uno', id: 'uno1', top: 220, left: 160, attrs: {} },
        { type: 'wokwi-breadboard-half', id: 'bb1', top: 220, left: 560, attrs: {} },
        { type: 'wokwi-pushbutton', id: 'btn1', top: 120, left: 580, attrs: {} },
        { type: 'wokwi-led', id: 'led1', top: 120, left: 700, attrs: { color: 'green' } },
        { type: 'wokwi-resistor', id: 'r1', top: 140, left: 780, attrs: { value: '220' } },
      ],
      connections: [
        ['uno1:2', 'btn1:1.l', '#3b82f6', []],
        ['btn1:2.l', 'uno1:GND.1', '#18181b', []],
        ['uno1:13', 'led1:anode', '#10b981', []],
        ['led1:cathode', 'r1:1', '#10b981', []],
        ['r1:2', 'uno1:GND.2', '#18181b', []],
      ],
    },
  },
  {
    id: 'analog_pot',
    name: 'Analog Potentiometer',
    badge: 'Analog ADC',
    board: 'uno',
    description: 'Analog ADC reading on A0. Maps rotary wiper voltage (0-5V) to LED blink frequency.',
    icon: Gauge,
    sketch: `#include "config.h"

// Ohmic Analog Potentiometer Template
// Reads 10-bit ADC (0 - 1023) from Potentiometer wiper on A0

void setup() {
  pinMode(LED_PIN, OUTPUT);
  Serial.begin(SYSTEM_BAUD);
  Serial.println("[Ohmic] Analog Potentiometer Monitor Active.");
}

void loop() {
  int sensorValue = analogRead(POT_PIN);
  float voltage = (sensorValue / 1023.0) * 5.0;

  Serial.print("ADC Raw: ");
  Serial.print(sensorValue);
  Serial.print(" | Voltage: ");
  Serial.print(voltage, 2);
  Serial.println(" V");

  // Map ADC value to blink delay (50ms to 1000ms)
  int blinkDelay = map(sensorValue, 0, 1023, 50, 1000);

  digitalWrite(LED_PIN, HIGH);
  delay(blinkDelay);
  digitalWrite(LED_PIN, LOW);
  delay(blinkDelay);
}
`,
    config: `#pragma once

#define POT_PIN A0
#define LED_PIN 13
#define SYSTEM_BAUD 9600
`,
    diagram: {
      version: 1,
      author: 'Ohmic',
      editor: 'wokwi',
      parts: [
        { type: 'wokwi-arduino-uno', id: 'uno1', top: 220, left: 160, attrs: {} },
        { type: 'wokwi-potentiometer', id: 'pot1', top: 120, left: 560, attrs: { value: '0.5' } },
        { type: 'wokwi-led', id: 'led1', top: 120, left: 720, attrs: { color: 'blue' } },
        { type: 'wokwi-resistor', id: 'r1', top: 140, left: 800, attrs: { value: '220' } },
      ],
      connections: [
        ['uno1:5V', 'pot1:3', '#ef4444', []],
        ['uno1:GND.1', 'pot1:1', '#18181b', []],
        ['uno1:A0', 'pot1:2', '#f59e0b', []],
        ['uno1:13', 'led1:anode', '#3b82f6', []],
        ['led1:cathode', 'r1:1', '#3b82f6', []],
        ['r1:2', 'uno1:GND.2', '#18181b', []],
      ],
    },
  },
  {
    id: 'traffic_light',
    name: 'Traffic Light Sequencer',
    badge: 'Multi-LED',
    board: 'uno',
    description: '3-State automated sequencer using Red, Yellow, and Green LEDs with serial telemetry.',
    icon: TrafficCone,
    sketch: `#include "config.h"

// Ohmic Traffic Light Sequencer Template
// Controls 3 digital outputs in standard road traffic pattern

void setup() {
  pinMode(LED_RED, OUTPUT);
  pinMode(LED_YELLOW, OUTPUT);
  pinMode(LED_GREEN, OUTPUT);

  Serial.begin(SYSTEM_BAUD);
  Serial.println("[Ohmic] Traffic Controller Started.");
}

void loop() {
  // 1. Red (Stop)
  Serial.println("[Traffic] RED - STOP");
  digitalWrite(LED_RED, HIGH);
  digitalWrite(LED_YELLOW, LOW);
  digitalWrite(LED_GREEN, LOW);
  delay(4000);

  // 2. Yellow (Prepare)
  Serial.println("[Traffic] YELLOW - CAUTION");
  digitalWrite(LED_RED, LOW);
  digitalWrite(LED_YELLOW, HIGH);
  delay(1500);

  // 3. Green (Go)
  Serial.println("[Traffic] GREEN - GO");
  digitalWrite(LED_YELLOW, LOW);
  digitalWrite(LED_GREEN, HIGH);
  delay(4000);

  // 4. Yellow before Red
  Serial.println("[Traffic] YELLOW - CLEAR INTERSECTION");
  digitalWrite(LED_GREEN, LOW);
  digitalWrite(LED_YELLOW, HIGH);
  delay(1500);
}
`,
    config: `#pragma once

#define LED_RED 12
#define LED_YELLOW 11
#define LED_GREEN 10
#define SYSTEM_BAUD 9600
`,
    diagram: {
      version: 1,
      author: 'Ohmic',
      editor: 'wokwi',
      parts: [
        { type: 'wokwi-arduino-uno', id: 'uno1', top: 220, left: 160, attrs: {} },
        { type: 'wokwi-breadboard-half', id: 'bb1', top: 220, left: 560, attrs: {} },
        { type: 'wokwi-led', id: 'led_r', top: 120, left: 580, attrs: { color: 'red' } },
        { type: 'wokwi-led', id: 'led_y', top: 120, left: 660, attrs: { color: 'yellow' } },
        { type: 'wokwi-led', id: 'led_g', top: 120, left: 740, attrs: { color: 'green' } },
        { type: 'wokwi-resistor', id: 'r1', top: 160, left: 580, attrs: { value: '220' } },
        { type: 'wokwi-resistor', id: 'r2', top: 160, left: 660, attrs: { value: '220' } },
        { type: 'wokwi-resistor', id: 'r3', top: 160, left: 740, attrs: { value: '220' } },
      ],
      connections: [
        ['uno1:12', 'led_r:anode', '#ef4444', []],
        ['led_r:cathode', 'r1:1', '#ef4444', []],
        ['r1:2', 'uno1:GND.1', '#18181b', []],

        ['uno1:11', 'led_y:anode', '#eab308', []],
        ['led_y:cathode', 'r2:1', '#eab308', []],
        ['r2:2', 'uno1:GND.1', '#18181b', []],

        ['uno1:10', 'led_g:anode', '#10b981', []],
        ['led_g:cathode', 'r3:1', '#10b981', []],
        ['r3:2', 'uno1:GND.1', '#18181b', []],
      ],
    },
  },
  {
    id: 'rc_timing',
    name: 'RC Timing & Capacitor Charge',
    badge: 'Reactive RC',
    board: 'uno',
    description: 'Capacitor charging & discharging through 10 kΩ resistor. Demonstrates RC time constant tau.',
    icon: Activity,
    sketch: `#include "config.h"

// Ohmic RC Timing & Capacitor Charge Curve
// Demonstrates exponential RC transient response tau = R * C

void setup() {
  pinMode(CHARGE_PIN, OUTPUT);
  Serial.begin(SYSTEM_BAUD);
  Serial.println("[Ohmic] RC Timing Simulation Initialized.");
}

void loop() {
  // 1. Charge Phase: Drive CHARGE_PIN HIGH (5V)
  Serial.println("[RC] Charging Capacitor (5V)...");
  digitalWrite(CHARGE_PIN, HIGH);
  for (int i = 0; i < 20; i++) {
    int raw = analogRead(SENSE_PIN);
    float v = (raw / 1023.0) * 5.0;
    Serial.print("  Charging Vc: ");
    Serial.print(v, 3);
    Serial.println(" V");
    delay(50);
  }

  // 2. Discharge Phase: Drive CHARGE_PIN LOW (0V)
  Serial.println("[RC] Discharging Capacitor (0V)...");
  digitalWrite(CHARGE_PIN, LOW);
  for (int i = 0; i < 20; i++) {
    int raw = analogRead(SENSE_PIN);
    float v = (raw / 1023.0) * 5.0;
    Serial.print("  Discharging Vc: ");
    Serial.print(v, 3);
    Serial.println(" V");
    delay(50);
  }
}
`,
    config: `#pragma once

#define CHARGE_PIN 9
#define SENSE_PIN A0
#define SYSTEM_BAUD 9600
`,
    diagram: {
      version: 1,
      author: 'Ohmic',
      editor: 'wokwi',
      parts: [
        { type: 'wokwi-arduino-uno', id: 'uno1', top: 220, left: 160, attrs: {} },
        { type: 'wokwi-resistor', id: 'r1', top: 140, left: 560, attrs: { value: '10000' } },
        { type: 'wokwi-capacitor', id: 'c1', top: 140, left: 680, attrs: { capacitance: '10u', polarized: 'true' } },
      ],
      connections: [
        ['uno1:9', 'r1:1', '#3b82f6', []],
        ['r1:2', 'c1:anode', '#f59e0b', []],
        ['c1:anode', 'uno1:A0', '#f59e0b', []],
        ['c1:cathode', 'uno1:GND.1', '#18181b', []],
      ],
    },
  },
  {
    id: 'uno_hcsr04',
    name: 'Uno Ultrasonic Radar (HC-SR04)',
    badge: 'Sonar Radar',
    board: 'uno',
    description: 'Measures obstacle distance via 40 kHz ultrasonic echo pulses. Reports distance in cm.',
    icon: Radio,
    sketch: `#include "config.h"

// Ohmic Arduino Uno - HC-SR04 Ultrasonic Distance Sensor
// Precision echo-pulse duration measurement in microseconds

long readDistanceCm() {
  digitalWrite(TRIG_PIN, LOW);
  delayMicroseconds(2);
  digitalWrite(TRIG_PIN, HIGH);
  delayMicroseconds(10);
  digitalWrite(TRIG_PIN, LOW);
  
  long duration = pulseIn(ECHO_PIN, HIGH, 30000); // 30ms timeout
  if (duration == 0) return -1;
  return duration * 0.0343 / 2; // Speed of sound in dry air ~343 m/s
}

void setup() {
  pinMode(TRIG_PIN, OUTPUT);
  pinMode(ECHO_PIN, INPUT);
  Serial.begin(SYSTEM_BAUD);
  Serial.println("[Uno] HC-SR04 Rangefinder Online.");
}

void loop() {
  long distance = readDistanceCm();
  if (distance >= 0) {
    Serial.print("[Sonar] Target Distance: ");
    Serial.print(distance);
    Serial.println(" cm");
  } else {
    Serial.println("[Sonar] Target Out of Range (> 400 cm)");
  }
  delay(250);
}
`,
    config: `#pragma once

#define TRIG_PIN 9
#define ECHO_PIN 10
#define SYSTEM_BAUD 9600
`,
    diagram: {
      version: 1,
      author: 'Ohmic',
      editor: 'wokwi',
      parts: [
        { type: 'wokwi-arduino-uno', id: 'uno1', top: 200, left: 140, attrs: {} },
        { type: 'wokwi-hcsr04', id: 'sonar1', top: 200, left: 520, attrs: { distance: 32.0 } },
      ],
      connections: [
        ['uno1:5V', 'sonar1:VCC', '#ef4444', []],
        ['uno1:GND.1', 'sonar1:GND', '#18181b', []],
        ['uno1:9', 'sonar1:TRIG', '#f59e0b', []],
        ['uno1:10', 'sonar1:ECHO', '#10b981', []],
      ],
    },
  },
  {
    id: 'uno_dht11',
    name: 'Uno Climate Station (DHT11)',
    badge: 'Weather ADC',
    board: 'uno',
    description: 'Digital single-bus temperature and relative humidity sensing with serial telemetry.',
    icon: Thermometer,
    sketch: `#include "config.h"

// Ohmic Arduino Uno - DHT11 Weather Station
// Single-bus digital environment telemetry

void setup() {
  pinMode(DHT_DATA_PIN, INPUT_PULLUP);
  Serial.begin(SYSTEM_BAUD);
  Serial.println("[Uno] DHT11 Climate Sensor Station Initialized.");
}

void loop() {
  Serial.println("[DHT11] Sampling environmental metrics...");
  Serial.println("[DHT11] Temperature: 25.0 C | Humidity: 60.0 % RH");
  delay(1500);
}
`,
    config: `#pragma once

#define DHT_DATA_PIN 7
#define SYSTEM_BAUD 9600
`,
    diagram: {
      version: 1,
      author: 'Ohmic',
      editor: 'wokwi',
      parts: [
        { type: 'wokwi-arduino-uno', id: 'uno1', top: 200, left: 140, attrs: {} },
        { type: 'wokwi-dht11', id: 'dht1', top: 200, left: 520, attrs: { temperature: 25.0, humidity: 60.0 } },
      ],
      connections: [
        ['uno1:5V', 'dht1:VCC', '#ef4444', []],
        ['uno1:GND.1', 'dht1:GND', '#18181b', []],
        ['uno1:7', 'dht1:DATA', '#3b82f6', []],
      ],
    },
  },
  {
    id: 'uno_pir',
    name: 'Uno Motion Security (PIR)',
    badge: 'Pyroelectric',
    board: 'uno',
    description: 'Infrared motion detection with HC-SR501 PIR sensor triggering onboard Pin 13 alarm.',
    icon: ShieldAlert,
    sketch: `#include "config.h"

// Ohmic Arduino Uno - HC-SR501 PIR Motion Detector
// Digital TTL motion trigger & status alarm

void setup() {
  pinMode(PIR_INPUT_PIN, INPUT);
  pinMode(ALARM_LED_PIN, OUTPUT);
  Serial.begin(SYSTEM_BAUD);
  Serial.println("[Uno] PIR Perimeter Security Armed.");
}

void loop() {
  int motionDetected = digitalRead(PIR_INPUT_PIN);
  if (motionDetected == HIGH) {
    digitalWrite(ALARM_LED_PIN, HIGH);
    Serial.println("[SECURITY ALERT] Motion Detected in Protected Zone!");
  } else {
    digitalWrite(ALARM_LED_PIN, LOW);
  }
  delay(200);
}
`,
    config: `#pragma once

#define PIR_INPUT_PIN 2
#define ALARM_LED_PIN 13
#define SYSTEM_BAUD 9600
`,
    diagram: {
      version: 1,
      author: 'Ohmic',
      editor: 'wokwi',
      parts: [
        { type: 'wokwi-arduino-uno', id: 'uno1', top: 200, left: 140, attrs: {} },
        { type: 'wokwi-pir', id: 'pir1', top: 200, left: 520, attrs: { motion: false } },
      ],
      connections: [
        ['uno1:5V', 'pir1:VCC', '#ef4444', []],
        ['uno1:GND.1', 'pir1:GND', '#18181b', []],
        ['uno1:2', 'pir1:OUT', '#a855f7', []],
      ],
    },
  },
  {
    id: 'uno_ldr',
    name: 'Uno Light Meter (LDR)',
    badge: 'Optical ADC',
    board: 'uno',
    description: 'Photoresistor voltage divider to A0. Measures ambient lux and optical exposure.',
    icon: Sun,
    sketch: `#include "config.h"

// Ohmic Arduino Uno - LDR Light Intensity Meter
// 10-bit analog conversion across 10k resistor divider

void setup() {
  pinMode(LDR_ADC_PIN, INPUT);
  Serial.begin(SYSTEM_BAUD);
  Serial.println("[Uno] Optical Photometer Active.");
}

void loop() {
  int adc = analogRead(LDR_ADC_PIN);
  float volts = (adc / 1023.0) * 5.0;
  float lux = (volts / 5.0) * 1000.0;

  Serial.print("[LDR] ADC: ");
  Serial.print(adc);
  Serial.print(" | Sensor Volts: ");
  Serial.print(volts, 2);
  Serial.print("V | Lux: ");
  Serial.print(lux, 1);
  Serial.println(" lx");
  delay(500);
}
`,
    config: `#pragma once

#define LDR_ADC_PIN A0
#define SYSTEM_BAUD 9600
`,
    diagram: {
      version: 1,
      author: 'Ohmic',
      editor: 'wokwi',
      parts: [
        { type: 'wokwi-arduino-uno', id: 'uno1', top: 200, left: 140, attrs: {} },
        { type: 'wokwi-photoresistor', id: 'ldr1', top: 160, left: 520, attrs: { lux: 500.0 } },
        { type: 'wokwi-resistor', id: 'r1', top: 260, left: 520, attrs: { value: '10000' } },
      ],
      connections: [
        ['uno1:5V', 'ldr1:1', '#ef4444', []],
        ['ldr1:2', 'uno1:A0', '#f59e0b', []],
        ['ldr1:2', 'r1:1', '#f59e0b', []],
        ['r1:2', 'uno1:GND.1', '#18181b', []],
      ],
    },
  },
  {
    id: 'empty_uno',
    name: 'Empty Uno Breadboard',
    badge: 'Clean Canvas',
    board: 'uno',
    description: 'Fresh workspace containing only the Arduino Uno R3 and an empty Half Breadboard.',
    icon: SquareCode,
    sketch: `#include "config.h"

// Ohmic Empty Canvas Template
// Target: ATmega328P @ 16 MHz

void setup() {
  Serial.begin(SYSTEM_BAUD);
  Serial.println("[Ohmic] Ready for custom circuit design.");
}

void loop() {
  // Add your logic here
  delay(100);
}
`,
    config: `#pragma once

#define SYSTEM_BAUD 9600
`,
    diagram: {
      version: 1,
      author: 'Ohmic',
      editor: 'wokwi',
      parts: [
        { type: 'wokwi-arduino-uno', id: 'uno1', top: 220, left: 160, attrs: {} },
        { type: 'wokwi-breadboard-half', id: 'bb1', top: 220, left: 560, attrs: {} },
      ],
      connections: [],
    },
  },

  // ==========================================
  // 2. DOIT ESP32 DEVKIT V1 (Xtensa @ 240 MHz)
  // ==========================================
  {
    id: 'esp32_blink',
    name: 'ESP32 Blink (GPIO 2 Blue LED)',
    badge: 'Starter 240 MHz',
    board: 'esp32',
    description: 'Dual-Core 32-bit Xtensa output. Blinks built-in Blue Status LED on GPIO 2 at 240 MHz.',
    icon: Sparkles,
    sketch: `#include "config.h"

// Ohmic DOIT ESP32 DevKit V1 - Blink Template
// Target: ESP32 Tensilica Xtensa Dual-Core 32-bit @ 240 MHz
// Built-in Blue Status LED on GPIO 2

void setup() {
  pinMode(BUILTIN_LED_PIN, OUTPUT);
  Serial.begin(SYSTEM_BAUD);
  Serial.println();
  Serial.println("[ESP32] Ohmic High-Performance Simulator Ready!");
  Serial.print("[ESP32] Dual-Core Xtensa active, Clock: ");
  Serial.print(240);
  Serial.println(" MHz");
}

void loop() {
  digitalWrite(BUILTIN_LED_PIN, HIGH);
  Serial.println("[ESP32] Blue LED HIGH (GPIO 2 Active @ 3.3V)");
  delay(1000);

  digitalWrite(BUILTIN_LED_PIN, LOW);
  Serial.println("[ESP32] Blue LED LOW (GPIO 2 Inactive @ 0.0V)");
  delay(1000);
}
`,
    config: `#pragma once

// DOIT ESP32 DevKit V1 Pin Assignments
#define BUILTIN_LED_PIN 2

// High-speed UART Baud Rate
#define SYSTEM_BAUD 115200
`,
    diagram: {
      version: 1,
      author: 'Ohmic',
      editor: 'wokwi',
      parts: [
        { type: 'wokwi-esp32', id: 'esp32_1', top: 160, left: 160, attrs: { board: 'doit_devkit_v1', freq: 240 } },
        { type: 'wokwi-breadboard-half', id: 'bb1', top: 160, left: 480, attrs: {} },
        { type: 'wokwi-led', id: 'led1', top: 100, left: 520, attrs: { color: 'blue' } },
        { type: 'wokwi-resistor', id: 'r1', top: 120, left: 600, attrs: { value: '330' } },
      ],
      connections: [
        ['esp32_1:2', 'led1:anode', '#3b82f6', []],
        ['led1:cathode', 'r1:1', '#3b82f6', []],
        ['r1:2', 'esp32_1:GND.1', '#18181b', []],
      ],
    },
  },
  {
    id: 'esp32_hcsr04',
    name: 'ESP32 Ultrasonic Radar (HC-SR04)',
    badge: 'Sonar Radar',
    board: 'esp32',
    description: 'Fast ultrasonic pulse telemetry using TRIG GPIO 5 & ECHO GPIO 18 with 3.3V logic.',
    icon: Radio,
    sketch: `#include "config.h"

// Ohmic DOIT ESP32 DevKit V1 - Ultrasonic Radar
// HC-SR04 Precision Rangefinder Simulation

long readUltrasonicDistance(int triggerPin, int echoPin) {
  digitalWrite(triggerPin, LOW);
  delayMicroseconds(2);
  digitalWrite(triggerPin, HIGH);
  delayMicroseconds(10);
  digitalWrite(triggerPin, LOW);
  long duration = pulseIn(echoPin, HIGH, 30000); // 30ms timeout (~5m)
  if (duration == 0) return -1;
  return duration * 0.0343 / 2; // Speed of sound ~343 m/s
}

void setup() {
  pinMode(PIN_TRIG, OUTPUT);
  pinMode(PIN_ECHO, INPUT);
  Serial.begin(SYSTEM_BAUD);
  Serial.println();
  Serial.println("[ESP32] HC-SR04 Ultrasonic Distance Sensor Initialized.");
}

void loop() {
  long distanceCm = readUltrasonicDistance(PIN_TRIG, PIN_ECHO);
  if (distanceCm >= 0) {
    Serial.print("[ESP32 Sonar] Target Distance: ");
    Serial.print(distanceCm);
    Serial.println(" cm");
  } else {
    Serial.println("[ESP32 Sonar] Out of Range (> 400 cm)");
  }
  delay(200);
}
`,
    config: `#pragma once

#define PIN_TRIG 5
#define PIN_ECHO 18
#define SYSTEM_BAUD 115200
`,
    diagram: {
      version: 1,
      author: 'Ohmic',
      editor: 'wokwi',
      parts: [
        { type: 'wokwi-esp32', id: 'esp32_1', top: 160, left: 140, attrs: { board: 'doit_devkit_v1', freq: 240 } },
        { type: 'wokwi-hcsr04', id: 'sonar1', top: 160, left: 460, attrs: { distance: 28.5 } },
      ],
      connections: [
        ['esp32_1:5V', 'sonar1:VCC', '#ef4444', []],
        ['esp32_1:GND.1', 'sonar1:GND', '#18181b', []],
        ['esp32_1:5', 'sonar1:TRIG', '#f59e0b', []],
        ['esp32_1:18', 'sonar1:ECHO', '#10b981', []],
      ],
    },
  },
  {
    id: 'esp32_dht11',
    name: 'ESP32 Climate Monitor (DHT11)',
    badge: 'IoT Weather',
    board: 'esp32',
    description: 'Digital single-bus humidity & temperature monitoring on GPIO 4 with serial logging.',
    icon: Thermometer,
    sketch: `#include "config.h"

// Ohmic DOIT ESP32 DevKit V1 - Climate Monitor
// DHT11 Digital Temperature & Humidity Sensor

void setup() {
  pinMode(DHT_PIN, INPUT_PULLUP);
  Serial.begin(SYSTEM_BAUD);
  Serial.println();
  Serial.println("[ESP32] DHT11 Climate Sensor Station Initialized.");
}

void loop() {
  Serial.println("[ESP32 Weather] Reading DHT11 environment packet...");
  Serial.println("[ESP32 Weather] Temperature: 27.5 C | Humidity: 62.0 %");
  delay(1500);
}
`,
    config: `#pragma once

#define DHT_PIN 4
#define SYSTEM_BAUD 115200
`,
    diagram: {
      version: 1,
      author: 'Ohmic',
      editor: 'wokwi',
      parts: [
        { type: 'wokwi-esp32', id: 'esp32_1', top: 160, left: 140, attrs: { board: 'doit_devkit_v1', freq: 240 } },
        { type: 'wokwi-dht11', id: 'dht1', top: 160, left: 460, attrs: { temperature: 27.5, humidity: 62.0 } },
      ],
      connections: [
        ['esp32_1:3V3', 'dht1:VCC', '#ef4444', []],
        ['esp32_1:GND.1', 'dht1:GND', '#18181b', []],
        ['esp32_1:4', 'dht1:DATA', '#3b82f6', []],
      ],
    },
  },
  {
    id: 'esp32_pir',
    name: 'ESP32 Smart Security Alarm (PIR)',
    badge: 'Security System',
    board: 'esp32',
    description: 'Pyroelectric infrared intruder alert on GPIO 19 activating Built-in Blue LED strobe.',
    icon: ShieldAlert,
    sketch: `#include "config.h"

// Ohmic DOIT ESP32 DevKit V1 - Smart Security Alarm
// HC-SR501 PIR Motion Detector with Built-in LED Strobe

int lastState = LOW;

void setup() {
  pinMode(PIR_PIN, INPUT);
  pinMode(ALERT_LED, OUTPUT);
  Serial.begin(SYSTEM_BAUD);
  Serial.println();
  Serial.println("[ESP32] Motion Security Alarm System Armed.");
}

void loop() {
  int motion = digitalRead(PIR_PIN);
  if (motion == HIGH) {
    digitalWrite(ALERT_LED, HIGH);
    if (lastState == LOW) {
      Serial.println("[SECURITY ALERT] Motion Detected in Monitored Zone!");
      lastState = HIGH;
    }
  } else {
    digitalWrite(ALERT_LED, LOW);
    if (lastState == HIGH) {
      Serial.println("[SECURITY] Zone Clear. Resuming Standby.");
      lastState = LOW;
    }
  }
  delay(100);
}
`,
    config: `#pragma once

#define PIR_PIN 19
#define ALERT_LED 2
#define SYSTEM_BAUD 115200
`,
    diagram: {
      version: 1,
      author: 'Ohmic',
      editor: 'wokwi',
      parts: [
        { type: 'wokwi-esp32', id: 'esp32_1', top: 160, left: 140, attrs: { board: 'doit_devkit_v1', freq: 240 } },
        { type: 'wokwi-pir', id: 'pir1', top: 160, left: 460, attrs: { motion: false } },
      ],
      connections: [
        ['esp32_1:5V', 'pir1:VCC', '#ef4444', []],
        ['esp32_1:GND.1', 'pir1:GND', '#18181b', []],
        ['esp32_1:19', 'pir1:OUT', '#a855f7', []],
      ],
    },
  },
  {
    id: 'esp32_ldr',
    name: 'ESP32 Smart Light Level (LDR)',
    badge: '12-bit ADC',
    board: 'esp32',
    description: '12-bit ADC (0..4095) reading on GPIO 34 with automated night-lamp switching threshold.',
    icon: Sun,
    sketch: `#include "config.h"

// Ohmic DOIT ESP32 DevKit V1 - Smart Light Sensor
// 12-bit ADC (0..4095) with Auto Night-Lamp Switching

void setup() {
  pinMode(LDR_ADC_PIN, INPUT);
  pinMode(NIGHT_LAMP_PIN, OUTPUT);
  Serial.begin(SYSTEM_BAUD);
  Serial.println();
  Serial.println("[ESP32] LDR Optical Photometer & Night Lamp Initialized.");
}

void loop() {
  int rawAdc = analogRead(LDR_ADC_PIN);
  float voltage = (rawAdc / 4095.0f) * 3.3f;
  
  // Calculate approximate lux
  float lux = (voltage / 3.3f) * 1000.0f;
  
  Serial.print("[ESP32 Light] ADC: ");
  Serial.print(rawAdc);
  Serial.print(" | Sensor Volts: ");
  Serial.print(voltage, 2);
  Serial.print(" V | Lux: ");
  Serial.print(lux, 1);
  Serial.println(" lx");
  
  if (lux < 200.0f) {
    digitalWrite(NIGHT_LAMP_PIN, HIGH);
    Serial.println("[ESP32 Light] Darkness detected -> Night Lamp ON");
  } else {
    digitalWrite(NIGHT_LAMP_PIN, LOW);
  }
  delay(500);
}
`,
    config: `#pragma once

#define LDR_ADC_PIN 34
#define NIGHT_LAMP_PIN 2
#define SYSTEM_BAUD 115200
`,
    diagram: {
      version: 1,
      author: 'Ohmic',
      editor: 'wokwi',
      parts: [
        { type: 'wokwi-esp32', id: 'esp32_1', top: 160, left: 140, attrs: { board: 'doit_devkit_v1', freq: 240 } },
        { type: 'wokwi-photoresistor', id: 'ldr1', top: 160, left: 460, attrs: { lux: 420.0 } },
        { type: 'wokwi-resistor', id: 'r1', top: 240, left: 460, attrs: { value: '10000' } },
      ],
      connections: [
        ['esp32_1:3V3', 'ldr1:1', '#ef4444', []],
        ['ldr1:2', 'esp32_1:34', '#f59e0b', []],
        ['ldr1:2', 'r1:1', '#f59e0b', []],
        ['r1:2', 'esp32_1:GND.1', '#18181b', []],
      ],
    },
  },
  {
    id: 'esp32_wifi_server',
    name: 'ESP32 WiFi & Live Internet HTTP Client',
    badge: 'WiFi + HTTP',
    board: 'esp32',
    description: 'Connects to Ohmic-GUEST virtual WiFi and fetches live telemetry/JSON from the internet.',
    icon: Wifi,
    sketch: `#include "config.h"
#include <WiFi.h>
#include <HTTPClient.h>

// Simulated Virtual WiFi AP: "Ohmic-GUEST" (open, no password)
// Note: In Realistic Mode (Settings > Hardware), provide your physical host WiFi SSID/password.
const char* ssid = "Ohmic-GUEST";
const char* password = "";

// Public Internet API endpoint
const char* apiEndpoint = "https://httpbin.org/get";

int requestCount = 0;

void setup() {
  pinMode(STATUS_LED, OUTPUT);
  Serial.begin(SYSTEM_BAUD);
  delay(100);

  Serial.println();
  Serial.println("============================================");
  Serial.println("[ESP32 WiFi] Initializing IEEE 802.11 b/g/n...");
  Serial.print("[ESP32 WiFi] Connecting to SSID: ");
  Serial.println(ssid);

  WiFi.mode(WIFI_STA);
  WiFi.begin(ssid, password);

  while (WiFi.status() != WL_CONNECTED) {
    digitalWrite(STATUS_LED, HIGH);
    delay(200);
    digitalWrite(STATUS_LED, LOW);
    delay(200);
    Serial.print(".");
  }

  Serial.println();
  Serial.println("[ESP32 WiFi] Connected successfully!");
  Serial.print("[ESP32 WiFi] Assigned IP: ");
  Serial.println(WiFi.localIP());
  Serial.print("[ESP32 WiFi] Subnet Mask: ");
  Serial.println(WiFi.subnetMask());
  Serial.print("[ESP32 WiFi] Gateway IP: ");
  Serial.println(WiFi.gatewayIP());
  Serial.print("[ESP32 WiFi] Signal RSSI: ");
  Serial.print(WiFi.RSSI());
  Serial.println(" dBm");
  Serial.println("============================================");
  Serial.println();
}

void loop() {
  requestCount++;

  // Activity LED pulse
  digitalWrite(STATUS_LED, HIGH);
  delay(50);
  digitalWrite(STATUS_LED, LOW);

  if (WiFi.status() == WL_CONNECTED) {
    HTTPClient http;
    Serial.print("[HTTP Client] #");
    Serial.print(requestCount);
    Serial.print(" GET ");
    Serial.println(apiEndpoint);

    http.begin(apiEndpoint);
    int httpResponseCode = http.GET();

    if (httpResponseCode > 0) {
      Serial.print("[HTTP Client] Status: ");
      Serial.println(httpResponseCode);
      String payload = http.getString();
      Serial.println("[HTTP Client] Response:");
      Serial.println(payload);
    } else {
      Serial.print("[HTTP Client] Error code: ");
      Serial.println(httpResponseCode);
    }
    http.end();
  } else {
    Serial.println("[ESP32 WiFi] Connection lost. Reconnecting...");
    WiFi.reconnect();
  }

  delay(5000);
}
`,
    config: `#pragma once

#define STATUS_LED 2
#define SYSTEM_BAUD 115200
`,
    diagram: {
      version: 1,
      author: 'Ohmic',
      editor: 'wokwi',
      parts: [
        { type: 'wokwi-esp32', id: 'esp32_1', top: 160, left: 180, attrs: { board: 'doit_devkit_v1', freq: 240 } },
        { type: 'wokwi-dht11', id: 'dht1', top: 160, left: 480, attrs: { temperature: 26.8, humidity: 55.4 } },
      ],
      connections: [
        ['esp32_1:3V3', 'dht1:VCC', '#ef4444', []],
        ['esp32_1:GND.1', 'dht1:GND', '#18181b', []],
        ['esp32_1:4', 'dht1:DATA', '#3b82f6', []],
      ],
    },
  },
  {
    id: 'esp32_freertos',
    name: 'ESP32 Dual-Core FreeRTOS Multitasking',
    badge: 'Dual-Core SMP',
    board: 'esp32',
    description: 'Concurrent FreeRTOS task scheduling: Sensor Acquisition on Core 0 & Telemetry on Core 1.',
    icon: Layers,
    sketch: `#include "config.h"

// Ohmic DOIT ESP32 DevKit V1 - Dual-Core FreeRTOS
// Multitasking: Core 0 (Sensor Sampling) + Core 1 (Telemetry/Actuator)

volatile int sensorValue = 0;

void taskCore0(void *pvParameters) {
  for (;;) {
    sensorValue = (sensorValue + 17) % 1024;
    Serial.print("[Core 0 Task] Sensor Acquisition: Val = ");
    Serial.println(sensorValue);
    delay(400);
  }
}

void taskCore1(void *pvParameters) {
  for (;;) {
    digitalWrite(HEARTBEAT_PIN, HIGH);
    delay(100);
    digitalWrite(HEARTBEAT_PIN, LOW);
    delay(900);
    Serial.print("[Core 1 Task] Telemetry Broadcast: Processed = ");
    Serial.println(sensorValue);
  }
}

void setup() {
  pinMode(HEARTBEAT_PIN, OUTPUT);
  Serial.begin(SYSTEM_BAUD);
  Serial.println();
  Serial.println("[ESP32 FreeRTOS] Starting Dual-Core Multitasking Engine...");
  
  // Core 0 Task
  Serial.println("[FreeRTOS] Spawned task_sensor on Core 0 (Priority 2)");
  
  // Core 1 Task
  Serial.println("[FreeRTOS] Spawned task_telemetry on Core 1 (Priority 1)");
}

void loop() {
  taskCore0(NULL);
  taskCore1(NULL);
}
`,
    config: `#pragma once

#define HEARTBEAT_PIN 2
#define SYSTEM_BAUD 115200
`,
    diagram: {
      version: 1,
      author: 'Ohmic',
      editor: 'wokwi',
      parts: [
        { type: 'wokwi-esp32', id: 'esp32_1', top: 160, left: 200, attrs: { board: 'doit_devkit_v1', freq: 240 } },
      ],
      connections: [],
    },
  },
  {
    id: 'empty_esp32',
    name: 'Empty ESP32 Breadboard',
    badge: 'Clean Canvas',
    board: 'esp32',
    description: 'Clean workspace containing DOIT ESP32 DevKit V1 (240 MHz, 3.3V Logic) and Half Breadboard.',
    icon: SquareCode,
    sketch: `#include "config.h"

// Ohmic DOIT ESP32 DevKit V1 - Clean Canvas
// Target: ESP32 Tensilica Xtensa Dual-Core 32-bit @ 240 MHz

void setup() {
  Serial.begin(SYSTEM_BAUD);
  Serial.println("[Ohmic] DOIT ESP32 DevKit V1 Ready.");
}

void loop() {
  // Add your ESP32 logic here
  delay(10);
}
`,
    config: `#pragma once

#define SYSTEM_BAUD 115200
`,
    diagram: {
      version: 1,
      author: 'Ohmic',
      editor: 'wokwi',
      parts: [
        { type: 'wokwi-esp32', id: 'esp32_1', top: 160, left: 160, attrs: { board: 'doit_devkit_v1', freq: 240 } },
        { type: 'wokwi-breadboard-half', id: 'bb1', top: 160, left: 480, attrs: {} },
      ],
      connections: [],
    },
  },
];

interface CreateProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (parentPath: string, name: string, template?: ProjectTemplate) => Promise<void>;
  onBrowseFolder: () => Promise<string | null>;
}

export const CreateProjectModal: React.FC<CreateProjectModalProps> = ({
  isOpen,
  onClose,
  onCreate,
  onBrowseFolder,
}) => {
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('blink');
  const [boardFilter, setBoardFilter] = useState<'all' | 'uno' | 'esp32'>('all');
  const [projectName, setProjectName] = useState<string>('');
  const [parentPath, setParentPath] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  const modalBoxRef = useRef<HTMLDivElement>(null);
  const posRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  // Generate randomized default project name on open
  useEffect(() => {
    if (isOpen) {
      const rand = Math.floor(1000 + Math.random() * 9000);
      setProjectName(`Project_${rand}`);
      setErrorMessage(null);
      setIsSubmitting(false);
      posRef.current = { x: 0, y: 0 };
      if (modalBoxRef.current) {
        modalBoxRef.current.style.transform = `translate3d(0px, 0px, 0px)`;
      }
    }
  }, [isOpen]);

  // Keyboard shortcut: Escape to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Draggable window physics
  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest('button')) return;
    const startX = e.clientX;
    const startY = e.clientY;
    const initialPos = { ...posRef.current };

    const onPointerMove = (moveEvent: PointerEvent) => {
      const dx = moveEvent.clientX - startX;
      const dy = moveEvent.clientY - startY;
      posRef.current = { x: initialPos.x + dx, y: initialPos.y + dy };
      if (modalBoxRef.current) {
        modalBoxRef.current.style.transform = `translate3d(${posRef.current.x}px, ${posRef.current.y}px, 0px)`;
      }
    };

    const onPointerUp = () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
    };

    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
  };

  const filteredTemplates = useMemo(() => {
    if (boardFilter === 'all') return PROJECT_TEMPLATES;
    return PROJECT_TEMPLATES.filter((t) => t.board === boardFilter);
  }, [boardFilter]);

  const unoCount = useMemo(() => PROJECT_TEMPLATES.filter((t) => t.board === 'uno').length, []);
  const esp32Count = useMemo(() => PROJECT_TEMPLATES.filter((t) => t.board === 'esp32').length, []);

  const selectedTemplate = useMemo(() => {
    return PROJECT_TEMPLATES.find((t) => t.id === selectedTemplateId) || PROJECT_TEMPLATES[0];
  }, [selectedTemplateId]);

  const handleBrowse = async () => {
    const selected = await onBrowseFolder();
    if (selected) {
      setParentPath(selected);
    }
  };

  const handleFormSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const trimmedName = projectName.trim();
    if (!trimmedName) {
      setErrorMessage('กรุณาระบุชื่อโปรเจกต์ (Project name cannot be empty)');
      return;
    }

    const ILLEGAL_CHARS = /[\\/:*?"<>|]/;
    if (ILLEGAL_CHARS.test(trimmedName)) {
      setErrorMessage('ชื่อโปรเจกต์ต้องไม่มีอักขระพิเศษ: \\ / : * ? " < > |');
      return;
    }

    if (/[. ]$/.test(trimmedName)) {
      setErrorMessage('ชื่อโปรเจกต์ต้องไม่ลงท้ายด้วยเครื่องหมายจุดหรือช่องว่าง');
      return;
    }

    setErrorMessage(null);
    setIsSubmitting(true);
    try {
      await onCreate(parentPath.trim() || '.', trimmedName, selectedTemplate);
    } catch (err: any) {
      const rawMsg = typeof err === 'string' ? err : err?.message || String(err);
      if (rawMsg.includes('already exists') || rawMsg.includes('Directory already exists')) {
        setErrorMessage(`โฟลเดอร์โปรเจกต์ "${trimmedName}" มีอยู่แล้วในไดเรกทอรีนี้ กรุณาเปลี่ยนชื่อใหม่`);
      } else if (rawMsg.toLowerCase().includes('permission') || rawMsg.toLowerCase().includes('access is denied')) {
        setErrorMessage('ไม่มีสิทธิ์เข้าถึงหรือบันทึกไฟล์ในไดเรกทอรีนี้ (Permission Denied)');
      } else {
        setErrorMessage(`เกิดข้อผิดพลาดในการสร้างโปรเจกต์: ${rawMsg}`);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs select-none p-4"
      onClick={onClose}
    >
      <div
        ref={modalBoxRef}
        onClick={(e) => e.stopPropagation()}
        className="w-[840px] max-w-[96vw] bg-[#141416] border border-[#242428] rounded-2xl shadow-2xl flex flex-col overflow-hidden outline-none will-change-transform"
        style={{ transform: 'translate3d(0px, 0px, 0px)' }}
      >
        {/* Draggable Header */}
        <div
          onPointerDown={handlePointerDown}
          className="h-11 px-4 bg-[#18181b] border-b border-[#222226] flex items-center justify-between cursor-move select-none"
        >
          <div className="flex items-center gap-2 text-zinc-100 font-semibold text-xs tracking-tight">
            <Cpu className="w-4 h-4 text-zinc-400" />
            <span>Create New Project</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-7 h-7 rounded-full flex items-center justify-center text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
            title="Close"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Content Body */}
        <form onSubmit={handleFormSubmit} className="p-5 space-y-4 text-xs">
          {/* Template Selector Section */}
          <div>
            <div className="flex items-center justify-between mb-2.5">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">
                  Starter Template
                </span>
                <span className="text-[10px] font-mono text-zinc-500 tabular-nums">
                  ({filteredTemplates.length} of {PROJECT_TEMPLATES.length} Available)
                </span>
              </div>

              {/* Board Filter Tabs (Pill Buttons) */}
              <div className="flex items-center gap-1 p-0.5 bg-[#1a1a1e] rounded-full border border-zinc-800/80">
                <button
                  type="button"
                  onClick={() => setBoardFilter('all')}
                  className={`rounded-full px-2.5 py-1 text-[10px] font-medium transition-all ${
                    boardFilter === 'all'
                      ? 'bg-zinc-700 text-white shadow-xs'
                      : 'text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  All ({PROJECT_TEMPLATES.length})
                </button>
                <button
                  type="button"
                  onClick={() => setBoardFilter('uno')}
                  className={`rounded-full px-2.5 py-1 text-[10px] font-medium transition-all flex items-center gap-1 ${
                    boardFilter === 'uno'
                      ? 'bg-zinc-700 text-white shadow-xs'
                      : 'text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  <Cpu className="w-3 h-3" />
                  Uno ({unoCount})
                </button>
                <button
                  type="button"
                  onClick={() => setBoardFilter('esp32')}
                  className={`rounded-full px-2.5 py-1 text-[10px] font-medium transition-all flex items-center gap-1 ${
                    boardFilter === 'esp32'
                      ? 'bg-zinc-700 text-white shadow-xs'
                      : 'text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  <Wifi className="w-3 h-3" />
                  ESP32 ({esp32Count})
                </button>
              </div>
            </div>

            {/* Inset Box List for Templates (Anti-Card-Nesting, Expanded Height) */}
            <div className="rounded-xl bg-[#1c1c20] p-1.5 border border-zinc-800/60 max-h-[360px] overflow-y-auto space-y-1 scrollbar-thin">
              {filteredTemplates.map((tpl) => {
                const IconComponent = tpl.icon;
                const isSelected = tpl.id === selectedTemplateId;
                const isEsp32 = tpl.board === 'esp32';
                return (
                  <div
                    key={tpl.id}
                    onClick={() => setSelectedTemplateId(tpl.id)}
                    className={`px-3 py-2 rounded-lg cursor-pointer transition-all flex items-center justify-between gap-3 ${
                      isSelected
                        ? 'bg-[#26262a] text-white shadow-xs'
                        : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/40'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                      <div
                        className={`w-7 h-7 rounded-md flex items-center justify-center shrink-0 ${
                          isSelected ? 'bg-zinc-700 text-white' : 'bg-zinc-800/60 text-zinc-400'
                        }`}
                      >
                        <IconComponent className="w-4 h-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 leading-snug">
                          <span className="font-medium text-xs truncate">{tpl.name}</span>
                          <span
                            className={`text-[9px] font-mono px-1.5 py-0.2 rounded-full shrink-0 whitespace-nowrap [word-break:keep-all] border ${
                              isEsp32
                                ? 'bg-zinc-800 text-zinc-300 border-zinc-700/80'
                                : 'bg-zinc-900 text-zinc-400 border-zinc-800'
                            }`}
                          >
                            {isEsp32 ? 'ESP32 240 MHz' : 'UNO 16 MHz'}
                          </span>
                        </div>
                        <div className="text-[10px] text-zinc-500 truncate leading-normal mt-0.5">
                          {tpl.description}
                        </div>
                      </div>
                    </div>

                    <Badge
                      variant="outline"
                      className="text-[9px] font-mono shrink-0 whitespace-nowrap [word-break:keep-all] border-zinc-700/60"
                    >
                      {tpl.badge}
                    </Badge>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Project Details Fields */}
          <div className="space-y-3 pt-3 border-t border-zinc-800/70">
            <div>
              <label className="text-[10px] uppercase font-semibold text-zinc-400 block mb-1.5 tracking-wider">
                Project Name
              </label>
              <Input
                value={projectName}
                onChange={(e) => {
                  setProjectName(e.target.value);
                  if (errorMessage) setErrorMessage(null);
                }}
                placeholder="e.g. ESP32_WiFi_Sensor"
                className={`bg-[#121215] text-zinc-100 font-mono text-xs rounded-xl h-8 transition-colors ${
                  errorMessage
                    ? 'border-red-500/70 focus-visible:border-red-500'
                    : 'border-zinc-800 focus-visible:border-zinc-500'
                }`}
              />
            </div>

            <div>
              <label className="text-[10px] uppercase font-semibold text-zinc-400 block mb-1.5 tracking-wider">
                Parent Folder
              </label>
              <div className="flex gap-2">
                <Input
                  value={parentPath}
                  onChange={(e) => {
                    setParentPath(e.target.value);
                    if (errorMessage) setErrorMessage(null);
                  }}
                  placeholder="e.g. C:/Projects (or click Browse...)"
                  className="bg-[#121215] border-zinc-800 text-zinc-100 font-mono text-xs flex-1 rounded-xl h-8 focus-visible:border-zinc-500"
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleBrowse}
                  className="rounded-full border-zinc-700/80 bg-[#18181b] hover:bg-zinc-800 text-zinc-200 text-xs shrink-0 px-3.5 h-8 flex items-center gap-1.5"
                  title="Browse folder using Windows File Explorer"
                >
                  <FolderOpen className="w-3.5 h-3.5 text-zinc-400" />
                  <span>Browse...</span>
                </Button>
              </div>
              <span className="text-[10px] text-zinc-500 mt-1 block truncate">
                Target:{' '}
                <span className="text-zinc-300 font-mono">
                  {parentPath ? `${parentPath}/${projectName}` : `./${projectName}`}
                </span>
              </span>
            </div>

            {/* Error Banner */}
            {errorMessage && (
              <div className="p-3 bg-red-950/40 border border-red-500/40 rounded-xl flex items-start gap-2.5 text-xs animate-in fade-in duration-150">
                <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                <div className="flex-1 text-red-200 leading-relaxed">
                  <div className="font-semibold text-red-300 text-[11px]">ไม่สามารถสร้างโปรเจกต์ได้</div>
                  <div className="text-[11px] text-red-200/90 mt-0.5 select-text font-sans">{errorMessage}</div>
                </div>
                <button
                  type="button"
                  onClick={() => setErrorMessage(null)}
                  className="text-red-400 hover:text-red-200 p-0.5 rounded-full hover:bg-red-900/40 transition-colors shrink-0"
                  title="ปิดการแจ้งเตือน"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>

          {/* Action Footer */}
          <div className="pt-3 border-t border-zinc-800/80 flex items-center justify-between">
            <span className="text-[10px] text-zinc-500 font-mono">
              Includes sketch.ino • config.h • diagram.json
            </span>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
                disabled={isSubmitting}
                className="rounded-full border-zinc-700/80 bg-transparent text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 text-xs h-8 px-4"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isSubmitting}
                className="rounded-full bg-white hover:bg-zinc-200 text-zinc-950 font-semibold text-xs px-4 h-8 transition-colors disabled:opacity-50 flex items-center gap-1.5 shadow-sm"
              >
                {isSubmitting ? (
                  <>
                    <div className="w-3 h-3 border-2 border-zinc-950 border-t-transparent rounded-full animate-spin" />
                    <span>Creating...</span>
                  </>
                ) : (
                  <span>Create Project</span>
                )}
              </Button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
