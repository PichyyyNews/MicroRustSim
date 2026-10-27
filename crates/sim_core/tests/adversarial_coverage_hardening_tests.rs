//! Tier 5 Hardening & Adversarial Verification Test Suite
//! MicroRustSim v0.2.1
//!
//! Validates:
//! 1. 5V-to-GND shorts, 3.3V-to-GND shorts, GPIO overcurrent (>40mA), LED reverse polarity.
//! 2. Immediate fault clearing upon resolving wiring/load.
//! 3. Continuous analog voltage accuracy across rails, dividers, and potentiometers.

use sim_core::{
    components::{LedComponent, PotentiometerComponent, ResistorComponent},
    solver::FaultType,
    LogicState, McuCore, PinId, SimulationEngine, Wire,
};
use std::collections::HashMap;

struct TestMcu {
    states: HashMap<String, LogicState>,
}

impl TestMcu {
    fn new() -> Self {
        Self { states: HashMap::new() }
    }
    fn set(&mut self, pin: &str, state: LogicState) {
        self.states.insert(pin.to_string(), state);
    }
}

impl McuCore for TestMcu {
    fn name(&self) -> &str { "test_mcu" }
    fn reset(&mut self) {}
    fn load_hex(&mut self, _hex: &str) -> Result<(), String> { Ok(()) }
    fn step_cycles(&mut self, _cycles: u64) {}
    fn get_pin_state(&mut self, pin_name: &str) -> LogicState {
        if let Some(&s) = self.states.get(pin_name) {
            s
        } else if pin_name == "5V" || pin_name == "VIN" {
            LogicState::High
        } else if pin_name == "3.3V" || pin_name == "3V3" {
            LogicState::Analog(3.3)
        } else if pin_name.starts_with("GND") {
            LogicState::Low
        } else {
            LogicState::Floating
        }
    }
    fn set_pin_input(&mut self, _pin_name: &str, _high: bool) {}
    fn set_pin_mode_pullup(&mut self, pin_name: &str) {
        self.states.insert(pin_name.to_string(), LogicState::InputPullUp);
    }
    fn set_adc_voltage(&mut self, _channel: u8, _voltage: f32) {}
    fn read_serial_output(&mut self) -> Vec<u8> { Vec::new() }
    fn write_serial_input(&mut self, _bytes: &[u8]) {}
    fn cycles(&self) -> u64 { 0 }
    fn millis(&self) -> f64 { 0.0 }
}

#[test]
fn test_hardened_5v_to_gnd_short_and_immediate_clearance() {
    let mut engine = SimulationEngine::new_with_uno();

    // 1. Initially healthy
    engine.resolve_electrical_nets();
    assert!(engine.faults.is_empty(), "Initial engine should have no faults");
    assert!((engine.get_pin_voltage("uno1", "5V") - 5.0).abs() < 0.01);
    assert_eq!(engine.get_pin_voltage("uno1", "GND"), 0.0);

    // 2. Direct 5V to GND short circuit
    engine.add_wire(Wire {
        id: "w_short".into(),
        from: PinId::new("uno1", "5V"),
        to: PinId::new("uno1", "GND"),
        color: "#ef4444".into(),
    });
    engine.resolve_electrical_nets();

    assert!(!engine.faults.is_empty(), "Short circuit must trigger fault");
    let short_fault = engine.faults.iter().find(|f| f.fault_type == FaultType::ShortCircuit);
    assert!(short_fault.is_some(), "Must report ShortCircuit fault");
    let f = short_fault.unwrap();
    assert_eq!(f.component_id, "uno1");
    assert_eq!(f.pin_name, "5V");
    assert!(f.current_ma > 500.0, "Short circuit current must exceed 500mA: got {}mA", f.current_ma);

    // 3. Resolve the fault by removing the shorting wire
    engine.remove_wire("w_short");
    engine.resolve_electrical_nets();

    assert!(engine.faults.is_empty(), "Resolving fault must immediately clear all faults");
    assert!((engine.get_pin_voltage("uno1", "5V") - 5.0).abs() < 0.01, "5V rail must recover to 5.0V");
}

#[test]
fn test_hardened_3v3_to_gnd_short_and_immediate_clearance() {
    let mut engine = SimulationEngine::new_with_uno();

    // 1. Initial 3.3V health
    engine.resolve_electrical_nets();
    assert!(engine.faults.is_empty());
    assert!((engine.get_pin_voltage("uno1", "3.3V") - 3.3).abs() < 0.05, "3.3V rail must be ~3.3V");

    // 2. Direct 3.3V to GND short circuit
    engine.add_wire(Wire {
        id: "w_short_3v3".into(),
        from: PinId::new("uno1", "3.3V"),
        to: PinId::new("uno1", "GND"),
        color: "#ef4444".into(),
    });
    engine.resolve_electrical_nets();

    assert!(!engine.faults.is_empty());
    let short_fault = engine.faults.iter().find(|f| f.fault_type == FaultType::ShortCircuit);
    assert!(short_fault.is_some());
    let f = short_fault.unwrap();
    assert_eq!(f.component_id, "uno1");
    assert_eq!(f.pin_name, "3.3V");
    assert!(f.current_ma > 150.0, "3.3V short current must exceed 150mA: got {}mA", f.current_ma);

    // 3. Resolve fault
    engine.remove_wire("w_short_3v3");
    engine.resolve_electrical_nets();

    assert!(engine.faults.is_empty(), "Resolving 3.3V short must clear faults immediately");
    assert!((engine.get_pin_voltage("uno1", "3.3V") - 3.3).abs() < 0.05);
}

#[test]
fn test_hardened_gpio_overcurrent_source_and_recovery() {
    let mut engine = SimulationEngine::new_with_uno();
    let mut mcu = TestMcu::new();
    mcu.set("13", LogicState::High);
    engine.mcu = Box::new(mcu);

    // Connect Pin 13 directly to GND (Shorting GPIO output)
    engine.add_wire(Wire {
        id: "w_pin13_short".into(),
        from: PinId::new("uno1", "13"),
        to: PinId::new("uno1", "GND"),
        color: "#ef4444".into(),
    });
    engine.resolve_electrical_nets();

    let overcurrent = engine.faults.iter().find(|f| f.fault_type == FaultType::Overcurrent && f.pin_name == "13");
    assert!(overcurrent.is_some(), "Must report Overcurrent on Pin 13");
    let f = overcurrent.unwrap();
    assert_eq!(f.component_id, "uno1");
    assert!(f.current_ma > 40.0, "GPIO current must exceed 40mA: got {}mA", f.current_ma);

    // Resolve by replacing direct short with 220 ohm resistor
    engine.remove_wire("w_pin13_short");
    engine.resistors.insert("r1".into(), ResistorComponent::new("r1", 220.0));
    engine.add_wire(Wire {
        id: "w_r1_in".into(),
        from: PinId::new("uno1", "13"),
        to: PinId::new("r1", "1"),
        color: "#22c55e".into(),
    });
    engine.add_wire(Wire {
        id: "w_r1_out".into(),
        from: PinId::new("r1", "2"),
        to: PinId::new("uno1", "GND"),
        color: "#000000".into(),
    });
    engine.resolve_electrical_nets();

    assert!(engine.faults.is_empty(), "Inserting 220 ohm resistor must resolve GPIO overcurrent");
    let i_pin13 = engine.branch_currents.get("uno1:13").copied().unwrap_or(0.0) * 1000.0;
    assert!(i_pin13 > 15.0 && i_pin13 < 25.0, "Current through 220 ohm should be ~20mA: got {}mA", i_pin13);
}

#[test]
fn test_hardened_gpio_overcurrent_sink_and_recovery() {
    let mut engine = SimulationEngine::new_with_uno();
    let mut mcu = TestMcu::new();
    mcu.set("8", LogicState::Low);
    engine.mcu = Box::new(mcu);

    // Connect 5V rail directly to Pin 8 (sinking high current into LOW GPIO driver)
    engine.add_wire(Wire {
        id: "w_pin8_sink_short".into(),
        from: PinId::new("uno1", "5V"),
        to: PinId::new("uno1", "8"),
        color: "#ef4444".into(),
    });
    engine.resolve_electrical_nets();

    let overcurrent = engine.faults.iter().find(|f| f.fault_type == FaultType::Overcurrent && f.pin_name == "8");
    assert!(overcurrent.is_some(), "Must report sink overcurrent on Pin 8");
    let f = overcurrent.unwrap();
    assert_eq!(f.component_id, "uno1");
    assert!(f.current_ma > 40.0, "Sink current must exceed 40mA: got {}mA", f.current_ma);

    // Resolve by removing short
    engine.remove_wire("w_pin8_sink_short");
    engine.resolve_electrical_nets();
    assert!(engine.faults.is_empty(), "Removing short must clear sink overcurrent");
}

#[test]
fn test_hardened_led_overcurrent_without_resistor_and_recovery() {
    let mut engine = SimulationEngine::new_with_uno();
    engine.leds.insert("led1".into(), LedComponent::new("led1", "red"));

    // Connect LED directly across 5V and GND without resistor
    engine.add_wire(Wire {
        id: "w_led_a".into(),
        from: PinId::new("uno1", "5V"),
        to: PinId::new("led1", "anode"),
        color: "#ef4444".into(),
    });
    engine.add_wire(Wire {
        id: "w_led_c".into(),
        from: PinId::new("led1", "cathode"),
        to: PinId::new("uno1", "GND"),
        color: "#000000".into(),
    });
    engine.resolve_electrical_nets();

    let led_fault = engine.faults.iter().find(|f| f.component_id == "led1" && f.fault_type == FaultType::Overcurrent);
    assert!(led_fault.is_some(), "Must report Overcurrent on unresisted LED");
    let f = led_fault.unwrap();
    assert!(f.current_ma > 40.0, "LED current without resistor must exceed 40mA: got {}mA", f.current_ma);

    // Insert 220 ohm resistor between cathode and GND
    engine.remove_wire("w_led_c");
    engine.resistors.insert("r1".into(), ResistorComponent::new("r1", 220.0));
    engine.add_wire(Wire {
        id: "w_led_to_r".into(),
        from: PinId::new("led1", "cathode"),
        to: PinId::new("r1", "1"),
        color: "#eab308".into(),
    });
    engine.add_wire(Wire {
        id: "w_r_to_gnd".into(),
        from: PinId::new("r1", "2"),
        to: PinId::new("uno1", "GND"),
        color: "#000000".into(),
    });
    engine.resolve_electrical_nets();

    assert!(engine.faults.is_empty(), "Resisted LED must not have any faults");
    assert!(engine.leds["led1"].is_lit, "LED should be lit");
    assert!(engine.leds["led1"].brightness > 0.5, "Brightness should be healthy");
}

#[test]
fn test_hardened_led_reverse_polarity_and_recovery() {
    let mut engine = SimulationEngine::new_with_uno();
    engine.leds.insert("led1".into(), LedComponent::new("led1", "red"));

    // Reverse bias: Anode to GND, Cathode to 5V
    engine.add_wire(Wire {
        id: "w_rev_a".into(),
        from: PinId::new("uno1", "GND"),
        to: PinId::new("led1", "anode"),
        color: "#000000".into(),
    });
    engine.add_wire(Wire {
        id: "w_rev_c".into(),
        from: PinId::new("uno1", "5V"),
        to: PinId::new("led1", "cathode"),
        color: "#ef4444".into(),
    });
    engine.resolve_electrical_nets();

    let rev_fault = engine.faults.iter().find(|f| f.component_id == "led1" && f.fault_type == FaultType::ReversePolarity);
    assert!(rev_fault.is_some(), "Must report ReversePolarity on reverse-biased LED");
    let f = rev_fault.unwrap();
    assert_eq!(f.pin_name, "anode");
    assert_eq!(f.current_ma, 0.0, "Reverse current is zero/leakage");
    assert!(!engine.leds["led1"].is_lit, "Reverse-biased LED must not light up");

    // Correct polarity
    engine.remove_wire("w_rev_a");
    engine.remove_wire("w_rev_c");
    engine.resistors.insert("r1".into(), ResistorComponent::new("r1", 330.0));
    engine.add_wire(Wire {
        id: "w_fwd_a".into(),
        from: PinId::new("uno1", "5V"),
        to: PinId::new("r1", "1"),
        color: "#ef4444".into(),
    });
    engine.add_wire(Wire {
        id: "w_r_to_led".into(),
        from: PinId::new("r1", "2"),
        to: PinId::new("led1", "anode"),
        color: "#eab308".into(),
    });
    engine.add_wire(Wire {
        id: "w_fwd_c".into(),
        from: PinId::new("led1", "cathode"),
        to: PinId::new("uno1", "GND"),
        color: "#000000".into(),
    });
    engine.resolve_electrical_nets();

    assert!(engine.faults.is_empty(), "Correctly wired LED must have zero faults");
    assert!(engine.leds["led1"].is_lit);
}

#[test]
fn test_hardened_breadboard_power_rail_short_and_recovery() {
    let mut engine = SimulationEngine::new_with_uno();

    // Distribute 5V and GND to breadboard rails
    engine.add_wire(Wire {
        id: "w_bb_5v".into(),
        from: PinId::new("uno1", "5V"),
        to: PinId::new("bb1", "top_plus"),
        color: "#ef4444".into(),
    });
    engine.add_wire(Wire {
        id: "w_bb_gnd".into(),
        from: PinId::new("uno1", "GND"),
        to: PinId::new("bb1", "top_minus"),
        color: "#000000".into(),
    });
    engine.resolve_electrical_nets();
    assert!(engine.faults.is_empty());
    assert!((engine.get_pin_voltage("bb1", "top_plus") - 5.0).abs() < 0.05);
    assert_eq!(engine.get_pin_voltage("bb1", "top_minus"), 0.0);

    // Short circuit jumper between rail pins
    engine.add_wire(Wire {
        id: "w_rail_short".into(),
        from: PinId::new("bb1", "tp_15"),
        to: PinId::new("bb1", "tm_15"),
        color: "#ef4444".into(),
    });
    engine.resolve_electrical_nets();

    let short = engine.faults.iter().find(|f| f.fault_type == FaultType::ShortCircuit);
    assert!(short.is_some(), "Breadboard rail jumper short must be detected");
    assert_eq!(short.unwrap().pin_name, "5V");

    // Remove rail jumper
    engine.remove_wire("w_rail_short");
    engine.resolve_electrical_nets();
    assert!(engine.faults.is_empty(), "Removing rail jumper clears short circuit immediately");
    assert!((engine.get_pin_voltage("bb1", "top_plus") - 5.0).abs() < 0.05);
}

#[test]
fn test_hardened_continuous_analog_voltages_potentiometer_sweep() {
    let mut engine = SimulationEngine::new_with_uno();
    let mut pot = PotentiometerComponent::new("pot1");
    pot.value = 0.0;
    engine.pots.insert("pot1".into(), pot);

    // Connect Pot: pin 3 -> 5V, pin 1 -> GND, pin 2 -> Uno A0
    engine.add_wire(Wire {
        id: "w_p3".into(),
        from: PinId::new("uno1", "5V"),
        to: PinId::new("pot1", "3"),
        color: "#ef4444".into(),
    });
    engine.add_wire(Wire {
        id: "w_p1".into(),
        from: PinId::new("uno1", "GND"),
        to: PinId::new("pot1", "1"),
        color: "#000000".into(),
    });
    engine.add_wire(Wire {
        id: "w_p2".into(),
        from: PinId::new("pot1", "2"),
        to: PinId::new("uno1", "A0"),
        color: "#3b82f6".into(),
    });

    // Sweep across 11 ratios from 0.0 to 1.0 in 0.1 increments
    for step in 0..=10 {
        let alpha = step as f32 / 10.0;
        engine.pots.get_mut("pot1").unwrap().value = alpha;
        engine.resolve_electrical_nets();

        let v_wiper = engine.get_pin_voltage("pot1", "2");
        let v_a0 = engine.get_pin_voltage("uno1", "A0");
        let expected = 5.0 * alpha;

        assert!(
            (v_wiper - expected).abs() < 0.015,
            "Wiper at alpha {} must be ~{:.2}V, got {:.3}V",
            alpha,
            expected,
            v_wiper
        );
        assert!(
            (v_a0 - expected).abs() < 0.015,
            "Uno A0 at alpha {} must match wiper ~{:.2}V, got {:.3}V",
            alpha,
            expected,
            v_a0
        );

        // Verify mcu_pin_voltages_map exposes true analog voltage
        let mcu_map = engine.mcu_pin_voltages_map();
        let a0_mcu = mcu_map.get("A0").copied().unwrap_or(-1.0);
        assert!(
            (a0_mcu - expected).abs() < 0.015,
            "mcu_pin_voltages_map[\"A0\"] must match expected analog voltage"
        );
    }
}

#[test]
fn test_hardened_continuous_analog_voltages_resistor_divider() {
    let mut engine = SimulationEngine::new_with_uno();
    // Voltage divider: 5V -> R1 (3.3k) -> mid -> R2 (10k) -> GND
    engine.resistors.insert("r1".into(), ResistorComponent::new("r1", 3300.0));
    engine.resistors.insert("r2".into(), ResistorComponent::new("r2", 10000.0));

    engine.add_wire(Wire {
        id: "w1".into(),
        from: PinId::new("uno1", "5V"),
        to: PinId::new("r1", "1"),
        color: "#ef4444".into(),
    });
    engine.add_wire(Wire {
        id: "w2".into(),
        from: PinId::new("r1", "2"),
        to: PinId::new("r2", "1"),
        color: "#eab308".into(),
    });
    engine.add_wire(Wire {
        id: "w3".into(),
        from: PinId::new("r2", "2"),
        to: PinId::new("uno1", "GND"),
        color: "#000000".into(),
    });
    engine.add_wire(Wire {
        id: "w4".into(),
        from: PinId::new("r2", "1"),
        to: PinId::new("uno1", "A1"),
        color: "#3b82f6".into(),
    });

    engine.resolve_electrical_nets();

    // V_mid = 5.0 * 10000 / (10000 + 3300) = 5.0 * 10000 / 13300 = 3.7594 V
    let v_mid = engine.get_pin_voltage("r2", "1");
    let v_a1 = engine.get_pin_voltage("uno1", "A1");
    let expected = 5.0 * 10000.0 / 13300.0;

    assert!(
        (v_mid - expected).abs() < 0.02,
        "Divider mid voltage must be {:.3}V, got {:.3}V",
        expected,
        v_mid
    );
    assert_eq!(v_mid, v_a1, "A1 must match mid voltage exactly");
    assert!(engine.faults.is_empty());
}
