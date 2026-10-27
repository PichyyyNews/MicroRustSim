import React, { useState, useRef, useEffect } from 'react';
import {
  GoPlus,
  GoX,
  GoFileDirectory,
  GoCheck,
  GoCpu,
} from 'react-icons/go';
import {
  FolderOpen,
  Sparkles,
  ToggleLeft,
  Gauge,
  TrafficCone,
  SquareCode,
} from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';

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
  if (currentButton == LOW && lastButtonState == HIGH) {
    ledState = !ledState;
    digitalWrite(LED_PIN, ledState ? HIGH : LOW);
    Serial.print("Tactile Button Pressed! LED is now: ");
    Serial.println(ledState ? "ON" : "OFF");
    delay(60); // Debounce
  }
  lastButtonState = currentButton;
}
`,
    config: `#pragma once

// Hardware Pin Definitions
#define LED_PIN 13
#define BUTTON_PIN 2

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
        { type: 'wokwi-pushbutton', id: 'btn1', top: 110, left: 570, attrs: {} },
        { type: 'wokwi-led', id: 'led1', top: 110, left: 700, attrs: { color: 'green' } },
        { type: 'wokwi-resistor', id: 'r1', top: 140, left: 770, attrs: { value: '220' } },
      ],
      connections: [
        ['uno1:2', 'btn1:1.l', '#3b82f6', []],
        ['btn1:2.r', 'uno1:GND.1', '#18181b', []],
        ['uno1:13', 'led1:anode', '#10b981', []],
        ['led1:cathode', 'r1:1', '#10b981', []],
        ['r1:2', 'uno1:GND.2', '#18181b', []],
      ],
    },
  },
  {
    id: 'potentiometer',
    name: 'Potentiometer ADC',
    badge: 'Analog',
    description: '10-bit analog conversion. Read rotating potentiometer on A0 and stream voltage to UART.',
    icon: Gauge,
    sketch: `#include "config.h"

// MicroRustSim Potentiometer ADC Template
// 10-bit Analog to Digital Conversion (0-1023)

void setup() {
  Serial.begin(SYSTEM_BAUD);
  Serial.println("[MicroRustSim] ADC Potentiometer Stream Online.");
}

void loop() {
  int rawADC = analogRead(POT_PIN);
  float voltage = rawADC * (5.0 / 1023.0);

  Serial.print("ADC Raw: ");
  Serial.print(rawADC);
  Serial.print(" | Voltage: ");
  Serial.print(voltage, 2);
  Serial.println(" V");

  delay(200);
}
`,
    config: `#pragma once

// Hardware Pin Definitions
#define POT_PIN A0

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
        { type: 'wokwi-potentiometer', id: 'pot1', top: 110, left: 600, attrs: {} },
      ],
      connections: [
        ['uno1:5V', 'pot1:VCC', '#ef4444', []],
        ['uno1:GND.1', 'pot1:GND', '#18181b', []],
        ['uno1:A0', 'pot1:SIG', '#eab308', []],
      ],
    },
  },
  {
    id: 'traffic',
    name: 'Traffic Light Sequencer',
    badge: 'Multi-LED',
    description: 'Automated 3-phase traffic controller: Red (3s) -> Green (3s) -> Yellow (1s).',
    icon: TrafficCone,
    sketch: `#include "config.h"

// MicroRustSim Traffic Light Sequencer
// Timed state machine for 3 LEDs

void setup() {
  pinMode(RED_PIN, OUTPUT);
  pinMode(YELLOW_PIN, OUTPUT);
  pinMode(GREEN_PIN, OUTPUT);
  Serial.begin(SYSTEM_BAUD);
  Serial.println("[MicroRustSim] Traffic Controller Active.");
}

void loop() {
  // RED Phase (Stop)
  digitalWrite(RED_PIN, HIGH);
  digitalWrite(YELLOW_PIN, LOW);
  digitalWrite(GREEN_PIN, LOW);
  Serial.println("Signal: [RED] STOP");
  delay(3000);

  // GREEN Phase (Go)
  digitalWrite(RED_PIN, LOW);
  digitalWrite(GREEN_PIN, HIGH);
  Serial.println("Signal: [GREEN] GO");
  delay(3000);

  // YELLOW Phase (Caution)
  digitalWrite(GREEN_PIN, LOW);
  digitalWrite(YELLOW_PIN, HIGH);
  Serial.println("Signal: [YELLOW] CAUTION");
  delay(1000);
}
`,
    config: `#pragma once

// Hardware Pin Definitions
#define RED_PIN 12
#define YELLOW_PIN 11
#define GREEN_PIN 10

// UART Baud Rate
#define SYSTEM_BAUD 9600
`,
    diagram: {
      version: 1,
      author: 'MicroRustSim',
      editor: 'wokwi',
      parts: [
        { type: 'wokwi-arduino-uno', id: 'uno1', top: 240, left: 160, attrs: {} },
        { type: 'wokwi-breadboard-half', id: 'bb1', top: 240, left: 560, attrs: {} },
        { type: 'wokwi-led', id: 'led_r', top: 110, left: 560, attrs: { color: 'red' } },
        { type: 'wokwi-led', id: 'led_y', top: 110, left: 630, attrs: { color: 'yellow' } },
        { type: 'wokwi-led', id: 'led_g', top: 110, left: 700, attrs: { color: 'green' } },
      ],
      connections: [
        ['uno1:12', 'led_r:anode', '#ef4444', []],
        ['uno1:11', 'led_y:anode', '#eab308', []],
        ['uno1:10', 'led_g:anode', '#10b981', []],
        ['led_r:cathode', 'uno1:GND.1', '#18181b', []],
        ['led_y:cathode', 'uno1:GND.1', '#18181b', []],
        ['led_g:cathode', 'uno1:GND.1', '#18181b', []],
      ],
    },
  },
  {
    id: 'blank',
    name: 'Blank Canvas',
    badge: 'Empty',
    description: 'Clean project with Uno R3 and Breadboard. Add your own components and code freely.',
    icon: SquareCode,
    sketch: `#include "config.h"

// MicroRustSim Blank Project
// Target: ATmega328P @ 16 MHz (Arduino Uno R3)

void setup() {
  Serial.begin(SYSTEM_BAUD);
  Serial.println("[MicroRustSim] Blank project ready.");
}

void loop() {
  // Your code here
}
`,
    config: `#pragma once

// Pin configurations and hardware definitions
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
  onCreate: (parentPath: string, name: string, template: ProjectTemplate) => void;
  onBrowseFolder: () => Promise<string | null>;
}

export const CreateProjectModal: React.FC<CreateProjectModalProps> = ({
  isOpen,
  onClose,
  onCreate,
  onBrowseFolder,
}) => {
  const [selectedTemplateId, setSelectedTemplateId] = useState('blink');
  const [projectName, setProjectName] = useState('My_Arduino_Lab');
  const [parentPath, setParentPath] = useState('');

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

  const handleFormSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (projectName.trim()) {
      onCreate(parentPath.trim() || '.', projectName.trim(), selectedTemplate);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs select-none"
      onClick={onClose}
    >
      <div
        ref={modalBoxRef}
        onClick={(e) => e.stopPropagation()}
        className="w-[580px] max-w-[92vw] bg-[#141417] border border-zinc-800 rounded-xl shadow-2xl flex flex-col overflow-hidden outline-none ring-0 will-change-transform"
        style={{ transform: 'translate3d(0px, 0px, 0px)' }}
      >
        {/* Draggable Header */}
        <div
          onPointerDown={handlePointerDown}
          className="h-10 px-4 bg-[#18181b] border-b border-zinc-800 flex items-center justify-between cursor-move select-none"
        >
          <div className="flex items-center gap-2 text-zinc-100 font-semibold text-xs tracking-wide">
            <GoCpu className="w-4 h-4 text-zinc-300" />
            <span>Create New MicroRustSim Project</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800 transition-colors"
            title="Close"
          >
            <GoX className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Content Body */}
        <form onSubmit={handleFormSubmit} className="p-4 space-y-4 text-xs">
          {/* Template Selector Grid */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-[11px] font-semibold text-zinc-300 uppercase tracking-wider">
                Select Starter Template
              </label>
              <span className="text-[10px] text-zinc-500 font-mono">
                5 Starter Circuits & Firmwares
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto pr-1 scrollbar-thin">
              {PROJECT_TEMPLATES.map((tpl) => {
                const IconComponent = tpl.icon;
                const isSelected = tpl.id === selectedTemplateId;
                return (
                  <div
                    key={tpl.id}
                    onClick={() => setSelectedTemplateId(tpl.id)}
                    className={`p-2.5 rounded-lg border text-left cursor-pointer transition-all flex flex-col justify-between ${
                      isSelected
                        ? 'bg-[#1e1e23] border-zinc-300 shadow-sm'
                        : 'bg-[#18181b]/60 border-zinc-800 hover:border-zinc-700 hover:bg-[#18181b]'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-1 mb-1">
                      <div className="flex items-center gap-1.5 font-medium text-zinc-200 text-xs">
                        <IconComponent className={`w-3.5 h-3.5 ${isSelected ? 'text-white' : 'text-zinc-400'}`} />
                        <span className="truncate">{tpl.name}</span>
                      </div>
                      <span className="text-[9px] font-mono px-1 py-0.5 rounded bg-zinc-800 text-zinc-400 shrink-0">
                        {tpl.badge}
                      </span>
                    </div>
                    <p className="text-[10px] text-zinc-400 line-clamp-2 leading-relaxed">
                      {tpl.description}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Project Details Fields */}
          <div className="space-y-3 pt-2 border-t border-zinc-800/80">
            <div>
              <label className="text-[11px] font-medium text-zinc-300 block mb-1">
                Project Name
              </label>
              <Input
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                placeholder="e.g. Traffic_Light_Lab"
                className="bg-[#121215] border-zinc-800 text-zinc-100 font-mono text-xs focus:outline-none focus:ring-0 focus-visible:ring-0 focus-visible:border-zinc-500 rounded-md"
              />
            </div>

            <div>
              <label className="text-[11px] font-medium text-zinc-300 block mb-1">
                Parent Working Folder
              </label>
              <div className="flex gap-1.5">
                <Input
                  value={parentPath}
                  onChange={(e) => setParentPath(e.target.value)}
                  placeholder="e.g. C:/Projects (or click Browse...)"
                  className="bg-[#121215] border-zinc-800 text-zinc-100 font-mono text-xs flex-1 focus:outline-none focus:ring-0 focus-visible:ring-0 focus-visible:border-zinc-500 rounded-md"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleBrowse}
                  className="border-zinc-800 bg-[#18181b] hover:bg-zinc-800 text-zinc-200 hover:text-white text-xs shrink-0 px-3 h-8 flex items-center gap-1.5 rounded-md"
                  title="Browse folder using Windows File Explorer"
                >
                  <FolderOpen className="w-3.5 h-3.5 text-zinc-400" />
                  <span>Browse...</span>
                </Button>
              </div>
              <span className="text-[10px] text-zinc-500 mt-1 block">
                Destination: <span className="text-zinc-300 font-mono">{parentPath ? `${parentPath}/${projectName}` : `./${projectName}`}</span>
              </span>
            </div>
          </div>

          {/* Action Footer */}
          <div className="pt-3 border-t border-zinc-800 flex items-center justify-between">
            <span className="text-[10px] text-zinc-500 font-mono">
              Includes sketch.ino, config.h, diagram.json
            </span>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={onClose}
                className="border-zinc-800 bg-transparent text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 text-xs rounded-md"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                className="bg-zinc-100 hover:bg-white text-zinc-950 font-semibold text-xs px-3.5 shadow-none transition-colors rounded-md"
              >
                Create Project
              </Button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
