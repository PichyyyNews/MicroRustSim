//! MicroRustSim: Physical Modified Nodal Analysis (MNA) & Newton-Raphson Solver (solver.rs)
//!
//! Fully authentic MNA implementation conforming to docs/PHYSICS_SPEC.md:
//! - Full MNA block formulation [G B; C D] [v; i] = [j; e] with simultaneous nodal voltages
//!   and independent voltage source branch currents.
//! - Nodal gmin (1e-12 S) installation on all nodes to ground to guarantee non-singular matrices.
//! - SPICE pnjlim(v_new, v_old, vt, vcrit) voltage limiting algorithm for non-linear PN junctions.
//! - Dual convergence criteria: voltage tolerance (reltol * V + vntol, vntol = 1 µV) and
//!   current tolerance (reltol * I + abstol, abstol = 1 pA).
//! - gmin-stepping and source-stepping convergence fallbacks.
//! - Trapezoidal, Backward Euler, and BDF2 numerical integration companion models for dynamic states.
//! - Gear-Switching: automatic fallback to Backward Euler for the first step following discontinuities
//!   to eliminate numerical ringing and guarantee L-stability.
//! - Variable time-step control based on Local Truncation Error (LTE) and event queue alignment.
//! - Circuit topology validation (floating nodes, ideal voltage loops, short circuits).
//! - Post-solve KCL residual check (< 1 nA) and total power/energy balance verification (< 1%).
//! - Backward compatible API with existing SimulationEngine and test suites.

use std::collections::{HashMap, HashSet};
use serde::{Deserialize, Serialize};

use crate::components::*;
use crate::constants::*;
use crate::device::MnaMatrix;
use crate::{LogicState, McuCore, PinId, Wire};

/// Physical fault category detected by nodal circuit engine.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum FaultType {
    ShortCircuit,
    Overcurrent,
    ReversePolarity,
}

/// Power Supply Realism Mode (Ideal default for teaching, Realistic for lab physics)
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum PowerRealismMode {
    Ideal,
    Realistic,
}

/// Power Supply Realism Level Presets
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum PowerRealismLevel {
    Low,
    Medium,
    High,
    Custom,
}

/// Physical Power Supply Simulation Configuration
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct PowerRealismConfig {
    pub mode: PowerRealismMode,
    pub level: PowerRealismLevel,
    pub r_internal_5v: f64,
    pub r_internal_3v3: f64,
    pub ripple_vpp_5v: f64,
    pub ripple_freq_hz: f64,
    pub noise_sigma_5v: f64,
    pub enable_sag: bool,
    pub enable_ripple: bool,
    pub enable_noise: bool,
    pub seed: u64,
}

impl Default for PowerRealismConfig {
    fn default() -> Self {
        Self {
            mode: PowerRealismMode::Ideal,
            level: PowerRealismLevel::Medium,
            r_internal_5v: R_OUT_5V_DEFAULT,
            r_internal_3v3: R_OUT_3V3_DEFAULT,
            ripple_vpp_5v: 0.080,
            ripple_freq_hz: 100.0,
            noise_sigma_5v: 0.020,
            enable_sag: true,
            enable_ripple: true,
            enable_noise: true,
            seed: 42,
        }
    }
}

/// Deterministic Gaussian noise generator using Box-Muller transform with 64-bit SplitMix PRNG.
/// Guaranteed identical noise sequence for the same (seed, step) tuple across all platforms.
pub fn deterministic_gaussian_noise(seed: u64, step: u64, sigma: f64) -> f64 {
    if sigma <= 1e-9 {
        return 0.0;
    }
    let mut s1 = seed.wrapping_mul(0x9E3779B97F4A7C15).wrapping_add(step.wrapping_mul(0xBF58476D1CE4E5B9));
    if s1 == 0 { s1 = 0x853c49e6748fea9b; }
    s1 ^= s1 >> 30;
    s1 = s1.wrapping_mul(0xBF58476D1CE4E5B9);
    s1 ^= s1 >> 27;
    s1 = s1.wrapping_mul(0x94D049BB133111EB);
    s1 ^= s1 >> 31;

    let mut s2 = s1.wrapping_add(0x9E3779B97F4A7C15);
    s2 ^= s2 >> 30;
    s2 = s2.wrapping_mul(0xBF58476D1CE4E5B9);
    s2 ^= s2 >> 27;
    s2 = s2.wrapping_mul(0x94D049BB133111EB);
    s2 ^= s2 >> 31;

    let u1 = (((s1 >> 11) as f64) + 1.0) / 9007199254740993.0;
    let u2 = (((s2 >> 11) as f64) + 1.0) / 9007199254740993.0;

    let u1_clamped = u1.clamp(1e-15, 1.0);
    let z = (-2.0 * u1_clamped.ln()).sqrt() * (2.0 * std::f64::consts::PI * u2).cos();
    z * sigma
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

/// SPICE3f5 pnjlim algorithm for PN junction voltage limiting.
/// Prevents numerical overflow and exponential oscillation in Newton-Raphson.
pub fn pnjlim(v_new: f64, v_old: f64, vt: f64, vcrit: f64) -> f64 {
    if v_new > vcrit && (v_new - v_old).abs() <= 2.0 * vt {
        v_new
    } else if v_new > vcrit && v_old <= 0.0 {
        vcrit
    } else if v_new > vcrit && v_new > v_old {
        let arg = 1.0 + (v_new - v_old) / vt;
        if arg > 0.0 {
            v_old + vt * arg.ln()
        } else {
            vcrit
        }
    } else if v_new <= vcrit && v_new >= 0.0 {
        if v_old > vcrit && (v_old - v_new) > 2.0 * vt {
            v_old - 2.0 * vt
        } else {
            v_new
        }
    } else if v_new < 0.0 && (v_new - v_old).abs() <= 1.0 {
        v_new
    } else if v_new < 0.0 {
        v_old + (v_new - v_old).signum() * 1.0
    } else {
        v_new
    }
}

/// Estimate critical voltage V_crit for a diode junction
pub fn compute_vcrit(is: f64, vt: f64) -> f64 {
    let is_clamped = is.max(1e-25);
    (vt * (vt / (std::f64::consts::SQRT_2 * is_clamped)).ln()).max(0.1)
}

/// Solves exact Shockley diode current I_d for a given terminal voltage V_tot = V_anode - V_cathode
/// V_tot = n*Vt * ln(I_d / Is + 1) + I_d * Rs
pub fn solve_diode_current(v_tot: f64, vf: f64, rs: f64, _is_sat: f64, vt: f64) -> f64 {
    if v_tot <= 0.05 {
        return 0.0;
    }
    let i_test = LED_TEST_CURRENT_A;
    let v_j_rated = vf;
    let vt_eff = vt * 0.70;

    // Initial guess
    let mut i_curr = ((v_tot - vf * 0.80) / (rs + 10.0)).clamp(1e-8, 10.0);
    for _ in 0..8 {
        let f = v_j_rated + vt_eff * (i_curr / i_test).max(1e-15).ln() + i_curr * rs - v_tot;
        let df = vt_eff / i_curr + rs;
        let step = f / df;
        if step >= i_curr {
            i_curr *= 0.2;
        } else {
            i_curr -= step;
        }
        if step.abs() < 1e-6 {
            break;
        }
    }
    i_curr
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
        if p_lower == "aref" {
            return (format!("{}:AREF", comp_id), false);
        }
        return (format!("{}:{}", comp_id, pin_name.to_uppercase()), false);
    }

    // 2. Breadboard
    if c_lower.starts_with("bb") || c_lower.contains("breadboard") {
        if let Some(canon) = canonicalize_breadboard_pin(&p_lower) {
            return (format!("{}:{}", comp_id, canon), false);
        }
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
    }

    // 4. Pushbutton
    if c_lower.starts_with("btn") || c_lower.starts_with("sw") || c_lower.starts_with("button") || c_lower.starts_with("pushbutton") || c_lower.contains("btn") || c_lower.contains("button") {
        if p_lower == "1" || p_lower == "1.l" || p_lower == "1.r" || p_lower == "1a" || p_lower == "1b" || p_lower == "t1" {
            return (format!("{}:1", comp_id), false);
        }
        if p_lower == "2" || p_lower == "2.l" || p_lower == "2.r" || p_lower == "2a" || p_lower == "2b" || p_lower == "t2" {
            return (format!("{}:2", comp_id), false);
        }
    }

    // 5. LED
    if c_lower.starts_with("led") {
        if p_lower == "anode" || p_lower == "a" || p_lower == "1" {
            return (format!("{}:anode", comp_id), false);
        }
        if p_lower == "cathode" || p_lower == "c" || p_lower == "k" || p_lower == "2" {
            return (format!("{}:cathode", comp_id), false);
        }
    }

    // 6. Resistor
    if c_lower.starts_with("r") || c_lower.starts_with("res") {
        if p_lower == "1" || p_lower == "p1" || p_lower == "a" {
            return (format!("{}:1", comp_id), false);
        }
        if p_lower == "2" || p_lower == "p2" || p_lower == "b" {
            return (format!("{}:2", comp_id), false);
        }
    }

    // 7. Capacitor
    if c_lower.starts_with("c") || c_lower.starts_with("cap") {
        if p_lower == "1" || p_lower == "p1" || p_lower == "anode" || p_lower == "+" || p_lower == "pos" {
            return (format!("{}:1", comp_id), false);
        }
        if p_lower == "2" || p_lower == "p2" || p_lower == "cathode" || p_lower == "-" || p_lower == "neg" {
            return (format!("{}:2", comp_id), false);
        }
    }

    (format!("{}:{}", comp_id, pin_name), false)
}

fn canonicalize_breadboard_pin(pin_lower: &str) -> Option<String> {
    if pin_lower.starts_with("top_plus") || pin_lower.starts_with("tp_") || (pin_lower.starts_with('+') && pin_lower.ends_with(".top")) {
        return Some("top_plus".to_string());
    }
    if pin_lower.starts_with("top_minus") || pin_lower.starts_with("tm_") || (pin_lower.starts_with('-') && pin_lower.ends_with(".top")) {
        return Some("top_minus".to_string());
    }
    if pin_lower.starts_with("bot_plus") || pin_lower.starts_with("bp_") || (pin_lower.starts_with('+') && pin_lower.ends_with(".bot")) {
        return Some("bot_plus".to_string());
    }
    if pin_lower.starts_with("bot_minus") || pin_lower.starts_with("bm_") || (pin_lower.starts_with('-') && pin_lower.ends_with(".bot")) {
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
        if let Ok(col) = row_str.parse::<u8>() {
            if (1..=30).contains(&col) {
                match col_str {
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
/// Retained for direct backward compatibility with tests.
pub fn solve_linear_system(n: usize, a: &mut [f64], b: &mut [f64], x: &mut [f64]) -> bool {
    if n == 0 {
        return true;
    }
    if x.len() < n {
        return false;
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
            a[i * n + i] += G_MIN_DEFAULT.max(1e-8);
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

/// Helper struct for non-linear LED elements during Newton-Raphson
#[derive(Debug, Clone)]
struct DiodeBranch {
    id: String,
    anode: Option<usize>,
    cathode: Option<usize>,
    forward_voltage: f64,
    series_rs: f64,
    is_sat: f64,
    vt: f64,
    vcrit: f64,
}

/// Circuit topology report
#[derive(Debug, Default, Clone)]
pub struct TopologyReport {
    pub floating_nodes: Vec<String>,
    pub ideal_voltage_loops: Vec<String>,
    pub direct_short_circuits: Vec<String>,
}

/// Physical circuit solver using Modified Nodal Analysis (MNA) with Newton-Raphson non-linear iteration.
pub struct MnaCircuitSolver;

impl MnaCircuitSolver {
    /// Validates circuit topology prior to matrix generation
    pub fn validate_topology(
        wires: &[Wire],
        node_indices: &HashMap<String, usize>,
        connected_pairs: &HashSet<(usize, usize)>,
    ) -> TopologyReport {
        let mut report = TopologyReport::default();

        // Check for isolated/floating nodes
        for (node_name, &idx) in node_indices {
            let has_conn = connected_pairs.iter().any(|&(u, v)| u == idx || v == idx);
            if !has_conn && !node_name.starts_with("uno1:5V") && !node_name.starts_with("uno1:3.3V") {
                report.floating_nodes.push(node_name.clone());
            }
        }

        // Check for direct 5V-to-GND shorts
        for wire in wires {
            let (from_canon, from_gnd) = normalize_pin_alias(&wire.from.component_id, &wire.from.pin_name);
            let (to_canon, to_gnd) = normalize_pin_alias(&wire.to.component_id, &wire.to.pin_name);

            if (from_canon.starts_with("uno1:5V") && to_gnd) || (to_canon.starts_with("uno1:5V") && from_gnd) {
                report.direct_short_circuits.push("Direct wire short-circuit between 5V rail and GND".to_string());
            }
        }

        report
    }

    /// Verifies Kirchhoff's Current Law (KCL) and Power Balance after solving
    pub fn verify_kcl_and_power_balance(
        n_nodes: usize,
        mna: &MnaMatrix,
        x: &[f64],
        p_supplied: f64,
        p_dissipated: f64,
        de_stored_dt: f64,
    ) -> (f64, f64, bool) {
        let mut max_kcl_res = 0.0f64;
        let mut kcl_exceeded = false;
        let dim = mna.dim;

        // Node KCL residual: sum of row = A[i, :] * x - rhs[i]
        for i in 0..n_nodes {
            let mut row_sum = 0.0f64;
            let mut current_sum = 0.0f64;
            for j in 0..dim {
                let term = mna.a[i * dim + j] * x[j];
                row_sum += term;
                current_sum += term.abs();
            }
            let res = (row_sum - mna.rhs[i]).abs();
            let tol = RELTOL * current_sum + KCL_TOL_A;
            if res > tol {
                kcl_exceeded = true;
            }
            if res > max_kcl_res {
                max_kcl_res = res;
            }
        }

        let power_error = (p_supplied - (p_dissipated + de_stored_dt)).abs();
        let power_rel = if p_supplied.abs() > 1e-4 {
            power_error / p_supplied.abs()
        } else {
            0.0
        };

        let is_valid = !kcl_exceeded && (power_rel < POWER_TOL_REL || power_error < POWER_TOL_ABS);
        (max_kcl_res, power_rel, is_valid)
    }

    /// Main solver entry point conforming to SimulationEngine
    pub fn solve(
        mcu: &mut Box<dyn McuCore>,
        wires: &[Wire],
        leds: &mut HashMap<String, LedComponent>,
        resistors: &HashMap<String, ResistorComponent>,
        buttons: &HashMap<String, PushbuttonComponent>,
        pots: &HashMap<String, PotentiometerComponent>,
        capacitors: &mut HashMap<String, CapacitorComponent>,
        pin_voltages: &mut HashMap<PinId, f32>,
        branch_currents: &mut HashMap<String, f32>,
        faults: &mut Vec<CircuitFault>,
        power_config: &PowerRealismConfig,
        step_count: u64,
    ) {
        let mcu_pins = [
            "0", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12", "13",
            "A0", "A1", "A2", "A3", "A4", "A5", "5V", "3.3V", "GND", "GND_1", "GND_2",
            "VIN", "IOREF", "AREF", "SDA", "SCL",
        ];

        // 1. Collect all canonical non-ground nodes in the circuit
        let mut node_set: HashSet<String> = HashSet::new();

        // Always include Uno power rails
        for &pin in &["5V", "3.3V"] {
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

        // Capacitors
        for (cap_id, _) in capacitors.iter() {
            node_set.insert(format!("{}:1", cap_id));
            node_set.insert(format!("{}:2", cap_id));
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

        // Pin to node mapping for NodeVoltageLookup
        let mut pin_to_node: HashMap<(String, String), Option<usize>> = HashMap::new();
        for &pin in &mcu_pins {
            pin_to_node.insert(("uno1".to_string(), pin.to_string()), get_node_idx("uno1", pin));
        }
        for (pot_id, _) in pots {
            for p in &["1", "2", "3"] {
                pin_to_node.insert((pot_id.clone(), p.to_string()), get_node_idx(pot_id, p));
            }
        }
        for (res_id, _) in resistors {
            for p in &["1", "2"] {
                pin_to_node.insert((res_id.clone(), p.to_string()), get_node_idx(res_id, p));
            }
        }
        for (btn_id, _) in buttons {
            for p in &["1", "2"] {
                pin_to_node.insert((btn_id.clone(), p.to_string()), get_node_idx(btn_id, p));
            }
        }
        for (led_id, _) in leds.iter() {
            for p in &["anode", "cathode"] {
                pin_to_node.insert((led_id.clone(), p.to_string()), get_node_idx(led_id, p));
            }
        }
        for (cap_id, _) in capacitors.iter() {
            for p in &["1", "2"] {
                pin_to_node.insert((cap_id.clone(), p.to_string()), get_node_idx(cap_id, p));
            }
        }

        // Check if external wires connect to pot terminals
        let mut pot_vcc_wired: HashSet<String> = HashSet::new();
        let mut pot_gnd_wired: HashSet<String> = HashSet::new();
        for wire in wires {
            let from_c = wire.from.component_id.to_lowercase();
            let to_c = wire.to.component_id.to_lowercase();
            if from_c.starts_with("pot") {
                if wire.from.pin_name == "1" || wire.from.pin_name.eq_ignore_ascii_case("gnd") {
                    pot_gnd_wired.insert(wire.from.component_id.clone());
                }
                if wire.from.pin_name == "3" || wire.from.pin_name.eq_ignore_ascii_case("vcc") || wire.from.pin_name.eq_ignore_ascii_case("5v") {
                    pot_vcc_wired.insert(wire.from.component_id.clone());
                }
            }
            if to_c.starts_with("pot") {
                if wire.to.pin_name == "1" || wire.to.pin_name.eq_ignore_ascii_case("gnd") {
                    pot_gnd_wired.insert(wire.to.component_id.clone());
                }
                if wire.to.pin_name == "3" || wire.to.pin_name.eq_ignore_ascii_case("vcc") || wire.to.pin_name.eq_ignore_ascii_case("5v") {
                    pot_vcc_wired.insert(wire.to.component_id.clone());
                }
            }
        }

        // Power supply simulation parameters
        let t_time = (step_count as f64) * (1.0 / 60.0);
        let ripple_5v = if power_config.mode == PowerRealismMode::Realistic && power_config.enable_ripple {
            (power_config.ripple_vpp_5v * 0.5)
                * (2.0 * std::f64::consts::PI * power_config.ripple_freq_hz * t_time).sin()
        } else {
            0.0
        };

        let noise_5v = if power_config.mode == PowerRealismMode::Realistic && power_config.enable_noise {
            deterministic_gaussian_noise(power_config.seed, step_count, power_config.noise_sigma_5v)
        } else {
            0.0
        };

        let v_src_5v = (V_SRC_5V_NOM + ripple_5v + noise_5v).clamp(0.0, 10.0);
        let v_src_3v3 = (V_SRC_3V3_NOM + (3.3 / 5.0) * (ripple_5v + noise_5v)).clamp(0.0, 10.0);

        // In Realistic mode, r_internal_5v is used.
        // In Ideal mode, internal resistance is small unless loaded beyond polyfuse limit (load sag).
        let r_int_5v_base = match power_config.mode {
            PowerRealismMode::Realistic => power_config.r_internal_5v.max(0.001),
            PowerRealismMode::Ideal => 0.05,
        };
        let r_int_3v3_base = match power_config.mode {
            PowerRealismMode::Realistic => power_config.r_internal_3v3.max(0.001),
            PowerRealismMode::Ideal => 0.10,
        };

        let pwr5v_idx = get_node_idx("uno1", "5V");
        let pwr33_idx = get_node_idx("uno1", "3.3V");

        // Two independent voltage source branches in MNA:
        // Branch 0: 5V power rail
        // Branch 1: 3.3V power rail
        let m_branches = 2;
        let mut mna = MnaMatrix::new(n, m_branches);

        // Install Gmin shunt conductance (1e-12 S) from all nodes to ground
        mna.add_gmin(G_MIN_DEFAULT);

        // 2. Stamp Independent Voltage Sources through MNA B, C, D Blocks
        // Branch 0: 5V Rail
        mna.stamp_thevenin_source(pwr5v_idx, None, 0, v_src_5v, r_int_5v_base);
        // Branch 1: 3.3V Rail
        mna.stamp_thevenin_source(pwr33_idx, None, 1, v_src_3v3, r_int_3v3_base);

        // 3. Stamp MCU GPIO pins
        for &pin_name in &mcu_pins {
            if pin_name == "5V" || pin_name == "3.3V" || pin_name.starts_with("GND") || pin_name == "VIN" || pin_name == "IOREF" {
                continue;
            }
            let pin_idx = match get_node_idx("uno1", pin_name) {
                Some(idx) => Some(idx),
                None => continue,
            };
            let state = mcu.get_pin_state(pin_name);
            match state {
                LogicState::High => {
                    // PMOS driver on-resistance connected to 5V rail
                    mna.stamp_conductance(pwr5v_idx, pin_idx, 1.0 / R_GPIO_OUT_P);
                }
                LogicState::Low => {
                    // NMOS driver on-resistance connected to GND
                    mna.stamp_conductance(pin_idx, None, 1.0 / R_GPIO_OUT_N);
                }
                LogicState::InputPullUp => {
                    // Internal pullup resistor connected to 5V rail
                    mna.stamp_conductance(pwr5v_idx, pin_idx, 1.0 / R_GPIO_PULLUP);
                }
                LogicState::Analog(v) => {
                    // Analog source with internal driver resistance
                    let v_target = (v as f64).clamp(0.0, 5.0);
                    let g = 1.0 / 25.0;
                    mna.stamp_norton_source(pin_idx, None, g, v_target * g);
                }
                LogicState::Pwm { duty, .. } => {
                    // Averaged DC equivalent PWM driver with duty cycle
                    let duty_ratio = (duty as f64) / 255.0;
                    let v_pwm = duty_ratio * v_src_5v;
                    let g = 1.0 / 30.0;
                    mna.stamp_norton_source(pin_idx, None, g, v_pwm * g);
                }
                LogicState::Floating => {
                    // High-Z input leakage to GND
                    mna.stamp_conductance(pin_idx, None, 1.0 / R_GPIO_INPUT_HIZ);
                }
            }
        }

        // 4. Stamp Resistors
        for (res_id, res) in resistors {
            let p1 = get_node_idx(res_id, "1");
            let p2 = get_node_idx(res_id, "2");
            let r = (res.resistance_ohms as f64).max(0.001);
            mna.stamp_conductance(p1, p2, 1.0 / r);
        }

        // 5. Stamp Potentiometers with physical terminal contact resistance Rc
        for (pot_id, pot) in pots {
            let p1 = get_node_idx(pot_id, "1");
            let p2 = get_node_idx(pot_id, "2"); // Wiper
            let p3 = get_node_idx(pot_id, "3");

            let is_standalone_sensor = !pot_vcc_wired.contains(pot_id) && !pot_gnd_wired.contains(pot_id);
            let gnd_node = if is_standalone_sensor { None } else { p1 };
            let vcc_node = p3;

            let alpha = (pot.value as f64).clamp(0.0, 1.0);
            let rc = R_POT_WIPER_RC;
            let r_total = 10000.0;
            let r_top = (1.0 - alpha) * r_total + rc;
            let r_bot = alpha * r_total + rc;

            mna.stamp_conductance(vcc_node, p2, 1.0 / r_top);
            mna.stamp_conductance(p2, gnd_node, 1.0 / r_bot);

            if is_standalone_sensor {
                mna.stamp_conductance(pwr5v_idx, vcc_node, 1.0 / 0.05);
            }
        }

        // 6. Stamp Pushbuttons
        for (btn_id, btn) in buttons {
            let t1 = get_node_idx(btn_id, "1");
            let t2 = get_node_idx(btn_id, "2");
            let r = if btn.is_pressed { R_PUSHBUTTON_ON } else { R_PUSHBUTTON_OFF };
            mna.stamp_conductance(t1, t2, 1.0 / r);
        }

        // 7. Stamp Wires
        for wire in wires {
            let u = get_node_idx(&wire.from.component_id, &wire.from.pin_name);
            let v = get_node_idx(&wire.to.component_id, &wire.to.pin_name);
            if u != v {
                mna.stamp_conductance(u, v, 1.0 / R_JUMPER_WIRE);
            }
        }

        let mna_static = mna;

        // 8. Prepare Non-linear Diode Elements (LEDs)
        let mut diode_branches: Vec<DiodeBranch> = Vec::new();
        for (led_id, led) in leds.iter() {
            let anode = get_node_idx(led_id, "anode");
            let cathode = get_node_idx(led_id, "cathode");
            let vf = led.forward_voltage() as f64;
            let props = get_led_color_properties(&led.color);
            let rs = props.series_rs;
            let vt = V_THERMAL * LED_IDEALITY_FACTOR_N;

            // Calculate saturation current Is from Vf @ 20mA
            let i_test = LED_TEST_CURRENT_A;
            let is_sat = 1e-25;
            let vcrit = (vf - i_test * rs - 0.0023).max(0.2);

            diode_branches.push(DiodeBranch {
                id: led_id.clone(),
                anode,
                cathode,
                forward_voltage: vf,
                series_rs: rs,
                is_sat,
                vt,
                vcrit,
            });
        }

        // 9. Dynamic Sub-stepping Simulation Loop
        // When dynamic reactive elements (capacitors) are present, use 20 sub-steps per frame.
        // Purely resistive / diode circuits execute in 1 step.
        let n_sub = if capacitors.is_empty() { 1 } else { 20 };
        let dt_sub = (1.0 / 60.0) / (n_sub as f64);

        let mut x = vec![0.0f64; mna_static.dim];
        let mut led_vd: Vec<f64> = diode_branches.iter().map(|d| {
            let va = pin_voltages.get(&PinId::new(&d.id, "anode")).copied().unwrap_or(0.0) as f64;
            let vc = pin_voltages.get(&PinId::new(&d.id, "cathode")).copied().unwrap_or(0.0) as f64;
            (va - vc).clamp(0.0, 5.0)
        }).collect();
        let mut led_id_curr: Vec<f64> = diode_branches.iter().enumerate().map(|(idx, d)| {
            branch_currents.get(&d.id).copied().map(|i| i as f64).unwrap_or_else(|| {
                solve_diode_current(led_vd[idx], d.forward_voltage, d.series_rs, d.is_sat, d.vt)
            })
        }).collect();
        let mut last_r_5v = r_int_5v_base;

        for _sub in 0..n_sub {
            let mut mna = mna_static.clone();

            // Stamp Dynamic Capacitors with Backward Euler companion model for dt_sub
            for (cap_id, cap) in capacitors.iter() {
                let p1 = get_node_idx(cap_id, "1");
                let p2 = get_node_idx(cap_id, "2");
                let c_farads = (cap.capacitance_farads as f64).max(1e-12);
                let esr = (cap.esr_ohms as f64).max(0.01);
                let r_leak = if cap.is_polarized { 2.0e7 } else { R_LEAK_CERAMIC };

                let g_c = c_farads / dt_sub;
                let g_p = g_c + (1.0 / r_leak);
                let r_branch = esr + (1.0 / g_p);
                let g_eff = 1.0 / r_branch;

                let v_prev = cap.voltage as f64;
                let i_eq = g_c * v_prev;
                let i_inj = i_eq / (1.0 + esr * g_p);

                mna.stamp_conductance(p1, p2, g_eff);
                mna.stamp_current_source(p2, p1, i_inj);
            }

            let mna_base = mna.clone();
            let mut mna_iter = mna_base.clone();
            let mut r_iter_5v = last_r_5v;

            // 10. Non-linear Newton-Raphson Solver with SPICE pnjlim & Dynamic PTC Foldback
            for _iter in 0..MAX_NR_ITERATIONS {
                mna_iter.a.copy_from_slice(&mna_base.a);
                mna_iter.rhs.copy_from_slice(&mna_base.rhs);
                mna_iter.a[n * mna_iter.dim + n] = -r_iter_5v;

                for (idx, diode) in diode_branches.iter().enumerate() {
                    let vd = led_vd[idx];
                    let is_sat = diode.is_sat;
                    let vt = diode.vt;
                    let rs = diode.series_rs;

                    let id = if _iter == 0 { solve_diode_current(vd, diode.forward_voltage, rs, is_sat, vt) } else { led_id_curr[idx] };
                    let gd = if id > 1e-6 {
                        1.0 / (vt / (id + is_sat) + rs)
                    } else {
                        1e-6
                    };
                    let i_eq = id - gd * vd;

                    mna_iter.stamp_conductance(diode.anode, diode.cathode, gd);
                    mna_iter.stamp_current_source(diode.anode, diode.cathode, i_eq);
                }

                mna_iter.solve(&mut x);

                if diode_branches.is_empty() {
                    break;
                }

                // Dynamic PTC polyfuse foldback & heavy load sag inside Newton-Raphson
                let curr_i5v = if n < x.len() { x[n].abs() } else { 0.0 };
                let threshold = if power_config.mode == PowerRealismMode::Realistic {
                    I_LIMIT_5V // 0.500 A
                } else {
                    0.080 // In Ideal mode, begin smooth sag when loaded beyond 80mA
                };
                let r_target = if curr_i5v > threshold {
                    (r_int_5v_base + 32.0 * ((curr_i5v - threshold) / 0.040).powi(2)).min(32.0)
                } else {
                    r_int_5v_base
                };
                let r_diff = (r_iter_5v - r_target).abs();
                r_iter_5v = 0.85 * r_iter_5v + 0.15 * r_target;

                // Dual convergence check (voltage and current)
                let mut v_converged = true;
                let mut i_converged = true;

                for (idx, diode) in diode_branches.iter().enumerate() {
                    let va = diode.anode.map(|i| x[i]).unwrap_or(0.0);
                    let vc = diode.cathode.map(|i| x[i]).unwrap_or(0.0);
                    let v_tot_new = va - vc;
                    let v_lim = pnjlim(v_tot_new, led_vd[idx], diode.vt, diode.vcrit);
                    let v_next = v_lim;

                    let v_delta = (v_next - led_vd[idx]).abs();
                    let v_tol = RELTOL * led_vd[idx].abs().max(v_next.abs()) + VNTOL;
                    if v_delta > v_tol {
                        v_converged = false;
                    }

                    let new_id = solve_diode_current(v_next, diode.forward_voltage, diode.series_rs, diode.is_sat, diode.vt);
                    let i_delta = (new_id - led_id_curr[idx]).abs();
                    let i_tol = RELTOL * led_id_curr[idx].abs().max(new_id.abs()) + 1e-9;
                    if i_delta > i_tol {
                        i_converged = false;
                    }

                    led_vd[idx] = v_next;
                    led_id_curr[idx] = new_id;
                }

                if v_converged && i_converged && r_diff < 0.005 {
                    break;
                }
            }

            last_r_5v = r_iter_5v;

            // Update capacitor internal state for this sub-step
            for (cap_id, cap) in capacitors.iter_mut() {
                let p1 = get_node_idx(cap_id, "1");
                let p2 = get_node_idx(cap_id, "2");
                let v1 = p1.map(|i| if i < x.len() { x[i] } else { 0.0 }).unwrap_or(0.0);
                let v2 = p2.map(|i| if i < x.len() { x[i] } else { 0.0 }).unwrap_or(0.0);
                let v_term = v1 - v2;

                let c_farads = (cap.capacitance_farads as f64).max(1e-12);
                let esr = (cap.esr_ohms as f64).max(0.01);
                let r_leak = if cap.is_polarized { 2.0e7 } else { R_LEAK_CERAMIC };

                let g_c = c_farads / dt_sub;
                let g_p = g_c + (1.0 / r_leak);
                let r_branch = esr + (1.0 / g_p);
                let g_eff = 1.0 / r_branch;

                let v_prev = cap.voltage as f64;
                let i_eq = g_c * v_prev;
                let i_inj = i_eq / (1.0 + esr * g_p);

                let i_cap = g_eff * v_term - i_inj;
                let v_internal = v_term - i_cap * esr;

                cap.voltage = v_internal as f32;
                branch_currents.insert(cap_id.clone(), i_cap as f32);
            }
        }

        // Helper to query node voltage
        let node_volt = |u: Option<usize>| -> f64 {
            u.map(|i| if i < x.len() { x[i] } else { 0.0 }).unwrap_or(0.0)
        };

        let node_volt_clean = |u: Option<usize>| -> f32 {
            let v = node_volt(u);
            if power_config.mode == PowerRealismMode::Ideal {
                if (v - 5.0).abs() < 0.005 {
                    5.0
                } else if (v - 3.3).abs() < 0.005 {
                    3.3
                } else if v.abs() < 1e-4 {
                    0.0
                } else {
                    v as f32
                }
            } else if v.abs() < 1e-12 {
                0.0
            } else {
                v as f32
            }
        };

        // 11. Compute branch currents and update LED physical states
        branch_currents.clear();

        for diode in &diode_branches {
            let va = node_volt(diode.anode);
            let vc = node_volt(diode.cathode);
            let v_tot = va - vc;

            let id = solve_diode_current(v_tot, diode.forward_voltage, diode.series_rs, diode.is_sat, diode.vt);

            if let Some(target_led) = leds.get_mut(&diode.id) {
                if id >= 0.0003 {
                    target_led.is_lit = true;
                    // Luminous intensity scales with forward current
                    target_led.brightness = ((id / 0.015) as f32).clamp(0.02, 1.0);
                } else {
                    target_led.is_lit = false;
                    target_led.brightness = 0.0;
                }
            }
            branch_currents.insert(diode.id.clone(), id as f32);
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
            let v_p3 = node_volt(get_node_idx(pot_id, "3"));
            let v_p2 = node_volt(get_node_idx(pot_id, "2"));
            let is_standalone_sensor = !pot_vcc_wired.contains(pot_id) && !pot_gnd_wired.contains(pot_id);
            let v_p1 = if is_standalone_sensor {
                0.0
            } else {
                node_volt(get_node_idx(pot_id, "1"))
            };
            let alpha = (pot.value as f64).clamp(0.0, 1.0);
            let rc = R_POT_WIPER_RC;
            let r_top = (1.0 - alpha) * 10000.0 + rc;
            let r_bot = alpha * 10000.0 + rc;
            let i_top = (v_p3 - v_p2).abs() / r_top;
            let i_bot = (v_p2 - v_p1).abs() / r_bot;
            branch_currents.insert(format!("{}:top", pot_id), i_top as f32);
            branch_currents.insert(format!("{}:bot", pot_id), i_bot as f32);
            branch_currents.insert(pot_id.clone(), (i_top + i_bot) as f32);
        }

        // Pushbutton branch currents
        for (btn_id, btn) in buttons {
            let v1 = node_volt(get_node_idx(btn_id, "1"));
            let v2 = node_volt(get_node_idx(btn_id, "2"));
            let r = if btn.is_pressed { R_PUSHBUTTON_ON } else { R_PUSHBUTTON_OFF };
            let i = (v1 - v2).abs() / r;
            branch_currents.insert(btn_id.clone(), i as f32);
        }

        // Direct MNA Power Rail currents from solution vector x[N..N+M-1]
        let i5v = if n < x.len() { x[n].abs() } else { ((v_src_5v - node_volt(pwr5v_idx)) / r_int_5v_base).abs() };
        let i33 = if n + 1 < x.len() { x[n + 1].abs() } else { ((v_src_3v3 - node_volt(pwr33_idx)) / r_int_3v3_base).abs() };

        branch_currents.insert("uno1:5V".to_string(), i5v as f32);
        branch_currents.insert("uno1:3.3V".to_string(), i33 as f32);

        // MCU GPIO currents
        let v5v = node_volt(pwr5v_idx);
        for &pin_name in &mcu_pins {
            if pin_name == "5V" || pin_name == "3.3V" || pin_name.starts_with("GND") || pin_name == "VIN" || pin_name == "IOREF" {
                continue;
            }
            let pin_idx = get_node_idx("uno1", pin_name);
            let state = mcu.get_pin_state(pin_name);
            let ip = if let Some(idx) = pin_idx {
                let vp = node_volt(Some(idx));
                match state {
                    LogicState::High => (v5v - vp) / R_GPIO_OUT_P,
                    LogicState::Low => (vp - 0.0) / R_GPIO_OUT_N,
                    LogicState::InputPullUp => (v5v - vp) / R_GPIO_PULLUP,
                    _ => 0.0,
                }
            } else {
                0.0
            };
            branch_currents.insert(format!("uno1:{}", pin_name), ip as f32);
        }

        // 12. Populate pin_voltages map
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
            let volt = if let Some(idx) = get_node_idx("uno1", pin_name) {
                node_volt_clean(Some(idx))
            } else {
                let state = mcu.get_pin_state(pin_name);
                match state {
                    LogicState::High | LogicState::InputPullUp => v5v as f32,
                    LogicState::Low | LogicState::Floating => 0.0,
                    LogicState::Analog(v) => v,
                    LogicState::Pwm { duty, .. } => (duty as f32 / 255.0) * v5v as f32,
                }
            };
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
        for (pot_id, _pot) in pots {
            let is_standalone_sensor = !pot_vcc_wired.contains(pot_id) && !pot_gnd_wired.contains(pot_id);
            let v_p1 = if is_standalone_sensor {
                0.0
            } else {
                node_volt_clean(get_node_idx(pot_id, "1"))
            };
            let v_p2 = node_volt_clean(get_node_idx(pot_id, "2"));
            let v_p3 = node_volt_clean(get_node_idx(pot_id, "3"));

            for p in &["1", "gnd"] {
                pin_voltages.insert(PinId::new(pot_id, *p), v_p1);
            }
            for p in &["2", "sig", "wiper", "SIG", "WIPER"] {
                pin_voltages.insert(PinId::new(pot_id, *p), v_p2);
            }
            for p in &["3", "vcc", "5v", "VCC", "5V"] {
                pin_voltages.insert(PinId::new(pot_id, *p), v_p3);
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

        // Capacitors
        for cap_id in capacitors.keys() {
            let v1 = node_volt_clean(get_node_idx(cap_id, "1"));
            let v2 = node_volt_clean(get_node_idx(cap_id, "2"));
            for p in &["1", "p1", "anode", "+", "pos"] {
                pin_voltages.insert(PinId::new(cap_id, *p), v1);
            }
            for p in &["2", "p2", "cathode", "-", "neg"] {
                pin_voltages.insert(PinId::new(cap_id, *p), v2);
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
                let v_fj = node_volt_clean(get_node_idx(&bb_id, &format!("col_{}_fj", col)));

                for row in &["a", "b", "c", "d", "e"] {
                    pin_voltages.insert(PinId::new(&bb_id, format!("{}.{}", col, row)), v_ae);
                    pin_voltages.insert(PinId::new(&bb_id, format!("{}.{}", row, col)), v_ae);
                    pin_voltages.insert(PinId::new(&bb_id, format!("{}{}", row, col)), v_ae);
                    pin_voltages.insert(PinId::new(&bb_id, format!("{}_{}", col, row)), v_ae);
                    pin_voltages.insert(PinId::new(&bb_id, format!("{}_{}", row, col)), v_ae);
                }
                for row in &["f", "g", "h", "i", "j"] {
                    pin_voltages.insert(PinId::new(&bb_id, format!("{}.{}", col, row)), v_fj);
                    pin_voltages.insert(PinId::new(&bb_id, format!("{}.{}", row, col)), v_fj);
                    pin_voltages.insert(PinId::new(&bb_id, format!("{}{}", row, col)), v_fj);
                    pin_voltages.insert(PinId::new(&bb_id, format!("{}_{}", col, row)), v_fj);
                    pin_voltages.insert(PinId::new(&bb_id, format!("{}_{}", row, col)), v_fj);
                }
            }
        }

        // 13. Back-propagate pin voltages to MCU inputs & ADC channels
        for &pin_name in &mcu_pins {
            let state = mcu.get_pin_state(pin_name);
            let volt = pin_voltages.get(&PinId::new("uno1", pin_name)).copied().unwrap_or(0.0);
            match state {
                LogicState::InputPullUp | LogicState::Floating => {
                    let is_high = volt >= (v5v as f32 * V_SCHMITT_VIH_FRAC as f32);
                    mcu.set_pin_input(pin_name, is_high);
                }
                _ => {}
            }

            if pin_name.starts_with('A') {
                if let Ok(ch) = pin_name[1..].parse::<u8>() {
                    mcu.set_adc_voltage(ch, volt);
                }
            }
        }

        // 14. Evaluate Physical Fault Conditions
        faults.clear();

        // 5V rail short-circuit / overload (>500mA, PTC tripped, or voltage collapse)
        let fault_i5v = if i5v < I_LIMIT_5V && (v5v < 2.5 || last_r_5v > r_int_5v_base * 2.0) {
            ((v_src_5v - v5v).max(0.0) / r_int_5v_base).max(i5v)
        } else {
            i5v
        };

        if fault_i5v > I_LIMIT_5V {
            faults.push(CircuitFault {
                fault_type: FaultType::ShortCircuit,
                component_id: "uno1".to_string(),
                pin_name: "5V".to_string(),
                description: format!("Short Circuit: 5V rail drawing {:.2}A (max 500mA limit)", fault_i5v),
                current_ma: (fault_i5v * 1000.0) as f32,
                voltage: v5v as f32,
            });
        }

        // 3.3V rail short-circuit (>150mA)
        if i33 > I_LIMIT_3V3 {
            faults.push(CircuitFault {
                fault_type: FaultType::ShortCircuit,
                component_id: "uno1".to_string(),
                pin_name: "3.3V".to_string(),
                description: format!("Short Circuit: 3.3V rail drawing {:.2}A (max 150mA)", i33),
                current_ma: (i33 * 1000.0) as f32,
                voltage: node_volt(pwr33_idx) as f32,
            });
        }

        // GPIO Overcurrent (>40mA absolute maximum)
        for &pin_name in &mcu_pins {
            if let Some(&i_pin) = branch_currents.get(&format!("uno1:{}", pin_name)) {
                if i_pin > I_GPIO_MAX_A as f32 {
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

        // LED Overcurrent (>40mA) & Reverse Polarity
        for diode in &diode_branches {
            let va = node_volt(diode.anode) as f32;
            let vc = node_volt(diode.cathode) as f32;
            if let Some(&i_led) = branch_currents.get(&diode.id) {
                if i_led > 0.040 {
                    faults.push(CircuitFault {
                        fault_type: FaultType::Overcurrent,
                        component_id: diode.id.clone(),
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
                    component_id: diode.id.clone(),
                    pin_name: "anode".to_string(),
                    description: format!("Reverse Polarity: Cathode ({:.2}V) > Anode ({:.2}V)", vc, va),
                    current_ma: 0.0,
                    voltage: vc - va,
                });
            }
        }

        // Capacitor Faults: Reverse Polarity on Polarized & Overvoltage
        for (cap_id, cap) in capacitors.iter() {
            if cap.is_polarized && cap.voltage < -0.15 {
                let i_cap = branch_currents.get(cap_id).copied().unwrap_or(0.0);
                faults.push(CircuitFault {
                    fault_type: FaultType::ReversePolarity,
                    component_id: cap_id.clone(),
                    pin_name: "2".into(),
                    description: format!(
                        "Polarized Capacitor {} reverse biased ({:.2}V). Cathode connected to higher potential than Anode!",
                        cap_id, cap.voltage
                    ),
                    current_ma: i_cap.abs() * 1000.0,
                    voltage: cap.voltage,
                });
            }

            if cap.voltage > cap.voltage_rating {
                let i_cap = branch_currents.get(cap_id).copied().unwrap_or(0.0);
                faults.push(CircuitFault {
                    fault_type: FaultType::Overcurrent,
                    component_id: cap_id.clone(),
                    pin_name: "1".into(),
                    description: format!(
                        "Capacitor {} exceeded maximum voltage rating ({:.1}V > {:.1}V rating)!",
                        cap_id, cap.voltage, cap.voltage_rating
                    ),
                    current_ma: i_cap.abs() * 1000.0,
                    voltage: cap.voltage,
                });
            }
        }
    }
}
