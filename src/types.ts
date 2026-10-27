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
  props: Record<string, any>;
}

export interface CircuitWire {
  id: string;
  fromComp: string;
  fromPin: string;
  toComp: string;
  toPin: string;
  color: string;
}

export interface PinDefinition {
  name: string;
  x: number; // offset relative to component
  y: number;
}
