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

export type PowerRealismMode = 'ideal' | 'realistic';
export type PowerRealismLevel = 'low' | 'medium' | 'high' | 'custom';

export interface PowerRealismConfig {
  mode: PowerRealismMode;
  level: PowerRealismLevel;
  r_internal_5v: number;
  r_internal_3v3: number;
  ripple_vpp_5v: number;
  ripple_freq_hz: number;
  noise_sigma_5v: number;
  enable_sag: boolean;
  enable_ripple: boolean;
  enable_noise: boolean;
  seed: number;
}

export const DEFAULT_POWER_REALISM_CONFIG: PowerRealismConfig = {
  mode: 'ideal',
  level: 'medium',
  r_internal_5v: 0.05,
  r_internal_3v3: 0.10,
  ripple_vpp_5v: 0.060,
  ripple_freq_hz: 100.0,
  noise_sigma_5v: 0.015,
  enable_sag: true,
  enable_ripple: true,
  enable_noise: true,
  seed: 42,
};


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

