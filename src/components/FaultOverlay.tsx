import React from 'react';
import { CircuitFault, CircuitComponent } from '../types';
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from '@/components/ui/tooltip';
import { GoAlert } from 'react-icons/go';

export interface FaultOverlayProps {
  faults: CircuitFault[];
  getPinWorldPos: (compId: string, pinName: string) => { x: number; y: number } | null;
  components?: CircuitComponent[];
  onHoverFault?: (description: string) => void;
}

interface ResolvedFaultIndicator {
  key: string;
  x: number;
  y: number;
  fault: CircuitFault;
  title: string;
}

/**
 * Resolves component ID with resilience against minor alias differences (e.g. uno vs uno1).
 */
function resolveCompId(compId: string, components?: CircuitComponent[]): string {
  if (!components || components.length === 0) return compId;
  if (components.some((c) => c.id === compId)) return compId;

  const lower = compId.toLowerCase();
  if (lower.includes('uno') || lower.includes('mcu') || lower.includes('arduino')) {
    const uno = components.find((c) => c.kind === 'arduino_uno');
    if (uno) return uno.id;
  }
  const match = components.find((c) => c.id.toLowerCase() === lower);
  if (match) return match.id;

  return compId;
}

/**
 * Hardware Fault Overlay: Renders discrete pulsating red alert dots on pins
 * undergoing physical circuit faults (short-circuit, overcurrent, reverse polarity).
 * Features hover tooltips with detailed diagnostics and immediately auto-clears
 * when faults are resolved.
 */
export const FaultOverlay: React.FC<FaultOverlayProps> = ({
  faults,
  getPinWorldPos,
  components,
  onHoverFault,
}) => {
  if (!faults || faults.length === 0) {
    return null;
  }

  const indicators: ResolvedFaultIndicator[] = [];

  for (let i = 0; i < faults.length; i++) {
    const fault = faults[i];
    const compId = resolveCompId(fault.component_id, components);

    // Primary pin lookup
    let pos = getPinWorldPos(compId, fault.pin_name);

    // Resilience: Clean pin name prefixes (e.g., 'Pin 13' -> '13')
    if (!pos && fault.pin_name) {
      const cleanPin = fault.pin_name.replace(/^pin\s*/i, '').trim();
      pos = getPinWorldPos(compId, cleanPin);
    }

    // Component center fallback if pin coordinate cannot be resolved directly
    if (!pos && components) {
      const comp = components.find((c) => c.id === compId);
      if (comp) {
        pos = { x: comp.x + 20, y: comp.y + 10 };
      }
    }

    if (pos) {
      const title =
        fault.fault_type === 'ShortCircuit'
          ? 'Short Circuit Fault'
          : fault.fault_type === 'Overcurrent'
          ? 'Overcurrent Warning'
          : 'Reverse Polarity Fault';

      indicators.push({
        key: `fault-${fault.component_id}-${fault.pin_name}-${i}`,
        x: pos.x,
        y: pos.y,
        fault,
        title,
      });

      // For 5V or 3.3V rail short circuit on Uno, also display a companion indicator on GND
      if (
        fault.fault_type === 'ShortCircuit' &&
        (fault.pin_name === '5V' || fault.pin_name === '3.3V')
      ) {
        const gndPos = getPinWorldPos(compId, 'GND');
        if (gndPos) {
          indicators.push({
            key: `fault-${fault.component_id}-gnd-return-${i}`,
            x: gndPos.x,
            y: gndPos.y,
            fault: {
              ...fault,
              pin_name: 'GND',
              description: `Short Circuit Return: High current return path to GND (${(fault.current_ma / 1000).toFixed(2)}A)`,
            },
            title: 'Short Circuit Ground Return',
          });
        }
      }
    }
  }

  return (
    <div className="absolute inset-0 pointer-events-none z-40 select-none">
      {indicators.map((ind) => (
        <Tooltip key={ind.key}>
          <TooltipTrigger
            render={
              <div
                role="alert"
                aria-label={`${ind.title}: ${ind.fault.description}`}
                className="absolute -translate-x-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full bg-red-500 ring-2 ring-red-950 animate-pulse cursor-help pointer-events-auto shadow-[0_0_8px_#ef4444] transition-transform hover:scale-125"
                style={{ left: `${ind.x}px`, top: `${ind.y}px` }}
                onMouseEnter={() => onHoverFault?.(ind.fault.description)}
                onMouseLeave={() => onHoverFault?.('')}
              />
            }
          />
          <TooltipContent
            side="top"
            sideOffset={6}
            className="bg-[#18181b] border border-[#27272a] text-zinc-100 p-2.5 shadow-2xl rounded-md pointer-events-auto z-50 max-w-xs font-sans"
          >
            <div className="flex items-center gap-1.5 text-red-400 font-semibold text-xs">
              <GoAlert className="w-3.5 h-3.5 text-red-500 shrink-0" />
              <span>{ind.title}</span>
            </div>
            <p className="text-[11px] text-zinc-300 mt-1 font-mono leading-tight">
              {ind.fault.description}
            </p>
            {ind.fault.current_ma > 0 && (
              <div className="text-[10px] text-zinc-400 font-mono mt-1.5 pt-1 border-t border-[#27272a] flex items-center justify-between">
                <span>Current: {ind.fault.current_ma.toFixed(1)} mA</span>
                <span>Node: {ind.fault.voltage.toFixed(2)} V</span>
              </div>
            )}
          </TooltipContent>
        </Tooltip>
      ))}
    </div>
  );
};
