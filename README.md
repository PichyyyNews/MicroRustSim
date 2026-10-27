# MicroRustSim

<div align="center">

[![Rust](https://img.shields.io/badge/Rust-1.80%2B-orange.svg?logo=rust&logoColor=white)](https://www.rust-lang.org/)
[![GUI](https://img.shields.io/badge/GUI-egui%200.36-blue.svg)](https://github.com/emilk/egui)
[![MCU](https://img.shields.io/badge/MCU-ATmega328P%20%40%2016MHz-8b5cf6.svg)](https://github.com/avr8rs/avr8rs)
[![Storage](https://img.shields.io/badge/Storage-Local--first%20SQLite-green.svg)](https://github.com/rusqlite/rusqlite)
[![License](https://img.shields.io/badge/License-MIT-purple.svg)](LICENSE)
[![Platform](https://img.shields.io/badge/Platform-Windows%20%7C%20Linux%20%7C%20macOS-informational.svg)](https://github.com/PichyyyNews/MicroRustSim)

**A high-performance, cycle-accurate embedded microcontroller & circuit simulator built in Pure Rust + egui.**  
*Native-first, WebAssembly-ready, low-latency, and local-first.*

[Features](#-key-features) • [Architecture](#-architecture) • [Design System](#-design-system--visual-hierarchy) • [Quickstart](#-quickstart) • [Design Guide (AGENTS.md)](AGENTS.md)

</div>

---

## 📖 Overview

**MicroRustSim** brings the fluid, interactive experience of Wokwi and Tinkercad to desktop and web using **Pure Rust** and the immediate-mode UI framework **egui**.

Designed specifically for electronics engineers, educators, and embedded software developers, MicroRustSim pairs **genuine cycle-accurate microcontroller emulation** with a real C++ compiler toolchain (`arduino-cli`), an electrical netlist engine, and an uncluttered, modern dark-mode IDE.

```
┌────────────────────────────────────────────────────────────────────────┐
│  ▶  ⏸  ⚡  ⟳  🗎           MicroRustSim  [Arduino Uno R3]         ⏴  ⊞  │
├─────────────┬────────────────────────────────────────────┬─────────────┤
│             │                                            │  COMPONENTS │
│             │      Arduino Uno R3         LED (Red)      │  ┌───────┐  │
│  void       │     ┌───────────────┐     ┌───┐            │  │ Core  │  │
│  setup() {  │     │ D13 ──────────┼─────┤ + │            │  ├───────┤  │
│    ...      │     │ GND ──────────┼─────┤ - │ (Glow 5V)  │  │ Bread │  │
│  }          │     └───────────────┘     └───┘            │  ├───────┤  │
│             │                                            │  │ Parts │  │
├─────────────┴────────────────────────────────────────────┴─────────────┤
│  >_ Serial Monitor    ∿ Logic Waveform (D13)    ⚙ Settings             │
│  [14:10:02] USART Initialized @ 9600 Baud.                             │
│  [14:10:03] D13 HIGH [████████████████████] 5.00V                      │
└────────────────────────────────────────────────────────────────────────┘
```

---

## ✨ Key Features

- **⚡ Cycle-Accurate ATmega328P Emulation**: Powered by `avr8rs` executing instructions at 16 MHz with accurate GPIO, timers, ADC, interrupts, and registers.
- **🛠️ Genuine Toolchain Integration**: Compiles real Arduino C++ sketches down to Intel HEX using local `arduino-cli` stored in `%LOCALAPPDATA%\MicroRustSim\tools`. Zero fake mocks.
- **🔌 BFS Netlist & Component Physics**:
  - **LEDs**: Dynamic forward-voltage glow (Red, Green, Blue, Yellow, White) calculated from cathode/anode potential.
  - **Resistors**: Standard 220Ω, 1kΩ, 10kΩ with realistic color code bands.
  - **Pushbutton**: Interactive tactile button with spring-back click state.
  - **Potentiometer**: Rotatable knob adjusting wiper output linearly from 0.0V to 5.0V for ADC reading.
  - **Breadboard**: 30-row half-size breadboard with linked power rails and 5-hole terminal strips.
  - **Bezier Wiring**: Smooth cubic Bezier curves with simulated gravitational sag and pin snap.
- **🎨 Engineer-Grade Minimal Dark IDE**:
  - **Icon-First Low-Text Density**: Based on **GitHub Octicons** (`react-icons/go`). Buttons use crisp glyphs (`▶`, `⏸`, `⚡`, `⟳`, `>_`, `∿`) with succinct tooltips.
  - **Drawer Architecture**: 1-click toggles (`⏴`, `⏵`, `⊞`, `>_`) to collapse the Code Editor, Component Palette, or Bottom Console, expanding into a **full-screen distraction-free circuit wiring canvas**.
  - **Balanced Purple Accent**: Refined medium violet (`#8b5cf6`) with smooth glow states.
- **📊 Real-Time Logic Analyzer & UART Console**:
  - High-performance 60 FPS digital waveform visualizer powered by `egui_plot`.
  - Non-blocking hardware UART register hooking capturing serial communication at 9600 baud.
- **💾 Local-First Persistence**:
  - Embedded SQLite database storing circuits, wire netlists, and sketch codes.
  - Wokwi-compatible `diagram.json` serialization schema.

---

## 🏛 Architecture

MicroRustSim is structured as a modular Cargo workspace:

```mermaid
flowchart TD
    subgraph UI ["crates/app (egui + eframe)"]
        UI_MAIN[App Window & Toolbar]
        THEME[Theme & Octicon Tokens]
        EDITOR[C++ Code Editor]
        CONSOLE[Serial Monitor & egui_plot Waveform]
    end

    subgraph CANVAS ["crates/sim_canvas"]
        PAINTER[Vector Breadboard & PCB Painter]
        INPUT[Interactive Knob / Pushbutton Handlers]
        BEZIER[Cubic Bezier Wire Solver]
    end

    subgraph CORE ["crates/sim_core"]
        MCU[avr8rs ATmega328P @ 16MHz Engine]
        NETLIST[BFS Electrical Solver]
        UART[Hardware USART Hook]
        PARTS[LED / Resistor / Pot / Button Models]
    end

    subgraph COMPILER ["crates/sim_compiler"]
        CLI[Arduino-CLI Backend (%LOCALAPPDATA%)]
        HEX[Intel HEX Parser & Checksum Validator]
    end

    subgraph STORAGE ["crates/sim_storage"]
        SQLITE[rusqlite Database Store]
        SCHEMA[Wokwi diagram.json Schema]
    end

    UI_MAIN --> CANVAS
    UI_MAIN --> CONSOLE
    EDITOR --> COMPILER
    COMPILER -->|Intel HEX| MCU
    MCU <--> NETLIST
    NETLIST <--> PARTS
    CANVAS <--> NETLIST
    CANVAS <--> INPUT
    UART --> CONSOLE
    UI_MAIN --> STORAGE
```

### Workspace Crates

| Crate | Responsibility | Key Technologies |
| :--- | :--- | :--- |
| **`crates/sim_core`** | MCU emulation, electrical netlist solver, pin states, component models | `avr8rs`, zero-alloc BFS |
| **`crates/sim_compiler`** | C++ sketch compilation, Intel HEX generation and validation | `arduino-cli`, `std::process` |
| **`crates/sim_canvas`** | 60 FPS viewport, infinite pan & zoom, component rendering, Bezier curves | `egui::Painter`, `epaint` |
| **`crates/sim_storage`** | Local-first project storage, Wokwi diagram.json export & import | `rusqlite`, `serde_json` |
| **`crates/app`** | Main desktop IDE executable, design system, theme tokens, panels | `eframe 0.36.2`, `egui_plot` |

---

## 🎨 Design System & Visual Hierarchy

Strictly enforced through [`AGENTS.md`](AGENTS.md) and [`crates/app/src/theme.rs`](crates/app/src/theme.rs).

### Proportional Radius Formula (`--radius: 8px`)

```
--radius-sm:  calc(var(--radius) * 0.6)  ->  4.8px   (tooltips, badges)
--radius-md:  calc(var(--radius) * 0.8)  ->  6.4px   (buttons, inputs)
--radius-lg:  var(--radius)              ->  8.0px   (cards, modals)
--radius-xl:  calc(var(--radius) * 1.4)  ->  11.2px  (floating toolbars)
--radius-2xl: calc(var(--radius) * 1.8)  ->  14.4px  (breadboard corners)
--radius-3xl: calc(var(--radius) * 2.2)  ->  17.6px  (pill badges)
--radius-4xl: calc(var(--radius) * 2.6)  ->  20.8px  (overlay dialogs)
```

### Color Palette

| Token | Value | Visual Purpose |
| :--- | :--- | :--- |
| `BG_CANVAS` | `#0f1117` | Infinite circuit grid canvas |
| `BG_APP` | `#13161f` | Base window background |
| `BG_SURFACE` | `#181b26` | Side panels, drawers, toolbars |
| `BG_ELEVATED` | `#202533` | Component cards, active items |
| `ACCENT` | `#8b5cf6` | Balanced medium purple (Violet 500) |
| `ACCENT_LIGHT` | `#a78bfa` | Hover accent glow |
| `WARNING_BG` | `oklch(0.41 0.11 46)` | Amber surface (`#b45309`) |
| `WARNING_FG` | `oklch(0.99 0.02 95)` | Warm amber text (`#fef3c7`) |
| `SUCCESS` | `#10b981` | Running simulation emerald |
| `DANGER` | `#ef4444` | Compilation / runtime error |

---

## 🚀 Quickstart

### Prerequisites

- [Rust & Cargo](https://rustup.rs/) (1.80 or newer recommended)
- Windows / Linux / macOS

### Build & Run

1. **Clone the repository:**
   ```bash
   git clone https://github.com/PichyyyNews/MicroRustSim.git
   cd MicroRustSim
   ```

2. **Run via Cargo:**
   ```bash
   cargo run --bin microrustsim
   ```

   *On Windows, you can also simply double-click or run:*
   ```powershell
   .\run.bat
   ```

3. **Run Automated Test Suite:**
   ```bash
   cargo test --all
   ```

All 5 core verification suites will run:
- Cycle-accurate Blink HEX execution.
- Genuine `arduino-cli` local compilation.
- BFS Netlist voltage & LED propagation.
- Hardware USART transmission capture (`"HELLO_RUST\r\n"`).
- SQLite database storage CRUD.

---

## 🕹 Controls & Keyboard Shortcuts

| Interaction | Action |
| :--- | :--- |
| **Middle-Click Drag** or **Right-Click Drag** | Pan canvas |
| **Mouse Scroll Wheel** | Zoom in / out |
| **Left-Click & Drag Pin** | Draw wire to another pin |
| **Click Pushbutton** | Depress tactile button (triggers digital input) |
| **Drag Potentiometer Dial** | Rotate wiper knob (adjusts 0V–5V analog input) |
| **`▶` Play Button** | Start / Resume MCU cycle simulation |
| **`⏸` Pause Button** | Pause MCU clock |
| **`⚡` Compile & Flash** | Compile editor sketch and load into ATmega328P |
| **`⏴ / ⏵` Code Toggle** | Collapse / Expand C++ Code Editor |
| **`⊞` Palette Toggle** | Collapse / Expand Component Drawer |
| **`>_` Drawer Toggle** | Collapse / Expand Output Terminal & Waveform |

---

## 🗺 Roadmap

- [x] Pure Rust ATmega328P cycle-accurate emulator engine (`avr8rs`).
- [x] Local `arduino-cli` toolchain provisioned in `%LOCALAPPDATA%\MicroRustSim\tools`.
- [x] Dynamic LED glow, Resistor color bands, Pushbutton, and Potentiometer.
- [x] Minimal Octicons-based dark UI with collapsible 3-way drawers.
- [x] Real-time logic analyzer oscilloscope (`egui_plot`).
- [x] Local-first embedded SQLite store with Wokwi `diagram.json` schema.
- [ ] ESP32-C3 RISC-V core simulation via `rvsim`.
- [ ] WebAssembly (`wasm32-unknown-unknown`) build running directly in modern browsers via WebGPU / WebGL2.
- [ ] Cloud sync via Turso / libSQL embedded replicas.
- [ ] Custom SVG parts loader from Fritzing repository via `resvg`.

---

## 📄 License

Distributed under the MIT License. See [LICENSE](LICENSE) for more information.

---

<div align="center">
Developed with ❤️ by <a href="https://github.com/PichyyyNews">PichyyyNews</a>
</div>
