//! MicroRustSim: MCU Core Electrical Interface & Hardware Models (mcu.rs)
//!
//! Provides hardware-accurate electrical specifications and state tracking for
//! the ATmega328P microcontroller on the Arduino Uno R3:
//! - Digital input Schmitt trigger hysteresis model (V_IL <= 0.3*Vcc, V_IH >= 0.6*Vcc)
//! - 10-bit Successive Approximation ADC electrical coupling and dynamic Vref tracking
//! - Authentic time-domain PWM frequency and phase calculations for Timer 0/1/2
//! - Absolute maximum electrical ratings and overcurrent protection thresholds
//!
//! Conforms to docs/PHYSICS_SPEC.md §5.1–§5.5 and ORIGINAL_REQUEST.md §R4.

use std::collections::HashMap;
use serde::{Deserialize, Serialize};
use crate::constants::*;

/// Digital input Schmitt trigger state machine for an ATmega328P I/O pin.
///
/// Implements genuine hysteresis behavior:
/// - Falling threshold: V_IL = 0.30 * Vcc (~1.50V at 5.0V Vcc)
/// - Rising threshold:  V_IH = 0.60 * Vcc (~3.00V at 5.0V Vcc)
/// - Hysteresis band:   Delta V_hyst = V_IH - V_IL = 0.30 * Vcc (~1.50V)
///
/// In the hysteresis band (V_IL < V_pin < V_IH), the pin maintains its previous
/// logic state, preventing spurious digital transitions and glitching from slow
/// analog transitions or noise.
#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub struct SchmittTrigger {
    /// Current registered digital input bit state (true = HIGH, false = LOW).
    pub state: bool,
    /// Time in seconds that the pin has continuously dwelled in the indeterminate region.
    pub indeterminate_dwell_s: f64,
}

impl Default for SchmittTrigger {
    fn default() -> Self {
        Self {
            state: false,
            indeterminate_dwell_s: 0.0,
        }
    }
}

impl SchmittTrigger {
    /// Create a new Schmitt trigger with an initial digital state.
    pub fn new(initial_high: bool) -> Self {
        Self {
            state: initial_high,
            indeterminate_dwell_s: 0.0,
        }
    }

    /// Evaluates input pin voltage against Vcc thresholds with hysteresis.
    ///
    /// Returns a tuple of:
    /// - `bool`: updated digital logic level (true = HIGH, false = LOW)
    /// - `bool`: true if the voltage is currently dwelling in the indeterminate band (V_IL < V < V_IH)
    pub fn update(&mut self, voltage: f32, vcc: f32, dt: f64) -> (bool, bool) {
        let v_ih = vcc * V_SCHMITT_VIH_FRAC as f32; // 0.60 * Vcc (~3.00V at 5.0V)
        let v_il = vcc * V_SCHMITT_VIL_FRAC as f32; // 0.30 * Vcc (~1.50V at 5.0V)

        let in_indeterminate_band = voltage > v_il && voltage < v_ih;

        if in_indeterminate_band {
            self.indeterminate_dwell_s += dt;
        } else {
            self.indeterminate_dwell_s = 0.0;
        }

        if voltage >= v_ih {
            self.state = true;
        } else if voltage <= v_il {
            self.state = false;
        }
        // If in indeterminate band, self.state is retained unchanged.

        (self.state, in_indeterminate_band)
    }

    /// Returns whether the pin has dwelled in the indeterminate region long enough
    /// to warrant a metastability warning (> 100 ms per PHYSICS_SPEC.md §5.2).
    pub fn is_metastable_warning(&self) -> bool {
        self.indeterminate_dwell_s >= 0.100
    }
}

/// Helper to determine the authentic ATmega328P hardware timer PWM frequency in Hz for a pin.
///
/// On Arduino Uno R3:
/// - Pins 5 and 6: Timer 0 (Fast PWM mode) -> 976.5625 Hz (~976.6 Hz)
/// - Pins 3, 9, 10, 11: Timer 1 & 2 (Phase-Correct PWM mode) -> 490.196 Hz (~490.2 Hz)
pub fn atmega328p_pwm_frequency(pin_name: &str) -> f64 {
    match pin_name {
        "5" | "6" => 976.5625,
        "3" | "9" | "10" | "11" => 490.196,
        _ => 490.196,
    }
}

/// Evaluates whether a PWM signal is currently in the HIGH phase at simulation time `t`.
///
/// Models true time-domain square wave switching between 5V (PMOS) and GND (NMOS).
pub fn evaluate_time_domain_pwm(t: f64, duty: u8, freq_hz: f64) -> bool {
    if duty == 0 {
        return false;
    }
    if duty == 255 {
        return true;
    }
    let f = if freq_hz > 0.0 { freq_hz } else { 490.196 };
    let period = 1.0 / f;
    let phase = (t % period + period) % period;
    let duty_ratio = (duty as f64) / 255.0;
    let t_high = duty_ratio * period;

    phase < t_high
}

/// 10-bit Successive Approximation ADC helper for converting analog input voltage to ADC code.
///
/// ADC Code = min(1023, max(0, floor(V_in / V_ref * 1024)))
pub fn calculate_adc_code(v_in: f64, v_ref: f64) -> u16 {
    let ref_voltage = v_ref.max(0.1);
    let ratio = (v_in / ref_voltage).clamp(0.0, 1.0);
    let code = (ratio * 1024.0).floor() as u16;
    code.min(1023)
}

/// Evaluates sample-and-hold charge sharing error for a source resistance R_src.
///
/// With C_sh ≈ 14 pF and t_sample ≈ 12 µs:
/// If R_src > 10 kΩ without external bypass capacitance, the charge sharing error causes
/// reading divergence, which is eliminated by adding an external buffer capacitor (>= 100 nF).
pub fn adc_sample_and_hold_voltage_drop(v_in: f64, r_src: f64, c_ext: f64) -> f64 {
    let c_sh = C_ADC_SAMPLE_HOLD; // 14 pF
    let r_mux = 2000.0; // 2 kΩ internal analog MUX switch resistance
    let t_sample = 1.5e-6; // 1.5 µs sampling time window (ATmega328P Table 24-1)
    let r_eff = (r_src + r_mux).max(1.0);

    if c_ext >= 1.0e-8 {
        // External buffer capacitor (>= 10 nF) supplies charge buffer
        let delta_v = v_in * (c_sh / (c_ext + c_sh));
        v_in - delta_v
    } else {
        // High impedance source without buffer: exponential settling error within 1.5µs
        let tau = r_eff * c_sh;
        v_in * (1.0 - (-t_sample / tau).exp())
    }
}

/// Registry of Schmitt triggers for all I/O pins of an MCU.
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct McuPinRegisterBank {
    pub triggers: HashMap<String, SchmittTrigger>,
}

impl McuPinRegisterBank {
    pub fn new() -> Self {
        Self {
            triggers: HashMap::new(),
        }
    }

    pub fn get_digital_input(&self, pin_name: &str) -> bool {
        self.triggers.get(pin_name).map(|st| st.state).unwrap_or(false)
    }

    pub fn set_digital_input(&mut self, pin_name: &str, high: bool) {
        let entry = self.triggers.entry(pin_name.to_string()).or_insert_with(|| SchmittTrigger::new(high));
        entry.state = high;
        entry.indeterminate_dwell_s = 0.0;
    }

    pub fn update_pin_voltage(&mut self, pin_name: &str, voltage: f32, vcc: f32, dt: f64) -> (bool, bool) {
        let entry = self.triggers.entry(pin_name.to_string()).or_default();
        entry.update(voltage, vcc, dt)
    }

    pub fn clear(&mut self) {
        self.triggers.clear();
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_schmitt_trigger_hysteresis_transitions() {
        let mut st = SchmittTrigger::new(false);
        let vcc = 5.0f32;
        let dt = 0.016;

        // 1. Initial LOW: 0V -> remains LOW
        let (state, indeterminate) = st.update(0.0, vcc, dt);
        assert!(!state);
        assert!(!indeterminate);

        // 2. Voltage rises into hysteresis band (2.0V): between 1.5V and 3.0V
        // Must retain previous state (LOW)
        let (state, indeterminate) = st.update(2.0, vcc, dt);
        assert!(!state, "Must retain previous LOW state in hysteresis band");
        assert!(indeterminate);

        // 3. Voltage crosses rising threshold (3.1V >= 0.60 * 5.0 = 3.0V) -> transitions to HIGH
        let (state, indeterminate) = st.update(3.1, vcc, dt);
        assert!(state, "Must transition to HIGH above VIH");
        assert!(!indeterminate);

        // 4. Voltage drops into hysteresis band (2.2V): between 1.5V and 3.0V
        // Must retain previous state (HIGH)
        let (state, indeterminate) = st.update(2.2, vcc, dt);
        assert!(state, "Must retain previous HIGH state in hysteresis band");
        assert!(indeterminate);

        // 5. Voltage drops below falling threshold (1.4V <= 0.30 * 5.0 = 1.5V) -> transitions to LOW
        let (state, indeterminate) = st.update(1.4, vcc, dt);
        assert!(!state, "Must transition to LOW below VIL");
        assert!(!indeterminate);
    }

    #[test]
    fn test_schmitt_trigger_indeterminate_dwell_metastability() {
        let mut st = SchmittTrigger::new(false);
        let vcc = 5.0f32;

        // Dwell in indeterminate region (2.5V) for 90ms (< 100ms warning threshold)
        for _ in 0..9 {
            st.update(2.5, vcc, 0.010);
        }
        assert!(!st.is_metastable_warning());

        // Dwell exceeds 100ms
        st.update(2.5, vcc, 0.015);
        assert!(st.is_metastable_warning(), "Must flag warning after >100ms indeterminate dwell");

        // Step out of indeterminate band -> dwell timer resets
        st.update(4.0, vcc, 0.010);
        assert!(!st.is_metastable_warning());
        assert_eq!(st.indeterminate_dwell_s, 0.0);
    }

    #[test]
    fn test_atmega328p_pwm_frequencies() {
        assert_eq!(atmega328p_pwm_frequency("5"), 976.5625);
        assert_eq!(atmega328p_pwm_frequency("6"), 976.5625);
        assert_eq!(atmega328p_pwm_frequency("3"), 490.196);
        assert_eq!(atmega328p_pwm_frequency("9"), 490.196);
        assert_eq!(atmega328p_pwm_frequency("10"), 490.196);
        assert_eq!(atmega328p_pwm_frequency("11"), 490.196);
    }

    #[test]
    fn test_time_domain_pwm_evaluation() {
        let f = 490.196;
        let period = 1.0 / f;

        // 0% duty is always LOW
        assert!(!evaluate_time_domain_pwm(0.0, 0, f));
        assert!(!evaluate_time_domain_pwm(period * 0.5, 0, f));

        // 100% duty is always HIGH
        assert!(evaluate_time_domain_pwm(0.0, 255, f));
        assert!(evaluate_time_domain_pwm(period * 0.5, 255, f));

        // 50% duty (duty = 128): HIGH during first half, LOW during second half
        assert!(evaluate_time_domain_pwm(period * 0.1, 128, f));
        assert!(evaluate_time_domain_pwm(period * 0.45, 128, f));
        assert!(!evaluate_time_domain_pwm(period * 0.55, 128, f));
        assert!(!evaluate_time_domain_pwm(period * 0.9, 128, f));
    }

    #[test]
    fn test_adc_code_and_dynamic_vref_tracking() {
        // Full scale
        assert_eq!(calculate_adc_code(5.0, 5.0), 1023);
        // Zero
        assert_eq!(calculate_adc_code(0.0, 5.0), 0);
        // Half scale nominal
        let code_nom = calculate_adc_code(2.5, 5.0);
        assert_eq!(code_nom, 512);

        // When 5V rail experiences sag to 4.5V, 2.5V input yields higher ADC code
        let code_sag = calculate_adc_code(2.5, 4.5);
        assert_eq!(code_sag, 568);
        assert!(code_sag > code_nom, "ADC code must increase under power rail sag (genuine physical Vref binding)");
    }

    #[test]
    fn test_adc_sample_and_hold_charge_sharing_buffer() {
        let v_in = 5.0;
        let r_high = 100_000.0; // 100 kΩ source impedance (> 10k max spec)

        // Without external buffer capacitor
        let v_unbuffered = adc_sample_and_hold_voltage_drop(v_in, r_high, 0.0);
        // With 100 nF external buffer capacitor
        let v_buffered = adc_sample_and_hold_voltage_drop(v_in, r_high, 100e-9);

        assert!(v_unbuffered < 4.90, "Unbuffered 100k source must exhibit S/H settling error: got {:.4}V", v_unbuffered);
        assert!(v_buffered >= 4.99, "Buffered 100nF source must eliminate charge sharing error: got {:.4}V", v_buffered);
    }

    #[test]
    fn test_mcu_pin_register_bank() {
        let mut rb = McuPinRegisterBank::new();
        assert!(!rb.get_digital_input("2"));

        rb.set_digital_input("2", true);
        assert!(rb.get_digital_input("2"));

        let (high, _) = rb.update_pin_voltage("2", 0.5, 5.0, 0.016);
        assert!(!high);
        assert!(!rb.get_digital_input("2"));

        rb.clear();
        assert!(!rb.get_digital_input("2"));
    }

    #[test]
    fn test_package_vcc_total_overcurrent_fault() {
        use crate::{SimulationEngine, components::ResistorComponent, Wire, PinId, LogicState};
        let mut engine = SimulationEngine::new_with_uno();

        // Configure 6 pins sourcing ~35mA each (total ~210mA > 200mA limit)
        for i in 2..=7 {
            let pin_str = i.to_string();
            let res_id = format!("r_{}", i);
            engine.mcu.set_pin_override(&pin_str, LogicState::High);
            engine.resistors.insert(res_id.clone(), ResistorComponent::new(&res_id, 120.0));

            engine.add_wire(Wire {
                id: format!("w_{}_a", i),
                from: PinId::new("uno1", &pin_str),
                to: PinId::new(&res_id, "1"),
                color: "#ef4444".into(),
            });
            engine.add_wire(Wire {
                id: format!("w_{}_b", i),
                from: PinId::new(&res_id, "2"),
                to: PinId::new("uno1", "GND"),
                color: "#000000".into(),
            });
        }

        engine.resolve_electrical_nets();

        let has_vcc_fault = engine.faults.iter().any(|f| {
            f.fault_type == crate::solver::FaultType::Overcurrent
                && f.component_id == "uno1"
                && f.pin_name == "VCC"
        });

        assert!(
            has_vcc_fault,
            "Must report Package VCC Overcurrent when total GPIO sourced current exceeds 200mA (faults: {:?})",
            engine.faults
        );
    }
}
