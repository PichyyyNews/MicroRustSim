# MicroRustSim: Physical Simulation Specification (PHYSICS_SPEC.md)
**Single Source of Truth (SSOT) สำหรับฟิสิกส์ไฟฟ้า, การคำนวณวงจร MNA, และโมเดลอุปกรณ์**

- **เวอร์ชัน**: 1.0.0 (Phase 0 Baseline)
- **สถานะ**: เสนอเพื่อขออนุมัติจากผู้ใช้ (Pending User Approval)
- **เจ้าของเอกสาร**: Subagent A (Recon & Spec)
- **ที่เก็บไฟล์**: `docs/PHYSICS_SPEC.md`
- **ระบบหน่วยสากล**: SI Units ทั้งหมด (V, A, Ω, S, F, H, s, Hz, W, J, K, C)

---

## สารบัญ (Table of Contents)
1. [บทสรุปผู้บริหารและการวิเคราะห์สาเหตุเชิงลึก (Executive Summary & Root Cause Analysis B1–B4, H1–H6)](#1-บทสรุปผู้บริหารและการวิเคราะห์สาเหตุเชิงลึก)
2. [แกนการคำนวณทางคณิตศาสตร์ (Mathematical Core: Full MNA & Non-linear Newton-Raphson Solver)](#2-แกนการคำนวณทางคณิตศาสตร์)
3. [การจำลองในโดเมนเวลาและโมเดลพลวัต (Dynamic Companion Models & Numerical Integration)](#3-การจำลองในโดเมนเวลาและโมเดลพลวัต)
4. [โมเดลชิ้นส่วนอุปกรณ์ตามหลักฟิสิกส์ (Component Physical Models & Specifications)](#4-โมเดลชิ้นส่วนอุปกรณ์ตามหลักฟิสิกส์)
5. [การเชื่อมโยงระบบไฟฟ้า Arduino Uno (ATmega328P Electrical Coupling & AVR Emulation)](#5-การเชื่อมโยงระบบไฟฟ้า-arduino-uno)
6. [สารบบค่าคงที่ทางฟิสิกส์และสเปกอุปกรณ์ (Physical Constants & Parameters Registry)](#6-สารบบค่าคงที่ทางฟิสิกส์และสเปกอุปกรณ์)
7. [แผนผังโครงสร้างโค้ดและจุดปรับปรุง (Code Architecture Map & Upgrade Plan)](#7-แผนผังโครงสร้างโค้ดและจุดปรับปรุง)
8. [เกณฑ์การยอมรับและเมทริกซ์การทดสอบ (Acceptance Criteria & Test Matrix T1–T20)](#8-เกณฑ์การยอมรับและเมทริกซ์การทดสอบ)

---

## 1. บทสรุปผู้บริหารและการวิเคราะห์สาเหตุเชิงลึก

เอกสารฉบับนี้เป็น **Single Source of Truth (SSOT)** ที่กำหนดสเปก พารามิเตอร์ทางฟิสิกส์ สมการคณิตศาสตร์ และจุดเชื่อมต่อของระบบจำลอง MicroRustSim ทั้งหมด ก่อนเริ่มดำเนินการแก้ไขโค้ดใน Phase 1–6 ตามข้อกำหนด Phase 0

จากการตรวจสอบโค้ดจริง (Code Reconnaissance) ร่วมกันระหว่าง `explorer_bugs` และ `explorer_solver` ได้ข้อสรุปการพิสูจน์สมมติฐาน H1–H6 และสาเหตุที่แท้จริงของปัญหา B1–B4 ดังนี้:

### 1.1 การพิสูจน์สมมติฐาน H1–H6 (Proof / Disproof Matrix)

| รหัสสมมติฐาน | ปัญหา | ข้อความสมมติฐานทางฟิสิกส์ | ผลการพิสูจน์ | การยืนยันในโค้ดจริง (File:Line) |
| :--- | :---: | :--- | :---: | :--- |
| **H1** | B1 | การกระโดดของแรงดัน Wiper ที่ 99% $\to$ 100% เกิดจากความต้านทาน $R_{top}$ ที่ลดลงฮวบฮาบ 10,000 เท่า (จาก $100\ \Omega$ เป็น $0.01\ \Omega$) ในก้าวเดียว ประกอบกับแหล่งจ่าย 5V ในโหมด Ideal ขาดการคำนวณ Load Sag | **ยืนยัน (CONFIRMED)** | `crates/sim_core/src/solver.rs:568-573`<br>`src/components/PropertyInspector.tsx:349`<br>`crates/sim_core/src/solver.rs:368` |
| **H2** | B1 | ฟังก์ชัน `node_volt_clean` ทำการ Clamp ตัดท่อนแรงดันที่เข้าใกล้ 5.0V ในระยะ $\pm 0.1\text{ mV}$ ให้กลายเป็น 5.000V นิ่ง ทำให้ไม่เห็นการตกของแรงดันภายใต้โหลดหนัก | **ยืนยัน (CONFIRMED)** | `crates/sim_core/src/solver.rs:695-710` |
| **H3** | B2 | LED สีแดง 3 ดวงต่อขนานแล้วติดเพียงดวงแรก เกิดจากความไม่สมมาตรของ $V_f$ ในระบบ โดย `led1` ในเทมเพลตเริ่มต้นใช้ $1.8\text{ V}$ ขณะที่ LED ใหม่ได้ $2.0\text{ V}$ หรือ $2.2\text{ V}$ ส่งผลให้ดวงแรก Clamp แรงดันโหนดไว้ต่ำกว่าเกณฑ์ดวงอื่น (Current Hogging) | **ยืนยัน (CONFIRMED)** | `crates/sim_core/src/lib.rs:420-428`<br>`src/App.tsx:671, 2315, 4900`<br>`crates/sim_core/src/solver.rs:730` |
| **H4** | B2 | โมเดลไดโอดใน Solver มีจุดสะดุดไม่ต่อเนื่อง (Discontinuity) ที่ $V_d = V_f$ (กระแสกระโดดลดลง $0.5\text{ mA}$ และความนำกระโดด 32 เท่า) และขาด SPICE `pnjlim` ทำให้ Newton-Raphson แกว่งเมื่อมีไดโอดขนานหลายกิ่ง | **ยืนยัน (CONFIRMED)** | `crates/sim_core/src/solver.rs:646-661`<br>`crates/sim_core/src/solver.rs:638-688` |
| **H5** | B3 | LED สีแดงแสดงค่า $V_f = 3.2\text{ V}$ เกิดจาก UI Quick Presets เปิดให้เลือก $3.2\text{ V}$ กับทุกสี และ IPC `add_led` ไม่ส่งค่า `vf` ทำให้ค่าเดิมตกค้าง ขัดกับหลักฟิสิกส์แบนด์แกปสารกึ่งตัวนำ | **ยืนยัน (CONFIRMED)** | `src/components/PropertyInspector.tsx:67-74, 694`<br>`src/App.tsx:1316`<br>`crates/sim_core/src/lib.rs:421, 425` |
| **H6** | B4 | ตัวเก็บประจุไม่ได้เป็น Dynamic Companion Model ที่แท้จริงในโดเมนเวลา: ค่าเวลาถูกล็อกที่ $dt = 16.67\text{ ms}$, อัปเดตด้วยสูตร Relaxation หลัง solve, ขาด $R_{leak}$, และถูกละเลยใน Desktop Runner | **ยืนยัน (CONFIRMED)** | `crates/sim_core/src/solver.rs:589-603, 778-795`<br>`crates/app/src/runner.rs:69-94` |

---

### 1.2 สรุปสาเหตุที่แท้จริงของปัญหา B1–B4 (Root Causes)

#### ปัญหา B1: โพเทนชิโอมิเตอร์ 5V → Pot → Wiper ขนาน LED 3 ดวง (99% ได้ ~3.2V แต่ 100% กระโดดเป็น 5.0V / 4.99V)
- **พฤติกรรมเดิม**: ที่ $\alpha = 0.99$ ค่า $R_{top} = (1 - 0.99) \times 10,000 = 100\ \Omega$ เมื่อนำไปต่อกับโหลดหนัก (LED 3 ดวงขนาน ซึ่งมีความต้านทานเนื้อสารรวม $R_{bulk}/3 \approx 1.67\ \Omega$) ตัวต้านทาน $100\ \Omega$ จะทำหน้าที่จำกัดกระแส ดรอปแรงดันส่วนใหญ่ไว้ ทำให้แรงดันที่ Wiper วัดได้เพียง $\approx 3.2\ \text{V}$ แต่เมื่อหมุนถึง $\alpha = 1.00$ ค่า $R_{top}$ หล่นฮวบลงเหลือ $0.01\ \Omega$ (ลดลง 10,000 เท่า) ส่งผลให้โหลดต่อตรงกับรางจ่าย 5V และฟังก์ชัน `node_volt_clean` บังคับตัดเศษให้เป็น $5.000\ \text{V}$ นิ่ง
- **วิธีแก้ปัญหาที่แท้จริง**:
  1. ใช้โมเดลตัวต้านทานคู่พร้อม Contact Resistance: $R_{top} = R(1 - x) + R_c$ และ $R_{bot} = R \cdot x + R_c$ โดยที่ $R_c \ge 1.0\ \Omega$ (ค่าสัมผัสปลายที่เรียบเนียนตลอดช่วง $x \in [0, 1]$ ไม่มีการกระโดด)
  2. ยกเลิกการปัดเศษแรงดันใน `node_volt_clean` โดยเด็ดขาด
  3. บังคับใช้ Internal Source Resistance ($R_{out} \approx 1.0\ \Omega$) บนรางจ่าย 5V ทำให้เมื่อ Wiper อยู่ที่ 100% กระแสจาก LED 3 ดวงที่พุ่งสูงจะดึงแรงดันราง 5V ให้ตกลง (Voltage Sag) ตามฟิสิกส์จริง และแจ้งเตือน Overcurrent

#### ปัญหา B2: LED สีแดง Vf 2.2V ขนานกัน 3 ดวง แต่ติดเฉพาะดวงแรก ดวงอื่นดับ
- **พฤติกรรมเดิม**: เกิดจาก 3 ปัจจัยทับซ้อน:
  1. ค่า $V_f$ ไม่เท่ากันตั้งแต่เริ่มต้น: `led1` ในเทมเพลตไม่มี props `vf` จึงได้ค่าเริ่มต้นจาก Rust เป็น $1.8\ \text{V}$ ขณะที่ LED ดวงถัดไปที่ผู้ใช้ลากลงมาได้ค่า $2.0\ \text{V}$ หรือ $2.2\ \text{V}$ จาก UI
  2. ปรากฏการณ์ **Current Hogging**: เมื่อต่อขนานโดยไม่มีตัวต้านทานประจำกิ่ง ดวงที่มี $V_f$ ต่ำที่สุด ($1.8\ \text{V}$) จะเริ่มนำกระแสก่อนและยึดแรงดันโหนดไว้ที่ $\approx 1.85\ \text{V}$ ส่งผลให้ดวงอื่นที่มี $V_f = 2.2\ \text{V}$ มีแรงดันตกคร่อมน้อยกว่า $V_f$ กระแสจึงไม่ไหล
  3. ความไม่ต่อเนื่องของอนุพันธ์ใน Piecewise Model ทำให้ลูป Newton-Raphson แกว่ง และเกณฑ์กระแส `id > 0.00005` ($50\ \mu\text{A}$) ตัดให้ดวงอื่นดับสนิท
- **วิธีแก้ปัญหาที่แท้จริง**:
  1. ปรับใช้โมเดล **Shockley Diode + $R_s$** แบบเรียบเนียนระดับ $C^\infty$:
     $$I_d(V_d) = I_s \left( \exp\left(\frac{V_d}{n V_t}\right) - 1 \right)$$
  2. ติดตั้งอัลกอริทึม **SPICE `pnjlim`** ป้องกันการแกว่งใน Newton-Raphson
  3. ปรับเกณฑ์ความสว่างให้เป็นฟังก์ชันต่อเนื่องของกระแส ไม่ตัดท่อนด้วย Threshold แข็งกร้าว
  4. เพิ่มตัวเลือกสุ่มความเบี่ยงเบน $V_f$ เล็กน้อย ($\pm 2-3\%$) ด้วย Seed ที่คงที่ เพื่อจำลอง Current Hogging ที่เป็นธรรมชาติ

#### ปัญหา B3: LED สีแดงแสดงค่า Vf 3.2V
- **พฤติกรรมเดิม**: Property Inspector ใน UI มีปุ่ม Quick Presets อิสระที่แสดงปุ่ม `3.2` ให้คลิกได้กับ LED ทุกสี และ IPC `add_led` ส่งเฉพาะ `color` แต่ไม่ส่ง `vf` ทำให้ค่า `props.vf` เดิมของคอมโพเนนต์สีฟ้า/ขาวตกค้างอยู่ข้ามการเปลี่ยนสี
- **วิธีแก้ปัญหาที่แท้จริง**:
  1. จัดทำ Registry ค่าคงที่กลางของ $V_f$ แยกตามสารกึ่งตัวนำและสีอย่างเคร่งครัด
  2. กำหนดขอบเขต Validation: LED สีแดงห้ามตั้งค่าเกิน $2.4\text{ V}$ (ช่วงฟิสิกส์ 1.8–2.2V)
  3. เมื่อมีการเปลี่ยนสี LED ใน UI ให้รีเซ็ตค่า $V_f$ เป็น Default ประจำสีนั้นโดยอัตโนมัติ

#### ปัญหา B4: ตัวเก็บประจุ (Capacitor) เป็นภาพ/ค่าคงที่ ขาดความถูกต้องในโดเมนเวลา
- **พฤติกรรมเดิม**: ตัวเก็บประจุถูกจำลองด้วย $dt = 16.67\text{ ms}$ คงที่ และในตอนท้ายถูกคำนวณทับด้วยสมการ Relaxation ภายนอก $\alpha = dt / (C \cdot R_{eff})$ โดยมี `.min(1.0)` ซึ่งบังคับให้ชาร์จเต็ม 100% ในเฟรมเดียวเมื่อ $\tau < 16.67\text{ ms}$ อีกทั้งไม่ได้ต่ออยู่ใน Desktop Runner (`crates/app/src/runner.rs`)
- **วิธีแก้ปัญหาที่แท้จริง**:
  1. ยกระดับเป็น **MNA Dynamic Companion Model** แบบเต็มรูปแบบ (Trapezoidal และ Backward Euler) ภายในเมทริกซ์ MNA ตัวเดียวกัน
  2. แยกโหนดภายในสำหรับความต้านทานอนุกรมเทียบเท่า ($ESR$) และขนานด้วยความต้านทานรั่ว ($R_{leak}$)
  3. ซิงค์คอมโพเนนต์ตัวเก็บประจุเข้าสู่ทุก Runner (ทั้ง Desktop Egui และ Web Tauri)
  4. ปรับรอบเวลาการคำนวณให้รองรับ Sub-microsecond Time-stepping เพื่อตอบสนองต่อ PWM 490/980 Hz และวงจร RC ได้อย่างแม่นยำ

---

## 2. แกนการคำนวณทางคณิตศาสตร์
*(Mathematical Core: Full MNA & Non-linear Newton-Raphson Solver)*

### 2.1 โครงสร้างเมทริกซ์ Modified Nodal Analysis (MNA)
วงจรไฟฟ้าทั้งหมดต้องถูกสร้างเป็นระบบสมการเชิงเส้นปนไม่เชิงเส้นในรูปแบบบล็อกเมทริกซ์ MNA มาตรฐานสากล (Ho, Ruehli, & Brennan, IEEE Trans. Circuits and Systems, 1975):

$$\begin{bmatrix} \mathbf{G} & \mathbf{B} \\ \mathbf{C} & \mathbf{D} \end{bmatrix} \begin{bmatrix} \mathbf{v} \\ \mathbf{i} \end{bmatrix} = \begin{bmatrix} \mathbf{j} \\ \mathbf{e} \end{bmatrix}$$

โดยที่:
- $N$ คือจำนวนโหนดอิสระ (ไม่นับ Ground โหนด 0)
- $M$ คือจำนวนกิ่งที่มีแหล่งจ่ายแรงดันอิสระ (Independent Voltage Sources), แหล่งจ่ายแรงดันควบคุม, หรือตัวเหนี่ยวนำ
- $\mathbf{G} \in \mathbb{R}^{N \times N}$ คือเมทริกซ์ความนำไฟฟ้าระหว่างโหนด (Nodal Conductance Matrix)
- $\mathbf{B} \in \mathbb{R}^{N \times M}$ คือเมทริกซ์การเชื่อมต่อของแหล่งจ่ายแรงดัน (Incidence Matrix สำหรับกระแสสาขาที่ไหลเข้าโหนด)
- $\mathbf{C} \in \mathbb{R}^{M \times N}$ คือเมทริกซ์แสดงความสัมพันธ์แรงดันของแหล่งจ่าย ($\mathbf{C} = \mathbf{B}^T$ สำหรับวงจรเชิงเส้นสองทิศทาง)
- $\mathbf{D} \in \mathbb{R}^{M \times M}$ คือเมทริกซ์ความต้านทานหรือการเชื่อมโยงระหว่างแหล่งจ่าย (เป็นศูนย์ $\mathbf{0}$ สำหรับแหล่งจ่ายแรงดันอุดมคติ)
- $\mathbf{v} \in \mathbb{R}^N$ คือเวกเตอร์แรงดันโหนดเทียบกับกราวด์
- $\mathbf{i} \in \mathbb{R}^M$ คือเวกเตอร์กระแสสาขาที่ไหลผ่านแหล่งจ่ายแรงดัน
- $\mathbf{j} \in \mathbb{R}^N$ คือเวกเตอร์ผลรวมกระแสอิสระที่ฉีดเข้าโหนด (Independent Current Sources และ Norton Currents)
- $\mathbf{e} \in \mathbb{R}^M$ คือเวกเตอร์ค่าแรงดันของแหล่งจ่ายแรงดันอิสระ

---

### 2.2 กฎการแสตมป์ลงเมทริกซ์ (MNA Stamping Rules)

#### (1) ตัวนำไฟฟ้าเชิงเส้น (Conductance $g = 1/R$) เชื่อมระหว่างโหนด $k$ และ $m$:
$$\begin{array}{rcc}
& \text{node } k & \text{node } m \\
\text{node } k & \begin{bmatrix} +g \end{bmatrix} & \begin{bmatrix} -g \end{bmatrix} \\
\text{node } m & \begin{bmatrix} -g \end{bmatrix} & \begin{bmatrix} +g \end{bmatrix}
\end{array}$$
*หมายเหตุ: หากโหนดใดโหนดหนึ่งเป็นกราวด์ (โหนด 0) ให้ตัดแถวและคอลัมน์ของโหนดนั้นออก*

#### (2) แหล่งจ่ายกระแสอิสระ (Independent Current Source $I_s$) ไหลจากโหนด $k$ ไปโหนด $m$:
$$\mathbf{j}[k] \mathrel{-}= I_s, \quad \mathbf{j}[m] \mathrel{+}= I_s$$

#### (3) แหล่งจ่ายแรงดันอิสระ (Independent Voltage Source $V_s$) เชื่อมระหว่างขั้วบวกโหนด $k$ และขั้วลบโหนด $m$ (กำหนดให้ดัชนีกิ่งคือ $p$ ในบล็อก $\mathbf{B}, \mathbf{C}, \mathbf{D}$):
$$\begin{array}{rccc}
& \text{node } k & \text{node } m & \text{branch } p \\
\text{node } k & & & \begin{bmatrix} +1 \end{bmatrix} \\
\text{node } m & & & \begin{bmatrix} -1 \end{bmatrix} \\
\text{branch } p & \begin{bmatrix} +1 \end{bmatrix} & \begin{bmatrix} -1 \end{bmatrix} & \begin{bmatrix} 0 \end{bmatrix}
\end{array}, \quad \mathbf{e}[p] = V_s$$

#### (4) แหล่งจ่ายแรงดันที่มีความต้านทานภายใน ($V_s$ อนุกรมกับ $R_{int}$):
สามารถเลือกทำได้ 2 รูปแบบอย่างแม่นยำ:
- **รูปแบบที่ 1 (Thevenin MNA)**: สแตมป์แบบข้อ (3) โดยใส่ค่า $\mathbf{D}[p, p] = -R_{int}$ สมการในแถว $p$ จะกลายเป็น:
  $$(v_k - v_m) - R_{int} \cdot i_p = V_s \implies v_k - v_m = V_s + R_{int} \cdot i_p$$
- **รูปแบบที่ 2 (Norton Companion)**: แปลงเป็นความนำ $g_{int} = 1/R_{int}$ ขนานกับแหล่งจ่ายกระแส $I_{norton} = V_s / R_{int}$ ฉีดเข้าโหนดบวก:
  $$\mathbf{G}[k, k] \mathrel{+}= g_{int}, \quad \mathbf{G}[m, m] \mathrel{+}= g_{int}, \quad \mathbf{G}[k, m] \mathrel{-}= g_{int}, \quad \mathbf{G}[m, k] \mathrel{-}= g_{int}$$
  $$\mathbf{j}[k] \mathrel{+}= I_{norton}, \quad \mathbf{j}[m] \mathrel{-}= I_{norton}$$

---

### 2.3 การแก้ระบบไม่เชิงเส้นด้วย Newton-Raphson และ SPICE Voltage Limiting (`pnjlim`)

สำหรับอุปกรณ์ไม่เชิงเส้น เช่น ไดโอด/LED ซึ่งมีสมการกระแส-แรงดัน $I_d = f(V_d)$ ระบบสมการจะอยู่ในรูป $\mathbf{F}(\mathbf{x}) = \mathbf{0}$
ในแต่ละรอบการวนซ้ำ $k$:

1. คำนวณความนำพลวัต (Dynamic Conductance / Jacobian Derivative):
   $$g_d^{(k)} = \left. \frac{\partial I_d}{\partial V_d} \right|_{V_d^{(k)}}$$
2. คำนวณกระแสเทียบเท่า Norton (Equivalent Current Source):
   $$I_{eq}^{(k)} = I_d(V_d^{(k)}) - g_d^{(k)} \cdot V_d^{(k)}$$
3. สแตมป์ $g_d^{(k)}$ ลงใน $\mathbf{G}$ และสแตมป์ $I_{eq}^{(k)}$ ลงใน $\mathbf{j}$ (ไหลออกจากโหนด Anode เข้าสู่ Cathode)
4. แก้ระบบสมการเชิงเส้น $\mathbf{A} \cdot \mathbf{x}^{(k+1)} = \mathbf{b}$ เพื่อหาแรงดันโหนดใหม่ $\hat{V}_d^{(k+1)} = v_{anode}^{(k+1)} - v_{cathode}^{(k+1)}$
5. **การจำกัดแรงดันด้วย SPICE `pnjlim`**:
   เพื่อป้องกันการระเบิดเชิงตัวเลข (Numerical Overflow) ในฟังก์ชัน $\exp$ เมื่อ $\hat{V}_d$ เพิ่มขึ้นอย่างรวดเร็ว ต้องผ่านฟังก์ชัน `pnjlim`:

$$V_d^{(k+1)} = \text{pnjlim}\left(\hat{V}_d^{(k+1)}, V_d^{(k)}, V_t, V_{crit}\right)$$

โดยที่นิยามของฟังก์ชัน `pnjlim` ตามมาตรฐาน SPICE3f5 คือ:

$$V_{crit} = n V_t \ln\left( \frac{n V_t}{\sqrt{2} I_s} \right)$$

$$\text{pnjlim}(V_{new}, V_{old}, V_t, V_{crit}) = \begin{cases}
V_{new} & \text{ถ้า } V_{new} > V_{crit} \text{ และ } |V_{new} - V_{old}| \le 2 n V_t \\
V_{old} + n V_t \ln\left(1 + \frac{V_{new} - V_{old}}{n V_t}\right) & \text{ถ้า } V_{new} > V_{crit} \text{ และ } V_{new} > V_{old} \\
V_{crit} & \text{ถ้า } V_{new} > V_{crit} \text{ และ } V_{old} \le 0 \\
V_{new} & \text{ถ้า } V_{new} \le V_{crit} \text{ และ } V_{new} \ge 0 \\
V_{new} & \text{ถ้า } V_{new} < 0 \text{ และ } |V_{new} - V_{old}| \le 1.0\text{ V} \\
V_{old} + \text{sgn}(V_{new} - V_{old}) \times 1.0\text{ V} & \text{ถ้า } V_{new} < 0 \text{ และ } |V_{new} - V_{old}| > 1.0\text{ V}
\end{cases}$$

---

### 2.4 การป้องกันภาวะเอกฐาน (Singular Matrix), $g_{min}$, และ Stepping Fallback

1. **การติดตั้ง $g_{min}$ ประจำทุกโหนด**:
   - เพื่อป้องกันโหนดลอย (Floating Node) ทำให้เมทริกซ์เกิดภาวะเอกฐาน ต้องบวกค่าความนำไฟฟ้าขนาดเล็กมาก $g_{min} = 10^{-12}\ \text{S}$ ($1\ \text{pS}$ หรือความต้านทาน $1\ \text{T}\Omega$) จากทุกโหนดลงกราวด์:
     $$\mathbf{G}[i, i] \mathrel{+}= g_{min} \quad \forall i \in \{1, 2, \dots, N\}$$
2. **อัลกอริทึม $g_{min}$ Stepping**:
   - หาก Newton-Raphson ไม่สามารถลู่เข้าได้ภายใน `max_iterations = 50` รอบ ให้เปิดใช้งาน $g_{min}$ Stepping:
     - เริ่มต้นจาก $g_{min} = 10^{-3}\ \text{S}$ (วงจรเชิงเส้นเด่นชัด ลู่เข้าได้ง่าย)
     - ค่อยๆ ลดค่า $g_{min}$ ลงทีละขั้น: $10^{-4}, 10^{-5}, \dots, 10^{-12}\ \text{S}$ โดยใช้ผลลัพธ์ของรอบก่อนหน้าเป็น Initial Guess
3. **อัลกอริทึม Source Stepping**:
   - หาก $g_{min}$ Stepping ยังคงไม่ลู่เข้า ให้ปรับลดแรงดันแหล่งจ่ายอิสระทั้งหมดลงเหลือ $\lambda \in [0.0, 1.0]$:
     $$\mathbf{e}(\lambda) = \lambda \cdot \mathbf{e}_{final}, \quad \mathbf{j}(\lambda) = \lambda \cdot \mathbf{j}_{final}$$
   - เริ่มจาก $\lambda = 0.1$ ก้าวขึ้นทีละ $0.1$ จนถึง $\lambda = 1.0$

---

### 2.5 เกณฑ์การลู่เข้าคู่ (Dual Convergence Criteria)

การตัดสินว่ารอบการคำนวณ Newton-Raphson ลู่เข้าสู่ผลลัพธ์แล้ว (Converged) ต้องผ่านเกณฑ์ความคลาดเคลื่อนทั้งแรงดันและกระแสพร้อมกัน:

1. **เกณฑ์แรงดัน (Voltage Tolerance)**:
   $$|v_i^{(k+1)} - v_i^{(k)}| \le \text{reltol} \cdot \max(|v_i^{(k+1)}|, |v_i^{(k)}|) + \text{vntol} \quad \forall i \in \{1, \dots, N\}$$
   โดยที่ $\text{reltol} = 10^{-3}$ ($0.1\%$) และ $\text{vntol} = 1.0\ \mu\text{V}$ ($10^{-6}\ \text{V}$)
2. **เกณฑ์กระแส (Current Tolerance)**:
   $$|i_m^{(k+1)} - i_m^{(k)}| \le \text{reltol} \cdot \max(|i_m^{(k+1)}|, |i_m^{(k)}|) + \text{abstol} \quad \forall m \in \text{Nonlinear branches}$$
   โดยที่ $\text{abstol} = 1.0\ \text{pA}$ ($10^{-12}\ \text{A}$)

---

### 2.6 การตรวจสอบกฎเคอร์ชอฟฟ์และความสมดุลพลังงาน (KCL & Power Balance Verification)

ทุกครั้งที่การคำนวณวงจรในแต่ละ Time Step สิ้นสุดลง Solver ต้องทำการตรวจสอบทางกายภาพ 2 ด้าน:

1. **Kirchhoff's Current Law (KCL) Check**:
   สำหรับทุกโหนด $k \in \{1, \dots, N\}$:
   $$\text{KCL\_Residual}(k) = \left| \sum_{b \in \text{connected}(k)} I_b \right| \le \text{reltol} \cdot \sum_{b} |I_b| + 10^{-9}\ \text{A}$$
   หากเกินกว่าเกณฑ์ ให้บันทึก Log Warning ระดับระบบ
2. **Power & Energy Balance Check**:
   $$\sum P_{\text{supplied}} = \sum P_{\text{dissipated}} + \frac{dE_{\text{stored}}}{dt}$$
   - $P_{\text{supplied}} = \sum V_s \cdot (-I_s) + \sum I_{src} \cdot (V_+ - V_-)$
   - $P_{\text{dissipated}} = \sum I_R^2 R + \sum I_d V_d$
   - $\frac{dE_{\text{stored}}}{dt} = \sum i_C(t) \cdot v_C(t) = \sum C \cdot v_C \frac{dv_C}{dt}$
   - เกณฑ์ความสมดุล: $\left| \sum P_{\text{supplied}} - \left(\sum P_{\text{dissipated}} + \frac{dE_{\text{stored}}}{dt}\right) \right| < 1.0\ \text{mW}$ (หรือ $1\%$ ของกำลังไฟฟ้ารวม)

---

## 3. การจำลองในโดเมนเวลาและโมเดลพลวัต
*(Dynamic Companion Models & Numerical Integration)*

### 3.1 การแปลงสมการเชิงอนุพันธ์ของตัวเก็บประจุ ($i(t) = C \frac{dv}{dt}$) เป็น MNA Companion Model

ตัวเก็บประจุมีสมการความสัมพันธ์:
$$v(t_n) - v(t_{n-1}) = \int_{t_{n-1}}^{t_n} \frac{i(t)}{C} dt$$

#### (1) วิธี Trapezoidal Rule (Second-Order, $O(\Delta t^2)$):
สมมติให้กระแสเปลี่ยนเป็นเส้นตรงระหว่างก้าวเวลา:
$$v_n - v_{n-1} = \frac{\Delta t}{2 C} (i_n + i_{n-1}) \implies i_n = \frac{2 C}{\Delta t} v_n - \left( \frac{2 C}{\Delta t} v_{n-1} + i_{n-1} \right)$$
จัดรูปเป็น **Norton Companion Model**:
$$i_n = G_{eq} \cdot v_n - I_{eq}$$
โดยที่:
$$G_{eq} = \frac{2 C}{\Delta t}$$
$$I_{eq} = G_{eq} \cdot v_{n-1} + i_{n-1}$$
*(สแตมป์ $G_{eq}$ ลง $\mathbf{G}$ ระหว่าง 2 ขั้ว และฉีดกระแส $I_{eq}$ เข้าขั้วบวก ไหลออกจากขั้วลบ)*

#### (2) วิธี Backward Euler (First-Order, $O(\Delta t)$, L-stable):
$$v_n - v_{n-1} = \frac{\Delta t}{C} i_n \implies i_n = \frac{C}{\Delta t} v_n - \frac{C}{\Delta t} v_{n-1}$$
จัดรูปเป็น Norton Companion Model:
$$G_{eq} = \frac{C}{\Delta t}$$
$$I_{eq} = G_{eq} \cdot v_{n-1}$$

#### (3) วิธี BDF2 (Second-Order Backward Differentiation Formula, L-stable):
ใช้ข้อมูลจาก 2 สเต็ปก่อนหน้า ($t_{n-1}, t_{n-2}$):
$$i_n = C \left[ \frac{1 + 2\theta}{1 + \theta} \frac{v_n - v_{n-1}}{\Delta t_n} - \frac{\theta^2}{1 + \theta} \frac{v_{n-1} - v_{n-2}}{\Delta t_{n-1}} \right]$$
เมื่อก้าวเวลาคงที่ ($\theta = \Delta t_n / \Delta t_{n-1} = 1$):
$$i_n = \frac{3 C}{2 \Delta t} v_n - \left( \frac{2 C}{\Delta t} v_{n-1} - \frac{C}{2 \Delta t} v_{n-2} \right)$$
$$G_{eq} = \frac{1.5 C}{\Delta t}, \quad I_{eq} = \frac{C}{\Delta t} (2 v_{n-1} - 0.5 v_{n-2})$$

---

### 3.2 สถาปัตยกรรม Gear-Switching ป้องกัน Numerical Ringing

- **ปัญหาของ Trapezoidal Rule**: แม้จะมีความแม่นยำระดับ $O(\Delta t^2)$ แต่ Trapezoidal Rule ไม่มี L-stability เมื่อเกิดความไม่ต่อเนื่อง (Discontinuity) ฉับพลัน เช่น ขอบขึ้น/ลงของสัญญาณ PWM หรือการสับสวิตช์ จะเกิดการสั่นของตัวเลข (Trapezoidal Ringing / Oscillations) สลับฟันปลาข้ามรอบเวลา
- **ข้อกำหนด Gear-Switching**:
  1. เมื่อเกิด **Event** (เช่น ขอบ PWM สลับระดับ, ปุ่มกดเปลี่ยนสถานะ, สวิตช์สับวงจร):
     - ให้ถอยกลับมาแก้สมการที่จุดรอยต่อเวลา $t_{event}$ พอดี
     - ในก้าวแรกทันทีหลังรอยต่อ ($t_{event} \to t_{event} + \Delta t_{min}$) **บังคับสลับไปใช้วิธี Backward Euler** เพราะ Backward Euler มีคุณสมบัติ L-stable แท้จริง จะดูดซับความไม่ต่อเนื่องและกำจัดการสั่นได้อย่างสมบูรณ์
  2. ในก้าวถัดไปเมื่อสัญญาณราบเรียบแล้ว ให้สลับกลับมาใช้ **Trapezoidal Rule หรือ BDF2** เพื่อรักษาความแม่นยำระดับสูง

---

### 3.3 การประมาณค่าความคลาดเคลื่อนและการปรับก้าวเวลาอัตโนมัติ (Local Truncation Error: LTE)

เพื่อรักษาความแม่นยำสูงสุดโดยไม่สูญเสียประสิทธิภาพการประมวลผล Solver ต้องคำนวณก้าวเวลาแปรผัน $\Delta t$ ตามค่า LTE:

$$\text{LTE} = \frac{\Delta t^2}{12} \left| \frac{d^3 v}{dt^3} \right| \approx \frac{\Delta t}{2 + \theta} \left| \frac{v_n - v_{n-1}}{\Delta t_n} - \frac{v_{n-1} - v_{n-2}}{\Delta t_{n-1}} \right|$$

กำหนดค่าความคลาดเคลื่อนที่ยอมรับได้:
$$\text{tol} = \text{trtol} \cdot (\text{reltol} \cdot |v_n| + \text{abstol})$$
ก้าวเวลาในสเต็ปถัดไปจะถูกปรับตามสมการ:
$$\Delta t_{new} = \Delta t \times \min\left(2.0, \max\left(0.1, 0.9 \times \sqrt{\frac{\text{tol}}{\text{LTE}}}\right)\right)$$
โดยถูกจำกัดในช่วง: $\Delta t_{min} = 100\ \text{ns} \le \Delta t \le \Delta t_{max} = 100\ \mu\text{s}$

---

### 3.4 คิวเหตุการณ์ทางเวลา (Event Queue Architecture)

ระบบจำลองต้องมี Event Queue จัดเรียงตามลำดับเวลา $t$:
- ขอบสัญญาณ PWM ของ ATmega328P ($490.2\ \text{Hz} \implies T \approx 2.04\ \text{ms}$, $976.6\ \text{Hz} \implies T \approx 1.024\ \text{ms}$)
- กิจกรรมการกด/ปล่อยปุ่มของผู้ใช้ (User Interaction Events)
- เวลาสิ้นสุดรอบการหน่วงเวลา Bounce
- **กฎเหล็ก**: Solver ต้องก้าวเวลาไปหยุดที่ $t_{event}$ พอดีเสมอ **ห้ามก้าวข้าม Event เด็ดขาด**

---

### 3.5 จุดทำงาน DC เริ่มต้นที่ $t = 0$ (DC Operating Point)

ก่อนเริ่มการจำลองในโดเมนเวลา ($t > 0$) ต้องคำนวณจุดทำงานเริ่มต้น (DC Operating Point Analysis):
- ตัวเก็บประจุที่ผู้ใช้ไม่ได้ระบุประจุเริ่มต้น ($V_{init} = 0\ \text{V}$ หรือไม่ได้ตั้งค่า): ให้จำลองเป็น **วงจรเปิด (Open Circuit)** โดยใส่ Conductance ขนาดเล็ก $g_{open} = 10^{-12}\ \text{S}$ (ไม่ทำให้เมทริกซ์กลายเป็น Singular)
- ตัวเก็บประจุที่มีประจุเริ่มต้น ($V_{init} \ne 0\ \text{V}$): ให้จำลองเป็นแหล่งจ่ายแรงดันอิสระขนาด $V_{init}$ ในก้าว $t = 0$
- ผลลัพธ์แรงดันที่ได้จะถูกนำไปใช้เป็นสถานะเริ่มต้น $v(0)$ ของก้าวเวลาถัดไป

---

## 4. โมเดลชิ้นส่วนอุปกรณ์ตามหลักฟิสิกส์
*(Component Physical Models & Device Specifications)*

### 4.1 ตัวต้านทาน (Resistor)
- **สัญลักษณ์**: $R$
- **สมการกระแส-แรงดัน**:
  $$I = \frac{V_1 - V_2}{R_{act}}$$
- **ความคลาดเคลื่อนตามเกรด (Tolerance Model)**:
  ค่าความต้านทานจริง $R_{act}$ คำนวณจากการแจกแจงแบบเกาส์เซียน (Gaussian Distribution) ที่ถูกตัดปลาย (Truncated at $\pm 3\sigma$):
  $$R_{act} = R_{nom} \times \left( 1 + \delta_{tol} \right), \quad \delta_{tol} \sim \mathcal{N}(0, (\text{Tol}/3)^2)$$
  - ตัวเลือกเกรด: $1\%$ (Metal Film, E96 series), $5\%$ (Carbon Film, E24 series)
  - ค่าสุ่มถูกล็อกด้วย Seed ประจำตัวคอมโพเนนต์ ทำให้ผลลัพธ์ซ้ำเดิมเสมอ
- **การคำนวณกำลังไฟฟ้าและความเสียหาย (Power & Thermal Damage)**:
  $$P = I^2 R_{act} = \frac{(V_1 - V_2)^2}{R_{act}}$$
  - พิกัดกำลังปกติ (Rated Power): $P_{rated} = 0.25\ \text{W}$ (สามารถปรับแต่งได้)
  - พิกัดเตือน (Warning Threshold): เมื่อ $P > P_{rated}$
  - ตัวสะสมความร้อน (Thermal Accumulator):
    $$\frac{d\theta}{dt} = \frac{P - P_{rated}}{C_{th}} - \frac{\theta}{\tau_{th}}$$
    เมื่อ $\theta \ge \theta_{damage}$ ชิ้นส่วนจะเปลี่ยนสถานะเป็น **เสียหาย (Damaged - Open Circuit)** ถาวร

---

### 4.2 โพเทนชิโอมิเตอร์ (Potentiometer)
- **สัญลักษณ์**: Potentiometer 3 ขา (ขา 1: Terminal A, ขา 2: Wiper W, ขา 3: Terminal B)
- **โมเดลตัวต้านทาน 2 ตัวพร้อมความต้านทานหน้าสัมผัส (Dual-Resistor + Contact Resistance Model)**:
  $$\begin{aligned}
  R_{top}(x) &= R_{total} \cdot (1 - f_{taper}(x)) + R_c \\
  R_{bot}(x) &= R_{total} \cdot f_{taper}(x) + R_c
  \end{aligned}$$
  โดยที่:
  - $x \in [0.0, 1.0]$ คือตำแหน่งเชิงกลของแกนหมุน (Wiper Position)
  - $R_{total}$ คือความต้านทานระบุรวม (Default $10\ \text{k}\Omega$, ปรับได้ $1\ \text{k}\Omega - 1\ \text{M}\Omega$)
  - $R_c$ คือความต้านทานปลายและหน้าสัมผัส (Terminal/Contact Resistance, Default $1.0\ \Omega$, $[1.0, 5.0]\ \Omega$)
  - $f_{taper}(x)$:
    - **Linear Taper (Type B)**: $f_{taper}(x) = x$
    - **Audio / Logarithmic Taper (Type A)**: $f_{taper}(x) = \frac{10^x - 1}{9}$ (หรือสูตร piecewise สองช่วงที่ $x=0.5 \implies 10\%$)
- **การแสตมป์ลง MNA**:
  - Wiper (โหนด W) มีความเชื่อมโยงกับโหนด A ผ่านความนำ $g_{top} = 1 / R_{top}(x)$
  - Wiper (โหนด W) มีความเชื่อมโยงกับโหนด B ผ่านความนำ $g_{bot} = 1 / R_{bot}(x)$
  - ความต่อเนื่อง: $R_{top}$ และ $R_{bot}$ เป็นฟังก์ชันต่อเนื่องระดับ $C^\infty$ บนช่วง $x \in [0, 1]$ **ไม่มีการใช้ special case `if x == 1.0` หรือ `if x == 0.0`** ทำให้แรงดันและกระแสที่ Wiper ต่อเนื่องและราบเรียบเสมอแม้มีโหลดหนัก

---

### 4.3 ไดโอดเปล่งแสง (LED - Light Emitting Diode)
- **โมเดล Shockley Diode พร้อมความต้านทานเนื้อสาร (Shockley Diode with Series Bulk Resistance)**:
  $$I_d = I_s \left( \exp\left( \frac{V_d - I_d R_s}{n V_t} \right) - 1 \right)$$
  โดยที่:
  - $V_t = \frac{k T}{q} \approx 25.852\ \text{mV}$ ที่อุณหภูมิห้อง $T = 300\ \text{K}$
  - $n$ คือค่าสัมประสิทธิ์อุดมคติ (Emission Coefficient / Ideality Factor, ค่ามาตรฐาน $n = 2.0$)
  - $R_s$ คือความต้านทานอนุกรมของเนื้อสารกึ่งตัวนำและขาต่อ ($R_s \in [5.0, 20.0]\ \Omega$, ค่า Default $10.0\ \Omega$)
- **การคำนวณ $I_s$ จากพิกัด $V_f$ และกระแสทดสอบ $I_{test}$**:
  ผู้ใช้กำหนดพารามิเตอร์ $V_f$ ที่กระแสทดสอบ $I_{test} = 20\ \text{mA}$ ในหน้า Inspector ค่ากระแสอิ่มตัวย้อนกลับ $I_s$ จะถูกคำนวณตามสูตรทางฟิสิกส์:
  $$I_s = \frac{I_{test}}{\exp\left( \frac{V_f - I_{test} R_s}{n V_t} \right) - 1}$$
- **โมเดลสภาวะไบแอสย้อนกลับและการพังทลาย (Reverse Leakage & Breakdown)**:
  เมื่อ $V_d < 0$:
  $$I_d = -I_s \left( 1 - \exp\left( \frac{V_d}{V_t} \right) \right) - I_{bv} \exp\left( -\frac{V_d + V_{br}}{n_{bv} V_t} \right)$$
  - กระแสรั่วย้อนกลับปกติ: $I_{leak} \approx 10^{-9}\ \text{A} - 10^{-8}\ \text{A}$ ($1 - 10\ \text{nA}$)
  - แรงดันพังทลายย้อนกลับ (Reverse Breakdown Voltage): $V_{br} \approx 5.0\ \text{V}$
- **ตารางคุณสมบัติมาตรฐานตามสารกึ่งตัวนำและสีของ LED**:

| สี LED | วัสดุสารกึ่งตัวนำ (Semiconductor Material) | ความยาวคลื่น $\lambda$ (nm) | $V_f$ ทั่วไป @ 20mA (V) | ช่วง $V_f$ ที่ยอมรับ (V) | $R_s$ ($\Omega$) |
| :--- | :--- | :---: | :---: | :---: | :---: |
| **Red** | GaAsP / AlInGaP | 620–645 | 1.95 | 1.80 – 2.20 | 8.0 |
| **Orange**| GaAsP | 600–620 | 2.00 | 1.90 – 2.20 | 8.0 |
| **Yellow**| AlInGaP / GaAsP | 585–595 | 2.05 | 1.90 – 2.30 | 9.0 |
| **Green** | GaP / InGaN | 520–550 | 2.20 (GaP) / 3.00 (InGaN) | 2.00 – 3.20 | 12.0 |
| **Blue**  | InGaN / SiC | 460–475 | 3.10 | 2.90 – 3.40 | 15.0 |
| **White** | InGaN + Phosphor | Spectrum | 3.20 | 3.00 – 3.50 | 15.0 |

- **ความสว่างและการเฉลี่ยกระแสตามเวลา (Luminous Intensity / Brightness)**:
  ความสว่างที่แสดงผลบนหน้าจอต้องคำนวณจาก **กระแสเฉลี่ยตามเวลา (Time-Averaged Current)** ผ่านตัวกรองความถี่ต่ำเพื่อรองรับ PWM:
  $$\langle I \rangle_{eff}(t) = \langle I \rangle_{eff}(t - \Delta t) \cdot e^{-\Delta t / \tau_{eye}} + I_d(t) \cdot (1 - e^{-\Delta t / \tau_{eye}})$$
  โดยที่ $\tau_{eye} \approx 20\ \text{ms}$ (การคงอยู่ของภาพในสายตามนุษย์ / Persistence of Vision)
  ความสว่างสัมพัทธ์ (0.0 ถึง 1.0):
  $$\text{Brightness} = \min\left(1.0, \frac{\langle I \rangle_{eff}}{I_{rated}} \times \left( 1 - \exp\left( -\frac{\langle I \rangle_{eff}}{0.2 \cdot I_{rated}} \right) \right)\right)$$
- **ความคลาดเคลื่อนประจำตัวชิ้นส่วน (Component Variability & Current Hogging)**:
  เมื่อเปิดตัวเลือก Realism/Tolerance LED แต่ละดวงจะได้รับค่า $V_f$ สุ่มเบี่ยงเบน $\pm 2.5\%$ ($\sigma = 0.83\%$) ด้วย Seed ประจำตัว ทำให้เมื่อต่อขนานกันโดยตรงโดยไม่มีตัวต้านทานประจำกิ่ง จะเกิดปรากฏการณ์ **Current Hogging** ตามธรรมชาติ (ดวงที่ $V_f$ ต่ำกว่าจะนำกระแสมากกว่าอย่างมีนัยสำคัญ)
- **ขีดจำกัดความเสียหาย (Overcurrent & Thermal Damage)**:
  - $I_{max} = 30\ \text{mA}$ (แจ้งเตือน Overcurrent เมื่อ $I_d > 30\ \text{mA}$)
  - อัตราการสะสมความเสียหายเมื่อ $I_d > 50\ \text{mA}$:
    $$\text{Damage}(t) = \int \left( \frac{I_d - 50\text{mA}}{50\text{mA}} \right)^2 dt$$
    หาก $\text{Damage} \ge 1.0\ \text{A}^2\cdot\text{s}$ (หรือกระแสพัลส์กระชาก $I_d > 200\ \text{mA}$) LED จะเข้าสู่สถานะ **เสียหาย (Blown Open Circuit)** ถาวร

---

### 4.4 สวิตช์ปุ่มกด (Pushbutton - 4-Pin Tactile Switch)
- **สัญลักษณ์และโครงสร้างกายภาพ**:
  ปุ่มกดแบบแทกไทล์ 4 ขามาตรฐาน (Tactile Switch 6x6 mm):
  - ขา 1 เชื่อมต่อกับ ขา 2 ภายในตลอดเวลา
  - ขา 3 เชื่อมต่อกับ ขา 4 ภายในตลอดเวลา
  - เมื่อกดปุ่ม หน้าสัมผัสจะเชื่อมคู่ (1, 2) เข้ากับคู่ (3, 4)
- **พารามิเตอร์ทางไฟฟ้า**:
  - เมื่อกด (Closed): $R_{on} = 0.05\ \Omega \le 0.1\ \Omega$
  - เมื่อปล่อย (Open): $R_{off} = 100\ \text{M}\Omega = 10^8\ \Omega$ (ไม่ใช้ $\infty$ เพื่อรักษาโครงสร้างเมทริกซ์)
- **การจำลอง Contact Bounce (การกระดอนของหน้าสัมผัสเชิงกล)**:
  เมื่อเปิดตัวเลือก Bounce การสับสวิตช์จะสร้างสัญญาณกระดอนสุ่มในช่วงเวลา $t_{bounce} \in [1, 5]\ \text{ms}$:
  - ลำดับการกระดอนสร้างจาก Pseudo-random Pulse Generator (อิง Seed) ที่ความถี่ $\approx 2 - 10\ \text{kHz}$
  - สัญญาณนี้จะถูกส่งเข้า Event Queue เพื่อให้วงจรดีบาวน์แบบฮาร์ดแวร์ ($RC$ Filter) หรือซอฟต์แวร์สามารถทดสอบการขจัดสัญญาณรบกวนได้อย่างสมจริง

---

### 4.5 เบรดบอร์ดและสายต่อ (Breadboard & Wiring Parasitics)
- **โครงสร้างการเชื่อมต่อของเบรดบอร์ด (Half-size Breadboard 400 tie-points)**:
  - แถวเสียบอุปกรณ์: รู a, b, c, d, e ในแต่ละแถว (แถวที่ 1 ถึง 30) เชื่อมถึงกันเป็น Net เดียว
  - รู f, g, h, i, j เชื่อมถึงกันเป็นอีก Net หนึ่ง
  - ร่องตรงกลาง (Center Divider) แยกฝั่ง a-e และ f-j ออกจากกันโดยเด็ดขาด
  - รางจ่ายไฟ (Power Rails): ฝั่งบนและฝั่งล่างมี 2 ราง (+ และ -) เชื่อมต่อกันตลอดแนวยาว 30 คอลัมน์ (รุ่น Half-size ไม่มีรอยต่อแบ่งครึ่ง)
- **ปรสิตทางไฟฟ้า (Parasitics)**:
  - ความต้านทานหน้าสัมผัสของคลิปสปริง (Contact Resistance per tie-point): $R_{clip} \approx 10\ \text{m}\Omega$
  - ความจุไฟฟ้าปรสิตระหว่างแถวที่อยู่ติดกัน (Inter-strip Stray Capacitance): $C_{stray} \approx 1.5 - 3.0\ \text{pF}$
  - ความจุไฟฟ้าลงกราวด์ (Capacitance to Ground Plane): $C_{gnd} \approx 0.5\ \text{pF}$
- **สายจัมเปอร์ (Jumper Wires)**:
  - สายจัมเปอร์มีความต้านทานสาย $R_{wire} \ge 1.0\ \text{m}\Omega$ ($0.01 - 0.05\ \Omega$) หรือใช้การยุบรวมโหนด (Netlist Unification) โดยต้องตรวจสอบไม่ให้เกิด Loop ของแหล่งจ่ายแรงดันอุดมคติ (Ideal Voltage Source Loop)

---

### 4.6 ตัวเก็บประจุ (Capacitor: Ceramic vs Electrolytic)
- **วงจรสมมูลทางกายภาพ (Physical Equivalent Circuit Model)**:
  ตัวเก็บประจุถูกจำลองด้วยโครงสร้างที่มีโหนดภายใน (Internal Node):

```
Terminal 1 ───[ ESR ]───( Internal Node )───┬───[ Ideal C ]───┬─── Terminal 2
                                            │                 │
                                            └────[ R_leak ]───┘
```

- **สมการ MNA และการแสตมป์**:
  1. $ESR$ เชื่อมระหว่าง Terminal 1 กับ Internal Node: สแตมป์ความนำ $g_{esr} = 1 / ESR$
  2. กิ่ง $C$ ขนาน $R_{leak}$ เชื่อมระหว่าง Internal Node กับ Terminal 2:
     - ความนำ $G_{cap} = G_{eq} + 1 / R_{leak}$ (โดยที่ $G_{eq}$ มาจาก Trapezoidal / Backward Euler ในหัวข้อ 3.1)
     - แหล่งจ่ายกระแสเทียบเท่า $I_{eq}$ ฉีดเข้า Internal Node และไหลออกจาก Terminal 2

- **ความแตกต่างระหว่างเซรามิกและอิเล็กทรอไลต์**:

| คุณลักษณะ | เซรามิก (Ceramic Capacitor, e.g. MLCC) | อิเล็กทรอไลต์ (Aluminum Electrolytic) |
| :--- | :--- | :--- |
| **โครงสร้างขั้ว** | ไม่มีขั้ว (Non-polarized) | มีขั้วบวก/ลบชัดเจน (Polarized) |
| **พิกัดความจุทั่วไป** | $100\ \text{pF} - 10\ \mu\text{F}$ | $1\ \mu\text{F} - 10,000\ \mu\text{F}$ |
| **พิกัดแรงดัน ($V_{rated}$)** | $50.0\ \text{V}$ (ทั่วไป) | $16.0\ \text{V} - 25.0\ \text{V}$ |
| **ความต้านทานอนุกรม ($ESR$)** | ต่ำมาก: $10 - 50\ \text{m}\Omega$ ($0.02\ \Omega$) | ปานกลาง: $0.1 - 1.0\ \Omega$ ($0.5\ \Omega$) |
| **ความต้านทานรั่วไหล ($R_{leak}$)** | สูงมาก: $1 - 10\ \text{G}\Omega$ ($10^9 - 10^{10}\ \Omega$) | คำนวณตามสูตรกระแสรั่ว: $I_{leak} \approx 0.01 C V + 3\ \mu\text{A}$ $\implies R_{leak} \approx \frac{V}{I_{leak}} \approx 1 - 50\ \text{M}\Omega$ |
| **DC-Bias Derating** | มีผลใน Dielectric Class II (X7R/X5R): ความจุลดลงตามแรงดัน DC ตกคร่อม | ไม่มีผลจาก DC-bias อย่างมีนัยสำคัญ |
| **การต่อกลับขั้ว (Reverse Polarity)**| ทนทานได้ทั้งสองทิศทาง | **เกิดความเสียหาย**: เมื่อ $V_{rev} > 1.0\ \text{V}$ กระแสรั่วพุ่งขึ้นมหาศาล ($R_{leak} \to 10\ \Omega$) สะสมความร้อนและระเบิด/เสียหาย |

- **แบบจำลอง DC-Bias Derating สำหรับเซรามิก (X7R)**:
  $$C_{eff}(V_{dc}) = C_{nom} \times \left( \frac{1}{1 + \left( \frac{|V_{dc}|}{V_{rated} \times 0.7} \right)^2} \right)$$
- **แบบจำลองการเสียหายจากการต่อกลับขั้วของอิเล็กทรอไลต์ (Reverse Breakdown Model)**:
  เมื่อ $V_{term} = V_+ - V_- < -0.5\ \text{V}$:
  $$I_{leak, rev} = I_{leak, norm} \times \exp\left( \frac{-V_{term} - 0.5}{0.2} \right)$$
  หาก $V_{term} < -1.5\ \text{V}$ ต่อเนื่องเกิน $1.0\ \text{s}$ คอมโพเนนต์จะเปลี่ยนสถานะเป็น **เสียหาย (Damaged - Shorted then Open)**

---

## 5. การเชื่อมโยงระบบไฟฟ้า Arduino Uno
*(ATmega328P Electrical Coupling & AVR Emulation Specifications)*

### 5.1 รางจ่ายไฟบอร์ด Uno (5V and 3.3V Power Distribution Rails)
1. **ราง 5V (USB Powered / Onboard 5V Regulator)**:
   - แหล่งแรงดัน Thevenin: $V_{src} = 5.0\ \text{V}$
   - ความต้านทานภายใน (Internal Source Resistance): $R_{out\_5v} = 1.0\ \Omega$ ($0.5 - 1.5\ \Omega$, ปรับได้ใน Inspector)
   - ขีดจำกัดกระแส (Polyfuse Limit): $I_{max\_5v} = 500\ \text{mA}$
   - เมื่อ $I_{load} > 500\ \text{mA}$:
     - ฟิวส์แบบ PTC Resettable Fuse ทำงาน: ความต้านทาน $R_{out\_5v}$ จะเพิ่มขึ้นตามความร้อน $R(t) = R_0 \cdot (1 + \alpha_{ptc} \cdot \theta)$ ส่งผลให้แรงดันตกฮวบ (Voltage Sag / Brownout)
     - แจ้งเตือนสภาวะ Overcurrent Fault บน UI
2. **ราง 3.3V (LP2985-33 LDO Regulator บนบอร์ด Uno)**:
   - แหล่งแรงดัน Thevenin: $V_{src} = 3.3\ \text{V}$
   - ความต้านทานภายใน: $R_{out\_3v3} = 2.0\ \Omega$
   - ขีดจำกัดกระแสสูงสุด: $I_{max\_3v3} = 150\ \text{mA}$

---

### 5.2 ขาพอร์ตดิจิทัล (GPIO Drivers & Digital Input Architecture)

วงจรสมมูลของขา I/O แต่ละพินของ ATmega328P จำลองตามโครงสร้าง CMOS แท้จริง:

```
                      +5V (Internal Vcc Node)
                               │
                       [ P-FET Driver ]  (R_on_P ≈ 30-40 Ω)
                               │
               ┌───────────────┴───────────────┐
               │                               │
       [ Pullup Resistor ]                     │
         (20k - 50k Ω)                         ├─── Physical Pin
               │                               │
               │                       [ N-FET Driver ]  (R_on_N ≈ 25-35 Ω)
               │                               │
              GND                             GND
```

1. **โหมด OUTPUT HIGH**:
   - เชื่อมต่อขาพินเข้ากับราง 5V ภายในผ่าน PMOS Driver Resistance:
     $$R_{on\_P} \approx 30.0\ \Omega \quad (25 - 45\ \Omega)$$
   - สอดคล้องกับ Datasheet: $V_{OH} \ge 4.2\ \text{V}$ ที่กระแสซอร์ส $I_{OH} = -20\ \text{mA}$ ($V_{drop} \le 0.8\ \text{V} \implies R \approx 40\ \Omega$)
2. **โหมด OUTPUT LOW**:
   - เชื่อมต่อขาพินลงกราวด์ผ่าน NMOS Driver Resistance:
     $$R_{on\_N} \approx 25.0\ \Omega \quad (20 - 40\ \Omega)$$
   - สอดคล้องกับ Datasheet: $V_{OL} \le 0.9\ \text{V}$ ที่กระแสซิงก์ $I_{OL} = +20\ \text{mA}$ ($R \approx 35\ \Omega$)
3. **โหมด INPUT (High-Z)**:
   - ความต้านทานอินพุตสูงมาก: $R_{in} > 100\ \text{M}\Omega$
   - กระแสรั่วไหลอินพุต: $I_{leak} \le 1.0\ \mu\text{A}$ (สอดคล้องกับ Datasheet input leakage)
4. **โหมด INPUT_PULLUP**:
   - ความต้านทานพูลอัปภายในต่อเข้ากับโหนด 5V:
     $$R_{pu} = 35.0\ \text{k}\Omega \quad (\text{Datasheet ช่วงที่ระบุ: } 20 - 50\ \text{k}\Omega)$$
5. **เกณฑ์การอ่านระดับดิจิทัลและ Schmitt Trigger Hysteresis**:
   การอ่านแรงดันจริงที่ขาพินเพื่อแปลงกลับเป็นบิตสถานะดิจิทัลของพอร์ต (PINx Register) ต้องใช้ Schmitt Trigger Model:
   - แรงดันธรณีประตูด้านต่ำ (Negative-going Threshold): $V_{IL} = 0.3 \times V_{cc} = 1.50\ \text{V}$ (ที่ $V_{cc} = 5.0\ \text{V}$)
   - แรงดันธรณีประตูด้านสูง (Positive-going Threshold): $V_{IH} = 0.6 \times V_{cc} = 3.00\ \text{V}$ (ที่ $V_{cc} = 5.0\ \text{V}$)
   - สถานะ Hysteresis:
     $$\text{Bit State}(t) = \begin{cases}
     1 & \text{ถ้า } V_{pin} \ge V_{IH} \\
     0 & \text{ถ้า } V_{pin} \le V_{IL} \\
     \text{Bit State}(t - \Delta t) & \text{ถ้า } V_{IL} < V_{pin} < V_{IH} \text{ (คงสถานะเดิม)}
     \end{cases}$$
   - หากแรงดันแช่อยู่ในช่วงก้ำกึ่ง ($1.5\ \text{V} < V_{pin} < 3.0\ \text{V}$) นานเกิน $100\ \text{ms}$ ให้แสดง Warning "Indeterminate Logic Level / Metastable State" บน UI

---

### 5.3 ภาคแปลงสัญญาณแอนะล็อกเป็นดิจิทัล (10-bit Successive Approximation ADC)
1. **สมการการแปลงค่า (Conversion Formula)**:
   $$\text{ADC Code} = \min\left(1023, \max\left(0, \left\lfloor \frac{V_{in}}{V_{ref}} \times 1024 \right\rfloor \right)\right)$$
2. **แรงดันอ้างอิง ($V_{ref}$ Selection)**:
   - `DEFAULT`: เชื่อมกับขา $AV_{cc}$ ซึ่งต่อเข้ากับรางจ่าย 5V ของบอร์ด (ดังนั้นหากราง 5V เกิด Voltage Sag ค่า $V_{ref}$ จะลดลงตาม ทำให้ค่าอ่าน ADC เพิ่มขึ้นตามฟิสิกส์จริง)
   - `INTERNAL`: แรงดัน Bandgap คงที่ $V_{bg} = 1.10\ \text{V}$ ($\pm 0.1\ \text{V}$)
   - `EXTERNAL`: แรงดันที่ป้อนเข้าขา AREF ($0.0\ \text{V} \le V_{aref} \le V_{cc}$)
3. **แบบจำลองวงจรสุ่มสัญญาณ (Sample-and-Hold Circuit Model)**:
   ระหว่างการแปลงค่า ADC สวิตช์ภายในจะเชื่อมต่อขาแอนะล็อกเข้ากับวงจร Sample-and-Hold:
   - ความต้านทานสวิตช์มัลติเพล็กเซอร์: $R_{adc\_mux} \approx 1.0 - 2.0\ \text{k}\Omega$
   - ตัวเก็บประจุสุ่มสัญญาณ: $C_{sh} \approx 14.0\ \text{pF}$
   - ปรากฏการณ์ **Charge Sharing**: หากความต้านทานของแหล่งกำเนิดสัญญาณภายนอกสูงกว่า $R_s > 10\ \text{k}\Omega$ (ตามคำเตือนใน Datasheet) ประจุที่ค้างอยู่ใน $C_{sh}$ จากการแปลงช่องก่อนหน้าจะถ่ายเทประจุมายังอินพุต ทำให้ค่าที่อ่านได้คลาดเคลื่อน เว้นแต่จะติดตั้งตัวเก็บประจุภายนอก (เช่น $100\ \text{nF}$) คร่อมขาอินพุตลงกราวด์เพื่อทำหน้าที่เป็น Buffer จ่ายประจุชดเชย
4. **พฤติกรรมขา ADC ลอย (Floating Analog Pin)**:
   ขา ADC ที่ปล่อยลอยจะถูกจำลองด้วยแหล่งกำเนิดสัญญาณสุ่มแบบเกาส์เซียนเชิงความถี่ต่ำ (Deterministic Pseudo-Random Pink Noise อิง Seed) ร่วมกับความจุปรสิต $C_{pin} \approx 5\ \text{pF}$ สู่สิ่งแวดล้อม ค่าที่อ่านได้จะลอยเคว้งระหว่าง 0 ถึง 1023 **ไม่ใช่ 0 เสมอไป**

---

### 5.4 ขีดจำกัดปลอดภัยสูงสุดและสถานะเสียหาย (Absolute Maximum Ratings)
อิงตาม ATmega328P Datasheet (Section 32.1 Absolute Maximum Ratings):
- กระแสสูงสุดต่อขา DC Current per I/O Pin:
  - เตือนเมื่อ $|I_{pin}| > 20.0\ \text{mA}$
  - เสียหายเมื่อ $|I_{pin}| > 40.0\ \text{mA}$
- กระแสสูงสุดรวมผ่านขั้ว VCC และ GND:
  - เสียหายเมื่อ $I_{vcc\_total} > 200.0\ \text{mA}$
- ขีดจำกัดแรงดันตกคร่อมขา I/O:
  - Clamping Diode ทำงานเมื่อ $V_{pin} < -0.5\ \text{V}$ หรือ $V_{pin} > V_{cc} + 0.5\ \text{V}$
  - กระแสผ่าน Clamping Diode เกิน $10\ \text{mA}$ ทำให้พินเสียหายถาวร

---

## 6. สารบบค่าคงที่ทางฟิสิกส์และสเปกอุปกรณ์
*(Physical Constants & Parameters Registry)*

ตารางนี้เป็นแหล่งอ้างอิงค่าคงที่ทั้งหมดในระบบ ในการนำไปเขียนโค้ดต้องสร้าง struct หรือ module กลาง (เช่น `crates/sim_core/src/constants.rs`) บรรจุค่าเหล่านี้ทั้งหมด:

| สัญลักษณ์ตัวแปร | ค่าตัวเลข (SI Unit) | หน่วย | คำอธิบายความหมาย | ที่มา / เอกสารอ้างอิง |
| :--- | :---: | :---: | :--- | :--- |
| `K_BOLTZMANN` | $1.380649 \times 10^{-23}$ | $\text{J}\cdot\text{K}^{-1}$ | Boltzmann Constant | CODATA 2018 Standard |
| `Q_ELECTRON` | $1.602176634 \times 10^{-19}$ | $\text{C}$ | Elementary Charge | CODATA 2018 Standard |
| `T_ROOM_KELVIN` | $300.15$ | $\text{K}$ | อุณหภูมิห้องมาตรฐาน ($27^\circ\text{C}$) | Standard Laboratory Temp |
| `V_THERMAL` | $0.025852$ | $\text{V}$ | Thermal Voltage $V_t = kT/q$ @ 300K | คำนวณจากค่าคงที่สากล |
| `G_MIN_DEFAULT` | $1.0 \times 10^{-12}$ | $\text{S}$ | ความนำไฟฟ้าขั้นต่ำเพื่อป้องกัน Singular | SPICE3f5 Standard |
| `V_SRC_5V_NOM` | $5.0$ | $\text{V}$ | แรงดันระบุราง 5V บอร์ด Uno | Arduino Uno Schematic |
| `R_OUT_5V_DEFAULT` | $1.0$ | $\Omega$ | ความต้านทานภายในราง 5V | วัดจริงจากบอร์ด Uno + USB cable |
| `I_LIMIT_5V` | $0.500$ | $\text{A}$ | พิกัดกระแส Polyfuse ราง 5V | Arduino Uno Eagle BOM |
| `V_SRC_3V3_NOM` | $3.3$ | $\text{V}$ | แรงดันระบุราง 3.3V บอร์ด Uno | LP2985 Datasheet |
| `R_OUT_3V3_DEFAULT`| $2.0$ | $\Omega$ | ความต้านทานภายในราง 3.3V | LP2985 Dropout Spec |
| `I_LIMIT_3V3` | $0.150$ | $\text{A}$ | พิกัดกระแสสูงสุด LDO 3.3V | LP2985 Max Output Spec |
| `R_GPIO_OUT_P` | $30.0$ | $\Omega$ | ความต้านทาน PMOS Driver ขา High | ATmega328P Datasheet $V_{OH}$ |
| `R_GPIO_OUT_N` | $25.0$ | $\Omega$ | ความต้านทาน NMOS Driver ขา Low | ATmega328P Datasheet $V_{OL}$ |
| `R_GPIO_PULLUP` | $35000.0$ | $\Omega$ | ความต้านทานพูลอัปภายใน (Nominal) | ATmega328P Spec ($20-50\text{ k}\Omega$) |
| `R_GPIO_INPUT_HIZ`| $1.0 \times 10^8$ | $\Omega$ | ความต้านทานอินพุต High-Z | ATmega328P Leakage Spec |
| `V_SCHMITT_VIL` | $0.30$ | $\times V_{cc}$ | ธรณีประตู Schmitt ขาลง | ATmega328P Table 32-2 |
| `V_SCHMITT_VIH` | $0.60$ | $\times V_{cc}$ | ธรณีประตู Schmitt ขาขึ้น | ATmega328P Table 32-2 |
| `C_ADC_SAMPLE_HOLD`| $1.4 \times 10^{-11}$ | $\text{F}$ | คาปาซิเตอร์ Sample-and-Hold (~14pF) | ATmega328P Section 24.6.1 |
| `R_ADC_SOURCE_MAX` | $10000.0$ | $\Omega$ | ความต้านทานแหล่งสัญญาณสูงสุดที่แนะนำ | ATmega328P Datasheet 24.6.1 |
| `I_GPIO_WARN_A` | $0.020$ | $\text{A}$ | กระแสสูงสุดที่แนะนำต่อขาพิน (20mA) | ATmega328P Absolute Ratings |
| `I_GPIO_MAX_A` | $0.040$ | $\text{A}$ | กระแสทำลายสูงสุดต่อขาพิน (40mA) | ATmega328P Absolute Ratings |
| `I_VCC_TOTAL_MAX_A`| $0.200$ | $\text{A}$ | กระแสรวมสูงสุดผ่าน VCC/GND (200mA) | ATmega328P Absolute Ratings |
| `R_POT_WIPER_RC` | $1.0$ | $\Omega$ | ความต้านทานหน้าสัมผัส Wiper ($R_c$) | Alps/Bourns Pot Spec |
| `R_PUSHBUTTON_ON` | $0.05$ | $\Omega$ | ความต้านทานหน้าสัมผัสปุ่มเมื่อกด | Omron B3F Tactile Datasheet |
| `R_PUSHBUTTON_OFF`| $1.0 \times 10^8$ | $\Omega$ | ความต้านทานของฉนวนปุ่มเมื่อปล่อย | Omron B3F Spec ($>100\text{ M}\Omega$) |
| `R_BREADBOARD_CLIP`| $0.010$ | $\Omega$ | ความต้านทานคลิปสปริงเบรดบอร์ดต่อจุด | [ยังไม่ยืนยัน] |
| `C_BREADBOARD_STRIP`| $2.0 \times 10^{-12}$ | $\text{F}$ | คาปาซิแตนซ์ปรสิตระหว่างแถวเบรดบอร์ด | [ยังไม่ยืนยัน] |
| `R_JUMPER_WIRE` | $0.020$ | $\Omega$ | ความต้านทานสายจัมเปอร์ 24 AWG 15cm | Standard Copper Wire Resistance |
| `ESR_CERAMIC_DEF` | $0.020$ | $\Omega$ | ความต้านทานอนุกรมเทียบเท่าเซรามิก | Murata GRM Series Datasheet |
| `R_LEAK_CERAMIC` | $1.0 \times 10^9$ | $\Omega$ | ความต้านทานฉนวนรั่วไหลเซรามิก | Murata Insulation Spec |
| `ESR_ELECTRO_DEF` | $0.500$ | $\Omega$ | ความต้านทานอนุกรมอิเล็กทรอไลต์ | Nichicon UVZ Series Datasheet |
| `V_RAT_ELECTRO_DEF`| $25.0$ | $\text{V}$ | พิกัดแรงดันอิเล็กทรอไลต์เริ่มต้น | Standard Starter Kit Spec |
| `V_RAT_CERAMIC_DEF`| $50.0$ | $\text{V}$ | พิกัดแรงดันเซรามิกเริ่มต้น | Standard MLCC Spec |
| `DT_MIN_TIMESTEP` | $1.0 \times 10^{-7}$ | $\text{s}$ | ก้าวเวลาขั้นต่ำ ($100\ \text{ns}$) | Solver Stability Spec |
| `DT_MAX_TIMESTEP` | $1.0 \times 10^{-4}$ | $\text{s}$ | ก้าวเวลาขั้นสูงสุด ($100\ \mu\text{s}$) | PWM Nyquist Sampling Spec |

---

## 7. แผนผังโครงสร้างโค้ดและจุดปรับปรุง
*(Code Architecture Map & Upgrade Plan)*

### 7.1 โครงสร้างไฟล์ปัจจุบันและการอ้างอิงบรรทัด (Current Code Baseline)

```
crates/
├── sim_core/
│   ├── Cargo.toml
│   └── src/
│       ├── lib.rs              # Component structs, McuCore trait, SimulationEngine
│       │   ├── L415-429: LedComponent::forward_voltage() (ไม่สอดคล้องกับ UI)
│       │   ├── L478-498: CapacitorComponent (ยังไม่มี R_leak, พิกัดไม่ถูกใช้)
│       │   └── L573-576: step_cycles() (เรียก solve ครั้งเดียวต่อเฟรม 60FPS)
│       └── solver.rs           # MNA solver, Norton stamping, Newton-Raphson
│           ├── L256-300: solve_linear_system() (Gaussian elimination + ad-hoc pivot)
│           ├── L367-374: PowerRealismMode::Ideal (ไม่มี voltage sag)
│           ├── L501-544: Stamping MCU power & GPIO pins (Norton fixed 25 ohm)
│           ├── L530-538: Averaged DC PWM resistive divider (ไม่ใช่ time-domain)
│           ├── L568-574: Potentiometer stamping (กระโดด 10,000 เท่าที่ 100%)
│           ├── L588-603: Capacitor companion stamp (ล็อก dt = 16.67ms)
│           ├── L646-661: Piecewise diode model (อนุพันธ์กระโดด 32 เท่า)
│           ├── L677-683: ขาด SPICE pnjlim
│           ├── L685:     เกณฑ์ convergence มีเพียง delta < 1e-4 ขาดเกณฑ์กระแส
│           ├── L695-710: node_volt_clean() ปัดเศษแรงดัน 5V นิ่ง
│           ├── L730:     เกณฑ์ติดของ LED id > 0.00005 แบบตัดท่อน
│           ├── L778-795: Capacitor post-relaxation alpha.min(1.0)
│           └── L980-985: Digital input อ่านขาด Schmitt hysteresis
├── sim_canvas/
│   └── src/
│       └── parts.rs            # PartKind enum (ขาด PartKind::Capacitor)
├── app/
│   └── src/
│       └── runner.rs           # Desktop simulation runner
│           └── L69-94: sync_components() (ละเลย Capacitor ทั้งหมด)
src/                            # Frontend Web & Tauri UI
├── App.tsx                     # React canvas state, circuit templates
│   ├── L671:   led1 default ไม่มี vf (ส่งผลต่อบั๊ก B2)
│   ├── L1316:  add_led ไม่ส่ง vf (ส่งผลต่อบั๊ก B3)
│   └── L2315, 4900: เพิ่ม LED ใหม่ด้วย vf: 2.0 (ไม่ตรงกับ backend 1.8)
└── components/
    └── PropertyInspector.tsx   # แผงตั้งค่าคุณสมบัติอุปกรณ์
        ├── L67-74: LED_PRESET_COLORS (ไม่ตรงกับ lib.rs)
        └── L694:   Quick Vf Presets มีปุ่ม 3.2V กับทุกสี (บั๊ก B3)
```

---

### 7.2 อินเทอร์เฟซอุปกรณ์แบบรวมศูนย์ (`CircuitDevice` Trait สำหรับ Phase 2/3)

เพื่อตอบสนองข้อกำหนด R2 ซึ่งระบุว่าอุปกรณ์ทุกชนิดต้องเชื่อมโยงผ่าน Interface เดียวกันโดยไม่ต้องรื้อแก้แกน Solver เมื่อเพิ่มอุปกรณ์ใหม่ในอนาคต:

```rust
// Target file: crates/sim_core/src/device.rs (ที่จะสร้างใน Phase 2)
use crate::solver::{MnaMatrix, TimeContext, NodeVoltageLookup};

pub trait CircuitDevice: Send + Sync {
    /// รหัสประจำตัวชิ้นส่วน
    fn id(&self) -> &str;

    /// รายชื่อพินและขั้วต่อทั้งหมดของอุปกรณ์
    fn terminal_pins(&self) -> Vec<String>;

    /// การสแตมป์เมทริกซ์สำหรับ DC Operating Point
    fn stamp_dc(&self, matrix: &mut MnaMatrix);

    /// การสแตมป์เมทริกซ์สำหรับ Transient Simulation (Dynamic Companion Models)
    fn stamp_transient(&self, matrix: &mut MnaMatrix, context: &TimeContext);

    /// อัปเดตสถานะตัวแปรภายใน (Internal State, ประจุ, ฟลักซ์, ความร้อน)
    fn update_state(&mut self, voltages: &NodeVoltageLookup, dt: f64);

    /// ตรวจสอบขีดจำกัดความปลอดภัย (Overcurrent, Overvoltage, Reverse Polarity)
    fn check_limits(&self, voltages: &NodeVoltageLookup, dt: f64) -> Vec<DeviceWarning>;

    /// สถานะความเสียหายถาวร (Damaged State)
    fn is_damaged(&self) -> bool;

    /// รีเซ็ตสถานะความเสียหายและประจุเริ่มต้น
    fn reset_device(&mut self);
}
```

---

## 8. เกณฑ์การยอมรับและเมทริกซ์การทดสอบ (Acceptance Criteria & Test Matrix T1–T20)

ตารางนี้เป็นเกณฑ์การตรวจสอบอิสระตามข้อกำหนดของ Phase 0 ที่ Subagent E (QA & Verification) จะนำไปเขียนเป็นชุดทดสอบอัตโนมัติใน Phase 1–6:

| รหัสทดสอบ | วงจรและเงื่อนไขการทดสอบ | พารามิเตอร์ที่ทดสอบ | ค่าที่คาดหวังตามหลักฟิสิกส์ | เกณฑ์การผ่าน (Tolerance) | ข้อกำหนด |
| :---: | :--- | :--- | :--- | :--- | :---: |
| **T1** | Potentiometer $10\text{ k}\Omega$ หมุนที่ $x = 0.50$ (50%) ไม่มีโหลด และต่อโหลด $10\text{ k}\Omega$ | แรงดัน Wiper | ไม่มีโหลด: $V_w = 2.500\text{ V}$<br>โหลด $10\text{ k}\Omega$: $V_w \approx 2.000\text{ V}$ | $\pm 0.5\%$ | R3 |
| **T2** | กวาด Pot $0 \to 100\%$ (ก้าวละ $0.1\%$) ต่อตรงเข้า LED 3 ดวงขนานลง GND | แรงดัน Wiper และความต่อเนื่อง | ต่อเนื่อง โมโนโทนิก ไม่มีการกระโดด ที่ $100\%$ ราง 5V เกิด Sag และมีแจ้งเตือน Overcurrent | ไม่มีกระโดด $>0.2\text{ V}$ ภายใน $1\%$ | R1 (B1), R3 |
| **T3** | แหล่งจ่าย 5V $\to$ $220\ \Omega$ $\to$ LED แดง ($V_f = 2.2\text{ V}$ @ 20mA) | กระแสในวงจร $I$ | $I \approx \frac{5.0 - 2.18}{220 + R_s} \approx 12.8\text{ mA}$ | $\pm 3.0\%$ | R1 (B3), R3 |
| **T4** | LED แดง 3 ดวงต่อขนาน: (a) $V_f$ เท่ากันเป๊ะ, (b) $V_f$ ต่างกัน $2\%$ | กระแสแต่ละดวง $I_1, I_2, I_3$ | (a) แบ่งกระแสเท่ากัน $I_1=I_2=I_3 > 0$<br>(b) ดวง $V_f$ ต่ำสุดนำกระแสมากสุด ทุกดวงผลรวมเท่ากับกระแสรวม | ทุกดวงมี $I > 0$ | R1 (B2), R3 |
| **T5** | แหล่งจ่าย 5V $\to$ LED ต่อกลับขั้วลง GND | กระแสและสถานะ | $I \approx I_{leak} \le 10\text{ nA}$, `is_lit == false` | $I < 1.0\ \mu\text{A}$ | R3 |
| **T6** | Pushbutton ต่อระหว่าง D2 กับ GND (โหมด `INPUT_PULLUP`) | ดิจิทัลบิต PIN2 | ไม่กด = 1 (HIGH, $V \approx 5.0\text{ V}$)<br>กด = 0 (LOW, $V \le 0.05\text{ V}$) | Schmitt แม่นยำ 100% | R3, R4 |
| **T7** | Pin D3 (OUTPUT HIGH) $\to$ $220\ \Omega$ $\to$ LED แดง | แรงดันตกคร่อม Pin D3 | แรงดันตกคร่อมตาม $R_{out} \approx 30\ \Omega$: $V_{pin} \approx 5.0 - I \cdot 30 < 5.0\text{ V}$ | $\pm 5.0\%$ | R4 |
| **T8** | ลัดวงจร 5V เข้ากับ GND โดยตรง | พฤติกรรมระบบ | ไม่เกิด Crash, ไม่เกิด NaN, กระแสถูกจำกัดที่ Polyfuse, แจ้งเตือน Short Circuit | ผ่าน 100% | R2, R4 |
| **T9** | ตรวจสอบ KCL ทุกโหนด และสมดุลกำลังไฟฟ้าทุกรอบการคำนวณ | KCL Residual และ $\Delta P$ | KCL error $< 1.0\ \text{nA}$, สมดุลกำลังไฟฟ้า $< 1\%$ | ผ่านทุกสเต็ป | R2 |
| **T10** | รันโปรเจกต์ตัวอย่างเดิมทั้งหมดใน Workspace | ฟังก์ชันเดิม | คอมไพล์ผ่าน, ทำงานปกติ, ไม่เกิด Regression | ผ่าน 100% | R1 |
| **T11** | วงจร RC Charge: $10\text{ k}\Omega + 10\ \mu\text{F}$ ($\tau = 0.1\text{ s}$) ป้อน 5V | $V_C(t)$ | $V_C(t) = 5(1 - e^{-t/0.1})$<br>ที่ $t = \tau$: $V_C \approx 3.16\text{ V}$ ($63.2\%$) | ผิดพลาด $\le 0.5\%$ ตลอด $0-5\tau$ | R3 (B4) |
| **T12** | วงจร RC Discharge: $C = 10\ \mu\text{F}$ มีประจุ $5\text{ V}$ ต่อคายประจุผ่าน $10\text{ k}\Omega$ | $V_C(t)$ | $V_C(t) = 5 \cdot e^{-t/0.1}$ | ผิดพลาด $\le 0.5\%$ | R3 (B4) |
| **T13** | สมดุลพลังงานในการชาร์จตัวเก็บประจุจาก 0 ถึง $5\tau$ | พลังงาน $E$ | $E_{source} \approx C V^2$, $E_{stored} \approx \frac{1}{2} C V^2$, $E_{dissipated} \approx \frac{1}{2} C V^2$ | คลาดเคลื่อน $\le 1.0\%$ | R3 |
| **T14** | ตัวเก็บประจุต่ออนุกรมในทางผ่านกระแสตรง | กระแส DC สภาวะคงที่ | กระแสลดลงจนเหลือเพียงกระแสรั่วไหล $I_{leak} \approx V / R_{leak}$ | $I < 1.0\ \text{nA}$ (Ceramic) | R3 |
| **T15** | สัญญาณ PWM 50% ($490\text{ Hz}$) ผ่านตัวกรอง RC Low-Pass ($10\text{ k}\Omega, 10\ \mu\text{F}$) | ค่าเฉลี่ยและ Ripple | ค่าเฉลี่ยแรงดัน $\approx 2.50\text{ V}$, Ripple สอดคล้องกับสมการวิเคราะห์ | ค่าเฉลี่ย $\pm 1\%$, Ripple $\pm 5\%$ | R3, R4 |
| **T16** | วงจรดีบาวน์สวิตช์: ปุ่มมี Contact Bounce ต่อผ่าน RC Filter เข้าขา D2 | จำนวนการข้าม Threshold | สัญญาณกระดอนหลายครั้งถูกกรองเหลือการทริกเกอร์ลอจิกเพียงครั้งเดียว | ไม่เกิด False Triggering | R3, R4 |
| **T17** | Decoupling: โหลดพัลส์กระชากบนราง 5V | แรงดัน Ripple / Sag | เมื่อมีตัวเก็บประจุ Decoupling คร่อมราง 5V-GND แรงดันตกและริปเปิลลดลง | มี C ริปเปิลลดลง $>50\%$ | R3 |
| **T18** | ตัวเก็บประจุอิเล็กทรอไลต์ต่อกลับขั้ว ($V_{term} < -1.0\text{ V}$) | กระแสรั่วและความเสียหาย | มีคำเตือน Reverse Polarity, กระแสรั่วพุ่งขึ้นตามสมการ, สะสมความเสียหายจนชำรุด | เกิด Fault ถูกต้อง | R3 (B4) |
| **T19** | สับสวิตช์ต่อตัวเก็บประจุเปล่า ($V=0$) เข้ากับแหล่งจ่าย 5V ทันที | กระแสกระชาก (Inrush) | กระแสถูกจำกัดด้วย $ESR + R_{out}$ ไม่เกิด NaN/Inf และไม่มี Numerical Ringing | คำนวณได้ราบเรียบ | R2, R3 |
| **T20** | ขา A0 ต่อกับแหล่งสัญญาณความต้านทานสูง $100\text{ k}\Omega$ โดย (a) ไม่มี C, (b) มี C $100\text{ nF}$ | ค่าอ่าน ADC | เมื่อมี C $100\text{ nF}$ ที่ขา A0 ค่าอ่าน ADC มีความแม่นยำขึ้นเนื่องจาก Charge Sharing Buffer | ตรงตามสมการ $\pm 2$ LSB | R4 |

---

## 9. ข้อกำหนดการดำเนินงานและการเปลี่ยนผ่านสู่ Phase 1
ตามข้อกำหนดของ Phase 0 เมื่อเอกสารฉบับนี้ถูกนำเสนอแล้ว:
1. **หยุดการทำงานเพื่อขออนุมัติจากผู้ใช้ (Stop and Wait for User Approval)**
2. ห้ามลงมือแก้ไขโค้ดการจำลองหรือแกน Solver ใดๆ ก่อนได้รับการยืนยัน
3. เมื่อได้รับอนุมัติ ผู้รับผิดชอบใน Phase 1–6 จะต้องปฏิบัติตามสมการ ค่าคงที่ และชื่อตัวแปรที่ระบุไว้ในเอกสารฉบับนี้อย่างเคร่งครัด
