import React, { useState, useRef, useEffect } from 'react';
import {
  FolderOpen,
  Sparkles,
  ToggleLeft,
  Gauge,
  TrafficCone,
  SquareCode,
  Check,
  AlertCircle,
  X,
  Cpu,
} from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Badge } from './ui/badge';

export interface ProjectTemplate {
  id: string;
  name: string;
  badge: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  sketch: string;
  config: string;
  diagram: any;
}

export const PROJECT_TEMPLATES: ProjectTemplate[] = [
  {
    id: 'blink',
    name: 'Blink (LED Pin 13)',
    badge: 'Starter',
    description: 'Standard ATmega328P digital output. Blinks LED on Pin 13 every 1 second.',
    icon: Sparkles,
    sketch: `#include "config.h"

// MicroRustSim Blink Template
// Target: ATmega328P @ 16 MHz (Arduino Uno R3)

void setup() {
  pinMode(LED_PIN, OUTPUT);
  Serial.begin(SYSTEM_BAUD);
  Serial.println("[MicroRustSim] Blink Template Initialized.");
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
      author: 'MicroRustSim',
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
    description: 'Digital input with tactile pushbutton. Depress button to toggle LED with debouncing.',
    icon: ToggleLeft,
    sketch: `#include "config.h"

// MicroRustSim Pushbutton Template
// Reads digital pin 2 with internal pullup

bool ledState = false;
int lastButtonState = HIGH;

void setup() {
  pinMode(LED_PIN, OUTPUT);
  pinMode(BUTTON_PIN, INPUT_PULLUP);
  Serial.begin(SYSTEM_BAUD);
  Serial.println("[MicroRustSim] Button Toggle Firmware Online.");
}

void loop() {
  int currentButton = digitalRead(BUTTON_PIN);
  if (lastButtonState == HIGH && currentButton == LOW) {
    ledState = !ledState;
    digitalWrite(LED_PIN, ledState ? HIGH : LOW);
    Serial.print("[Event] Button Clicked! LED state: ");
    Serial.println(ledState ? "HIGH" : "LOW");
    delay(50); // Simple debounce
  }
  lastButtonState = currentButton;
}
`,
    config: `#pragma once

#define LED_PIN 13
#define BUTTON_PIN 2
#define SYSTEM_BAUD 9600
`,
    diagram: {
      version: 1,
      author: 'MicroRustSim',
      editor: 'wokwi',
      parts: [
        { type: 'wokwi-arduino-uno', id: 'uno1', top: 220, left: 160, attrs: {} },
        { type: 'wokwi-breadboard-half', id: 'bb1', top: 220, left: 560, attrs: {} },
        { type: 'wokwi-pushbutton', id: 'btn1', top: 100, left: 580, attrs: { color: 'black' } },
        { type: 'wokwi-led', id: 'led1', top: 200, left: 600, attrs: { color: 'green' } },
        { type: 'wokwi-resistor', id: 'r1', top: 200, left: 680, attrs: { value: '220' } },
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
    id: 'potentiometer',
    name: 'Analog Potentiometer',
    badge: 'Analog ADC',
    description: 'Analog ADC reading on A0. Maps rotary wiper voltage (0-5V) to LED blink frequency.',
    icon: Gauge,
    sketch: `#include "config.h"

// MicroRustSim Potentiometer Template
// Reads 10-bit ADC channel A0 (0..1023)

void setup() {
  pinMode(LED_PIN, OUTPUT);
  Serial.begin(SYSTEM_BAUD);
  Serial.println("[MicroRustSim] Analog ADC Monitor Online.");
}

void loop() {
  int sensorValue = analogRead(POT_PIN);
  float voltage = (sensorValue / 1023.0f) * 5.0f;
  
  Serial.print("ADC Raw: ");
  Serial.print(sensorValue);
  Serial.print(" | Voltage: ");
  Serial.print(voltage, 2);
  Serial.println(" V");

  int blinkDelay = map(sensorValue, 0, 1023, 50, 1000);
  digitalWrite(LED_PIN, HIGH);
  delay(blinkDelay);
  digitalWrite(LED_PIN, LOW);
  delay(blinkDelay);
}
`,
    config: `#pragma once

#define LED_PIN 13
#define POT_PIN A0
#define SYSTEM_BAUD 9600
`,
    diagram: {
      version: 1,
      author: 'MicroRustSim',
      editor: 'wokwi',
      parts: [
        { type: 'wokwi-arduino-uno', id: 'uno1', top: 220, left: 160, attrs: {} },
        { type: 'wokwi-breadboard-half', id: 'bb1', top: 220, left: 560, attrs: {} },
        { type: 'wokwi-potentiometer', id: 'pot1', top: 100, left: 580, attrs: { value: '10000' } },
        { type: 'wokwi-led', id: 'led1', top: 200, left: 600, attrs: { color: 'blue' } },
        { type: 'wokwi-resistor', id: 'r1', top: 200, left: 680, attrs: { value: '220' } },
      ],
      connections: [
        ['uno1:5V', 'pot1:1', '#ef4444', []],
        ['uno1:A0', 'pot1:2', '#eab308', []],
        ['pot1:3', 'uno1:GND.1', '#18181b', []],
        ['uno1:13', 'led1:anode', '#3b82f6', []],
        ['led1:cathode', 'r1:1', '#3b82f6', []],
        ['r1:2', 'uno1:GND.2', '#18181b', []],
      ],
    },
  },
  {
    id: 'traffic',
    name: 'Traffic Light Sequencer',
    badge: 'Multi-LED',
    description: '3-State automated sequencer using Red, Yellow, and Green LEDs with serial telemetry.',
    icon: TrafficCone,
    sketch: `#include "config.h"

// MicroRustSim Traffic Light Controller
// Controls Red, Yellow, Green LEDs in cycle

#define RED_PIN 12
#define YELLOW_PIN 11
#define GREEN_PIN 10

void setup() {
  pinMode(RED_PIN, OUTPUT);
  pinMode(YELLOW_PIN, OUTPUT);
  pinMode(GREEN_PIN, OUTPUT);
  Serial.begin(SYSTEM_BAUD);
  Serial.println("[TrafficController] Initialized.");
}

void loop() {
  // RED Phase
  Serial.println("[State] RED: STOP");
  digitalWrite(RED_PIN, HIGH);
  digitalWrite(YELLOW_PIN, LOW);
  digitalWrite(GREEN_PIN, LOW);
  delay(3000);

  // GREEN Phase
  Serial.println("[State] GREEN: GO");
  digitalWrite(RED_PIN, LOW);
  digitalWrite(GREEN_PIN, HIGH);
  delay(3000);

  // YELLOW Phase
  Serial.println("[State] YELLOW: CAUTION");
  digitalWrite(GREEN_PIN, LOW);
  digitalWrite(YELLOW_PIN, HIGH);
  delay(1000);
}
`,
    config: `#pragma once

#define RED_PIN 12
#define YELLOW_PIN 11
#define GREEN_PIN 10
#define SYSTEM_BAUD 9600
`,
    diagram: {
      version: 1,
      author: 'MicroRustSim',
      editor: 'wokwi',
      parts: [
        { type: 'wokwi-arduino-uno', id: 'uno1', top: 220, left: 160, attrs: {} },
        { type: 'wokwi-breadboard-half', id: 'bb1', top: 220, left: 560, attrs: {} },
        { type: 'wokwi-led', id: 'led_red', top: 80, left: 580, attrs: { color: 'red' } },
        { type: 'wokwi-led', id: 'led_yel', top: 140, left: 580, attrs: { color: 'yellow' } },
        { type: 'wokwi-led', id: 'led_grn', top: 200, left: 580, attrs: { color: 'green' } },
        { type: 'wokwi-resistor', id: 'r_red', top: 80, left: 660, attrs: { value: '220' } },
        { type: 'wokwi-resistor', id: 'r_yel', top: 140, left: 660, attrs: { value: '220' } },
        { type: 'wokwi-resistor', id: 'r_grn', top: 200, left: 660, attrs: { value: '220' } },
      ],
      connections: [
        ['uno1:12', 'led_red:anode', '#ef4444', []],
        ['led_red:cathode', 'r_red:1', '#ef4444', []],
        ['r_red:2', 'uno1:GND.1', '#18181b', []],
        ['uno1:11', 'led_yel:anode', '#eab308', []],
        ['led_yel:cathode', 'r_yel:1', '#eab308', []],
        ['r_yel:2', 'uno1:GND.1', '#18181b', []],
        ['uno1:10', 'led_grn:anode', '#10b981', []],
        ['led_grn:cathode', 'r_grn:1', '#10b981', []],
        ['r_grn:2', 'uno1:GND.1', '#18181b', []],
      ],
    },
  },
  {
    id: 'empty',
    name: 'Empty Breadboard Circuit',
    badge: 'Clean Canvas',
    description: 'Fresh workspace containing only the Arduino Uno R3 and an empty Half Breadboard ready for custom wiring.',
    icon: SquareCode,
    sketch: `#include "config.h"

// MicroRustSim Clean Sketch
// Ready for custom Arduino C++ logic

void setup() {
  Serial.begin(SYSTEM_BAUD);
  Serial.println("[MicroRustSim] Ready.");
}

void loop() {
  // Your code here
}
`,
    config: `#pragma once

#define SYSTEM_BAUD 9600
`,
    diagram: {
      version: 1,
      author: 'MicroRustSim',
      editor: 'wokwi',
      parts: [
        { type: 'wokwi-arduino-uno', id: 'uno1', top: 220, left: 160, attrs: {} },
        { type: 'wokwi-breadboard-half', id: 'bb1', top: 220, left: 560, attrs: {} },
      ],
      connections: [],
    },
  },
];

export interface CreateProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (
    parentDir: string,
    projectName: string,
    template: ProjectTemplate
  ) => Promise<void> | void;
  onBrowseFolder: () => Promise<string | null>;
}

export const CreateProjectModal: React.FC<CreateProjectModalProps> = ({
  isOpen,
  onClose,
  onCreate,
  onBrowseFolder,
}) => {
  const [projectName, setProjectName] = useState('Traffic_Light_Lab');
  const [parentPath, setParentPath] = useState('');
  const [selectedTemplateId, setSelectedTemplateId] = useState('blink');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // 0-Latency Dragging via Direct DOM Transform
  const modalBoxRef = useRef<HTMLDivElement>(null);
  const posRef = useRef({ x: 0, y: 0 });
  const isDraggingRef = useRef(false);
  const dragStartRef = useRef({ mouseX: 0, mouseY: 0, startX: 0, startY: 0 });

  useEffect(() => {
    if (isOpen) {
      posRef.current = { x: 0, y: 0 };
      if (modalBoxRef.current) {
        modalBoxRef.current.style.transform = 'translate3d(0px, 0px, 0px)';
      }
      setErrorMessage(null);
      setIsSubmitting(false);
      setProjectName(`Project_${Date.now().toString().slice(-4)}`);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handlePointerDown = (e: React.PointerEvent) => {
    const target = e.target as HTMLElement;
    if (target.closest('button') || target.closest('input')) return;

    isDraggingRef.current = true;
    dragStartRef.current = {
      mouseX: e.clientX,
      mouseY: e.clientY,
      startX: posRef.current.x,
      startY: posRef.current.y,
    };

    const header = e.currentTarget as HTMLElement;
    header.setPointerCapture(e.pointerId);

    const onPointerMove = (ev: PointerEvent) => {
      if (!isDraggingRef.current) return;
      const dx = ev.clientX - dragStartRef.current.mouseX;
      const dy = ev.clientY - dragStartRef.current.mouseY;
      posRef.current = {
        x: dragStartRef.current.startX + dx,
        y: dragStartRef.current.startY + dy,
      };
      if (modalBoxRef.current) {
        modalBoxRef.current.style.transform = `translate3d(${posRef.current.x}px, ${posRef.current.y}px, 0px)`;
      }
    };

    const onPointerUp = (ev: PointerEvent) => {
      isDraggingRef.current = false;
      try {
        header.releasePointerCapture(ev.pointerId);
      } catch {}
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
    };

    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
  };

  const selectedTemplate =
    PROJECT_TEMPLATES.find((t) => t.id === selectedTemplateId) || PROJECT_TEMPLATES[0];

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

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs select-none"
      onClick={onClose}
    >
      <div
        ref={modalBoxRef}
        onClick={(e) => e.stopPropagation()}
        className="w-[560px] max-w-[94vw] bg-[#141416] border border-[#242428] rounded-2xl shadow-2xl flex flex-col overflow-hidden outline-none will-change-transform"
        style={{ transform: 'translate3d(0px, 0px, 0px)' }}
      >
        {/* Draggable Header */}
        <div
          onPointerDown={handlePointerDown}
          className="h-11 px-4 bg-[#18181b] border-b border-[#222226] flex items-center justify-between cursor-move select-none"
        >
          <div className="flex items-center gap-2 text-zinc-100 font-semibold text-xs tracking-tight">
            <Cpu className="w-4 h-4 text-zinc-300" />
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
        <form onSubmit={handleFormSubmit} className="p-4 space-y-4 text-xs">
          {/* Template Selector Section */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">
                Starter Template
              </span>
              <span className="text-[10px] font-mono text-zinc-500 tabular-nums">
                5 Circuits Available
              </span>
            </div>

            {/* Inset Box List for Templates (Anti-Card-Nesting) */}
            <div className="rounded-xl bg-[#1c1c20] p-1.5 border border-zinc-800/60 max-h-48 overflow-y-auto space-y-1 scrollbar-thin">
              {PROJECT_TEMPLATES.map((tpl) => {
                const IconComponent = tpl.icon;
                const isSelected = tpl.id === selectedTemplateId;
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
                      <div className={`w-6 h-6 rounded-md flex items-center justify-center shrink-0 ${
                        isSelected ? 'bg-zinc-700 text-white' : 'bg-zinc-800/60 text-zinc-400'
                      }`}>
                        <IconComponent className="w-3.5 h-3.5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="font-medium text-xs truncate leading-snug">
                          {tpl.name}
                        </div>
                        <div className="text-[10px] text-zinc-500 truncate leading-normal">
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
          <div className="space-y-3 pt-2 border-t border-zinc-800/70">
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
                placeholder="e.g. Traffic_Light_Lab"
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
                Target: <span className="text-zinc-300 font-mono">{parentPath ? `${parentPath}/${projectName}` : `./${projectName}`}</span>
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
