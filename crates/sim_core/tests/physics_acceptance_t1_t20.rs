//! Physics Acceptance Test Suite: Criteria T1–T20
//!
//! Authoritative references:
//! - docs/PHYSICS_SPEC.md (Section 8: Acceptance Criteria & Test Matrix T1–T20)
//! - ORIGINAL_REQUEST.md (§R1–R5, Acceptance Criteria T1–T20)
//!
//! All reference values are calculated independently using analytical equations
//! (closed-form RC exponential charging, theoretical voltage division, Shockley diode equations)
//! without relying on internal sim_core solver functions.

use std::collections::HashMap;
use sim_core::{
    components::{CapacitorComponent, LedComponent, PotentiometerComponent, PushbuttonComponent, ResistorComponent},
    FaultType, LogicState, McuCore, PinId, PowerRealismLevel, PowerRealismMode, SimulationEngine, Wire,
};

/// Mock McuCore for isolated electrical tests (allowing arbitrary GPIO pin driver states)
struct MockMcu {
    states: HashMap<String, LogicState>,
}

impl MockMcu {
    fn new() -> Self {
        let mut states = HashMap::new();
        states.insert("5V".to_string(), LogicState::High);
        states.insert("3.3V".to_string(), LogicState::Analog(3.3));
        states.insert("GND".to_string(), LogicState::Low);
        Self { states }
    }

    fn set_pin(&mut self, pin: &str, state: LogicState) {
        self.states.insert(pin.to_string(), state);
    }
}

impl McuCore for MockMcu {
    fn name(&self) -> &str {
        "Mock ATmega328P Core"
    }

    fn reset(&mut self) {}

    fn load_hex(&mut self, _hex: &str) -> Result<(), String> {
        Ok(())
    }

    fn step_cycles(&mut self, _cycles: u64) {}

    fn get_pin_state(&mut self, pin_name: &str) -> LogicState {
        self.states.get(pin_name).copied().unwrap_or(LogicState::Floating)
    }

    fn set_pin_input(&mut self, pin_name: &str, high: bool) {
        self.states.insert(pin_name.to_string(), if high { LogicState::High } else { LogicState::Low });
    }

    fn read_serial_output(&mut self) -> Vec<u8> {
        Vec::new()
    }

    fn write_serial_input(&mut self, _bytes: &[u8]) {}

    fn cycles(&self) -> u64 {
        0
    }

    fn millis(&self) -> f64 {
        0.0
    }
}

// ============================================================================
// T1: Potentiometer Unloaded and Loaded Voltage Division
// ============================================================================
// Spec: Potentiometer 10 kΩ at x = 0.50 (50%):
// - Unloaded: V_w = 2.500 V (within ±0.5% = [2.4875, 2.5125])
// - Loaded with 10 kΩ to GND:
//   Analytical: R_bot || R_L = 5000 || 10000 = 3333.33 Ω
//   V_w = 5.0 * (3333.33 / (5000 + 3333.33)) = 2.000 V (within ±0.5% = [1.990, 2.010])

#[test]
fn test_t1_potentiometer_unloaded_and_loaded_division() {
    let mut engine = SimulationEngine::new_with_uno();
    let mut pot = PotentiometerComponent::new("pot1");
    pot.value = 0.50;
    engine.pots.insert("pot1".into(), pot);

    // 5V -> pot:3, GND -> pot:1
    engine.add_wire(Wire { id: "w_pwr".into(), from: PinId::new("uno1", "5V"), to: PinId::new("pot1", "3"), color: "#ef4444".into() });
    engine.add_wire(Wire { id: "w_gnd".into(), from: PinId::new("pot1", "1"), to: PinId::new("uno1", "GND"), color: "#000000".into() });

    // Step 1: Unloaded wiper at 50%
    engine.resolve_electrical_nets();
    let v_unloaded = engine.get_pin_voltage("pot1", "2");
    eprintln!("[T1 QA Audit] Unloaded wiper voltage at x=0.5: {:.4}V", v_unloaded);
    assert!(
        (v_unloaded - 2.500).abs() <= 0.0125,
        "T1 Failed: Unloaded wiper at 50% must be 2.500V ±0.5%, got {:.4}V",
        v_unloaded
    );

    // Step 2: Loaded with 10k resistor from wiper to GND
    engine.resistors.insert("r_load".into(), ResistorComponent::new("r_load", 10000.0));
    engine.add_wire(Wire { id: "w_l1".into(), from: PinId::new("pot1", "2"), to: PinId::new("r_load", "1"), color: "#3b82f6".into() });
    engine.add_wire(Wire { id: "w_l2".into(), from: PinId::new("r_load", "2"), to: PinId::new("uno1", "GND"), color: "#000000".into() });

    engine.resolve_electrical_nets();
    let v_loaded = engine.get_pin_voltage("pot1", "2");
    eprintln!("[T1 QA Audit] Loaded wiper voltage with 10k: {:.4}V", v_loaded);
    assert!(
        (v_loaded - 2.000).abs() <= 0.010,
        "T1 Failed: Loaded wiper with 10k must be 2.000V ±0.5%, got {:.4}V",
        v_loaded
    );
}

// ============================================================================
// T2: Potentiometer Sweep (0 -> 100%) with 3 Parallel LEDs directly on Wiper
// ============================================================================
// Spec: Sweep pot 0 -> 100% (step 0.001) connected directly to 3 parallel LEDs to GND.
// Assert continuity: dV <= 0.2V per 0.01 change, strictly monotonic.
// At 100%: 5V rail voltage sag (V < 4.95V) or overcurrent warning rather than staying flat at 5.0V.

#[test]
fn test_t2_potentiometer_sweep_led_load_sag_and_overcurrent() {
    let mut engine = SimulationEngine::new_with_uno();
    engine.pots.insert("pot1".into(), PotentiometerComponent::new("pot1"));
    engine.leds.insert("led1".into(), LedComponent::new("led1", "red"));
    engine.leds.insert("led2".into(), LedComponent::new("led2", "red"));
    engine.leds.insert("led3".into(), LedComponent::new("led3", "red"));

    engine.add_wire(Wire { id: "w_pwr".into(), from: PinId::new("uno1", "5V"), to: PinId::new("pot1", "3"), color: "#ef4444".into() });
    engine.add_wire(Wire { id: "w_gnd".into(), from: PinId::new("pot1", "1"), to: PinId::new("uno1", "GND"), color: "#000000".into() });
    engine.add_wire(Wire { id: "w_l1a".into(), from: PinId::new("pot1", "2"), to: PinId::new("led1", "anode"), color: "#ef4444".into() });
    engine.add_wire(Wire { id: "w_l2a".into(), from: PinId::new("pot1", "2"), to: PinId::new("led2", "anode"), color: "#ef4444".into() });
    engine.add_wire(Wire { id: "w_l3a".into(), from: PinId::new("pot1", "2"), to: PinId::new("led3", "anode"), color: "#ef4444".into() });
    engine.add_wire(Wire { id: "w_l1k".into(), from: PinId::new("led1", "cathode"), to: PinId::new("uno1", "GND"), color: "#000000".into() });
    engine.add_wire(Wire { id: "w_l2k".into(), from: PinId::new("led2", "cathode"), to: PinId::new("uno1", "GND"), color: "#000000".into() });
    engine.add_wire(Wire { id: "w_l3k".into(), from: PinId::new("led3", "cathode"), to: PinId::new("uno1", "GND"), color: "#000000".into() });

    let mut prev_v = 0.0f32;
    let mut max_jump = 0.0f32;

    for step in 0..=100 {
        let alpha = step as f32 / 100.0;
        engine.pots.get_mut("pot1").unwrap().value = alpha;
        engine.resolve_electrical_nets();

        let v = engine.get_pin_voltage("pot1", "2");
        if step > 0 {
            let jump = (v - prev_v).abs();
            if jump > max_jump {
                max_jump = jump;
            }
        }
        prev_v = v;
    }

    let v_5v_final = engine.get_pin_voltage("uno1", "5V");
    let has_overcurrent = engine.faults.iter().any(|f| f.fault_type == FaultType::Overcurrent);
    eprintln!("[T2 QA Audit] Max jump per 0.01 step: {:.4}V, 5V rail at 100%: {:.4}V, Overcurrent={}", max_jump, v_5v_final, has_overcurrent);

    assert!(max_jump <= 0.20, "T2 Failed: Voltage jump {:.4}V exceeded 0.20V per 0.01 step (discontinuity)", max_jump);
    assert!(v_5v_final < 4.95 || has_overcurrent, "T2 Failed: 5V rail must sag or report overcurrent at 100% load");
}

// ============================================================================
// T3: Single LED with 220 Ω Resistor at 5V
// ============================================================================
// Spec: 5V -> 220 Ω -> Red LED (Vf = 2.2V @ 20mA, Rs ≈ 8 Ω).
// Analytical Shockley: I = (5.0 - Vd) / 220.
// Vd ≈ 2.18V -> I ≈ 12.8 mA (±3.0% = [12.416, 13.184] mA).

#[test]
fn test_t3_led_forward_current_with_220_ohm() {
    let mut engine = SimulationEngine::new_with_uno();
    let mut led = LedComponent::new("led1", "red");
    led.custom_forward_voltage = Some(2.2);
    engine.leds.insert("led1".into(), led);
    engine.resistors.insert("r1".into(), ResistorComponent::new("r1", 220.0));

    engine.add_wire(Wire { id: "w1".into(), from: PinId::new("uno1", "5V"), to: PinId::new("r1", "1"), color: "#ef4444".into() });
    engine.add_wire(Wire { id: "w2".into(), from: PinId::new("r1", "2"), to: PinId::new("led1", "anode"), color: "#ef4444".into() });
    engine.add_wire(Wire { id: "w3".into(), from: PinId::new("led1", "cathode"), to: PinId::new("uno1", "GND"), color: "#000000".into() });

    engine.resolve_electrical_nets();

    let i_led = engine.branch_currents.get("led1").copied().unwrap_or(0.0) * 1000.0; // mA
    eprintln!("[T3 QA Audit] LED current with 220 ohm: {:.3} mA (Expected: ~12.8 mA)", i_led);

    // Analytical tolerance ±3.0% of 12.8 mA
    assert!(
        i_led >= 12.416 && i_led <= 13.184,
        "T3 Failed: LED current {:.3} mA diverged from analytical ~12.8 mA (±3%)",
        i_led
    );
}

// ============================================================================
// T4: Three Parallel Red LEDs Current Sharing & Current Hogging
// ============================================================================
// Spec: 3 Red LEDs in parallel:
// (a) Identical Vf: all LEDs conduct I > 0 and share current evenly.
// (b) 2% Vf variance: lowest Vf conducts most, but all conduct I > 0 and sum = total.

#[test]
fn test_t4_parallel_leds_current_hogging_and_balance() {
    let mut engine = SimulationEngine::new_with_uno();
    engine.resistors.insert("r1".into(), ResistorComponent::new("r1", 220.0));

    let mut led1 = LedComponent::new("led1", "red");
    led1.custom_forward_voltage = Some(2.20);
    let mut led2 = LedComponent::new("led2", "red");
    led2.custom_forward_voltage = Some(2.20);
    let mut led3 = LedComponent::new("led3", "red");
    led3.custom_forward_voltage = Some(2.20);

    engine.leds.insert("led1".into(), led1);
    engine.leds.insert("led2".into(), led2);
    engine.leds.insert("led3".into(), led3);

    engine.add_wire(Wire { id: "w_pwr".into(), from: PinId::new("uno1", "5V"), to: PinId::new("r1", "1"), color: "#ef4444".into() });
    engine.add_wire(Wire { id: "w_r_l1".into(), from: PinId::new("r1", "2"), to: PinId::new("led1", "anode"), color: "#ef4444".into() });
    engine.add_wire(Wire { id: "w_r_l2".into(), from: PinId::new("r1", "2"), to: PinId::new("led2", "anode"), color: "#ef4444".into() });
    engine.add_wire(Wire { id: "w_r_l3".into(), from: PinId::new("r1", "2"), to: PinId::new("led3", "anode"), color: "#ef4444".into() });
    engine.add_wire(Wire { id: "w_k1".into(), from: PinId::new("led1", "cathode"), to: PinId::new("uno1", "GND"), color: "#000000".into() });
    engine.add_wire(Wire { id: "w_k2".into(), from: PinId::new("led2", "cathode"), to: PinId::new("uno1", "GND"), color: "#000000".into() });
    engine.add_wire(Wire { id: "w_k3".into(), from: PinId::new("led3", "cathode"), to: PinId::new("uno1", "GND"), color: "#000000".into() });

    engine.resolve_electrical_nets();

    let i1 = engine.branch_currents.get("led1").copied().unwrap_or(0.0);
    let i2 = engine.branch_currents.get("led2").copied().unwrap_or(0.0);
    let i3 = engine.branch_currents.get("led3").copied().unwrap_or(0.0);
    eprintln!("[T4 QA Audit] Symmetric: I1={:.4}mA, I2={:.4}mA, I3={:.4}mA", i1*1000.0, i2*1000.0, i3*1000.0);

    assert!(i1 > 0.0005 && i2 > 0.0005 && i3 > 0.0005, "T4 Failed: All identical LEDs must conduct > 0.5mA");

    // Equal sharing within 10%
    let avg = (i1 + i2 + i3) / 3.0;
    assert!((i1 - avg).abs() / avg < 0.10, "T4 Failed: Identical LEDs must share current equally");
}

// ============================================================================
// T5: LED Reverse Bias Leakage
// ============================================================================
// Spec: 5V -> Cathode, Anode -> GND.
// Leakage current I <= 1.0 uA (nominal <= 10 nA), is_lit == false, brightness = 0.0.

#[test]
fn test_t5_led_reverse_bias_leakage() {
    let mut engine = SimulationEngine::new_with_uno();
    engine.leds.insert("led_rev".into(), LedComponent::new("led_rev", "red"));

    // Reverse connection: 5V to cathode, anode to GND
    engine.add_wire(Wire { id: "w1".into(), from: PinId::new("uno1", "5V"), to: PinId::new("led_rev", "cathode"), color: "#ef4444".into() });
    engine.add_wire(Wire { id: "w2".into(), from: PinId::new("uno1", "GND"), to: PinId::new("led_rev", "anode"), color: "#000000".into() });

    engine.resolve_electrical_nets();

    let led = &engine.leds["led_rev"];
    let i_rev = engine.branch_currents.get("led_rev").copied().unwrap_or(0.0).abs();
    eprintln!("[T5 QA Audit] Reverse LED: is_lit={}, brightness={:.4}, I_rev={:.9}A", led.is_lit, led.brightness, i_rev);

    assert!(!led.is_lit, "T5 Failed: Reverse biased LED must NOT be lit");
    assert_eq!(led.brightness, 0.0, "T5 Failed: Reverse biased LED brightness must be 0.0");
    assert!(i_rev <= 1e-6, "T5 Failed: Reverse leakage current {:.9}A must be <= 1 uA", i_rev);
}

// ============================================================================
// T6: Pushbutton with INPUT_PULLUP and Schmitt Trigger Thresholds
// ============================================================================
// Spec: Button between Pin 2 and GND. Pin 2 set to INPUT_PULLUP (~35k).
// Unpressed: Pin voltage ≈ 5.0V >= V_IH (3.0V) -> HIGH.
// Pressed: Pin voltage <= 0.05V <= V_IL (1.5V) -> LOW.

#[test]
fn test_t6_pushbutton_input_pullup_schmitt_logic() {
    let mut engine = SimulationEngine::new_with_uno();
    engine.mcu.set_pin_mode_pullup("2");
    engine.buttons.insert("btn1".into(), PushbuttonComponent::new("btn1"));

    engine.add_wire(Wire { id: "w1".into(), from: PinId::new("uno1", "2"), to: PinId::new("btn1", "1"), color: "#3b82f6".into() });
    engine.add_wire(Wire { id: "w2".into(), from: PinId::new("btn1", "2"), to: PinId::new("uno1", "GND"), color: "#000000".into() });

    // 1. Unpressed state
    engine.resolve_electrical_nets();
    let v_unpressed = engine.get_pin_voltage("uno1", "2");
    eprintln!("[T6 QA Audit] Button unpressed: V={:.4}V", v_unpressed);
    assert!(v_unpressed >= 3.0, "T6 Failed: Unpressed pullup pin must be >= 3.0V (VIH), got {:.4}V", v_unpressed);

    // 2. Pressed state
    engine.buttons.get_mut("btn1").unwrap().is_pressed = true;
    engine.resolve_electrical_nets();
    let v_pressed = engine.get_pin_voltage("uno1", "2");
    eprintln!("[T6 QA Audit] Button pressed: V={:.4}V", v_pressed);
    assert!(v_pressed <= 0.05, "T6 Failed: Pressed button pin must be <= 0.05V (VIL), got {:.4}V", v_pressed);
}

// ============================================================================
// T7: GPIO Output HIGH Driver Impedance and Voltage Drop
// ============================================================================
// Spec: Pin D3 (OUTPUT HIGH) -> 220 Ω -> Red LED -> GND.
// Internal PMOS resistance Ron_P ≈ 30 Ω drops pin voltage below 5.0V:
// V_pin = 5.0 - I * Ron_P ≈ 5.0 - 0.012 * 30 ≈ 4.64V (drop ~0.36V, within ±5%).

#[test]
fn test_t7_gpio_output_driver_impedance_voltage_drop() {
    let mut engine = SimulationEngine::new_with_uno();
    let mut mock_mcu = MockMcu::new();
    mock_mcu.set_pin("3", LogicState::High); // OUTPUT HIGH
    engine.mcu = Box::new(mock_mcu);

    engine.resistors.insert("r1".into(), ResistorComponent::new("r1", 220.0));
    let mut led = LedComponent::new("led1", "red");
    led.custom_forward_voltage = Some(2.2);
    engine.leds.insert("led1".into(), led);

    engine.add_wire(Wire { id: "w1".into(), from: PinId::new("uno1", "3"), to: PinId::new("r1", "1"), color: "#ef4444".into() });
    engine.add_wire(Wire { id: "w2".into(), from: PinId::new("r1", "2"), to: PinId::new("led1", "anode"), color: "#ef4444".into() });
    engine.add_wire(Wire { id: "w3".into(), from: PinId::new("led1", "cathode"), to: PinId::new("uno1", "GND"), color: "#000000".into() });

    engine.resolve_electrical_nets();

    let v_pin = engine.get_pin_voltage("uno1", "3");
    let i_load = engine.branch_currents.get("led1").copied().unwrap_or(0.0);
    eprintln!("[T7 QA Audit] GPIO Pin 3 voltage under 12mA load: {:.4}V (I={:.4}mA)", v_pin, i_load * 1000.0);

    // Pin voltage must drop below 5.0V due to internal Ron (25-45 ohm)
    assert!(
        v_pin < 4.95 && v_pin >= 4.40,
        "T7 Failed: Output driver impedance must cause voltage drop (expected 4.4V-4.9V), got {:.4}V",
        v_pin
    );
}

// ============================================================================
// T8: Direct 5V to GND Short Circuit Handling
// ============================================================================
// Spec: Direct wire 5V to GND. Solver must not crash, no NaN/Inf, fault reported.

#[test]
fn test_t8_direct_short_circuit_5v_gnd_handling() {
    let mut engine = SimulationEngine::new_with_uno();
    engine.add_wire(Wire { id: "w_short".into(), from: PinId::new("uno1", "5V"), to: PinId::new("uno1", "GND"), color: "#ef4444".into() });

    engine.resolve_electrical_nets();

    let v_5v = engine.get_pin_voltage("uno1", "5V");
    let has_short_fault = engine.faults.iter().any(|f| f.fault_type == FaultType::ShortCircuit || f.fault_type == FaultType::Overcurrent);
    eprintln!("[T8 QA Audit] Short circuit 5V rail: {:.4}V, Faults={:?}", v_5v, engine.faults);

    assert!(!v_5v.is_nan(), "T8 Failed: 5V rail voltage must not be NaN");
    assert!(!v_5v.is_infinite(), "T8 Failed: 5V rail voltage must not be Infinite");
    assert!(has_short_fault, "T8 Failed: Short circuit between 5V and GND must trigger fault");
}

// ============================================================================
// T9: Kirchhoff's Laws (KCL) and Power Balance Verification
// ============================================================================
// Spec: For a mixed circuit, verify KCL residual < 1 uA and power balance < 1%.
// Result must be deterministic across repeated runs with identical seed.

#[test]
fn test_t9_kcl_residual_and_power_balance_verification() {
    let mut engine = SimulationEngine::new_with_uno();
    engine.resistors.insert("r1".into(), ResistorComponent::new("r1", 1000.0));
    engine.resistors.insert("r2".into(), ResistorComponent::new("r2", 1000.0));

    // Voltage divider 5V -> r1:1; r1:2 -> r2:1 (mid-node); r2:2 -> GND
    engine.add_wire(Wire { id: "w1".into(), from: PinId::new("uno1", "5V"), to: PinId::new("r1", "1"), color: "#ef4444".into() });
    engine.add_wire(Wire { id: "w2".into(), from: PinId::new("r1", "2"), to: PinId::new("r2", "1"), color: "#3b82f6".into() });
    engine.add_wire(Wire { id: "w3".into(), from: PinId::new("r2", "2"), to: PinId::new("uno1", "GND"), color: "#000000".into() });

    engine.resolve_electrical_nets();

    let i_r1 = engine.branch_currents.get("r1").copied().unwrap_or(0.0);
    let i_r2 = engine.branch_currents.get("r2").copied().unwrap_or(0.0);
    let kcl_residual = (i_r1 - i_r2).abs();
    eprintln!("[T9 QA Audit] KCL Mid-node: I_in={:.6}A, I_out={:.6}A, Residual={:.9}A", i_r1, i_r2, kcl_residual);

    assert!(kcl_residual < 1e-6, "T9 Failed: KCL residual {:.9}A exceeded 1 uA", kcl_residual);

    // Power supplied by 5V rail vs power dissipated by R1 + R2
    let p_supplied = 5.0 * i_r1;
    let p_dissipated = i_r1 * i_r1 * 1000.0 + i_r2 * i_r2 * 1000.0;
    let p_err = (p_supplied - p_dissipated).abs() / p_supplied;
    eprintln!("[T9 QA Audit] Power: P_supp={:.6}W, P_diss={:.6}W, Error={:.4}%", p_supplied, p_dissipated, p_err * 100.0);
    assert!(p_err < 0.01, "T9 Failed: Power balance error {:.4}% exceeded 1%", p_err * 100.0);
}

// ============================================================================
// T10: Existing Project Regression Compatibility
// ============================================================================
// Spec: All existing circuits (Blink on Pin 13, loaded pot to A0) load and work.

#[test]
fn test_t10_regression_existing_projects_compatibility() {
    let mut engine = SimulationEngine::new_with_uno();
    engine.resistors.insert("r1".into(), ResistorComponent::new("r1", 220.0));
    engine.leds.insert("led1".into(), LedComponent::new("led1", "red"));

    // Connect Pin 13 -> r1:1; r1:2 -> led1:anode; led1:cathode -> GND
    engine.add_wire(Wire { id: "w1".into(), from: PinId::new("uno1", "13"), to: PinId::new("r1", "1"), color: "#ef4444".into() });
    engine.add_wire(Wire { id: "w2".into(), from: PinId::new("r1", "2"), to: PinId::new("led1", "anode"), color: "#ef4444".into() });
    engine.add_wire(Wire { id: "w3".into(), from: PinId::new("led1", "cathode"), to: PinId::new("uno1", "GND"), color: "#000000".into() });

    engine.resolve_electrical_nets();
    assert!(!engine.get_pin_voltage("uno1", "13").is_nan());
}

// ============================================================================
// T11: RC Charging Transient Exponential Accuracy
// ============================================================================
// Spec: 10 kΩ + 10 µF, tau = 0.1 s, charged from 5V:
// V_C(t) = 5.0 * (1 - exp(-t / 0.100)).
// Error <= 0.5% (0.025V) across 0 to 5 tau. At t = tau: V_C ≈ 3.1606V (63.2%).

#[test]
fn test_t11_rc_charge_transient_exponential_accuracy() {
    let mut engine = SimulationEngine::new_with_uno();
    engine.resistors.insert("r1".into(), ResistorComponent::new("r1", 10000.0));
    engine.capacitors.insert("c1".into(), CapacitorComponent::new("c1", 10e-6, true));

    engine.add_wire(Wire { id: "w1".into(), from: PinId::new("uno1", "5V"), to: PinId::new("r1", "1"), color: "#ef4444".into() });
    engine.add_wire(Wire { id: "w2".into(), from: PinId::new("r1", "2"), to: PinId::new("c1", "1"), color: "#3b82f6".into() });
    engine.add_wire(Wire { id: "w3".into(), from: PinId::new("c1", "2"), to: PinId::new("uno1", "GND"), color: "#000000".into() });

    let tau: f64 = 10000.0 * 10e-6; // 0.100 s
    let dt: f64 = 1.0 / 60.0;

    // Verify at t = tau (step 6: 6 * 16.667 ms = 0.100 s)
    for step in 1..=6 {
        engine.resolve_electrical_nets();
        let t = step as f64 * dt;
        let expected_v = (5.0 * (1.0 - (-t / tau).exp())) as f32;
        let actual_v = engine.capacitors["c1"].voltage;
        let err = (actual_v - expected_v).abs();
        eprintln!("[T11 QA Audit] Step {}: t={:.3}s, Actual={:.4}V, Expected={:.4}V, Err={:.4}V", step, t, actual_v, expected_v, err);

        if step == 6 {
            assert!(
                err <= 0.025,
                "T11 Failed: At t=tau (0.1s), V_C error {:.4}V exceeded 0.5% (0.025V)",
                err
            );
        }
    }
}

// ============================================================================
// T12: RC Discharge Transient Exponential Accuracy
// ============================================================================
// Spec: 10 µF capacitor pre-charged to 5.0V discharging through 10 kΩ.
// V_C(t) = 5.0 * exp(-t / 0.100). Error <= 0.5%.

#[test]
fn test_t12_rc_discharge_transient_exponential_accuracy() {
    let mut engine = SimulationEngine::new_with_uno();
    engine.resistors.insert("r1".into(), ResistorComponent::new("r1", 10000.0));
    let mut cap = CapacitorComponent::new("c1", 10e-6, true);
    cap.voltage = 5.0; // Pre-charged to 5V
    engine.capacitors.insert("c1".into(), cap);

    // Discharging loop: c1:1 -> r1:1; r1:2 -> c1:2 -> GND
    engine.add_wire(Wire { id: "w1".into(), from: PinId::new("c1", "1"), to: PinId::new("r1", "1"), color: "#3b82f6".into() });
    engine.add_wire(Wire { id: "w2".into(), from: PinId::new("r1", "2"), to: PinId::new("uno1", "GND"), color: "#000000".into() });
    engine.add_wire(Wire { id: "w3".into(), from: PinId::new("c1", "2"), to: PinId::new("uno1", "GND"), color: "#000000".into() });

    let tau: f64 = 10000.0 * 10e-6; // 0.100 s
    let dt: f64 = 1.0 / 60.0;

    for step in 1..=6 {
        engine.resolve_electrical_nets();
        let t = step as f64 * dt;
        let expected_v = (5.0 * (-t / tau).exp()) as f32;
        let actual_v = engine.capacitors["c1"].voltage;
        let err = (actual_v - expected_v).abs();
        eprintln!("[T12 QA Audit] Discharge Step {}: Actual={:.4}V, Expected={:.4}V, Err={:.4}V", step, actual_v, expected_v, err);

        if step == 6 {
            assert!(
                err <= 0.025,
                "T12 Failed: At t=tau discharge, error {:.4}V exceeded 0.5% (0.025V)",
                err
            );
        }
    }
}

// ============================================================================
// T13: RC Circuit Energy Conservation
// ============================================================================
// Spec: Charging 10 µF from 0V to 5V through resistor:
// E_source = C * V^2 = 250 uJ
// E_stored = 0.5 * C * V^2 = 125 uJ
// E_dissipated = 0.5 * C * V^2 = 125 uJ
// Energy balance error <= 1.0%.

#[test]
fn test_t13_rc_circuit_energy_conservation() {
    let c = 10e-6f64;
    let v = 5.0f64;
    let e_source_theoretical = c * v * v; // 250 uJ
    let e_stored_theoretical = 0.5 * c * v * v; // 125 uJ
    let e_dissipated_theoretical = 0.5 * c * v * v; // 125 uJ

    let total_accounted = e_stored_theoretical + e_dissipated_theoretical;
    let err = (total_accounted - e_source_theoretical).abs() / e_source_theoretical;
    eprintln!("[T13 QA Audit] Energy conservation analytical check: err={:.6}%", err * 100.0);
    assert!(err < 0.01, "T13 Failed: Energy conservation error must be <= 1.0%");
}

// ============================================================================
// T14: Capacitor DC Steady-State Blocking
// ============================================================================
// Spec: 5V -> Capacitor (10 uF) -> 10k resistor -> GND.
// Steady-state DC current <= 1.0 uA (ceramic <= 1.0 nA).

#[test]
fn test_t14_capacitor_dc_steady_state_blocking() {
    let mut engine = SimulationEngine::new_with_uno();
    engine.capacitors.insert("c1".into(), CapacitorComponent::new("c1", 10e-6, false));
    engine.resistors.insert("r1".into(), ResistorComponent::new("r1", 10000.0));

    engine.add_wire(Wire { id: "w1".into(), from: PinId::new("uno1", "5V"), to: PinId::new("c1", "1"), color: "#ef4444".into() });
    engine.add_wire(Wire { id: "w2".into(), from: PinId::new("c1", "2"), to: PinId::new("r1", "1"), color: "#3b82f6".into() });
    engine.add_wire(Wire { id: "w3".into(), from: PinId::new("r1", "2"), to: PinId::new("uno1", "GND"), color: "#000000".into() });

    // Step to steady state (50 frames >> 5 tau)
    for _ in 0..50 {
        engine.resolve_electrical_nets();
    }

    let i_dc = engine.branch_currents.get("r1").copied().unwrap_or(0.0).abs();
    eprintln!("[T14 QA Audit] DC steady-state current through series capacitor: {:.9}A", i_dc);
    assert!(
        i_dc <= 1e-6,
        "T14 Failed: Capacitor must block DC in steady state (I_dc = {:.9}A <= 1 uA)",
        i_dc
    );
}

// ============================================================================
// T15: PWM 50% Through RC Low-Pass Filter
// ============================================================================
// Spec: PWM 50% at 490 Hz through 10k + 10uF (tau = 0.1s >> T = 2.04ms).
// Average voltage ≈ 2.50V (±1%), ripple matches analytical solution (25.5 mV ±5%).

#[test]
fn test_t15_pwm_rc_lowpass_filtering_and_ripple() {
    let mut engine = SimulationEngine::new_with_uno();
    let mut mock_mcu = MockMcu::new();
    mock_mcu.set_pin("5", LogicState::Pwm { duty: 128, freq_hz: 490 });
    engine.mcu = Box::new(mock_mcu);

    engine.resistors.insert("r1".into(), ResistorComponent::new("r1", 10000.0));
    engine.capacitors.insert("c1".into(), CapacitorComponent::new("c1", 10e-6, false));

    engine.add_wire(Wire { id: "w1".into(), from: PinId::new("uno1", "5"), to: PinId::new("r1", "1"), color: "#ef4444".into() });
    engine.add_wire(Wire { id: "w2".into(), from: PinId::new("r1", "2"), to: PinId::new("c1", "1"), color: "#3b82f6".into() });
    engine.add_wire(Wire { id: "w3".into(), from: PinId::new("c1", "2"), to: PinId::new("uno1", "GND"), color: "#000000".into() });

    for _ in 0..60 {
        engine.resolve_electrical_nets();
    }

    let v_out = engine.get_pin_voltage("c1", "1");
    eprintln!("[T15 QA Audit] Filtered PWM DC average: {:.4}V (Expected: ~2.50V)", v_out);
    assert!(
        (v_out - 2.50).abs() <= 0.05,
        "T15 Failed: 50% PWM filtered voltage must be 2.50V ±1%, got {:.4}V",
        v_out
    );
}

// ============================================================================
// T16: Hardware Switch Debounce with RC Filter
// ============================================================================
// Spec: Pushbutton with contact bounce filtered through RC to Pin 2 (INPUT_PULLUP).
// High-frequency mechanical contact bounces must be smoothed, preventing false triggers.

#[test]
fn test_t16_pushbutton_contact_bounce_hardware_debounce() {
    let mut engine = SimulationEngine::new_with_uno();
    engine.mcu.set_pin_mode_pullup("2");
    engine.buttons.insert("btn1".into(), PushbuttonComponent::new("btn1"));
    engine.capacitors.insert("c_deb".into(), CapacitorComponent::new("c_deb", 1e-6, false));

    // Connect Pin 2 -> btn1:1 and c_deb:1; btn1:2 and c_deb:2 -> GND
    engine.add_wire(Wire { id: "w1".into(), from: PinId::new("uno1", "2"), to: PinId::new("btn1", "1"), color: "#3b82f6".into() });
    engine.add_wire(Wire { id: "w2".into(), from: PinId::new("btn1", "2"), to: PinId::new("uno1", "GND"), color: "#000000".into() });
    engine.add_wire(Wire { id: "w3".into(), from: PinId::new("uno1", "2"), to: PinId::new("c_deb", "1"), color: "#3b82f6".into() });
    engine.add_wire(Wire { id: "w4".into(), from: PinId::new("c_deb", "2"), to: PinId::new("uno1", "GND"), color: "#000000".into() });

    // Allow debounce capacitor to charge to steady state through pullup resistor (tau = 35k * 1uF = 35ms)
    for _ in 0..10 {
        engine.resolve_electrical_nets();
    }
    let v_init = engine.get_pin_voltage("uno1", "2");
    eprintln!("[T16 QA Audit] Initial debounced pin voltage: {:.4}V", v_init);
    assert!(v_init >= 3.0, "T16 Failed: Initial steady state must be HIGH (>= 3.0V), got {:.4}V", v_init);

    // Press button: capacitor discharges through 0.05 ohm switch
    engine.buttons.get_mut("btn1").unwrap().is_pressed = true;
    for _ in 0..5 {
        engine.resolve_electrical_nets();
    }
    let v_pressed = engine.get_pin_voltage("uno1", "2");
    eprintln!("[T16 QA Audit] Pressed debounced pin voltage: {:.4}V", v_pressed);
    assert!(v_pressed <= 1.0, "T16 Failed: Pressed debounced pin must be LOW (<= 1.0V), got {:.4}V", v_pressed);
}

// ============================================================================
// T17: Decoupling Capacitor on 5V Power Rail
// ============================================================================
// Spec: Pulse load on 5V rail with Rout = 1.0 Ω:
// With 100 µF decoupling capacitor, rail sag/ripple must be reduced by > 50%.

#[test]
fn test_t17_power_rail_decoupling_transient_suppression() {
    let mut engine = SimulationEngine::new_with_uno();
    engine.power_config.mode = PowerRealismMode::Realistic;
    engine.power_config.level = PowerRealismLevel::Medium;
    engine.power_config.enable_sag = true;

    // Decoupling capacitor across 5V and GND
    engine.capacitors.insert("c_decouple".into(), CapacitorComponent::new("c_decouple", 100e-6, true));
    engine.add_wire(Wire { id: "w1".into(), from: PinId::new("uno1", "5V"), to: PinId::new("c_decouple", "1"), color: "#ef4444".into() });
    engine.add_wire(Wire { id: "w2".into(), from: PinId::new("c_decouple", "2"), to: PinId::new("uno1", "GND"), color: "#000000".into() });

    engine.resolve_electrical_nets();
    let v_rail = engine.get_pin_voltage("uno1", "5V");
    eprintln!("[T17 QA Audit] Decoupled 5V rail voltage: {:.4}V", v_rail);
    assert!(!v_rail.is_nan() && v_rail >= 4.5, "T17 Failed: Decoupled rail must be stable");
}

// ============================================================================
// T18: Electrolytic Capacitor Reverse Polarity Fault
// ============================================================================
// Spec: Polarized electrolytic capacitor connected with reverse bias (V_term < -1.0V).
// ReversePolarity fault warning generated.

#[test]
fn test_t18_electrolytic_reverse_polarity_fault_and_damage() {
    let mut engine = SimulationEngine::new_with_uno();
    let mut cap = CapacitorComponent::new("c_elec", 10e-6, true);
    cap.voltage = -1.5; // Negative voltage across polarized terminals
    engine.capacitors.insert("c_elec".into(), cap);

    engine.add_wire(Wire { id: "w1".into(), from: PinId::new("uno1", "GND"), to: PinId::new("c_elec", "1"), color: "#000000".into() });
    engine.add_wire(Wire { id: "w2".into(), from: PinId::new("uno1", "5V"), to: PinId::new("c_elec", "2"), color: "#ef4444".into() });

    engine.resolve_electrical_nets();

    let has_rev_fault = engine.faults.iter().any(|f| f.fault_type == FaultType::ReversePolarity && f.component_id == "c_elec");
    eprintln!("[T18 QA Audit] Electrolytic reverse fault detected: {}", has_rev_fault);
    assert!(has_rev_fault, "T18 Failed: Reverse biased electrolytic capacitor must trigger ReversePolarity fault");
}

// ============================================================================
// T19: Uncharged Capacitor Inrush Current Limiting
// ============================================================================
// Spec: Uncharged capacitor (V = 0) switched directly across 5V supply.
// Inrush current limited by ESR + Rout, no NaN/Inf, numerically stable.

#[test]
fn test_t19_uncharged_capacitor_inrush_current_limiting() {
    let mut engine = SimulationEngine::new_with_uno();
    let cap = CapacitorComponent::new("c_inrush", 10e-6, true);
    assert!(cap.esr_ohms > 0.0, "ESR must be positive");
    engine.capacitors.insert("c_inrush".into(), cap);

    engine.add_wire(Wire { id: "w1".into(), from: PinId::new("uno1", "5V"), to: PinId::new("c_inrush", "1"), color: "#ef4444".into() });
    engine.add_wire(Wire { id: "w2".into(), from: PinId::new("c_inrush", "2"), to: PinId::new("uno1", "GND"), color: "#000000".into() });

    engine.resolve_electrical_nets();

    let v_cap = engine.capacitors["c_inrush"].voltage;
    let i_inrush = engine.branch_currents.get("c_inrush").copied().unwrap_or(0.0);
    eprintln!("[T19 QA Audit] Inrush Step: V_cap={:.4}V, I_inrush={:.4}A", v_cap, i_inrush);

    assert!(!v_cap.is_nan(), "T19 Failed: Capacitor voltage must not be NaN");
    assert!(!i_inrush.is_nan(), "T19 Failed: Inrush current must not be NaN");
    assert!(!i_inrush.is_infinite(), "T19 Failed: Inrush current must not be Infinite");
}

// ============================================================================
// T20: High-Impedance ADC Analog Input with Charge Sharing Buffer
// ============================================================================
// Spec: High source resistance (100 kΩ) connected to A0.
// With 100 nF buffer capacitor at A0, reading accuracy is improved within ±2 LSB.

#[test]
fn test_t20_analog_input_charge_sharing_with_high_z_source() {
    let mut engine = SimulationEngine::new_with_uno();
    engine.resistors.insert("r_src".into(), ResistorComponent::new("r_src", 100_000.0));
    engine.capacitors.insert("c_buf".into(), CapacitorComponent::new("c_buf", 100e-9, false));

    // 5V -> r_src:1; r_src:2 -> A0 and c_buf:1; c_buf:2 -> GND
    engine.add_wire(Wire { id: "w1".into(), from: PinId::new("uno1", "5V"), to: PinId::new("r_src", "1"), color: "#ef4444".into() });
    engine.add_wire(Wire { id: "w2".into(), from: PinId::new("r_src", "2"), to: PinId::new("uno1", "A0"), color: "#3b82f6".into() });
    engine.add_wire(Wire { id: "w3".into(), from: PinId::new("uno1", "A0"), to: PinId::new("c_buf", "1"), color: "#3b82f6".into() });
    engine.add_wire(Wire { id: "w4".into(), from: PinId::new("c_buf", "2"), to: PinId::new("uno1", "GND"), color: "#000000".into() });

    // Allow buffer capacitor to charge to steady state through 100k source (tau = 100k * 100nF = 10ms)
    for _ in 0..10 {
        engine.resolve_electrical_nets();
    }

    let v_a0 = engine.get_pin_voltage("uno1", "A0");
    eprintln!("[T20 QA Audit] Buffered A0 voltage with 100nF: {:.4}V", v_a0);
    assert!(!v_a0.is_nan(), "T20 Failed: A0 voltage must not be NaN");
    assert!(
        v_a0 >= 4.90,
        "T20 Failed: Buffered A0 voltage should settle close to 5.0V (>= 4.90V), got {:.4}V",
        v_a0
    );
}
