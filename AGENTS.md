# MicroRustSim: Design System & Agent Guidelines (AGENTS.md)

This document establishes the official design system, visual hierarchy, token definitions, and interaction principles for **MicroRustSim**. All AI agents and developers modifying the UI or adding features must strictly adhere to these guidelines.

---

## 1. Visual Philosophy: Clean, Minimal, Dark & Low-Text

1. **Low Text Density, Icon-First**:
   - Replace long verbal button text with crisp, recognizable vector icons (**Lucide** and **GitHub Octicons**).
   - Every toolbar action should be an icon badge or capsule button (e.g. `▶`, `⏸`, `⚡`, `⟳`, `🗎`, `⚙`).
   - Use succinct tooltips (`<Tooltip>` on hover) instead of verbose inlined explanations.
   - Summarize dense simulation information visually using color-coded status dots, micro-badges (`<Badge variant="outline">`), and metric pills.

2. **Hide Visual Clutter (Drawer Architecture & Progressive Disclosure)**:
   - Provide **1-click toggle buttons** to collapse the Left Code Editor, the Right Component Palette, or the Bottom Drawer.
   - When collapsed, the central canvas expands into a distraction-free, 100% full-screen interactive breadboard.
   - Secondary actions and overflow options belong in `<DropdownMenu>` or right-click Context Menus, never cluttering primary toolbars.
   - Collapsible groups (`<Collapsible>`) in the right panel keep inactive categories neatly tucked away.

3. **Flat Dark & Zinc Monochrome Palette (Internal IDE Tool Aesthetic)**:
   - 3-Tier Dark Surface Depth:
     - Level 0 (Canvas Base): `#09090b` / `#0a0a0c`
     - Level 1 (Card / Shell): `#141416` / `#161619` with a clean 1px zinc divider (`#222226`, `#242428`)
     - Level 2 (Inset Box / Field / Ledger): `#1c1c20` / `#1f1f23` (borderless or 1px subtle border)
     - Level 3 (Active / Hover Surface): `#26262a` / `#27272a`
   - Pure, distraction-free monochrome styling with emerald (`#10b981`) for running simulation and amber (`oklch(0.41 0.11 46)`) for warnings. All purple accents and neon gradients are strictly eliminated.

---

## 2. Anti-Card-Nesting & Anti-AI-Slop Architecture

1. **Strictly NO Card Nesting ("ห้าม Card ซ้อน Card")**:
   - **NEVER nest `<Card>` inside another `<Card>`**. This is the primary indicator of low-quality AI slop.
   - Default to NOT wrapping main view containers in Cards. Instead, use natural layout surfaces (`bg-surface`, `bg-canvas`), clean Tailwind spacing (`space-y-3`, `gap-2`), and thin 1px dividers (`<Separator />` or `border-border`).
   - For sub-items inside a container, use an **Inset Box** (`bg-[#1c1c20] rounded-xl p-3`) rather than nested cards.
2. **No Mindless 3-Card Grids**:
   - For listing items (files, projects, MCU pins, components, register banks), use flat list rows (`<div className="flex items-center justify-between p-2 hover:bg-hover rounded-md">`), `<Table>`, or `<ScrollArea>`.
3. **Single Primary Action Rule**:
   - Exactly **one** primary button (`variant="default"`, high-contrast solid white/light zinc) per view or dialog.
   - All other actions must use `variant="outline"`, `variant="ghost"`, or `variant="secondary"`.
4. **Zero Decorative Emojis**:
   - Strictly NO emojis (🚀, ✨, 💡, ⚙️, 📁) in UI headings, titles, buttons, or badges.
   - Exclusively use official vector icons (`lucide-react` or `react-icons/go`).
5. **No AI Clutter / Placeholder Slop**:
   - No mock sections (hero banners, testimonial boxes, decorative stat grids).
   - Show actual emulator state, circuit pins, register values, or real project files.

---

## 3. Design Token System

### 3.1 Corner Radii & Pill Shapes
- **Capsule / Pill Buttons & Badges**: `rounded-full` (9999px) for primary, secondary, and outline buttons, search bars, and status badges.
- **Card Containers**: `rounded-2xl` (16px–20px) for modals, dialogs, and outer floating surfaces.
- **Inset Boxes & Fields**: `rounded-xl` (10px–12px) for text inputs, textareas, and data ledgers.
- **Inner Tags / Tooltips**: `rounded-md` (4.8px–6.4px).

### 3.2 Dark Theme Color Tokens

```css
:root, .dark {
  /* Surfaces */
  --bg-canvas: #09090b;       /* Infinite grid background */
  --bg-app: #0e0e11;          /* Window base background */
  --bg-surface: #121215;      /* Panels, drawers, editor gutter */
  --bg-elevated: #18181b;     /* Dialogs, popovers, elevated overlays */
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

## 4. Typography Scale & Text Length Budgets

### 4.1 Strict Typography Hierarchy
- **Hero Metric / Big Number**: `text-3xl` or `text-4xl font-bold tracking-tight text-white font-mono`.
- **Card / View Title**: `text-base font-semibold text-zinc-100`.
- **Section Eyebrow**: `text-[10px] uppercase tracking-wider text-zinc-400 font-semibold`.
- **Standard Body / Row Item**: `text-xs font-medium text-zinc-200`.
- **Secondary Subtitle**: `text-xs text-zinc-400 leading-normal`.
- **Footnote / Hint Text**: `text-[11px] text-zinc-400 leading-relaxed max-w-[320px]`.
- **Numbers & Physical Units**: `font-mono tabular-nums text-right whitespace-nowrap`.

### 4.2 Text Length Budgets (ความยาว Text ให้พอดี ไม่ล้น ไม่ฉีกคำ)
- **Titles**: 2–4 words max (under 24 characters).
- **Button Labels**: 1–3 words max (under 16 characters), `whitespace-nowrap shrink-0`.
- **Footnotes & Descriptions**: Cap max width at `max-w-[320px]` or `max-w-[360px]` with `leading-relaxed` so text flows naturally in 2–3 lines without hanging single orphan words.

### 4.3 Badge & Metric Guidelines (Strict "ไม่เอาหน่วยแตก" / No Unit Splitting Rule)
For `<Badge variant="outline">` and metric pills displaying physical or engineering values (e.g. `16 MHz`, `5 V`, `220 Ω`, `60 FPS`, `9600 baud`, `100 ms`, `$1,211.29 USD`):
1. **Strictly Non-Breaking Units ("ไม่เอาหน่วยแตก")**:
   - The value and its measurement unit must never wrap or split across lines (`16` on line 1 and `MHz` on line 2 is strictly forbidden).
   - Enforce `whitespace-nowrap`, `shrink-0`, `tabular-nums`, and `[word-break:keep-all]` on `<Badge variant="outline">`.
   - Use non-breaking space (`\u00A0` or `&nbsp;`) between number and unit, or wrap them in an atomic span.
2. **Tabular Numerals & Monospace**:
   - Dynamic simulation values must use `font-mono tabular-nums` to eliminate layout jitter.
3. **Atomic Micro-Pills**:
   - Keep badge height consistent (`h-5`), with crisp 1px borders (`border-border`), and prevent shrinking (`shrink-0`).

---

## 5. shadcn/ui Component Standards

The frontend uses **shadcn/ui** with:
- **Style**: `base-nova`
- **Base Library**: `@base-ui/react`
- **Icons**: `lucide-react` (with `react-icons/go` for specific hardware symbols)
- **CSS**: Tailwind CSS v3 with CSS variables

### 5.1 Component Selection Taxonomy
| Role / Function | Component to Use | DO NOT USE |
| :--- | :--- | :--- |
| **Row collection (files, pins, parts)** | Flat list / `<Table>` / `<Item>` | Multiple nested cards |
| **Tabbed views (Code / Logic / Pinout)** | `<Tabs>` with `<TabsList>` | Clustered buttons |
| **Input with icon / unit** | Pill Input with icon prefix/suffix | Div hack wrapping input + span |
| **Action groups (Zoom, Step, Run)** | Split Button Group / icon toggles | Disconnected button pills |
| **Contextual metadata** | `<Tooltip>` or `<Popover>` | Inlined verbose text |
| **Overflow & Actions** | `<DropdownMenu>`, Context Menu | Toolbar filled with 15 text buttons |
| **Status badge** | `<Badge variant="outline">` (ไม่เอาหน่วยแตก) | Disabled button |
| **Confirm destructive action** | `<Dialog>` with destructive action | Plain browser confirm |
| **Drawer / Panel collapse** | `<Collapsible>` | Hardcoded CSS toggle |
| **Separation** | `<Separator />` | Heavy colored borders |

---

## 6. Rules for Agents Modifying Code

1. **Preserve Token Consistency**: Never introduce arbitrary hardcoded colors like `Color32::from_rgb(123, 45, 67)` in Rust UI or `bg-blue-500` / `#123456` in React. Always reference `var(--...)` or semantic Tailwind tokens.
2. **No Excessive Text in Controls**: Use an icon + short tooltip (`<Tooltip>` in React, `on_hover_text` in egui).
3. **Always Respect Dark Visuals**: Keep canvas background dark `#09090b` and panel surface `#121215`.
4. **Never Block the UI Thread**: The simulation engine steps in configurable cycle slices per frame. Keep UI at 60 FPS.
5. **Preserve Genuine Logic**: Do not replace real emulator hooks with static mocks. The toolchain in `%LOCALAPPDATA%\MicroRustSim\tools` is genuine and must remain functional.
