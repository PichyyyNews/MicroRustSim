# MicroRustSim: Official Frontend & UI Design System (DESIGN.md)

## บทบาทและหน้าที่
คุณคือ **Senior Frontend/Design Systems Engineer** ที่เชี่ยวชาญ **shadcn/ui** และการออกแบบ UI สำหรับเครื่องมือระดับวิศวกรรม (Engineer-Grade Desktop IDE / Simulator)
เป้าหมายคือสร้าง UI ที่ **สะอาด โปร่ง minimal เน้น capsule/pill icon-first low-text จัดระเบียบง่าย และไม่มี AI slop**

---

## 1. ข้อมูลพื้นฐานโครงการ (Authoritative Project Context)

อ้างอิงจาก `components.json` และการตรวจสอบจริงของโปรเจกต์:
- **Framework**: Vite + React 18 + TypeScript (Tauri 2 Desktop App)
- **Base Primitive Library**: `@base-ui/react` (ห้ามเดาเป็น Radix ทั่วไป ให้ยึด Base UI API)
- **Style**: `base-nova`
- **Tailwind Version**: v3 พร้อม CSS Variables
- **Icon Library**: `lucide-react` และ `react-icons/go` (Octicons สำหรับสัญลักษณ์ฮาร์ดแวร์)
- **Typography**: `Geist Variable` (`@fontsource-variable/geist`)
- **Installed Components ใน `src/components/ui`**:
  `badge`, `button`, `collapsible`, `dialog`, `dropdown-menu`, `input`, `popover`, `resizable`, `scroll-area`, `select`, `separator`, `tabs`, `tooltip`

---

## 2. การใช้สีและระดับชั้นความลึก 3 ระดับ (3-Tier Surface Depth)

การสร้างมิติใน Dark Mode ห้ามใช้ Card ซ้อน Card หรือใส่เส้นขอบสีหนาเตอะ แต่ให้ใช้ **Surface Depth 3 ระดับ**:

```
[ ชั้นที่ 0 - Canvas Base: #09090b / #0a0a0c ]
       ↓
[ ชั้นที่ 1 - Panel / Card Shell: #141416 / #161619 + ขอบบาง 1px #242428 ]
       ↓
[ ชั้นที่ 2 - Inset Box / Field / Ledger: #1c1c20 / #1f1f23 ]
```

### 2.1 ตารางสีและ Token มาตรฐาน
- **Canvas Base**: `#09090b` (`--bg-canvas`): พื้นหลัง Infinite dot-grid ของแคนวาส
- **Card / Shell**: `#141416` / `#161619` (`--bg-surface`): กรอบแผงเครื่องมือ, Dialog, Modal ขนาดใหญ่ (`rounded-2xl` หรือ 16–20px)
- **Inset Box**: `#1c1c20` / `#1f1f23`: กล่องแสดงข้อมูลย่อย, สรุป Ledger, ช่องกรอก Input/Textarea (`rounded-xl` หรือ 10–12px)
- **Active Row / Tab**: `#26262a` / `#27272a`: ไฮไลต์แถบเมนูหรือแท็บที่ถูกเลือก
- **Hover State**: `#27272a` / `#323238`: สถานะชี้เมาส์ของปุ่มและรายการแถว
- **Primary Button**: `#ffffff` / `#f4f4f5` (`text-zinc-950`): ปุ่มหลักเด่นชัด 1 ปุ่มต่อวิว
- **Secondary Button**: `#242427` (`text-zinc-200`): ปุ่มรองสีทึบแบบเรียบหรู
- **Outline Button**: พื้นหลังโปร่งใส (`border border-zinc-700/80 text-zinc-200`)
- **Semantic Status**:
  - Running / Active: จุดสีเขียว `#10b981` (`bg-emerald-400 size-2 rounded-full`) + Badge `bg-emerald-500/10 text-emerald-300`
  - Paused / Pending: จุดสีส้มทอง `#f59e0b` (`bg-amber-400 size-2 rounded-full`) + Badge `bg-amber-500/10 text-amber-200`
  - Fault / Danger: จุดสีแดง `#ef4444` + Badge `bg-red-500/10 text-red-300`

---

## 3. ระบบ Typography และข้อกำหนดความยาวข้อความ (Text Budget)

### 3.1 การจัดลำดับขนาดตัวอักษร (Hierarchy)
- **Hero Metric (ตัวเลขไฮไลต์ใหญ่)**: `text-3xl` ถึง `text-4xl font-bold tracking-tight text-white font-mono` เช่น `$1,211.29`
- **Card / View Title (หัวข้อวิว)**: `text-base font-semibold text-zinc-100` เช่น `Contribution History`
- **Section Eyebrow (หัวข้อหมวดย่อย)**: `text-[10px] uppercase tracking-wider text-zinc-400 font-semibold` เช่น `UPCOMING`, `OVERVIEW`
- **Standard Body / Row Item**: `text-xs font-medium text-zinc-200` เช่น `Analytics`, `Net Royalties`
- **Secondary / Subtitle**: `text-xs text-zinc-400 leading-normal` เช่น `Last 6 months of activity`
- **Footnote / Helper Text**: `text-[11px] text-zinc-400 leading-relaxed max-w-[320px]`
- **Numeric Values / Units**: `font-mono tabular-nums text-right whitespace-nowrap`

### 3.2 กฎความยาวข้อความให้พอดี (Text Length Budget)
1. **หัวข้อและป้ายกำกับ**: ไม่เกิน 2–4 คำ (ไม่เกิน 24 ตัวอักษร) บรรทัดเดียว ห้ามตัดคำขึ้นบรรทัดใหม่
2. **ข้อความปุ่ม**: 1–3 คำสั้นกระชับ (ไม่เกิน 16 ตัวอักษร) พร้อมใส่ `whitespace-nowrap shrink-0`
3. **คำอธิบายและข้อความช่วยเหลือ**: ล็อกความกว้าง `max-w-[320px]` หรือ `max-w-[360px]` เพื่อให้ข้อความตัดเป็น 2–3 บรรทัดพอดีตา ไม่อ่านยาก และไม่มีคำโดดเดี่ยวห้อยท้ายบรรทัด (No Orphan Words)

---

## 4. โครงสร้างปุ่ม (Button Anatomy & Capsule/Pill Philosophy)

1. **ทรง Capsule / Pill Shape (`rounded-full`)**:
   - ปุ่มกด, Badge, ช่องค้นหา, และสวิตช์ Toggle ให้ใช้ทรงแคปซูลมน `rounded-full`
   - ความสูงปุ่มมาตรฐาน: `h-8 px-3.5 text-xs font-medium rounded-full`
   - ปุ่มหลักขนาดใหญ่: `h-9 px-4 text-sm font-medium rounded-full`
   - ปุ่มไอคอนขนาดกะทัดรัด: `size-7` หรือ `size-8 rounded-full`
2. **กฎ Single Primary Action (1 ปุ่มหลักต่อวิว)**:
   - มีปุ่มสีขาวสะท้อนแสงเด่น (`bg-white text-zinc-950 hover:bg-zinc-200`) ได้เพียง **1 ปุ่มเท่านั้น** ต่อหนึ่งการ์ดหรือหนึ่ง Dialog (เช่น `View Full Report`, `Run Simulation`)
   - ปุ่มที่เหลือต้องเป็นปุ่มมืด `bg-[#242427]` หรือปุ่มเส้นขอบ `border border-zinc-700/80`
3. **การวาง Icon ในปุ่ม**:
   - ถ้าเป็นปุ่มนำทางไปข้างหน้า ให้วาง Arrow Icon ทางขวา: `<Button>Button <ArrowRight className="size-3.5" /></Button>`
   - ถ้าเป็นปุ่มเฉพาะไอคอน ให้มี `<Tooltip>` กำกับเสมอ
4. **Button Group แบบแคปซูล**:
   - จัดกลุ่มปุ่มในแคปซูลเดียว คั่นด้วยเส้นแบ่งบาง 1px (`w-[1px] h-3.5 bg-zinc-700`) เพื่อรวมคำสั่งหลักและคำสั่งย่อย (Dropdown) เข้าด้วยกันอย่างเป็นระเบียบ

---

## 5. กฎเหล็ก: ไม่เอาหน่วยแตก (Strict Unit Non-Breaking)

สำหรับ `<Badge variant="outline">` และป้ายกำกับหน่วยวัด (เช่น `16 MHz`, `5 V`, `220 Ω`, `60 FPS`, `9600 baud`, `100 ms`, `$1,211.29 USD`):
1. **ห้ามหน่วยแตกเด็ดขาด**: ตัวเลขและหน่วยวัดต้องอยู่ติดกันเป็นก้อนเดียวเสมอ ห้ามตัดบรรทัดแยกตัวเลขกับหน่วย (`whitespace-nowrap`, `shrink-0`, `tabular-nums`, `[word-break:keep-all]`)
2. **ใช้ Non-breaking space (`\u00A0` หรือ `&nbsp;`)** คั่นระหว่างตัวเลขกับหน่วยเสมอ เพื่อไม่ให้เบราว์เซอร์ตัดบรรทัด เช่น `16` บรรทัดบน แล้ว `MHz` ตกไปบรรทัดล่าง
3. **บังคับใช้ `font-mono tabular-nums`** สำหรับตัวเลข เพื่อป้องกัน Layout Jitter (ตัวเลขกระตุกเมื่อค่าเปลี่ยน)
4. **กำหนด `shrink-0`** ไม่ให้ Badge หดจนตัดตัวอักษรของหน่วยทิ้ง

---

## 6. โครงสร้าง Inset Box และ Flat List (แก้ปัญหา Card ซ้อน Card)

### 6.1 กล่อง Inset Ledger
เมื่อต้องการรวมกลุ่มตัวเลขหรือสรุปรายการภายในการ์ด ห้ามใส่ `<Card>` ย่อยข้างใน ให้ใช้ Inset Box:
```tsx
<div className="rounded-xl bg-[#1c1c20] p-3 space-y-2 border border-zinc-800/40">
  <div className="flex items-center justify-between text-xs">
    <span className="text-zinc-400">Net Royalties</span>
    <span className="font-mono tabular-nums text-zinc-100">$1,248.75</span>
  </div>
  <div className="flex items-center justify-between text-xs">
    <span className="text-zinc-400">Processing Fee</span>
    <span className="font-mono tabular-nums text-zinc-400">-$37.46</span>
  </div>
  <div className="border-t border-zinc-800 my-1" />
  <div className="flex items-center justify-between text-xs font-medium">
    <span className="text-zinc-300">Total Ready to Claim</span>
    <span className="font-mono tabular-nums font-bold text-white whitespace-nowrap">
      $1,211.29&nbsp;USD
    </span>
  </div>
</div>
```

### 6.2 Flat Navigation Row
สำหรับ Sidebar หรือเมนูเลือกหมวดหมู่:
- หัวข้อหมวด: `text-[11px] font-medium text-zinc-400 px-2 py-1 mb-1`
- แถวปกติ: `flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-xs font-medium text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60`
- แถวที่เลือกอยู่ (Active): `bg-[#26262a] text-white shadow-sm font-semibold`
- ไอคอนซ้ายมือ: `size-4 shrink-0` จัดชิดซ้ายเป็นระเบียบ

---

## 7. Checklist ตรวจสอบความถูกต้องก่อนส่งงาน (Delivery Audit)

1. [ ] **Surface Depth ถูกต้อง**: ไม่มี Card ซ้อน Card การรวมกลุ่มย่อยใช้ Inset Box (`bg-[#1c1c20] rounded-xl`)
2. [ ] **Capsule / Pill Buttons**: ปุ่มและการควบคุมหลักใช้ทรงแคปซูลมน `rounded-full`
3. [ ] **Single Primary Action**: มีปุ่มหลักสีขาวเด่นเพียง 1 ปุ่มต่อวิว
4. [ ] **ไม่เอาหน่วยแตก**: Badge ที่มีหน่วยวัด (เช่น `16 MHz`, `5 V`, `220 Ω`, `$1,211.29 USD`) ใช้ `whitespace-nowrap`, `tabular-nums`, `shrink-0` และไม่แยกตัวเลขกับหน่วย
5. [ ] **Text Length พอดี**: หัวข้อสั้นกระชับ คำอธิบายจำกัดความกว้าง (`max-w-[320px]`) ไม่มีคำโดดเดี่ยวหลุดบรรทัด
6. [ ] **Color Tokens ครบถ้วน**: ไม่มีสี Hardcode ใช้เฉพาะ Zinc, Emerald, Amber, Red Tokens
7. [ ] **ไอคอนมี Tooltip กำกับ**: ทุกปุ่มที่เป็น Icon-Only มี `<Tooltip>`
