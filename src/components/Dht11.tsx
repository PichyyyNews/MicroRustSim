import React from 'react';
import { Badge } from './ui/badge';
import { Thermometer, Droplets } from 'lucide-react';

export interface Dht11Props {
  id: string;
  temperature?: number; // 0.0 to 50.0 °C (default: 24.0)
  humidity?: number;    // 20.0 to 90.0 %RH (default: 50.0)
  isSelected?: boolean;
  onTemperatureChange?: (val: number) => void;
  onHumidityChange?: (val: number) => void;
  onPinMouseDown?: (pinName: string, e: React.MouseEvent) => void;
}

export const Dht11: React.FC<Dht11Props> = ({
  id,
  temperature = 24.0,
  humidity = 50.0,
  isSelected = false,
  onTemperatureChange,
  onHumidityChange,
  onPinMouseDown,
}) => {
  const safeTemp = typeof temperature === 'number' && !isNaN(temperature)
    ? Math.max(0.0, Math.min(50.0, temperature))
    : 24.0;
  const safeHum = typeof humidity === 'number' && !isNaN(humidity)
    ? Math.max(20.0, Math.min(90.0, humidity))
    : 50.0;

  return (
    <div
      className="relative select-none flex flex-col items-center group cursor-move"
      style={{ width: '80px', height: '110px' }}
    >
      {/* Floating Canvas Micro-Pill Control (Dual Controls on Canvas) */}
      {(isSelected || true) && (
        <div
          className={`absolute -top-14 z-30 flex flex-col gap-1 px-3 py-1.5 rounded-2xl bg-[#121215]/95 border border-[#27272a] shadow-xl backdrop-blur-md transition-opacity duration-200 pointer-events-auto ${
            isSelected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
          }`}
          onMouseDown={(e) => e.stopPropagation()}
        >
          {/* Temperature Slider Row */}
          <div className="flex items-center gap-1.5">
            <Thermometer className="w-3 h-3 text-zinc-400 shrink-0" />
            <input
              type="range"
              min={0}
              max={50}
              step={0.5}
              value={safeTemp}
              onChange={(e) => onTemperatureChange?.(parseFloat(e.target.value))}
              className="w-14 h-1 bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-zinc-200"
              title="Adjust Temperature (°C)"
            />
            <Badge
              variant="outline"
              className="h-4 px-1 font-mono text-[9px] text-zinc-100 border-[#3f3f46] tabular-nums whitespace-nowrap shrink-0 [word-break:keep-all]"
            >
              {safeTemp.toFixed(1)}&nbsp;°C
            </Badge>
          </div>

          {/* Humidity Slider Row */}
          <div className="flex items-center gap-1.5">
            <Droplets className="w-3 h-3 text-zinc-400 shrink-0" />
            <input
              type="range"
              min={20}
              max={90}
              step={1}
              value={safeHum}
              onChange={(e) => onHumidityChange?.(parseFloat(e.target.value))}
              className="w-14 h-1 bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-zinc-200"
              title="Adjust Humidity (%RH)"
            />
            <Badge
              variant="outline"
              className="h-4 px-1 font-mono text-[9px] text-zinc-100 border-[#3f3f46] tabular-nums whitespace-nowrap shrink-0 [word-break:keep-all]"
            >
              {safeHum.toFixed(0)}&nbsp;%RH
            </Badge>
          </div>
        </div>
      )}

      {/* Main DHT11 Casing (Blue grid with ventilation slots) */}
      <div className="w-[64px] h-[82px] rounded-md bg-[#2573a7] border-2 border-[#1c5a84] shadow-md relative overflow-hidden flex flex-col items-center pt-2">
        {/* Silkscreen text */}
        <span className="text-[9px] font-mono tracking-wider text-white font-bold select-none pointer-events-none mb-1">
          DHT11
        </span>

        {/* Ventilation Grid Cutouts */}
        <div className="grid grid-cols-4 gap-1 p-1 bg-[#1a4f73] rounded-sm border border-[#133e5b]">
          {Array.from({ length: 16 }).map((_, i) => (
            <div key={i} className="w-2 h-2 rounded-[1px] bg-[#0d283b] shadow-inner" />
          ))}
        </div>

        {/* Internal Sensor Sensing Element hint */}
        <div className="w-8 h-1.5 bg-[#4fa3db]/40 rounded-xs mt-2" />

        {/* Pin labels at the bottom */}
        <div className="absolute bottom-1 inset-x-0 flex justify-around text-[7px] font-mono text-white/90 font-semibold px-2 pointer-events-none">
          <span>VCC</span>
          <span>DAT</span>
          <span>GND</span>
        </div>
      </div>

      {/* 3 Header Pins at the bottom: VCC, DATA, GND */}
      <div className="flex justify-around w-[54px] h-[16px] mt-1">
        {/* Pin: VCC */}
        <button
          type="button"
          onMouseDown={(e) => onPinMouseDown?.('VCC', e)}
          title={`${id}:VCC (Power 3.3V - 5V)`}
          className="w-3 h-3 rounded-full bg-amber-400 border border-amber-600 hover:scale-125 hover:ring-2 hover:ring-white transition-transform cursor-crosshair z-20 flex items-center justify-center shadow-xs"
        >
          <div className="w-1 h-1 rounded-full bg-amber-800" />
        </button>

        {/* Pin: DATA */}
        <button
          type="button"
          onMouseDown={(e) => onPinMouseDown?.('DATA', e)}
          title={`${id}:DATA (1-Wire Bidirectional Data)`}
          className="w-3 h-3 rounded-full bg-amber-400 border border-amber-600 hover:scale-125 hover:ring-2 hover:ring-white transition-transform cursor-crosshair z-20 flex items-center justify-center shadow-xs"
        >
          <div className="w-1 h-1 rounded-full bg-amber-800" />
        </button>

        {/* Pin: GND */}
        <button
          type="button"
          onMouseDown={(e) => onPinMouseDown?.('GND', e)}
          title={`${id}:GND (Ground 0V)`}
          className="w-3 h-3 rounded-full bg-amber-400 border border-amber-600 hover:scale-125 hover:ring-2 hover:ring-white transition-transform cursor-crosshair z-20 flex items-center justify-center shadow-xs"
        >
          <div className="w-1 h-1 rounded-full bg-amber-800" />
        </button>
      </div>
    </div>
  );
};
