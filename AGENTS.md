# MicroRustSim: Design System & Agent Guidelines (AGENTS.md)

This document establishes the official design system, visual hierarchy, token definitions, and interaction principles for **MicroRustSim**. All AI agents and developers modifying the UI or adding features must strictly adhere to these guidelines.

---

## 1. Visual Philosophy: Clean, Minimal, Dark & Low-Text

1. **Low Text Density, Icon-First**:
   - Replace long verbal button text with crisp, recognizable **GitHub Octicons** (`react-icons/go` aesthetic).
   - Use succinct tooltips (`on_hover_text`) instead of verbose inlined explanations.
   - Every toolbar action should be an icon badge (e.g. `▶`, `⏸`, `⚡`, `⟳`, `🗎`, `⚙`).
2. **Hide Visual Clutter (Drawer Architecture)**:
   - Provide **1-click toggle buttons** to collapse the Left Code Editor, the Right Component Palette, or the Bottom Drawer.
   - When collapsed, the central canvas expands into a distraction-free, 100% full-screen interactive breadboard.
   - Collapsible groups in the right panel keep inactive categories neatly tucked away.
3. **Flat Dark & Zinc Monochrome Palette (Internal IDE Tool Aesthetic)**:
   - Deep dark surfaces (`#09090b`, `#121215`, `#18181b`).
   - Clean zinc dividers (`#222226`, `#27272a`).
   - Pure, distraction-free monochrome styling with emerald (`#10b981`) for running simulation and amber (`oklch(0.41 0.11 46)`) for warnings. All purple accents eliminated.

---

## 2. Design Token System

### 2.1 Corner Radii (`--radius`)
Following the proportional formula based on `--radius: 8px`:

| Token | Formula | Value (px) | Application |
| :--- | :--- | :--- | :--- |
| `--radius-sm` | `calc(var(--radius) * 0.6)` | **4.8px** | Tooltips, badges, inner tags |
| `--radius-md` | `calc(var(--radius) * 0.8)` | **6.4px** | Standard buttons, inputs, icon toggles |
| `--radius-lg` | `var(--radius)` | **8.0px** | Cards, component cards, modals |
| `--radius-xl` | `calc(var(--radius) * 1.4)` | **11.2px** | Floating toolbars, drawer headers |
| `--radius-2xl`| `calc(var(--radius) * 1.8)` | **14.4px** | Breadboard corners, Uno PCB pads |
| `--radius-3xl`| `calc(var(--radius) * 2.2)` | **17.6px** | Pill buttons, status badges |
| `--radius-4xl`| `calc(var(--radius) * 2.6)` | **20.8px** | Large overlay dialogs |

### 2.2 Dark Theme Color Tokens

```css
:root, .dark {
  /* Surfaces */
  --bg-canvas: #09090b;       /* Infinite grid background */
  --bg-app: #0e0e11;          /* Window base background */
  --bg-surface: #121215;      /* Panels, drawers, editor gutter */
  --bg-elevated: #18181b;     /* Cards, unpressed buttons, headers */
  --bg-hover: #27272a;        /* Hover state for buttons and list items */

  /* Borders & Dividers */
  --border-subtle: #222226;   /* Thin 1px clean dividers */
  --border-focus: #52525b;    /* Focused inputs and active component selection */

  /* Accent (Clean Flat Monochrome Zinc) */
  --accent: #27272a;          /* Flat neutral active states */
  --accent-light: #3f3f46;    /* Hover accent */
  --accent-muted: #18181b;    /* Translucent tint backgrounds */

  /* Semantic Status Tokens */
  --warning: oklch(0.41 0.11 46);             /* Dark amber surface #b45309 */
  --warning-foreground: oklch(0.99 0.02 95);  /* Clean warm text #fef3c7 */
  --success: #10b981;                         /* Running simulation emerald */
  --danger: #ef4444;                          /* Error / compile failure */

  /* Typography */
  --text-primary: #f4f4f5;    /* Headings, main code, active labels */
  --text-secondary: #a1a1aa;  /* Subtitles, pin labels, inactive tabs */
  --text-muted: #71717a;      /* Disabled text, hints, line numbers */
}
```

---

## 3. Iconography Guidelines: GitHub Octicons (`react-icons/go`)

To eliminate clutter and maintain a professional engineer-grade interface, buttons use icon-first representations inspired by GitHub Octicons:

| Action / Element | Octicon Equivalent | Symbol / Glyph | Description |
| :--- | :--- | :--- | :--- |
| **Run Simulation** | `GoPlay` | `▶` | Emerald/Purple primary run button |
| **Pause Simulation** | `GoPause` | `⏸` | Pauses cycle clock |
| **Compile & Upload** | `GoZap` | `⚡` | Flashes Arduino C++ to ATmega328P |
| **Reset MCU** | `GoSync` | `⟳` | Hardware reset trigger |
| **Serial Console** | `GoTerminal` | `>_` | Serial UART input/output drawer |
| **Logic Plot** | `GoGraph` | `∿` | Real-time digital oscilloscope |
| **Code Editor** | `GoCode` | `</>` | Sketch editing tab |
| **Add Component** | `GoPlus` | `+` | Quick spawn button in palette |
| **Remove** | `GoTrash` | `🗑` | Delete selected item or wire |
| **Settings / Config**| `GoGear` | `⚙` | Baud rate, compiler configuration |
| **Save Project** | `GoFile` | `🗎` | SQLite persistent store |
| **Fold / Unfold** | `GoSidebarCollapse` | `⏴ / ⏵` | Toggle panels to declutter screen |

---

## 4. UI Layout & Component Categorization

### 4.1 Categorized Components Palette
Rather than dumping all parts in a single sprawling list, items are categorized into collapsible drawers:
1. **Core Processing**:
   - `Arduino Uno R3` (ATmega328P @ 16 MHz)
2. **Prototyping**:
   - `Half Breadboard` (30 rows, power rails)
3. **Outputs & Actuators**:
   - `LED` (Red, Green, Blue, Yellow, White) with realistic forward voltage glow
4. **Passives**:
   - `Resistor` (220Ω, 1kΩ, 10kΩ with color code bands)
5. **Interactive Inputs**:
   - `Tactile Pushbutton` (Interactive click-to-depress)
   - `Rotary Potentiometer` (Interactive drag-to-rotate wiper for ADC)

### 4.2 Distraction-Free Toggle
- **Toggle Code Panel** (`⏴ / ⏵`): Allows immediate full focus on wiring.
- **Toggle Palette** (`⊞`): Hides parts when only interacting with completed circuits.
- **Toggle Bottom Drawer** (`>_`): Hides terminal until output is expected.

---

## 5. Rules for Agents Modifying Code

1. **Preserve Token Consistency**: Never introduce arbitrary hardcoded colors like `Color32::from_rgb(123, 45, 67)` in UI code. Always reference `crate::theme::tokens::*`.
2. **No Excessive Text in Controls**: Use an icon + short tooltip (`resp.on_hover_text(...)`).
3. **Always Respect Dark Visuals**: Keep background dark `#0f1117` and panel surface `#181b26`.
4. **Never Block the UI Thread**: The simulation engine steps in configurable cycle slices per frame. Keep UI at 60 FPS.
5. **Preserve Genuine Logic**: Do not replace real emulator hooks with static mocks. The toolchain in `%LOCALAPPDATA%\MicroRustSim\tools` is genuine and must remain functional.
