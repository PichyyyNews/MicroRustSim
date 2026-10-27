use std::collections::{HashMap, HashSet};
use serde::{Deserialize, Serialize};

use crate::components::*;
use crate::{LogicState, McuCore, PinId, Wire};

/// Physical fault category detected by nodal circuit engine.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum FaultType {
    ShortCircuit,
    Overcurrent,
    ReversePolarity,
}

/// Structured fault record emitted during physical circuit solving.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct CircuitFault {
    pub fault_type: FaultType,
    pub component_id: String,
    pub pin_name: String,
    pub description: String,
    pub current_ma: f32,
    pub voltage: f32,
}

/// Normalizes pin aliases into a canonical node key and indicates whether it is GND.
pub fn normalize_pin_alias(comp_id: &str, pin_name: &str) -> (String, bool) {
    let p_lower = pin_name.to_lowercase();
    let c_lower = comp_id.to_lowercase();

    // 1. MCU (Arduino Uno R3)
    if c_lower.starts_with("uno") || c_lower.starts_with("mcu") || c_lower.starts_with("arduino") {
        if p_lower.starts_with("gnd") {
            return (format!("{}:GND", comp_id), true);
        }
        if p_lower == "5v" || p_lower == "vcc" || p_lower == "vin" || p_lower == "ioref" {
            return (format!("{}:5V", comp_id), false);
        }
        if p_lower == "3.3v" || p_lower == "3v3" {
            return (format!("{}:3.3V", comp_id), false);
        }
        if p_lower == "13" || p_lower == "led_builtin" {
            return (format!("{}:13", comp_id), false);
        }
        if let Ok(d) = p_lower.parse::<u8>() {
            if d <= 13 {
                return (format!("{}:{}", comp_id, d), false);
            }
        }
        if let Some(rest) = p_lower.strip_prefix('a') {
            if let Ok(a) = rest.parse::<u8>() {
                if a <= 5 {
                    return (format!("{}:A{}", comp_id, a), false);
                }
            }
        }
        return (format!("{}:{}", comp_id, pin_name), false);
    }

    // 2. Breadboard
    if c_lower.starts_with("bb") || c_lower.contains("breadboard") {
        if let Some(canonical) = parse_breadboard_pin(&p_lower) {
            return (format!("{}:{}", comp_id, canonical), false);
        }
        return (format!("{}:{}", comp_id, pin_name), false);
    }

    // 3. Potentiometer
    if c_lower.starts_with("pot") {
        if p_lower == "1" || p_lower == "gnd" {
            return (format!("{}:1", comp_id), false);
        }
        if p_lower == "2" || p_lower == "sig" || p_lower == "wiper" {
            return (format!("{}:2", comp_id), false);
        }
        if p_lower == "3" || p_lower == "vcc" || p_lower == "5v" {
            return (format!("{}:3", comp_id), false);
        }
        return (format!("{}:{}", comp_id, pin_name), false);
    }

    // 4. Pushbutton
    if c_lower.starts_with("btn") || c_lower.starts_with("sw") || c_lower.starts_with("button") {
        if p_lower == "1" || p_lower == "1a" || p_lower == "1b" || p_lower == "1.l" || p_lower == "1.r" || p_lower == "t1" {
            return (format!("{}:1", comp_id), false);
        }
        if p_lower == "2" || p_lower == "2a" || p_lower == "2b" || p_lower == "2.l" || p_lower == "2.r" || p_lower == "t2" {
            return (format!("{}:2", comp_id), false);
        }
        return (format!("{}:{}", comp_id, pin_name), false);
    }

    // 5. Resistor
    if c_lower.starts_with('r') || c_lower.starts_with("res") {
        if p_lower == "1" || p_lower == "p1" || p_lower == "a" {
            return (format!("{}:1", comp_id), false);
        }
        if p_lower == "2" || p_lower == "p2" || p_lower == "b" {
            return (format!("{}:2", comp_id), false);
        }
        return (format!("{}:{}", comp_id, pin_name), false);
    }

    // 6. LED
    if c_lower.starts_with("led") {
        if p_lower == "anode" || p_lower == "a" || p_lower == "1" {
            return (format!("{}:anode", comp_id), false);
        }
        if p_lower == "cathode" || p_lower == "c" || p_lower == "k" || p_lower == "2" {
            return (format!("{}:cathode", comp_id), false);
        }
        return (format!("{}:{}", comp_id, pin_name), false);
    }

    (format!("{}:{}", comp_id, pin_name), false)
}

fn parse_breadboard_pin(pin_lower: &str) -> Option<String> {
    if pin_lower.starts_with("top_plus") || pin_lower.starts_with("tp_") || (pin_lower.ends_with(".top") && pin_lower.starts_with('+')) {
        return Some("top_plus".to_string());
    }
    if pin_lower.starts_with("top_minus") || pin_lower.starts_with("tm_") || (pin_lower.ends_with(".top") && pin_lower.starts_with('-')) {
        return Some("top_minus".to_string());
    }
    if pin_lower.starts_with("bot_plus") || pin_lower.starts_with("bp_") || (pin_lower.ends_with(".bot") && pin_lower.starts_with('+')) {
        return Some("bot_plus".to_string());
    }
    if pin_lower.starts_with("bot_minus") || pin_lower.starts_with("bm_") || (pin_lower.ends_with(".bot") && pin_lower.starts_with('-')) {
        return Some("bot_minus".to_string());
    }

    if pin_lower.starts_with("col_") && (pin_lower.ends_with("_ae") || pin_lower.ends_with("_fj")) {
        return Some(pin_lower.to_string());
    }

    if let Some((row_str, col_str)) = pin_lower.split_once('_') {
        if let Ok(col) = col_str.parse::<u8>() {
            if (1..=30).contains(&col) {
                match row_str {
                    "a" | "b" | "c" | "d" | "e" => return Some(format!("col_{}_ae", col)),
                    "f" | "g" | "h" | "i" | "j" => return Some(format!("col_{}_fj", col)),
                    _ => {}
                }
            }
        }
    }

    if let Some((col_str, row_str)) = pin_lower.split_once('.') {
        if let Ok(col) = col_str.parse::<u8>() {
            if (1..=30).contains(&col) {
                match row_str {
                    "a" | "b" | "c" | "d" | "e" => return Some(format!("col_{}_ae", col)),
                    "f" | "g" | "h" | "i" | "j" => return Some(format!("col_{}_fj", col)),
                    _ => {}
                }
            }
        }
    }

    None
}

/// Gaussian elimination with partial pivoting solving A x = b.
pub fn solve_linear_system(n: usize, a: &mut [f64], b: &mut [f64], x: &mut [f64]) -> bool {
    if n == 0 {
        return true;
    }
    for i in 0..n {
        let mut max_val = a[i * n + i].abs();
        let mut pivot_row = i;
        for k in (i + 1)..n {
            let val = a[k * n + i].abs();
            if val > max_val {
                max_val = val;
                pivot_row = k;
            }
        }

        if max_val < 1e-14 {
            // Near-singular, add regularizing conductance
            a[i * n + i] += 1e-8;
        } else if pivot_row != i {
            for col in 0..n {
                a.swap(i * n + col, pivot_row * n + col);
            }
            b.swap(i, pivot_row);
        }

        let pivot = a[i * n + i];
        for k in (i + 1)..n {
            let factor = a[k * n + i] / pivot;
            a[k * n + i] = 0.0;
            for j in (i + 1)..n {
                a[k * n + j] -= factor * a[i * n + j];
            }
            b[k] -= factor * b[i];
        }
    }

    for i in (0..n).rev() {
        let mut sum = b[i];
        for j in (i + 1)..n {
            sum -= a[i * n + j] * x[j];
        }
        let diag = a[i * n + i];
        x[i] = if diag.abs() > 1e-14 { sum / diag } else { 0.0 };
    }
    true
}

#[inline]
fn stamp_conductance(g: &mut [f64], n: usize, u: Option<usize>, v: Option<usize>, cond: f64) {
    if let Some(u_idx) = u {
        g[u_idx * n + u_idx] += cond;
    }
    if let Some(v_idx) = v {
        g[v_idx * n + v_idx] += cond;
    }
    if let (Some(u_idx), Some(v_idx)) = (u, v) {
        g[u_idx * n + v_idx] -= cond;
        g[v_idx * n + u_idx] -= cond;
    }
}

#[inline]
fn stamp_norton_source(g: &mut [f64], j: &mut [f64], n: usize, u: Option<usize>, cond: f64, i_inj: f64) {
    if let Some(u_idx) = u {
        g[u_idx * n + u_idx] += cond;
        j[u_idx] += i_inj;
    }
}

#[inline]
fn stamp_current_source(j: &mut [f64], u: Option<usize>, v: Option<usize>, i_source: f64) {
    if let Some(u_idx) = u {
        j[u_idx] -= i_source;
    }
    if let Some(v_idx) = v {
        j[v_idx] += i_source;
    }
}

struct LedElement {
    id: String,
    anode: Option<usize>,
    cathode: Option<usize>,
    forward_voltage: f64,
}

/// Physical circuit solver using Modified Nodal Analysis (G v = j) with Newton-Raphson diode iteration.
pub struct MnaCircuitSolver;

impl MnaCircuitSolver {
    pub fn solve(
        mcu: &mut Box<dyn McuCore>,
        wires: &[Wire],
        leds: &mut HashMap<String, LedComponent>,
        resistors: &HashMap<String, ResistorComponent>,
        buttons: &HashMap<String, PushbuttonComponent>,
        pots: &HashMap<String, PotentiometerComponent>,
        pin_voltages: &mut HashMap<PinId, f32>,
        branch_currents: &mut HashMap<String, f32>,
        faults: &mut Vec<CircuitFault>,
    ) {
        let mcu_pins = [
            "0", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12", "13",
            "A0", "A1", "A2", "A3", "A4", "A5", "5V", "3.3V", "GND", "GND_1", "GND_2",
            "VIN", "IOREF", "AREF", "SDA", "SCL",
        ];

        // 1. Collect all canonical non-ground nodes in the circuit
        let mut node_set: HashSet<String> = HashSet::new();

        // Always include Uno power rails and active GPIO/analog pins
        for &pin in &mcu_pins {
            let (canon, is_gnd) = normalize_pin_alias("uno1", pin);
            if !is_gnd {
                node_set.insert(canon);
            }
        }

        // Potentiometers
        for (pot_id, _) in pots {
            node_set.insert(format!("{}:1", pot_id));
            node_set.insert(format!("{}:2", pot_id));
            node_set.insert(format!("{}:3", pot_id));
        }

        // Buttons
        for (btn_id, _) in buttons {
            node_set.insert(format!("{}:1", btn_id));
            node_set.insert(format!("{}:2", btn_id));
        }

        // Resistors
        for (res_id, _) in resistors {
            node_set.insert(format!("{}:1", res_id));
            node_set.insert(format!("{}:2", res_id));
        }

        // LEDs
        for (led_id, _) in leds.iter() {
            node_set.insert(format!("{}:anode", led_id));
            node_set.insert(format!("{}:cathode", led_id));
        }

        // Wires
        for wire in wires {
            let (from_canon, from_gnd) = normalize_pin_alias(&wire.from.component_id, &wire.from.pin_name);
            let (to_canon, to_gnd) = normalize_pin_alias(&wire.to.component_id, &wire.to.pin_name);
            if !from_gnd {
                node_set.insert(from_canon);
            }
            if !to_gnd {
                node_set.insert(to_canon);
            }
        }

        // Map non-ground nodes to matrix indices 0..N-1
        let mut node_indices: HashMap<String, usize> = HashMap::new();
        let mut sorted_nodes: Vec<String> = node_set.into_iter().collect();
        sorted_nodes.sort(); // Deterministic ordering
        for (idx, node) in sorted_nodes.iter().enumerate() {
            node_indices.insert(node.clone(), idx);
        }
        let n = node_indices.len();

        let get_node_idx = |comp_id: &str, pin_name: &str| -> Option<usize> {
            let (canon, is_gnd) = normalize_pin_alias(comp_id, pin_name);
            if is_gnd {
                None
            } else {
                node_indices.get(&canon).copied()
            }
        };

        // Check if external wires connect to pot terminals
        let mut pot_vcc_wired: HashSet<String> = HashSet::new();
        let mut pot_gnd_wired: HashSet<String> = HashSet::new();
        for wire in wires {
            for (cid, p) in &[(&wire.from.component_id, &wire.from.pin_name), (&wire.to.component_id, &wire.to.pin_name)] {
                let p_lower = p.to_lowercase();
                if cid.starts_with("pot") {
                    if p_lower == "3" || p_lower == "vcc" || p_lower == "5v" {
                        pot_vcc_wired.insert((*cid).clone());
                    }
                    if p_lower == "1" || p_lower == "gnd" {
                        pot_gnd_wired.insert((*cid).clone());
                    }
                }
            }
        }

        // Linear elements pre-computation:
        // Base conductance matrix and RHS current vector for linear components
        let mut g_base = vec![0.0f64; n * n];
        let mut j_base = vec![0.0f64; n];

        // 2. Stamp Uno power rails and MCU pins
        let pwr5v_idx = get_node_idx("uno1", "5V");
        stamp_norton_source(&mut g_base, &mut j_base, n, pwr5v_idx, 20.0, 100.0); // 5.0V with R_rail = 0.05 ohm

        let pwr33_idx = get_node_idx("uno1", "3.3V");
        stamp_norton_source(&mut g_base, &mut j_base, n, pwr33_idx, 10.0, 33.0); // 3.3V with R_rail = 0.1 ohm

        for &pin_name in &mcu_pins {
            if pin_name == "5V" || pin_name == "3.3V" || pin_name.starts_with("GND") || pin_name == "VIN" || pin_name == "IOREF" {
                continue;
            }
            let pin_idx = get_node_idx("uno1", pin_name);
            let state = mcu.get_pin_state(pin_name);
            match state {
                LogicState::High => {
                    // CMOS driver Ron = 25 ohm, Vth = 5.0V -> G = 0.04S, I_inj = 0.20A
                    stamp_norton_source(&mut g_base, &mut j_base, n, pin_idx, 0.04, 0.20);
                }
                LogicState::Low => {
                    // CMOS driver Ron = 25 ohm, Vth = 0.0V -> G = 0.04S, I_inj = 0.0A
                    stamp_norton_source(&mut g_base, &mut j_base, n, pin_idx, 0.04, 0.0);
                }
                LogicState::InputPullUp => {
                    // Internal pullup ~35k ohm to 5V -> G = 1/35000, I_inj = 5.0/35000
                    let g_pu = 1.0 / 35000.0;
                    let i_pu = 5.0 / 35000.0;
                    stamp_norton_source(&mut g_base, &mut j_base, n, pin_idx, g_pu, i_pu);
                }
                LogicState::Pwm { duty, .. } => {
                    let v_pwm = (duty as f64 / 255.0) * 5.0;
                    stamp_norton_source(&mut g_base, &mut j_base, n, pin_idx, 0.04, v_pwm * 0.04);
                }
                LogicState::Analog(_) | LogicState::Floating => {
                    // High-impedance input > 100M ohm
                    stamp_norton_source(&mut g_base, &mut j_base, n, pin_idx, 1e-8, 0.0);
                }
            }
        }

        // 3. Stamp Resistors (linear Ohm's law V = IR)
        for (res_id, res) in resistors {
            let p1 = get_node_idx(res_id, "1");
            let p2 = get_node_idx(res_id, "2");
            let r = (res.resistance_ohms as f64).max(0.001);
            let g = 1.0 / r;
            stamp_conductance(&mut g_base, n, p1, p2, g);
        }

        // 4. Stamp Potentiometers (continuous 3-terminal voltage dividers)
        for (pot_id, pot) in pots {
            let vcc = get_node_idx(pot_id, "3");
            let sig = get_node_idx(pot_id, "2");
            let gnd = if pot_gnd_wired.contains(pot_id) {
                get_node_idx(pot_id, "1")
            } else {
                None // Default GND reference
            };

            let alpha = (pot.value as f64).clamp(0.0, 1.0);
            if alpha <= 1e-6 {
                stamp_conductance(&mut g_base, n, sig, gnd, 1e6);
                stamp_conductance(&mut g_base, n, vcc, sig, 1.0 / 10000.0);
            } else if alpha >= 1.0 - 1e-6 {
                stamp_conductance(&mut g_base, n, vcc, sig, 1e6);
                stamp_conductance(&mut g_base, n, sig, gnd, 1.0 / 10000.0);
            } else {
                let r_top = (1.0 - alpha) * 10000.0;
                let r_bot = alpha * 10000.0;
                stamp_conductance(&mut g_base, n, vcc, sig, 1.0 / r_top);
                stamp_conductance(&mut g_base, n, sig, gnd, 1.0 / r_bot);
            }

            // If VCC is not explicitly wired, power track from internal 5V rail
            if !pot_vcc_wired.contains(pot_id) {
                stamp_norton_source(&mut g_base, &mut j_base, n, vcc, 20.0, 100.0);
            }
        }

        // 5. Stamp Pushbuttons (SPST switches)
        for (btn_id, btn) in buttons {
            let t1 = get_node_idx(btn_id, "1");
            let t2 = get_node_idx(btn_id, "2");
            let r = if btn.is_pressed { 0.05 } else { 1e10 };
            stamp_conductance(&mut g_base, n, t1, t2, 1.0 / r);
        }

        // 6. Stamp Wires (0.02 ohm jumper wire with contact resistance)
        for wire in wires {
            let u = get_node_idx(&wire.from.component_id, &wire.from.pin_name);
            let v = get_node_idx(&wire.to.component_id, &wire.to.pin_name);
            if u != v {
                stamp_conductance(&mut g_base, n, u, v, 1.0 / 0.02);
            }
        }

        // 7. Prepare LED Diode Companion Models
        let mut led_elements: Vec<LedElement> = Vec::new();
        for (led_id, led) in leds.iter() {
            let anode = get_node_idx(led_id, "anode");
            let cathode = get_node_idx(led_id, "cathode");
            led_elements.push(LedElement {
                id: led_id.clone(),
                anode,
                cathode,
                forward_voltage: led.forward_voltage() as f64,
            });
        }

        let mut led_vd = vec![0.0f64; led_elements.len()];
        let mut x = vec![0.0f64; n];

        // 8. Newton-Raphson Iteration for Diode Non-Linearities
        let max_iterations = 10;
        let r_bulk = 5.0;
        let g_bulk = 1.0 / r_bulk;
        let g_rev = 1e-8;
        let vt = 0.08;
        let i_knee = 0.0005;

        for _ in 0..max_iterations {
            let mut g_iter = g_base.clone();
            let mut j_iter = j_base.clone();

            for (idx, led) in led_elements.iter().enumerate() {
                let vd = led_vd[idx];
                let vf = led.forward_voltage;

                let (gd, i_eq) = if vd >= vf {
                    let gd = g_bulk;
                    let id = g_bulk * (vd - vf);
                    let i_eq = id - gd * vd; // -g_bulk * vf
                    (gd, i_eq)
                } else if vd > 0.0 {
                    let id = i_knee * ((vd - vf) / vt).exp();
                    let gd = (id / vt) + g_rev;
                    let i_eq = id - gd * vd;
                    (gd, i_eq)
                } else {
                    let gd = g_rev;
                    let id = g_rev * vd;
                    let i_eq = id - gd * vd;
                    (gd, i_eq)
                };

                stamp_conductance(&mut g_iter, n, led.anode, led.cathode, gd);
                stamp_current_source(&mut j_iter, led.anode, led.cathode, i_eq);
            }

            solve_linear_system(n, &mut g_iter, &mut j_iter, &mut x);

            if led_elements.is_empty() {
                break;
            }

            let mut max_delta = 0.0f64;
            for (idx, led) in led_elements.iter().enumerate() {
                let va = led.anode.map(|i| x[i]).unwrap_or(0.0);
                let vc = led.cathode.map(|i| x[i]).unwrap_or(0.0);
                let new_vd = va - vc;
                let delta = (new_vd - led_vd[idx]).abs();
                if delta > max_delta {
                    max_delta = delta;
                }
                led_vd[idx] = new_vd;
            }

            if max_delta < 1e-4 {
                break;
            }
        }

        // Helper to query node voltage
        let node_volt = |u: Option<usize>| -> f64 {
            u.map(|i| x[i]).unwrap_or(0.0)
        };

        let node_volt_clean = |u: Option<usize>| -> f32 {
            let v = node_volt(u);
            if (v - 5.0).abs() < 1e-4 {
                5.0
            } else if (v - 3.3).abs() < 1e-4 {
                3.3
            } else if v.abs() < 1e-4 {
                0.0
            } else {
                v as f32
            }
        };

        // 9. Update LED states and compute branch currents
        branch_currents.clear();

        for led in &led_elements {
            let va = node_volt(led.anode);
            let vc = node_volt(led.cathode);
            let vd = va - vc;
            let vf = led.forward_voltage;

            let id = if vd >= vf {
                g_bulk * (vd - vf)
            } else if vd > 0.0 {
                i_knee * ((vd - vf) / vt).exp()
            } else {
                0.0
            };

            if let Some(target_led) = leds.get_mut(&led.id) {
                if id > 0.00005 {
                    target_led.is_lit = true;
                    target_led.brightness = ((id / 0.015) as f32).clamp(0.02, 1.0);
                } else {
                    target_led.is_lit = false;
                    target_led.brightness = 0.0;
                }
            }
            branch_currents.insert(led.id.clone(), id as f32);
        }

        // Resistor branch currents
        for (res_id, res) in resistors {
            let v1 = node_volt(get_node_idx(res_id, "1"));
            let v2 = node_volt(get_node_idx(res_id, "2"));
            let r = (res.resistance_ohms as f64).max(0.001);
            let i = (v1 - v2).abs() / r;
            branch_currents.insert(res_id.clone(), i as f32);
        }

        // Potentiometer branch currents
        for (pot_id, pot) in pots {
            let v_vcc = node_volt(get_node_idx(pot_id, "3"));
            let v_sig = node_volt(get_node_idx(pot_id, "2"));
            let v_gnd = if pot_gnd_wired.contains(pot_id) {
                node_volt(get_node_idx(pot_id, "1"))
            } else {
                0.0
            };
            let alpha = (pot.value as f64).clamp(0.0, 1.0);
            let r_top = ((1.0 - alpha) * 10000.0 + 0.05).max(0.05);
            let r_bot = (alpha * 10000.0 + 0.05).max(0.05);
            let i_top = (v_vcc - v_sig).abs() / r_top;
            let i_bot = (v_sig - v_gnd).abs() / r_bot;
            branch_currents.insert(format!("{}:top", pot_id), i_top as f32);
            branch_currents.insert(format!("{}:bot", pot_id), i_bot as f32);
            branch_currents.insert(pot_id.clone(), i_top.max(i_bot) as f32);
        }

        // Pushbutton branch currents
        for (btn_id, btn) in buttons {
            let v1 = node_volt(get_node_idx(btn_id, "1"));
            let v2 = node_volt(get_node_idx(btn_id, "2"));
            let i = if btn.is_pressed { (v1 - v2).abs() / 0.05 } else { 0.0 };
            branch_currents.insert(btn_id.clone(), i as f32);
        }

        // MCU Power rail currents
        let v5v = node_volt(pwr5v_idx);
        let i5v = (5.0 - v5v) / 0.05;
        branch_currents.insert("uno1:5V".to_string(), i5v as f32);

        let v33 = node_volt(pwr33_idx);
        let i33 = (3.3 - v33) / 0.1;
        branch_currents.insert("uno1:3.3V".to_string(), i33 as f32);

        // MCU GPIO currents
        for &pin_name in &mcu_pins {
            if pin_name == "5V" || pin_name == "3.3V" || pin_name.starts_with("GND") || pin_name == "VIN" || pin_name == "IOREF" {
                continue;
            }
            let pin_idx = get_node_idx("uno1", pin_name);
            let vp = node_volt(pin_idx);
            let state = mcu.get_pin_state(pin_name);
            let ip = match state {
                LogicState::High => (5.0 - vp) / 25.0,
                LogicState::Low => (vp - 0.0) / 25.0,
                _ => 0.0,
            };
            branch_currents.insert(format!("uno1:{}", pin_name), ip as f32);
        }

        // 10. Populate pin_voltages map for all pins and aliases
        pin_voltages.clear();

        // Dedicated Ground Nodes
        for gnd_alias in &["GND", "GND_1", "GND_2", "GND.1", "GND.2", "GND.3", "GND.4"] {
            pin_voltages.insert(PinId::new("uno1", *gnd_alias), 0.0);
        }

        // MCU Pins
        for &pin_name in &mcu_pins {
            if pin_name.starts_with("GND") {
                continue;
            }
            let idx = get_node_idx("uno1", pin_name);
            let volt = node_volt_clean(idx);
            pin_voltages.insert(PinId::new("uno1", pin_name), volt);
            if pin_name == "13" {
                pin_voltages.insert(PinId::new("uno1", "LED_BUILTIN"), volt);
            }
        }

        // Resistors
        for res_id in resistors.keys() {
            let v1 = node_volt_clean(get_node_idx(res_id, "1"));
            let v2 = node_volt_clean(get_node_idx(res_id, "2"));
            for p in &["1", "p1", "a"] {
                pin_voltages.insert(PinId::new(res_id, *p), v1);
            }
            for p in &["2", "p2", "b"] {
                pin_voltages.insert(PinId::new(res_id, *p), v2);
            }
        }

        // Pushbuttons
        for btn_id in buttons.keys() {
            let v1 = node_volt_clean(get_node_idx(btn_id, "1"));
            let v2 = node_volt_clean(get_node_idx(btn_id, "2"));
            for p in &["1", "1a", "1b", "1.l", "1.r", "t1"] {
                pin_voltages.insert(PinId::new(btn_id, *p), v1);
            }
            for p in &["2", "2a", "2b", "2.l", "2.r", "t2"] {
                pin_voltages.insert(PinId::new(btn_id, *p), v2);
            }
        }

        // Potentiometers
        for (pot_id, _) in pots {
            let v_gnd = if pot_gnd_wired.contains(pot_id) {
                node_volt_clean(get_node_idx(pot_id, "1"))
            } else {
                0.0
            };
            let v_sig = node_volt_clean(get_node_idx(pot_id, "2"));
            let v_vcc = node_volt_clean(get_node_idx(pot_id, "3"));

            for p in &["1", "gnd"] {
                pin_voltages.insert(PinId::new(pot_id, *p), v_gnd);
            }
            for p in &["2", "sig", "wiper", "SIG", "WIPER"] {
                pin_voltages.insert(PinId::new(pot_id, *p), v_sig);
            }
            for p in &["3", "vcc", "5v", "VCC", "5V"] {
                pin_voltages.insert(PinId::new(pot_id, *p), v_vcc);
            }
        }

        // LEDs
        for led_id in leds.keys() {
            let va = node_volt_clean(get_node_idx(led_id, "anode"));
            let vc = node_volt_clean(get_node_idx(led_id, "cathode"));
            for p in &["anode", "a", "1"] {
                pin_voltages.insert(PinId::new(led_id, *p), va);
            }
            for p in &["cathode", "c", "k", "2"] {
                pin_voltages.insert(PinId::new(led_id, *p), vc);
            }
        }

        // Breadboards
        let mut bb_ids: HashSet<String> = HashSet::new();
        for w in wires {
            if w.from.component_id.starts_with("bb") || w.from.component_id.contains("breadboard") {
                bb_ids.insert(w.from.component_id.clone());
            }
            if w.to.component_id.starts_with("bb") || w.to.component_id.contains("breadboard") {
                bb_ids.insert(w.to.component_id.clone());
            }
        }

        for bb_id in bb_ids {
            let v_top_plus = node_volt_clean(get_node_idx(&bb_id, "top_plus"));
            let v_top_minus = node_volt_clean(get_node_idx(&bb_id, "top_minus"));
            let v_bot_plus = node_volt_clean(get_node_idx(&bb_id, "bot_plus"));
            let v_bot_minus = node_volt_clean(get_node_idx(&bb_id, "bot_minus"));

            pin_voltages.insert(PinId::new(&bb_id, "top_plus"), v_top_plus);
            pin_voltages.insert(PinId::new(&bb_id, "top_minus"), v_top_minus);
            pin_voltages.insert(PinId::new(&bb_id, "bot_plus"), v_bot_plus);
            pin_voltages.insert(PinId::new(&bb_id, "bot_minus"), v_bot_minus);

            for col in 1..=30 {
                pin_voltages.insert(PinId::new(&bb_id, format!("top_plus_{}", col)), v_top_plus);
                pin_voltages.insert(PinId::new(&bb_id, format!("tp_{}", col)), v_top_plus);
                pin_voltages.insert(PinId::new(&bb_id, format!("+{}.top", col)), v_top_plus);

                pin_voltages.insert(PinId::new(&bb_id, format!("top_minus_{}", col)), v_top_minus);
                pin_voltages.insert(PinId::new(&bb_id, format!("tm_{}", col)), v_top_minus);
                pin_voltages.insert(PinId::new(&bb_id, format!("-{}.top", col)), v_top_minus);

                pin_voltages.insert(PinId::new(&bb_id, format!("bot_plus_{}", col)), v_bot_plus);
                pin_voltages.insert(PinId::new(&bb_id, format!("bp_{}", col)), v_bot_plus);
                pin_voltages.insert(PinId::new(&bb_id, format!("+{}.bot", col)), v_bot_plus);

                pin_voltages.insert(PinId::new(&bb_id, format!("bot_minus_{}", col)), v_bot_minus);
                pin_voltages.insert(PinId::new(&bb_id, format!("bm_{}", col)), v_bot_minus);
                pin_voltages.insert(PinId::new(&bb_id, format!("-{}.bot", col)), v_bot_minus);

                let v_ae = node_volt_clean(get_node_idx(&bb_id, &format!("col_{}_ae", col)));
                pin_voltages.insert(PinId::new(&bb_id, format!("col_{}_ae", col)), v_ae);
                for r in &["a", "b", "c", "d", "e"] {
                    pin_voltages.insert(PinId::new(&bb_id, format!("{}_{}", r, col)), v_ae);
                    pin_voltages.insert(PinId::new(&bb_id, format!("{}.{}", col, r)), v_ae);
                }

                let v_fj = node_volt_clean(get_node_idx(&bb_id, &format!("col_{}_fj", col)));
                pin_voltages.insert(PinId::new(&bb_id, format!("col_{}_fj", col)), v_fj);
                for r in &["f", "g", "h", "i", "j"] {
                    pin_voltages.insert(PinId::new(&bb_id, format!("{}_{}", r, col)), v_fj);
                    pin_voltages.insert(PinId::new(&bb_id, format!("{}.{}", col, r)), v_fj);
                }
            }
        }

        // Wire endpoints
        for wire in wires {
            let u_volt = node_volt_clean(get_node_idx(&wire.from.component_id, &wire.from.pin_name));
            let v_volt = node_volt_clean(get_node_idx(&wire.to.component_id, &wire.to.pin_name));
            pin_voltages.insert(wire.from.clone(), u_volt);
            pin_voltages.insert(wire.to.clone(), v_volt);
        }

        // 11. Feed voltages back to MCU inputs and ADC channels
        for &pin_name in &mcu_pins {
            let pid = PinId::new("uno1", pin_name);
            let state = mcu.get_pin_state(pin_name);
            if let Some(&volt) = pin_voltages.get(&pid) {
                if state == LogicState::InputPullUp {
                    // Pullup active: if pulled below 1.5V, it registers LOW
                    mcu.set_pin_input(pin_name, volt >= 1.5);
                } else if state == LogicState::Floating {
                    mcu.set_pin_input(pin_name, volt >= 2.5);
                }

                // Update ADC channel if this is an analog pin
                if let Some(rest) = pin_name.strip_prefix('A') {
                    if let Ok(ch) = rest.parse::<u8>() {
                        mcu.set_adc_voltage(ch, volt);
                    }
                }
            }
        }

        // 12. Evaluate Physical Fault Conditions
        faults.clear();

        // 5V rail short-circuit (>500mA)
        if i5v > 0.500 {
            faults.push(CircuitFault {
                fault_type: FaultType::ShortCircuit,
                component_id: "uno1".to_string(),
                pin_name: "5V".to_string(),
                description: format!("Short Circuit: 5V rail drawing {:.2}A (max 500mA)", i5v),
                current_ma: (i5v * 1000.0) as f32,
                voltage: v5v as f32,
            });
        }

        // 3.3V rail short-circuit (>150mA)
        if i33 > 0.150 {
            faults.push(CircuitFault {
                fault_type: FaultType::ShortCircuit,
                component_id: "uno1".to_string(),
                pin_name: "3.3V".to_string(),
                description: format!("Short Circuit: 3.3V rail drawing {:.2}A (max 150mA)", i33),
                current_ma: (i33 * 1000.0) as f32,
                voltage: v33 as f32,
            });
        }

        // GPIO Overcurrent (>40mA absolute maximum)
        for &pin_name in &mcu_pins {
            if let Some(&i_pin) = branch_currents.get(&format!("uno1:{}", pin_name)) {
                if i_pin > 0.040 {
                    let v = pin_voltages.get(&PinId::new("uno1", pin_name)).copied().unwrap_or(0.0);
                    faults.push(CircuitFault {
                        fault_type: FaultType::Overcurrent,
                        component_id: "uno1".to_string(),
                        pin_name: pin_name.to_string(),
                        description: format!("Overcurrent: Pin {} drawing {:.1}mA (Absolute Maximum: 40mA)", pin_name, i_pin * 1000.0),
                        current_ma: i_pin * 1000.0,
                        voltage: v,
                    });
                }
            }
        }

        // LED Overcurrent (>40mA) & Reverse Polarity (Vc - Va > 0.5V)
        for led in &led_elements {
            let va = node_volt(led.anode) as f32;
            let vc = node_volt(led.cathode) as f32;
            if let Some(&i_led) = branch_currents.get(&led.id) {
                if i_led > 0.040 {
                    faults.push(CircuitFault {
                        fault_type: FaultType::Overcurrent,
                        component_id: led.id.clone(),
                        pin_name: "anode".to_string(),
                        description: format!("Overcurrent: LED drawing {:.1}mA without current-limiting resistor", i_led * 1000.0),
                        current_ma: i_led * 1000.0,
                        voltage: va - vc,
                    });
                }
            }
            if vc - va > 0.5 {
                faults.push(CircuitFault {
                    fault_type: FaultType::ReversePolarity,
                    component_id: led.id.clone(),
                    pin_name: "anode".to_string(),
                    description: format!("Reverse Polarity: Cathode ({:.2}V) > Anode ({:.2}V)", vc, va),
                    current_ma: 0.0,
                    voltage: vc - va,
                });
            }
        }
    }
}
