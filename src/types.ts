export type ComponentKind = 
  | 'arduino_uno' 
  | 'breadboard' 
  | 'led' 
  | 'resistor' 
  | 'pushbutton' 
  | 'potentiometer';

export interface CircuitComponent {
  id: string;
  kind: ComponentKind;
  x: number;
  y: number;
  rotation?: number; // 0, 90, 180, 270 (degrees)
  flipped?: boolean;
  props: Record<string, any>;
}

export interface CircuitWire {
  id: string;
  fromComp: string;
  fromPin: string;
  toComp: string;
  toPin: string;
  color: string;
  routingMode?: 'curve' | 'ortho';
  waypoints?: { x: number; y: number }[];
}

export interface PinDefinition {
  name: string;
  x: number; // offset relative to component
  y: number;
}
