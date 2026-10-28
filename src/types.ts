export type ComponentKind = 
  | 'arduino_uno' 
  | 'breadboard' 
  | 'led' 
  | 'resistor' 
  | 'pushbutton' 
  | 'potentiometer'
  | 'text_label';

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

export interface ProjectFileEntry {
  name: string;
  path: string;
  relative_path: string;
  is_dir: boolean;
  size: number;
}

export interface ProjectData {
  name: string;
  path: string;
  sketch_code: string;
  diagram_json: string;
  metadata_json: string;
  files: ProjectFileEntry[];
}

export interface RecentProject {
  name: string;
  path: string;
  last_opened: string;
}

export interface WorkspaceLayout {
  leftColumnSize?: number;
  centerColumnSize?: number;
  rightColumnSize?: number;
  leftEditorSplit?: number;
  leftExplorerSplit?: number;
  centerCanvasSplit?: number;
  centerTerminalSplit?: number;
  rightPaletteSplit?: number;
  rightInspectorSplit?: number;
  showEditor?: boolean;
  showExplorer?: boolean;
  showTerminal?: boolean;
  showPalette?: boolean;
  showInspector?: boolean;
}

export interface OpenTab {
  path: string;
  name: string;
  isDirty?: boolean;
}

export interface FileTreeNode {
  name: string;
  path: string;
  relativePath: string;
  isDir: boolean;
  size: number;
  children: FileTreeNode[];
}

export type FaultType = 'ShortCircuit' | 'Overcurrent' | 'ReversePolarity';

export interface CircuitFault {
  fault_type: FaultType;
  component_id: string;
  pin_name: string;
  description: string;
  current_ma: number;
  voltage: number;
}

export interface StepResult {
  pin13: boolean;
  lit_leds: string[];
  led_brightness?: Record<string, number>;
  serial_output: string | null;
  millis: number;
  pin_voltages?: Record<string, number>;
  mcu_pin_voltages?: Record<string, number>;
  faults?: CircuitFault[];
}

