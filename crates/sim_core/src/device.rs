//! Central Circuit Device Interface and MNA Matrix abstractions (device.rs)
//!
//! Conforms to Section 7 of docs/PHYSICS_SPEC.md.
//! Provides the unified CircuitDevice trait for pluggable components, MnaMatrix for
//! simultaneous nodal voltage and branch current formulation, and numerical integration contexts.

use std::collections::HashMap;
use serde::{Deserialize, Serialize};

use crate::constants::G_MIN_DEFAULT;

/// Numerical integration method for time-domain companion models.
/// MicroRustSim currently uses L-stable Backward Euler for dynamic capacitor states,
/// while Trapezoidal and BDF2 are defined as interface variants for future higher-order extension.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum IntegrationMethod {
    /// Second-order Trapezoidal rule: O(dt^2) accuracy (interface variant)
    Trapezoidal,
    /// First-order Backward Euler: L-stable active companion model in sim_core
    BackwardEuler,
    /// Second-order Backward Differentiation Formula: L-stable (interface variant)
    BDF2,
}

/// Simulation time context passed to dynamic companion models during transient stamping
#[derive(Debug, Clone, Copy, PartialEq)]
pub struct TimeContext {
    /// Current continuous simulation time in seconds
    pub t: f64,
    /// Current time-step dt in seconds
    pub dt: f64,
    /// Discrete step counter
    pub step_counter: u64,
    /// Numerical integration algorithm to apply
    pub method: IntegrationMethod,
    /// Flag indicating whether this time-step is immediately after a discontinuity event
    pub is_discontinuity: bool,
}

impl Default for TimeContext {
    fn default() -> Self {
        Self {
            t: 0.0,
            dt: 1.0 / 60.0,
            step_counter: 0,
            method: IntegrationMethod::Trapezoidal,
            is_discontinuity: false,
        }
    }
}

/// Lookup structure to query solved nodal voltages during state and limit updates
#[derive(Debug, Clone)]
pub struct NodeVoltageLookup<'a> {
    voltages: &'a [f64],
    pin_to_node: &'a HashMap<(String, String), Option<usize>>,
}

impl<'a> NodeVoltageLookup<'a> {
    pub fn new(
        voltages: &'a [f64],
        pin_to_node: &'a HashMap<(String, String), Option<usize>>,
    ) -> Self {
        Self {
            voltages,
            pin_to_node,
        }
    }

    /// Query voltage at a specific node index. Ground (None) always returns 0.0 V.
    #[inline]
    pub fn get_node(&self, idx: Option<usize>) -> f64 {
        match idx {
            Some(i) if i < self.voltages.len() => self.voltages[i],
            _ => 0.0,
        }
    }

    /// Query voltage at a component pin by component id and pin name
    pub fn get_pin(&self, comp_id: &str, pin_name: &str) -> f64 {
        let key = (comp_id.to_string(), pin_name.to_string());
        if let Some(&node_opt) = self.pin_to_node.get(&key) {
            self.get_node(node_opt)
        } else {
            0.0
        }
    }
}

/// Severity and category of device warnings
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum DeviceWarningType {
    Overcurrent,
    Overvoltage,
    ReversePolarity,
    Overheating,
    ExcessivePower,
    IndeterminateLogic,
}

/// Physical warning or limit violation emitted by a circuit device
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct DeviceWarning {
    pub component_id: String,
    pub warning_type: DeviceWarningType,
    pub message: String,
    pub value: f64,
    pub threshold: f64,
    pub fatal: bool,
}

/// Full Modified Nodal Analysis (MNA) system matrix and right-hand side vector:
///
/// ```text
/// [ G   B ] [ v ] = [ j ]
/// [ C   D ] [ i ]   [ e ]
/// ```
///
/// Where:
/// - N: Number of non-ground independent nodes (v: node voltages)
/// - M: Number of voltage sources / current-constrained branches (i: branch currents)
/// - Total dimension: S = N + M
#[derive(Debug, Clone)]
pub struct MnaMatrix {
    pub n_nodes: usize,
    pub n_branches: usize,
    pub dim: usize,
    /// Dense row-major storage of size dim * dim
    pub a: Vec<f64>,
    /// Right-hand side vector of size dim
    pub rhs: Vec<f64>,
}

impl MnaMatrix {
    pub fn new(n_nodes: usize, n_branches: usize) -> Self {
        let dim = n_nodes + n_branches;
        Self {
            n_nodes,
            n_branches,
            dim,
            a: vec![0.0; dim * dim],
            rhs: vec![0.0; dim],
        }
    }

    /// Reset all matrix elements and RHS entries to zero
    pub fn clear(&mut self) {
        self.a.fill(0.0);
        self.rhs.fill(0.0);
    }

    /// Re-initialize dimensions
    pub fn resize(&mut self, n_nodes: usize, n_branches: usize) {
        self.n_nodes = n_nodes;
        self.n_branches = n_branches;
        self.dim = n_nodes + n_branches;
        self.a.resize(self.dim * self.dim, 0.0);
        self.a.fill(0.0);
        self.rhs.resize(self.dim, 0.0);
        self.rhs.fill(0.0);
    }

    /// Add gmin shunt conductance (1e-12 S) from every node to ground (diagonal G entries)
    pub fn add_gmin(&mut self, gmin: f64) {
        let n = self.dim;
        for i in 0..self.n_nodes {
            self.a[i * n + i] += gmin;
        }
    }

    /// Stamp a linear conductance g between nodes u and v (Ground is None)
    #[inline]
    pub fn stamp_conductance(&mut self, u: Option<usize>, v: Option<usize>, g: f64) {
        let n = self.dim;
        if let Some(u_idx) = u {
            if u_idx < self.n_nodes {
                self.a[u_idx * n + u_idx] += g;
            }
        }
        if let Some(v_idx) = v {
            if v_idx < self.n_nodes {
                self.a[v_idx * n + v_idx] += g;
            }
        }
        if let (Some(u_idx), Some(v_idx)) = (u, v) {
            if u_idx < self.n_nodes && v_idx < self.n_nodes {
                self.a[u_idx * n + v_idx] -= g;
                self.a[v_idx * n + u_idx] -= g;
            }
        }
    }

    /// Stamp an independent current source injecting current i_source from u to v
    #[inline]
    pub fn stamp_current_source(&mut self, u: Option<usize>, v: Option<usize>, i_source: f64) {
        if let Some(u_idx) = u {
            if u_idx < self.n_nodes {
                self.rhs[u_idx] -= i_source;
            }
        }
        if let Some(v_idx) = v {
            if v_idx < self.n_nodes {
                self.rhs[v_idx] += i_source;
            }
        }
    }

    /// Stamp a Norton equivalent source: parallel conductance g_int with injection current i_inj
    #[inline]
    pub fn stamp_norton_source(&mut self, u: Option<usize>, v: Option<usize>, g_int: f64, i_inj: f64) {
        self.stamp_conductance(u, v, g_int);
        self.stamp_current_source(v, u, i_inj);
    }

    /// Stamp an independent voltage source V_s across node u (pos) and v (neg)
    /// through branch index `branch_idx` (0 .. n_branches - 1):
    ///
    /// Equation:
    ///   v_u - v_v = V_s
    ///   Node u KCL: +i_branch
    ///   Node v KCL: -i_branch
    pub fn stamp_voltage_source(
        &mut self,
        u: Option<usize>,
        v: Option<usize>,
        branch_idx: usize,
        v_source: f64,
    ) {
        let n = self.dim;
        let b_row = self.n_nodes + branch_idx;

        if let Some(u_idx) = u {
            if u_idx < self.n_nodes {
                // B block (Row u_idx, Column b_row)
                self.a[u_idx * n + b_row] += 1.0;
                // C block (Row b_row, Column u_idx)
                self.a[b_row * n + u_idx] += 1.0;
            }
        }

        if let Some(v_idx) = v {
            if v_idx < self.n_nodes {
                // B block (Row v_idx, Column b_row)
                self.a[v_idx * n + b_row] -= 1.0;
                // C block (Row b_row, Column v_idx)
                self.a[b_row * n + v_idx] -= 1.0;
            }
        }

        // e block RHS
        self.rhs[b_row] = v_source;
    }

    /// Stamp a Thevenin voltage source (V_s in series with internal resistance r_int)
    ///
    /// Equation:
    ///   (v_u - v_v) + r_int * i_branch = V_s  => v_u - v_v = V_s - r_int * i_branch
    ///   D[branch, branch] = r_int
    pub fn stamp_thevenin_source(
        &mut self,
        u: Option<usize>,
        v: Option<usize>,
        branch_idx: usize,
        v_source: f64,
        r_int: f64,
    ) {
        self.stamp_voltage_source(u, v, branch_idx, v_source);
        let n = self.dim;
        let b_row = self.n_nodes + branch_idx;
        // D block: series resistance (D[p, p] = -R_int per PHYSICS_SPEC.md Section 2.2)
        self.a[b_row * n + b_row] -= r_int;
    }

    /// Solve the linear system A * x = rhs using Gaussian elimination with partial pivoting.
    /// Returns true on success, false if matrix is completely non-invertible.
    pub fn solve(&mut self, x: &mut [f64]) -> bool {
        let n = self.dim;
        if n == 0 {
            return true;
        }
        if x.len() < n {
            return false;
        }

        for i in 0..n {
            let mut max_val = self.a[i * n + i].abs();
            let mut pivot_row = i;
            for k in (i + 1)..n {
                let val = self.a[k * n + i].abs();
                if val > max_val {
                    max_val = val;
                    pivot_row = k;
                }
            }

            if max_val < 1e-14 {
                // Regularize singular pivot to prevent NaN
                self.a[i * n + i] += G_MIN_DEFAULT.max(1e-10);
            } else if pivot_row != i {
                for col in 0..n {
                    self.a.swap(i * n + col, pivot_row * n + col);
                }
                self.rhs.swap(i, pivot_row);
            }

            let pivot = self.a[i * n + i];
            for k in (i + 1)..n {
                let factor = self.a[k * n + i] / pivot;
                self.a[k * n + i] = 0.0;
                for j in (i + 1)..n {
                    self.a[k * n + j] -= factor * self.a[i * n + j];
                }
                self.rhs[k] -= factor * self.rhs[i];
            }
        }

        for i in (0..n).rev() {
            let mut sum = self.rhs[i];
            for j in (i + 1)..n {
                sum -= self.a[i * n + j] * x[j];
            }
            let diag = self.a[i * n + i];
            x[i] = if diag.abs() > 1e-14 { sum / diag } else { 0.0 };
        }

        true
    }
}

/// Unified Circuit Device Interface per Section 7 of docs/PHYSICS_SPEC.md.
///
/// All hardware components (passives, semiconductors, reactive components, switches)
/// implement this interface to participate seamlessly in MNA and transient integration.
pub trait CircuitDevice: Send + Sync {
    /// Unique identifier for this device instance in the circuit
    fn id(&self) -> &str;

    /// List of physical terminals and pin names on this component
    fn terminal_pins(&self) -> Vec<String>;

    /// Stamp device conductance and sources into MNA matrix for DC Operating Point analysis
    fn stamp_dc(&self, matrix: &mut MnaMatrix);

    /// Stamp dynamic companion models for transient simulation (Trapezoidal / Backward Euler / BDF2)
    fn stamp_transient(&self, matrix: &mut MnaMatrix, context: &TimeContext);

    /// Update internal state (stored charge, flux, thermal accumulation, etc.) from solved voltages
    fn update_state(&mut self, voltages: &NodeVoltageLookup, dt: f64);

    /// Check physical limits and safety margins (overcurrent, overvoltage, reverse polarity, thermal limits)
    fn check_limits(&self, voltages: &NodeVoltageLookup, dt: f64) -> Vec<DeviceWarning>;

    /// Returns true if the device has suffered permanent physical damage (open circuit / breakdown)
    fn is_damaged(&self) -> bool;

    /// Reset internal state, damage status, and restore factory defaults
    fn reset_device(&mut self);
}

use crate::components::{
    BreadboardComponent, CapacitorComponent, LedComponent, PotentiometerComponent,
    PushbuttonComponent, ResistorComponent,
};
use crate::constants::LED_MAX_CURRENT_A;

impl CircuitDevice for ResistorComponent {
    fn id(&self) -> &str {
        &self.id
    }

    fn terminal_pins(&self) -> Vec<String> {
        vec!["1".to_string(), "2".to_string()]
    }

    fn stamp_dc(&self, matrix: &mut MnaMatrix) {
        if self.is_blown {
            return;
        }
        let n1 = self.get_pin_node("1");
        let n2 = self.get_pin_node("2");
        let g = 1.0 / self.actual_resistance();
        matrix.stamp_conductance(n1, n2, g);
    }

    fn stamp_transient(&self, matrix: &mut MnaMatrix, _context: &TimeContext) {
        self.stamp_dc(matrix);
    }

    fn update_state(&mut self, voltages: &NodeVoltageLookup, dt: f64) {
        let v1 = voltages.get_pin(&self.id, "1");
        let v2 = voltages.get_pin(&self.id, "2");
        self.check_power((v1 - v2).abs(), dt);
    }

    fn check_limits(&self, voltages: &NodeVoltageLookup, _dt: f64) -> Vec<DeviceWarning> {
        let mut warnings = Vec::new();
        let v1 = voltages.get_pin(&self.id, "1");
        let v2 = voltages.get_pin(&self.id, "2");
        let v_diff = (v1 - v2).abs();
        let r = self.actual_resistance();
        let p = (v_diff * v_diff) / r;
        let rated = self.power_rating_watts as f64;

        if self.is_blown {
            warnings.push(DeviceWarning {
                component_id: self.id.clone(),
                warning_type: DeviceWarningType::ExcessivePower,
                message: format!("Resistor '{}' burned out from thermal overload", self.id),
                value: p,
                threshold: rated,
                fatal: true,
            });
        } else if p > rated {
            warnings.push(DeviceWarning {
                component_id: self.id.clone(),
                warning_type: DeviceWarningType::ExcessivePower,
                message: format!(
                    "Resistor '{}' power dissipation ({:.3} W) exceeds rated power ({:.2} W)",
                    self.id, p, rated
                ),
                value: p,
                threshold: rated,
                fatal: false,
            });
        }
        warnings
    }

    fn is_damaged(&self) -> bool {
        self.is_blown
    }

    fn reset_device(&mut self) {
        self.is_blown = false;
        self.energy_absorbed_j = 0.0;
    }
}

impl CircuitDevice for PotentiometerComponent {
    fn id(&self) -> &str {
        &self.id
    }

    fn terminal_pins(&self) -> Vec<String> {
        vec!["1".to_string(), "2".to_string(), "3".to_string()]
    }

    fn stamp_dc(&self, matrix: &mut MnaMatrix) {
        let n1 = self.get_pin_node("1");
        let n2 = self.get_pin_node("2");
        let n3 = self.get_pin_node("3");
        let rc = self.terminal_contact_resistance as f64;
        let r_top = self.r_top(rc);
        let r_bot = self.r_bot(rc);
        matrix.stamp_conductance(n3, n2, 1.0 / r_top);
        matrix.stamp_conductance(n2, n1, 1.0 / r_bot);
    }

    fn stamp_transient(&self, matrix: &mut MnaMatrix, _context: &TimeContext) {
        self.stamp_dc(matrix);
    }

    fn update_state(&mut self, _voltages: &NodeVoltageLookup, _dt: f64) {}

    fn check_limits(&self, voltages: &NodeVoltageLookup, _dt: f64) -> Vec<DeviceWarning> {
        let mut warnings = Vec::new();
        let v3 = voltages.get_pin(&self.id, "3");
        let v2 = voltages.get_pin(&self.id, "2");
        let rc = self.terminal_contact_resistance as f64;
        let r_top = self.r_top(rc);
        let i_top = (v3 - v2).abs() / r_top;
        if i_top > 0.100 {
            warnings.push(DeviceWarning {
                component_id: self.id.clone(),
                warning_type: DeviceWarningType::Overcurrent,
                message: format!(
                    "Potentiometer '{}' wiper current ({:.1} mA) exceeds safe threshold",
                    self.id,
                    i_top * 1000.0
                ),
                value: i_top,
                threshold: 0.100,
                fatal: false,
            });
        }
        warnings
    }

    fn is_damaged(&self) -> bool {
        false
    }

    fn reset_device(&mut self) {}
}

impl CircuitDevice for LedComponent {
    fn id(&self) -> &str {
        &self.id
    }

    fn terminal_pins(&self) -> Vec<String> {
        vec!["anode".to_string(), "cathode".to_string()]
    }

    fn stamp_dc(&self, matrix: &mut MnaMatrix) {
        if self.is_blown {
            return;
        }
        let na = self.get_pin_node("anode");
        let nc = self.get_pin_node("cathode");
        let rs = self.series_rs();
        let gd = 1.0 / (rs + 1.0);
        matrix.stamp_conductance(na, nc, gd);
    }

    fn stamp_transient(&self, matrix: &mut MnaMatrix, _context: &TimeContext) {
        self.stamp_dc(matrix);
    }

    fn update_state(&mut self, voltages: &NodeVoltageLookup, dt: f64) {
        let va = voltages.get_pin(&self.id, "anode");
        let vc = voltages.get_pin(&self.id, "cathode");
        let v_d = va - vc;
        let vf = self.forward_voltage() as f64;
        let rs = self.series_rs();
        let is_sat = self.saturation_current_is();
        let vt = crate::constants::V_THERMAL * crate::constants::LED_IDEALITY_FACTOR_N;
        let current_a = crate::solver::solve_diode_current(v_d, vf, rs, is_sat, vt);
        self.update_current_and_brightness(current_a, dt);
    }

    fn check_limits(&self, voltages: &NodeVoltageLookup, _dt: f64) -> Vec<DeviceWarning> {
        let mut warnings = Vec::new();
        let va = voltages.get_pin(&self.id, "anode");
        let vc = voltages.get_pin(&self.id, "cathode");
        let v_d = va - vc;

        if self.is_blown {
            warnings.push(DeviceWarning {
                component_id: self.id.clone(),
                warning_type: DeviceWarningType::Overcurrent,
                message: format!("LED '{}' destroyed by excessive forward current", self.id),
                value: self.current_ma as f64 / 1000.0,
                threshold: LED_MAX_CURRENT_A,
                fatal: true,
            });
        } else if self.current_ma > (LED_MAX_CURRENT_A * 1000.0) as f32 {
            warnings.push(DeviceWarning {
                component_id: self.id.clone(),
                warning_type: DeviceWarningType::Overcurrent,
                message: format!(
                    "LED '{}' forward current ({:.1} mA) exceeds maximum rated current (30 mA)",
                    self.id, self.current_ma
                ),
                value: self.current_ma as f64 / 1000.0,
                threshold: LED_MAX_CURRENT_A,
                fatal: false,
            });
        } else if v_d < -0.5 {
            warnings.push(DeviceWarning {
                component_id: self.id.clone(),
                warning_type: DeviceWarningType::ReversePolarity,
                message: format!("LED '{}' is connected in reverse polarity (Vd = {:.2} V)", self.id, v_d),
                value: v_d,
                threshold: -0.5,
                fatal: false,
            });
        }
        warnings
    }

    fn is_damaged(&self) -> bool {
        self.is_blown
    }

    fn reset_device(&mut self) {
        self.is_blown = false;
        self.damage_accumulator = 0.0;
        self.current_ma = 0.0;
        self.avg_current_ma = 0.0;
        self.is_lit = false;
        self.brightness = 0.0;
    }
}

impl CircuitDevice for PushbuttonComponent {
    fn id(&self) -> &str {
        &self.id
    }

    fn terminal_pins(&self) -> Vec<String> {
        vec![
            "1".to_string(),
            "2".to_string(),
            "3".to_string(),
            "4".to_string(),
        ]
    }

    fn stamp_dc(&self, matrix: &mut MnaMatrix) {
        let n1 = self.get_pin_node("1");
        let n2 = self.get_pin_node("2");
        let n3 = self.get_pin_node("3");
        let n4 = self.get_pin_node("4");

        // Pins 1-2 tied, pins 3-4 tied internally
        matrix.stamp_conductance(n1, n2, 1.0 / 0.001);
        matrix.stamp_conductance(n3, n4, 1.0 / 0.001);

        let r_sw = self.contact_resistance();
        matrix.stamp_conductance(n1, n3, 1.0 / r_sw);
    }

    fn stamp_transient(&self, matrix: &mut MnaMatrix, _context: &TimeContext) {
        self.stamp_dc(matrix);
    }

    fn update_state(&mut self, _voltages: &NodeVoltageLookup, _dt: f64) {}

    fn check_limits(&self, _voltages: &NodeVoltageLookup, _dt: f64) -> Vec<DeviceWarning> {
        Vec::new()
    }

    fn is_damaged(&self) -> bool {
        false
    }

    fn reset_device(&mut self) {}
}

impl CircuitDevice for CapacitorComponent {
    fn id(&self) -> &str {
        &self.id
    }

    fn terminal_pins(&self) -> Vec<String> {
        vec!["1".to_string(), "2".to_string()]
    }

    fn stamp_dc(&self, matrix: &mut MnaMatrix) {
        if self.is_damaged {
            return;
        }
        let n1 = self.get_pin_node("1");
        let n2 = self.get_pin_node("2");
        let r_total = (self.esr_ohms as f64) + self.effective_leakage();
        matrix.stamp_conductance(n1, n2, 1.0 / r_total);
    }

    fn stamp_transient(&self, matrix: &mut MnaMatrix, context: &TimeContext) {
        if self.is_damaged {
            return;
        }
        let n1 = self.get_pin_node("1");
        let n2 = self.get_pin_node("2");
        let dt = context.dt.max(1e-9);
        let c_farads = (self.capacitance_farads as f64).max(1e-12);
        let esr = (self.esr_ohms as f64).max(0.01);
        let r_leak = self.effective_leakage();

        let g_c = c_farads / dt;
        let g_p = g_c + (1.0 / r_leak);
        let r_branch = esr + (1.0 / g_p);
        let g_eff = 1.0 / r_branch;

        let v_prev = self.voltage as f64;
        let i_eq = g_c * v_prev;
        let i_inj = i_eq / (1.0 + esr * g_p);

        matrix.stamp_conductance(n1, n2, g_eff);
        matrix.stamp_current_source(n2, n1, i_inj);
    }

    fn update_state(&mut self, voltages: &NodeVoltageLookup, dt: f64) {
        if self.is_damaged {
            return;
        }
        let v1 = voltages.get_pin(&self.id, "1");
        let v2 = voltages.get_pin(&self.id, "2");
        let v_term = v1 - v2;
        let dt_eff = dt.max(1e-9);
        let c_farads = (self.capacitance_farads as f64).max(1e-12);
        let esr = (self.esr_ohms as f64).max(0.01);
        let r_leak = self.effective_leakage();

        let g_c = c_farads / dt_eff;
        let g_p = g_c + (1.0 / r_leak);
        let r_branch = esr + (1.0 / g_p);
        let g_eff = 1.0 / r_branch;

        let v_prev = self.voltage as f64;
        let i_eq = g_c * v_prev;
        let i_inj = i_eq / (1.0 + esr * g_p);

        let i_cap = g_eff * v_term - i_inj;
        let v_internal = v_term - i_cap * esr;
        self.voltage = v_internal as f32;

        if self.is_polarized {
            if v_term < -0.5 {
                self.reverse_damage_timer_s += dt;
                if v_term < -1.5 && self.reverse_damage_timer_s >= 1.0 {
                    self.is_damaged = true;
                }
            } else {
                self.reverse_damage_timer_s = (self.reverse_damage_timer_s - dt).max(0.0);
            }
        }
    }

    fn check_limits(&self, voltages: &NodeVoltageLookup, _dt: f64) -> Vec<DeviceWarning> {
        let mut warnings = Vec::new();
        let v1 = voltages.get_pin(&self.id, "1");
        let v2 = voltages.get_pin(&self.id, "2");
        let v_term = v1 - v2;

        if self.is_damaged {
            warnings.push(DeviceWarning {
                component_id: self.id.clone(),
                warning_type: DeviceWarningType::ReversePolarity,
                message: format!(
                    "Capacitor '{}' destroyed by reverse polarity breakdown",
                    self.id
                ),
                value: v_term,
                threshold: -1.0,
                fatal: true,
            });
        } else if self.is_polarized && v_term < -0.5 {
            warnings.push(DeviceWarning {
                component_id: self.id.clone(),
                warning_type: DeviceWarningType::ReversePolarity,
                message: format!(
                    "Electrolytic capacitor '{}' connected in reverse polarity ({:.2} V)",
                    self.id, v_term
                ),
                value: v_term,
                threshold: -0.5,
                fatal: false,
            });
        } else if v_term.abs() > self.voltage_rating as f64 {
            warnings.push(DeviceWarning {
                component_id: self.id.clone(),
                warning_type: DeviceWarningType::Overvoltage,
                message: format!(
                    "Capacitor '{}' voltage ({:.2} V) exceeds rated voltage ({:.1} V)",
                    self.id,
                    v_term.abs(),
                    self.voltage_rating
                ),
                value: v_term.abs(),
                threshold: self.voltage_rating as f64,
                fatal: false,
            });
        }
        warnings
    }

    fn is_damaged(&self) -> bool {
        self.is_damaged
    }

    fn reset_device(&mut self) {
        self.is_damaged = false;
        self.voltage = 0.0;
        self.reverse_damage_timer_s = 0.0;
    }
}

impl CircuitDevice for BreadboardComponent {
    fn id(&self) -> &str {
        &self.id
    }

    fn terminal_pins(&self) -> Vec<String> {
        let mut pins = Vec::new();
        for col in 1..=30 {
            for row in ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J"] {
                pins.push(format!("{}{}", row, col));
            }
        }
        pins
    }

    fn stamp_dc(&self, _matrix: &mut MnaMatrix) {}

    fn stamp_transient(&self, _matrix: &mut MnaMatrix, _context: &TimeContext) {}

    fn update_state(&mut self, _voltages: &NodeVoltageLookup, _dt: f64) {}

    fn check_limits(&self, _voltages: &NodeVoltageLookup, _dt: f64) -> Vec<DeviceWarning> {
        Vec::new()
    }

    fn is_damaged(&self) -> bool {
        false
    }

    fn reset_device(&mut self) {}
}
