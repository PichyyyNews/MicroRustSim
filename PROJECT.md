# Project: MicroRustSim v0.2.1

## Architecture
MicroRustSim v0.2.1 is an interactive, cycle-accurate embedded simulation platform featuring a Tauri v2 desktop shell (Rust + React 18 / Vite / Tailwind / Canvas 2D) running an AVR ATmega328P MCU simulation coupled with a genuine physical nodal/branch circuit solver.

### Component Interaction & Data Flow
1. **MCU Simulation**: The ATmega328P runs in a dedicated worker thread via `avr8rs` in `crates/sim_core`, executing instructions cycle-by-cycle.
2. **Physical Circuit Simulation**: A Modified Nodal Analysis (MNA) electrical solver in `crates/sim_core` models all passive and active components (breadboard, resistors, potentiometers, LEDs, buttons, and MCU GPIO pins via Norton equivalents) as a physical matrix $\mathbf{G}\mathbf{v} = \mathbf{j}$.
3. **Fault Detection Engine**: Real-time evaluation of branch currents, total rail currents (5V > 500mA, 3.3V > 150mA), GPIO pin ratings (> 40mA), and reverse polarity, emitting structured `CircuitFault` records.
4. **Tauri IPC Bridge**: `src-tauri/src/lib.rs` executes `step_simulation` at ~60 FPS (266,666 cycles/step), returning `StepResult` with serial output, LED states/brightness, true analog `pin_voltages: HashMap<String, f32>`, `mcu_pin_voltages: HashMap<String, f32>`, and active `faults: Vec<CircuitFault>`.
5. **Frontend UI & Visualization**: `src/App.tsx` updates reactive state, streaming exact analog pin voltages to the custom Canvas 2D `LogicWaveform` (0.0V–5.0V continuous curves) and rendering discrete pulsating red alert dots (`bg-red-500 ring-2 ring-red-950 animate-pulse`, ~8x8px) with hover tooltips at exact pin world coordinates (`getPinWorldPos`), auto-clearing when resolved.

---

## Feature Inventory
| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| F1 | MNA Physical Solver | Replace DFS graph path search with Modified Nodal Analysis matrix solver ($\mathbf{G}\mathbf{v} = \mathbf{j}$) | M1 | ORIGINAL_REQUEST §R1 |
| F2 | ATmega328P Pin Norton Models | 5V rail, 3.3V LDO, GND, GPIO CMOS internal resistance ($R_{on} \approx 25\Omega$), high-Z inputs (>100MΩ) | M1 | ORIGINAL_REQUEST §R1 |
| F3 | Linear Resistors | Ohm's law branch impedance ($V = IR$) without artificial 10Ω clamp | M1 | ORIGINAL_REQUEST §R1 |
| F4 | Potentiometer Voltage Division | Continuous 3-terminal model with 10kΩ track impedance, $R_{top}=(1-\alpha)10\text{k}\Omega, R_{bot}=\alpha 10\text{k}\Omega$, load-aware wiper voltage | M1 | ORIGINAL_REQUEST §R1 |
| F5 | LED Diode $V_f$ & Brightness | Dynamic piecewise/Newton-Raphson exponential diode current, color-specific $V_f$, physical brightness scaling | M1 | ORIGINAL_REQUEST §R1 |
| F6 | Pushbutton Impedance | SPST switch with open impedance (>10GΩ) and closed contact resistance (~0.05Ω) | M1 | ORIGINAL_REQUEST §R1 |
| F7 | Breadboard Tie-Points & Rails | 5-hole terminal tie-points with 0.05Ω contact resistance, dual power distribution rails | M1 | ORIGINAL_REQUEST §R1 |
| F8 | Short-Circuit Fault Detection | Direct 5V / 3.3V to GND connection detection (>500mA / >150mA rail current) | M2 | ORIGINAL_REQUEST §R2 |
| F9 | GPIO Overcurrent Protection | Absolute maximum rating violation (>40mA sink/source per GPIO pin) detection | M2 | ORIGINAL_REQUEST §R2 |
| F10 | Reverse Polarity Detection | Anode/cathode reversal on polarized components ($V_c - V_a > 0.5\text{V}$) | M2 | ORIGINAL_REQUEST §R2 |
| F11 | IPC Protocol Extension | `StepResult` in `src-tauri` streaming `pin_voltages: HashMap<String, f32>` and `faults: Vec<CircuitFaultDto>` | M2 | ORIGINAL_REQUEST §R2, §R3 |
| F12 | Real-Voltage Oscilloscope | Bottom drawer logic plotter rendering continuous analog voltages ($0.0\text{V} - 5.0\text{V}$) at 60 FPS | M3 | ORIGINAL_REQUEST §R3 |
| F13 | Discrete Visual Fault Indicator | Small red dot (`bg-red-500 ring-2 ring-red-950 animate-pulse`, ~8x8px) rendered directly at pin world coordinates | M4 | ORIGINAL_REQUEST §R2 |
| F14 | Fault Tooltips & Auto-Clear | Hover tooltip explaining fault details; instant clearing when wiring fault is resolved | M4 | ORIGINAL_REQUEST §R2 |
| F15 | Complete Mock Removal | Eliminate all synthetic waveform mocks (`Math.sin`, UI prop mirroring) and hardcoded resistor clamps | M5 | ORIGINAL_REQUEST §R4 |
| F16 | Release Version Bump | Bump project version to `0.2.1` in `package.json`, `Cargo.toml`, and config manifests | M5 | ORIGINAL_REQUEST §R4 |
| F17 | Design System Integrity | Strict adherence to `AGENTS.md` (flat dark zinc `#09090b` palette, Octicons, collapsible panels, zero purple) | M4, M5 | ORIGINAL_REQUEST §R5 |
| F18 | Comprehensive E2E Test Suite | 4-Tier test suite covering features, boundaries, combinations, and real-world workloads | M6 (Test Track) | ORIGINAL_REQUEST §Acceptance |

---

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| M1 | Physical Nodal Electrical Engine | Implement MNA solver, Norton pin models, component stamps (resistors, pot divider, diode $V_f$, button, breadboard) in `crates/sim_core` | none | **DONE** |
| M2 | Fault Detection & IPC Streaming | Implement short-circuit, GPIO overcurrent (>40mA), reverse polarity detection, and extend Tauri IPC `StepResult` | M1 | **DONE** |
| M3 | Real-Voltage Waveform Oscilloscope | Update `src/components/LogicWaveform.tsx` and `src/App.tsx` to plot real continuous analog voltages ($0.0\text{V}-5.0\text{V}$) | M2 | **DONE** |
| M4 | Discrete Fault Visual Indicators & UI | Implement canvas fault indicator overlay with red pulsating dots, hover tooltips, auto-clear, and AGENTS.md zinc styling | M2 | **DONE** |
| M5 | Mock Removal & Version Bump v0.2.1 | Eliminate static mocks across backend and frontend; bump versions to 0.2.1 in Cargo.toml and package.json | M3, M4 | **DONE** |
| M6 | E2E Test Suite & Final Hardening | Execute full automated E2E test suite (Tiers 1-4) and adversarial verification (Tier 5) | M1, M2, M3, M4, M5 | **DONE** |

---

## Interface Contracts

### 1. `crates/sim_core` ↔ `src-tauri`
```rust
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CircuitFault {
    pub fault_type: FaultType,       // ShortCircuit, Overcurrent, ReversePolarity
    pub component_id: String,
    pub pin_name: String,
    pub description: String,
    pub current_ma: f32,
    pub voltage: f32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StepResult {
    pub pin13: bool,
    pub lit_leds: Vec<String>,
    pub led_brightness: HashMap<String, f32>,
    pub serial_output: Option<String>,
    pub millis: f64,
    pub pin_voltages: HashMap<String, f32>,
    pub mcu_pin_voltages: HashMap<String, f32>,
    pub faults: Vec<CircuitFault>,
}
```

### 2. `src-tauri` ↔ Frontend `src/App.tsx` (Tauri IPC)
- Command: `step_simulation(cycles: number)`
- Payload returned: `StepResult` (matching contract above).
- State binding:
  - `pin_voltages` -> streams into `waveformHistory`
  - `faults` -> reactive state `circuitFaults: CircuitFault[]`, auto-cleared when array is empty.

### 3. `src/App.tsx` ↔ `src/components/LogicWaveform.tsx`
```typescript
export interface WaveformChannel {
  id: string;
  label: string;
  color: string;
  history: [number, number][]; // [timestamp_ms, voltage_volts]
  isDigital?: boolean;         // false for real continuous analog curves (0.0V - 5.0V)
}
```

### 4. `src/App.tsx` ↔ Fault Indicator Overlay
- Component: `FaultOverlay.tsx`
- Coordinate mapper: `getPinWorldPos(fault.component_id, fault.pin_name)` -> `{ x: number, y: number }`
- Indicator element: `div` styled with `w-2.5 h-2.5 rounded-full bg-red-500 ring-2 ring-red-950 animate-pulse`
- Tooltip: Wrapped in `<Tooltip>` showing `fault.description`.

---

## Code Layout & Write Boundaries
| Module / Area | Primary Files Owned | Assigned Milestone |
|---------------|---------------------|--------------------|
| Backend Sim Core | `crates/sim_core/src/lib.rs`, `crates/sim_core/src/circuit.rs`, `crates/sim_core/src/solver.rs` | M1, M2 |
| Tauri IPC Bridge | `src-tauri/src/lib.rs`, `src-tauri/Cargo.toml`, `src-tauri/tauri.conf.json` | M2, M5 |
| Frontend Waveform | `src/components/LogicWaveform.tsx` | M3 |
| Frontend App & Overlay | `src/App.tsx`, `src/types.ts`, `src/components/FaultOverlay.tsx` | M3, M4, M5 |
| E2E Test Suite | `crates/sim_core/tests/e2e_circuit_tests.rs` | M6 (Test Track) |
| Manifests / Versions | `package.json`, `Cargo.toml`, `crates/*/Cargo.toml` | M5 |
