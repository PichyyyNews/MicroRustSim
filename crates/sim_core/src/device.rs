//! Central Circuit Device Interface and MNA Matrix abstractions (device.rs)
//!
//! Conforms to Section 7 of docs/PHYSICS_SPEC.md.
//! Provides the unified CircuitDevice trait for pluggable components, MnaMatrix for
//! simultaneous nodal voltage and branch current formulation, and numerical integration contexts.

use std::collections::HashMap;
use serde::{Deserialize, Serialize};

use crate::constants::G_MIN_DEFAULT;

/// Numerical integration method for time-domain companion models
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum IntegrationMethod {
    /// Second-order Trapezoidal rule: O(dt^2) accuracy
    Trapezoidal,
    /// First-order Backward Euler: L-stable, used for gear-switching at discontinuities
    BackwardEuler,
    /// Second-order Backward Differentiation Formula: L-stable
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
