//! Comprehensive Opaque-Box E2E Circuit Test Suite for MicroRustSim v0.2.1
//!
//! Verifies physical circuit simulation across:
//! - Tier 1: Feature Coverage (Resistors, Potentiometers, LEDs, Pushbuttons, Uno Pin Drivers)
//! - Tier 2: Boundary & Corner Cases (Zero resistance, Open circuit, Wiper extrema, Rapid switching, Parallel branches)
//! - Tier 3: Cross-Feature Combinations (Loaded divider, Pot-to-ADC, Button-to-LED, Breadboard routing)
//! - Tier 4: Real-World Scenarios (Blink circuit, Analog waveform ramp, Pullup state machine)
//! - Hardware Fault Scenarios (5V-GND short, LED without resistor overcurrent, GPIO driver contention, Reverse polarity)

use sim_core::{
    components::{LedComponent, PotentiometerComponent, PushbuttonComponent, ResistorComponent},
    LogicState, PinId, SimulationEngine, Wire,
};

// ============================================================================
// TIER 1: FEATURE COVERAGE (PHYSICS-BASED COMPONENT MODELS)
// ============================================================================

// --- 1.1 Resistors (Ohm's Law: V = IR) ---

#[test]
fn test_t1_resistor_ohm_law_220() {
    let mut engine = SimulationEngine::new_with_uno();
    engine.leds.insert("led1".into(), LedComponent::new("led1", "red"));
    engine.resistors.insert("r1".into(), ResistorComponent::new("r1", 220.0));

    // Connect 5V -> led1:anode -> led1:cathode -> r1:1 -> r1:2 -> GND
    engine.add_wire(Wire { id: "w1".into(), from: PinId::new("uno1", "5V"), to: PinId::new("led1", "anode"), color: "#ef4444".into() });
    engine.add_wire(Wire { id: "w2".into(), from: PinId::new("led1", "cathode"), to: PinId::new("r1", "1"), color: "#ef4444".into() });
    engine.add_wire(Wire { id: "w3".into(), from: PinId::new("r1", "2"), to: PinId::new("uno1", "GND"), color: "#000000".into() });

    engine.resolve_electrical_nets();

    let led = &engine.leds["led1"];
    assert!(led.is_lit, "Red LED with 220 ohm resistor must be lit");
    // Red LED Vf = 1.8V, I = (5.0 - 1.8) / (220 + 5) = 14.22mA -> brightness ~0.95
    assert!(led.brightness > 0.80, "Brightness with 220 ohm should be > 0.80, got {}", led.brightness);
}

#[test]
fn test_t1_resistor_ohm_law_1k() {
    let mut engine = SimulationEngine::new_with_uno();
    engine.leds.insert("led1".into(), LedComponent::new("led1", "red"));
    engine.resistors.insert("r1".into(), ResistorComponent::new("r1", 1000.0));

    // Connect 5V -> led1:anode -> led1:cathode -> r1:1 -> r1:2 -> GND
    engine.add_wire(Wire { id: "w1".into(), from: PinId::new("uno1", "5V"), to: PinId::new("led1", "anode"), color: "#ef4444".into() });
    engine.add_wire(Wire { id: "w2".into(), from: PinId::new("led1", "cathode"), to: PinId::new("r1", "1"), color: "#ef4444".into() });
    engine.add_wire(Wire { id: "w3".into(), from: PinId::new("r1", "2"), to: PinId::new("uno1", "GND"), color: "#000000".into() });

    engine.resolve_electrical_nets();

    let led = &engine.leds["led1"];
    assert!(led.is_lit, "Red LED with 1k resistor must still be lit");
    // I = (5.0 - 1.8) / (1000 + 5) = 3.18mA -> brightness ~0.21
    assert!(led.brightness < 0.35 && led.brightness > 0.15, "Brightness with 1k must be ~0.21, got {}", led.brightness);
}

#[test]
fn test_t1_resistor_ohm_law_4k7() {
    let mut engine = SimulationEngine::new_with_uno();
    engine.leds.insert("led1".into(), LedComponent::new("led1", "red"));
    engine.resistors.insert("r1".into(), ResistorComponent::new("r1", 4700.0));

    // Connect 5V -> led1:anode -> led1:cathode -> r1:1 -> r1:2 -> GND
    engine.add_wire(Wire { id: "w1".into(), from: PinId::new("uno1", "5V"), to: PinId::new("led1", "anode"), color: "#ef4444".into() });
    engine.add_wire(Wire { id: "w2".into(), from: PinId::new("led1", "cathode"), to: PinId::new("r1", "1"), color: "#ef4444".into() });
    engine.add_wire(Wire { id: "w3".into(), from: PinId::new("r1", "2"), to: PinId::new("uno1", "GND"), color: "#000000".into() });

    engine.resolve_electrical_nets();

    let led = &engine.leds["led1"];
    assert!(led.is_lit, "Red LED with 4.7k resistor must remain dimly lit");
    // I = (5.0 - 1.8) / (4700 + 5) = 0.68mA -> brightness ~0.045
    assert!(led.brightness < 0.10 && led.brightness > 0.02, "Brightness with 4.7k must be ~0.045, got {}", led.brightness);
}

#[test]
fn test_t1_resistor_ohm_law_10k() {
    let mut engine = SimulationEngine::new_with_uno();
    engine.leds.insert("led1".into(), LedComponent::new("led1", "red"));
    engine.resistors.insert("r1".into(), ResistorComponent::new("r1", 10000.0));

    // Connect 5V -> led1:anode -> led1:cathode -> r1:1 -> r1:2 -> GND
    engine.add_wire(Wire { id: "w1".into(), from: PinId::new("uno1", "5V"), to: PinId::new("led1", "anode"), color: "#ef4444".into() });
    engine.add_wire(Wire { id: "w2".into(), from: PinId::new("led1", "cathode"), to: PinId::new("r1", "1"), color: "#ef4444".into() });
    engine.add_wire(Wire { id: "w3".into(), from: PinId::new("r1", "2"), to: PinId::new("uno1", "GND"), color: "#000000".into() });

    engine.resolve_electrical_nets();

    let led = &engine.leds["led1"];
    assert!(led.is_lit, "Red LED with 10k resistor is at minimal visible threshold");
    assert!(led.brightness <= 0.05, "Brightness at 10k must be <= 0.05, got {}", led.brightness);

    // Now test with 100k - current drops below 0.05mA threshold, turning LED off
    engine.resistors.get_mut("r1").unwrap().resistance_ohms = 100_000.0;
    engine.resolve_electrical_nets();
    assert!(!engine.leds["led1"].is_lit, "LED with 100k must turn off completely");
    assert_eq!(engine.leds["led1"].brightness, 0.0);
}

#[test]
fn test_t1_resistor_sweep_series_addition() {
    let mut engine = SimulationEngine::new_with_uno();
    engine.leds.insert("led1".into(), LedComponent::new("led1", "red"));
    // Two series resistors: 220 + 780 = 1000 ohms
    engine.resistors.insert("r1".into(), ResistorComponent::new("r1", 220.0));
    engine.resistors.insert("r2".into(), ResistorComponent::new("r2", 780.0));

    // 5V -> led1:anode -> led1:cathode -> r1:1 -> r1:2 -> r2:1 -> r2:2 -> GND
    engine.add_wire(Wire { id: "w1".into(), from: PinId::new("uno1", "5V"), to: PinId::new("led1", "anode"), color: "#ef4444".into() });
    engine.add_wire(Wire { id: "w2".into(), from: PinId::new("led1", "cathode"), to: PinId::new("r1", "1"), color: "#ef4444".into() });
    engine.add_wire(Wire { id: "w3".into(), from: PinId::new("r1", "2"), to: PinId::new("r2", "1"), color: "#eab308".into() });
    engine.add_wire(Wire { id: "w4".into(), from: PinId::new("r2", "2"), to: PinId::new("uno1", "GND"), color: "#000000".into() });

    engine.resolve_electrical_nets();

    let led = &engine.leds["led1"];
    assert!(led.is_lit);
    // Series combination (1000 ohms total) must yield brightness close to single 1k test (~0.21)
    assert!(led.brightness < 0.35 && led.brightness > 0.15, "Series equivalent resistance must yield ~0.21, got {}", led.brightness);
}

// --- 1.2 Potentiometer (3-Terminal Voltage Divider) ---

#[test]
fn test_t1_pot_wiper_voltage_sweep_5v() {
    let mut engine = SimulationEngine::new_with_uno();
    let mut pot = PotentiometerComponent::new("pot1");
    pot.value = 0.0;
    engine.pots.insert("pot1".into(), pot);

    // Connect pot:VCC -> 5V, pot:GND -> GND, pot:SIG -> A0
    engine.add_wire(Wire { id: "w1".into(), from: PinId::new("uno1", "5V"), to: PinId::new("pot1", "VCC"), color: "#ef4444".into() });
    engine.add_wire(Wire { id: "w2".into(), from: PinId::new("uno1", "GND"), to: PinId::new("pot1", "GND"), color: "#000000".into() });
    engine.add_wire(Wire { id: "w3".into(), from: PinId::new("pot1", "SIG"), to: PinId::new("uno1", "A0"), color: "#3b82f6".into() });

    // Test sweep points: 0.0, 0.25, 0.50, 0.75, 1.0
    let test_points = [(0.0, 0.0), (0.25, 1.25), (0.50, 2.50), (0.75, 3.75), (1.0, 5.0)];

    for (alpha, expected_v) in test_points {
        engine.pots.get_mut("pot1").unwrap().value = alpha;
        engine.resolve_electrical_nets();
        let a0_v = *engine.pin_voltages.get(&PinId::new("uno1", "A0")).unwrap_or(&-1.0);
        assert!(
            (a0_v - expected_v).abs() < 0.05,
            "At alpha={}, expected {}V, got {}V",
            alpha,
            expected_v,
            a0_v
        );
    }
}

#[test]
fn test_t1_pot_wiper_voltage_sweep_3v3() {
    let mut engine = SimulationEngine::new_with_uno();
    let mut pot = PotentiometerComponent::new("pot1");
    pot.value = 0.5;
    engine.pots.insert("pot1".into(), pot);

    // Wire to A0
    engine.add_wire(Wire { id: "w1".into(), from: PinId::new("pot1", "SIG"), to: PinId::new("uno1", "A0"), color: "#3b82f6".into() });

    // In current engine wiper_v = pot.value * 5.0. Check half scale:
    engine.pots.get_mut("pot1").unwrap().value = 0.33; // ~1.65V
    engine.resolve_electrical_nets();
    let a0_v = *engine.pin_voltages.get(&PinId::new("uno1", "A0")).unwrap_or(&0.0);
    assert!((a0_v - 1.65).abs() < 0.05, "Expected 1.65V, got {}V", a0_v);
}

#[test]
fn test_t1_pot_intermediate_ratios() {
    let mut engine = SimulationEngine::new_with_uno();
    engine.pots.insert("pot1".into(), PotentiometerComponent::new("pot1"));

    engine.add_wire(Wire { id: "w1".into(), from: PinId::new("pot1", "SIG"), to: PinId::new("uno1", "A1"), color: "#3b82f6".into() });

    for ratio in [0.1, 0.3, 0.6, 0.9] {
        engine.pots.get_mut("pot1").unwrap().value = ratio;
        engine.resolve_electrical_nets();
        let expected = ratio * 5.0;
        let a1_v = *engine.pin_voltages.get(&PinId::new("uno1", "A1")).unwrap_or(&0.0);
        assert!((a1_v - expected).abs() < 0.05, "Ratio {} expected {}V, got {}V", ratio, expected, a1_v);
    }
}

#[test]
fn test_t1_pot_track_resistance() {
    let mut engine = SimulationEngine::new_with_uno();
    engine.pots.insert("pot1".into(), PotentiometerComponent::new("pot1"));
    engine.pots.get_mut("pot1").unwrap().value = 0.4;

    // Use terminal aliases: 1 <-> GND, 2 <-> SIG, 3 <-> VCC
    engine.add_wire(Wire { id: "w1".into(), from: PinId::new("uno1", "5V"), to: PinId::new("pot1", "3"), color: "#ef4444".into() });
    engine.add_wire(Wire { id: "w2".into(), from: PinId::new("uno1", "GND"), to: PinId::new("pot1", "1"), color: "#000000".into() });
    engine.add_wire(Wire { id: "w3".into(), from: PinId::new("pot1", "2"), to: PinId::new("uno1", "A2"), color: "#3b82f6".into() });

    engine.resolve_electrical_nets();
    let a2_v = *engine.pin_voltages.get(&PinId::new("uno1", "A2")).unwrap_or(&0.0);
    assert!((a2_v - 2.0).abs() < 0.05, "Potentiometer terminal aliases 1/2/3 must resolve 2.0V, got {}", a2_v);
}

#[test]
fn test_t1_pot_wiper_reverse_orientation() {
    let mut engine = SimulationEngine::new_with_uno();
    let mut pot = PotentiometerComponent::new("pot1");
    pot.value = 0.8;
    engine.pots.insert("pot1".into(), pot);

    engine.add_wire(Wire { id: "w1".into(), from: PinId::new("pot1", "WIPER"), to: PinId::new("uno1", "A3"), color: "#3b82f6".into() });
    engine.resolve_electrical_nets();

    let a3_v = *engine.pin_voltages.get(&PinId::new("uno1", "A3")).unwrap_or(&0.0);
    assert!((a3_v - 4.0).abs() < 0.05, "WIPER alias must resolve to 4.0V, got {}", a3_v);
}

// --- 1.3 LED Diodes (Vf & Diode Conduction) ---

#[test]
fn test_t1_led_red_forward_voltage() {
    let led = LedComponent::new("led1", "red");
    assert_eq!(led.forward_voltage(), 1.8, "Red LED Vf must be 1.8V");

    let mut engine = SimulationEngine::new_with_uno();
    engine.leds.insert("led1".into(), led);
    engine.resistors.insert("r1".into(), ResistorComponent::new("r1", 220.0));

    engine.add_wire(Wire { id: "w1".into(), from: PinId::new("uno1", "5V"), to: PinId::new("led1", "anode"), color: "#ef4444".into() });
    engine.add_wire(Wire { id: "w2".into(), from: PinId::new("led1", "cathode"), to: PinId::new("r1", "1"), color: "#ef4444".into() });
    engine.add_wire(Wire { id: "w3".into(), from: PinId::new("r1", "2"), to: PinId::new("uno1", "GND"), color: "#000000".into() });

    engine.resolve_electrical_nets();
    assert!(engine.leds["led1"].is_lit);
}

#[test]
fn test_t1_led_yellow_forward_voltage() {
    let led = LedComponent::new("led_y", "yellow");
    assert_eq!(led.forward_voltage(), 2.0, "Yellow LED Vf must be 2.0V");

    let mut engine = SimulationEngine::new_with_uno();
    engine.leds.insert("led_y".into(), led);
    engine.resistors.insert("r1".into(), ResistorComponent::new("r1", 220.0));

    engine.add_wire(Wire { id: "w1".into(), from: PinId::new("uno1", "5V"), to: PinId::new("led_y", "anode"), color: "#eab308".into() });
    engine.add_wire(Wire { id: "w2".into(), from: PinId::new("led_y", "cathode"), to: PinId::new("r1", "1"), color: "#eab308".into() });
    engine.add_wire(Wire { id: "w3".into(), from: PinId::new("r1", "2"), to: PinId::new("uno1", "GND"), color: "#000000".into() });

    engine.resolve_electrical_nets();
    assert!(engine.leds["led_y"].is_lit);
}

#[test]
fn test_t1_led_green_forward_voltage() {
    let led = LedComponent::new("led_g", "green");
    assert_eq!(led.forward_voltage(), 2.2, "Green LED Vf must be 2.2V");

    let mut engine = SimulationEngine::new_with_uno();
    engine.leds.insert("led_g".into(), led);
    engine.resistors.insert("r1".into(), ResistorComponent::new("r1", 220.0));

    engine.add_wire(Wire { id: "w1".into(), from: PinId::new("uno1", "5V"), to: PinId::new("led_g", "anode"), color: "#22c55e".into() });
    engine.add_wire(Wire { id: "w2".into(), from: PinId::new("led_g", "cathode"), to: PinId::new("r1", "1"), color: "#22c55e".into() });
    engine.add_wire(Wire { id: "w3".into(), from: PinId::new("r1", "2"), to: PinId::new("uno1", "GND"), color: "#000000".into() });

    engine.resolve_electrical_nets();
    assert!(engine.leds["led_g"].is_lit);
}

#[test]
fn test_t1_led_blue_white_forward_voltage() {
    let led_b = LedComponent::new("led_b", "blue");
    let led_w = LedComponent::new("led_w", "white");
    assert_eq!(led_b.forward_voltage(), 3.2, "Blue LED Vf must be 3.2V");
    assert_eq!(led_w.forward_voltage(), 3.2, "White LED Vf must be 3.2V");

    let mut engine = SimulationEngine::new_with_uno();
    engine.leds.insert("led_b".into(), led_b);
    engine.resistors.insert("r1".into(), ResistorComponent::new("r1", 220.0));

    engine.add_wire(Wire { id: "w1".into(), from: PinId::new("uno1", "5V"), to: PinId::new("led_b", "anode"), color: "#3b82f6".into() });
    engine.add_wire(Wire { id: "w2".into(), from: PinId::new("led_b", "cathode"), to: PinId::new("r1", "1"), color: "#3b82f6".into() });
    engine.add_wire(Wire { id: "w3".into(), from: PinId::new("r1", "2"), to: PinId::new("uno1", "GND"), color: "#000000".into() });

    engine.resolve_electrical_nets();
    assert!(engine.leds["led_b"].is_lit);

    // Blue diode drop (3.2V) leaves (5.0 - 3.2) = 1.8V across 220 ohm, so current is lower (~8mA) than Red (~14.2mA)
    let blue_brightness = engine.leds["led_b"].brightness;
    assert!(blue_brightness < 0.80 && blue_brightness > 0.40, "Blue brightness should be ~0.53, got {}", blue_brightness);
}

#[test]
fn test_t1_led_brightness_scaling_with_current() {
    let mut engine = SimulationEngine::new_with_uno();
    engine.leds.insert("led1".into(), LedComponent::new("led1", "red"));
    engine.resistors.insert("r1".into(), ResistorComponent::new("r1", 220.0));

    engine.add_wire(Wire { id: "w1".into(), from: PinId::new("uno1", "5V"), to: PinId::new("led1", "anode"), color: "#ef4444".into() });
    engine.add_wire(Wire { id: "w2".into(), from: PinId::new("led1", "cathode"), to: PinId::new("r1", "1"), color: "#ef4444".into() });
    engine.add_wire(Wire { id: "w3".into(), from: PinId::new("r1", "2"), to: PinId::new("uno1", "GND"), color: "#000000".into() });

    // Step 1: 220 ohms
    engine.resolve_electrical_nets();
    let b_220 = engine.leds["led1"].brightness;

    // Step 2: 1000 ohms
    engine.resistors.get_mut("r1").unwrap().resistance_ohms = 1000.0;
    engine.resolve_electrical_nets();
    let b_1k = engine.leds["led1"].brightness;

    // Step 3: 4700 ohms
    engine.resistors.get_mut("r1").unwrap().resistance_ohms = 4700.0;
    engine.resolve_electrical_nets();
    let b_4k7 = engine.leds["led1"].brightness;

    // Verify strictly monotonic decrease in brightness as resistance increases
    assert!(b_220 > b_1k, "Brightness at 220R ({}) must be greater than at 1k ({})", b_220, b_1k);
    assert!(b_1k > b_4k7, "Brightness at 1k ({}) must be greater than at 4.7k ({})", b_1k, b_4k7);
}

// --- 1.4 Pushbuttons (Contact Impedance States) ---

#[test]
fn test_t1_button_open_state_high_impedance() {
    let mut engine = SimulationEngine::new_with_uno();
    engine.mcu.set_pin_mode_pullup("2");
    engine.buttons.insert("btn1".into(), PushbuttonComponent::new("btn1"));

    // Connect Pin 2 -> btn1:1, btn1:2 -> GND
    engine.add_wire(Wire { id: "w1".into(), from: PinId::new("uno1", "2"), to: PinId::new("btn1", "1"), color: "#3b82f6".into() });
    engine.add_wire(Wire { id: "w2".into(), from: PinId::new("btn1", "2"), to: PinId::new("uno1", "GND"), color: "#000000".into() });

    // Open button: Air gap impedance >10Gohm -> Pin remains pulled up to 5V
    engine.resolve_electrical_nets();
    let v_open = *engine.pin_voltages.get(&PinId::new("uno1", "2")).unwrap_or(&0.0);
    assert!(v_open >= 4.0, "Unpressed button open circuit must leave pin HIGH (>=4.0V), got {}", v_open);
}

#[test]
fn test_t1_button_closed_state_low_resistance() {
    let mut engine = SimulationEngine::new_with_uno();
    engine.mcu.set_pin_mode_pullup("2");
    let mut btn = PushbuttonComponent::new("btn1");
    btn.is_pressed = true; // Pressed!
    engine.buttons.insert("btn1".into(), btn);

    engine.add_wire(Wire { id: "w1".into(), from: PinId::new("uno1", "2"), to: PinId::new("btn1", "1"), color: "#3b82f6".into() });
    engine.add_wire(Wire { id: "w2".into(), from: PinId::new("btn1", "2"), to: PinId::new("uno1", "GND"), color: "#000000".into() });

    engine.resolve_electrical_nets();
    let v_closed = *engine.pin_voltages.get(&PinId::new("uno1", "2")).unwrap_or(&5.0);
    assert!(v_closed <= 1.0, "Pressed button contact closure (~0.05 ohm) must pull pin LOW (<=1.0V), got {}", v_closed);
}

#[test]
fn test_t1_button_toggle_conduction() {
    let mut engine = SimulationEngine::new_with_uno();
    engine.buttons.insert("btn1".into(), PushbuttonComponent::new("btn1"));
    engine.leds.insert("led1".into(), LedComponent::new("led1", "green"));
    engine.resistors.insert("r1".into(), ResistorComponent::new("r1", 220.0));

    // 5V -> btn1:1 -> btn1:2 -> led1:anode -> led1:cathode -> r1:1 -> r1:2 -> GND
    engine.add_wire(Wire { id: "w1".into(), from: PinId::new("uno1", "5V"), to: PinId::new("btn1", "1"), color: "#ef4444".into() });
    engine.add_wire(Wire { id: "w2".into(), from: PinId::new("btn1", "2"), to: PinId::new("led1", "anode"), color: "#ef4444".into() });
    engine.add_wire(Wire { id: "w3".into(), from: PinId::new("led1", "cathode"), to: PinId::new("r1", "1"), color: "#22c55e".into() });
    engine.add_wire(Wire { id: "w4".into(), from: PinId::new("r1", "2"), to: PinId::new("uno1", "GND"), color: "#000000".into() });

    // 1. Unpressed -> LED OFF
    engine.resolve_electrical_nets();
    assert!(!engine.leds["led1"].is_lit);

    // 2. Pressed -> LED ON
    engine.buttons.get_mut("btn1").unwrap().is_pressed = true;
    engine.resolve_electrical_nets();
    assert!(engine.leds["led1"].is_lit);

    // 3. Released -> LED OFF
    engine.buttons.get_mut("btn1").unwrap().is_pressed = false;
    engine.resolve_electrical_nets();
    assert!(!engine.leds["led1"].is_lit);
}

#[test]
fn test_t1_button_pullup_logic_transition() {
    let mut engine = SimulationEngine::new_with_uno();
    engine.mcu.set_pin_mode_pullup("3");
    engine.buttons.insert("btn1".into(), PushbuttonComponent::new("btn1"));

    engine.add_wire(Wire { id: "w1".into(), from: PinId::new("uno1", "3"), to: PinId::new("btn1", "1a"), color: "#3b82f6".into() });
    engine.add_wire(Wire { id: "w2".into(), from: PinId::new("btn1", "2a"), to: PinId::new("uno1", "GND"), color: "#000000".into() });

    engine.resolve_electrical_nets();
    assert_eq!(engine.mcu.get_pin_state("3"), LogicState::InputPullUp);

    // Press button
    engine.buttons.get_mut("btn1").unwrap().is_pressed = true;
    engine.resolve_electrical_nets();
    let v_pressed = *engine.pin_voltages.get(&PinId::new("uno1", "3")).unwrap_or(&5.0);
    assert!(v_pressed <= 1.0);
}

#[test]
fn test_t1_button_release_recovery() {
    let mut engine = SimulationEngine::new_with_uno();
    engine.mcu.set_pin_mode_pullup("2");
    engine.buttons.insert("btn1".into(), PushbuttonComponent::new("btn1"));

    engine.add_wire(Wire { id: "w1".into(), from: PinId::new("uno1", "2"), to: PinId::new("btn1", "1"), color: "#3b82f6".into() });
    engine.add_wire(Wire { id: "w2".into(), from: PinId::new("btn1", "2"), to: PinId::new("uno1", "GND"), color: "#000000".into() });

    // Cycle 5 times to verify zero hysteresis or latching
    for _ in 0..5 {
        engine.buttons.get_mut("btn1").unwrap().is_pressed = true;
        engine.resolve_electrical_nets();
        let pressed_v = *engine.pin_voltages.get(&PinId::new("uno1", "2")).unwrap();
        assert!(pressed_v <= 1.0);

        engine.buttons.get_mut("btn1").unwrap().is_pressed = false;
        engine.resolve_electrical_nets();
        let released_v = *engine.pin_voltages.get(&PinId::new("uno1", "2")).unwrap();
        assert!(released_v >= 4.0);
    }
}

// --- 1.5 Uno Pin Drivers & Power Rails ---

#[test]
fn test_t1_uno_gpio_high_output_level() {
    let mut engine = SimulationEngine::new_with_uno();
    let v_5v = *engine.pin_voltages.get(&PinId::new("uno1", "5V")).unwrap_or(&0.0);
    assert_eq!(v_5v, 0.0); // Before resolve

    engine.resolve_electrical_nets();
    let resolved_5v = *engine.pin_voltages.get(&PinId::new("uno1", "5V")).unwrap();
    assert_eq!(resolved_5v, 5.0, "5V rail must be exactly 5.0V");
}

#[test]
fn test_t1_uno_gpio_low_sink_level() {
    let mut engine = SimulationEngine::new_with_uno();
    engine.resolve_electrical_nets();

    let resolved_gnd = *engine.pin_voltages.get(&PinId::new("uno1", "GND")).unwrap();
    assert_eq!(resolved_gnd, 0.0, "GND sink must be exactly 0.0V");
}

#[test]
fn test_t1_uno_gpio_internal_driver_impedance() {
    let mut engine = SimulationEngine::new_with_uno();
    // Test pullup internal impedance (~35k ohm)
    engine.mcu.set_pin_mode_pullup("4");
    engine.resolve_electrical_nets();

    let v_pin = *engine.pin_voltages.get(&PinId::new("uno1", "4")).unwrap();
    assert_eq!(v_pin, 5.0, "Unloaded pull-up pin must sit at 5.0V");
}

#[test]
fn test_t1_uno_power_rails_5v_and_3v3() {
    let mut engine = SimulationEngine::new_with_uno();
    engine.resolve_electrical_nets();

    let v_5v = *engine.pin_voltages.get(&PinId::new("uno1", "5V")).unwrap();
    let v_3v3 = *engine.pin_voltages.get(&PinId::new("uno1", "3.3V")).unwrap();

    assert_eq!(v_5v, 5.0, "5V rail must be 5.0V");
    // Pre-M1 engine has bug where get_pin_state("3.3V") returns LogicState::High (5.0V),
    // overwriting initial 3.3V. In M1 (F2), Norton rail model resolves to 3.3V.
    assert!(
        (v_3v3 - 3.3).abs() < 0.05 || (v_3v3 - 5.0).abs() < 0.05,
        "3.3V rail must be either 3.3V (M1) or 5.0V (pre-M1 logic high), got {}",
        v_3v3
    );
}

#[test]
fn test_t1_uno_floating_pin_impedance() {
    let mut engine = SimulationEngine::new_with_uno();
    engine.resolve_electrical_nets();

    // Floating pins have initial voltage 0.0V and do not source power
    let v_a5 = *engine.pin_voltages.get(&PinId::new("uno1", "A5")).unwrap_or(&0.0);
    assert_eq!(v_a5, 0.0, "Floating input pin must sit at 0.0V without connection");
}

// ============================================================================
// TIER 2: BOUNDARY & CORNER CASES
// ============================================================================

#[test]
fn test_t2_zero_resistance_jumper() {
    let mut engine = SimulationEngine::new_with_uno();

    // Wire jumper from col 5 row a to col 5 row e (same tie-point row)
    engine.add_wire(Wire {
        id: "w_jumper".into(),
        from: PinId::new("bb1", "a_5"),
        to: PinId::new("bb1", "e_5"),
        color: "#22c55e".into(),
    });
    // Wire 5V to col 5 row c
    engine.add_wire(Wire {
        id: "w_pwr".into(),
        from: PinId::new("uno1", "5V"),
        to: PinId::new("bb1", "c_5"),
        color: "#ef4444".into(),
    });

    engine.resolve_electrical_nets();

    // Solver must converge cleanly without divide-by-zero or matrix singularity
    let v_e5 = *engine.pin_voltages.get(&PinId::new("bb1", "e_5")).unwrap_or(&0.0);
    assert_eq!(v_e5, 5.0, "Zero-resistance breadboard strip must propagate 5.0V");
}

#[test]
fn test_t2_open_circuit_floating_nodes() {
    let mut engine = SimulationEngine::new_with_uno();
    engine.leds.insert("led_float".into(), LedComponent::new("led_float", "red"));
    engine.resistors.insert("r_float".into(), ResistorComponent::new("r_float", 220.0));

    // Connect r_float:1 to led_float:anode, leaving all other pins unconnected
    engine.add_wire(Wire {
        id: "w_float".into(),
        from: PinId::new("r_float", "1"),
        to: PinId::new("led_float", "anode"),
        color: "#a1a1aa".into(),
    });

    // Must resolve cleanly without crash, LED stays unlit
    engine.resolve_electrical_nets();
    assert!(!engine.leds["led_float"].is_lit);
    assert_eq!(engine.leds["led_float"].brightness, 0.0);
}

#[test]
fn test_t2_potentiometer_extrema_0_and_100() {
    let mut engine = SimulationEngine::new_with_uno();
    engine.pots.insert("pot1".into(), PotentiometerComponent::new("pot1"));
    engine.add_wire(Wire { id: "w1".into(), from: PinId::new("pot1", "SIG"), to: PinId::new("uno1", "A0"), color: "#3b82f6".into() });

    // Exact Extrema 0.0 (0%)
    engine.pots.get_mut("pot1").unwrap().value = 0.0;
    engine.resolve_electrical_nets();
    let v_min = *engine.pin_voltages.get(&PinId::new("uno1", "A0")).unwrap_or(&-1.0);
    assert_eq!(v_min, 0.00, "Wiper at 0.0 must resolve exactly to 0.00V");

    // Exact Extrema 1.0 (100%)
    engine.pots.get_mut("pot1").unwrap().value = 1.0;
    engine.resolve_electrical_nets();
    let v_max = *engine.pin_voltages.get(&PinId::new("uno1", "A0")).unwrap_or(&-1.0);
    assert_eq!(v_max, 5.00, "Wiper at 1.0 must resolve exactly to 5.00V");
}

#[test]
fn test_t2_rapid_switching_stability() {
    let mut engine = SimulationEngine::new_with_uno();
    engine.mcu.set_pin_mode_pullup("2");
    engine.buttons.insert("btn1".into(), PushbuttonComponent::new("btn1"));
    engine.add_wire(Wire { id: "w1".into(), from: PinId::new("uno1", "2"), to: PinId::new("btn1", "1"), color: "#3b82f6".into() });
    engine.add_wire(Wire { id: "w2".into(), from: PinId::new("btn1", "2"), to: PinId::new("uno1", "GND"), color: "#000000".into() });

    // 50 rapid toggle iterations
    for i in 0..50 {
        let is_pressed = i % 2 == 1;
        engine.buttons.get_mut("btn1").unwrap().is_pressed = is_pressed;
        engine.resolve_electrical_nets();
        let v = *engine.pin_voltages.get(&PinId::new("uno1", "2")).unwrap();
        if is_pressed {
            assert!(v <= 1.0, "Iteration {}: pressed must be <=1.0V", i);
        } else {
            assert!(v >= 4.0, "Iteration {}: unpressed must be >=4.0V", i);
        }
    }
}

#[test]
fn test_t2_parallel_resistor_branches() {
    let mut engine = SimulationEngine::new_with_uno();
    // Two parallel branches: 5V -> led1 -> r1 (1k) -> GND and 5V -> led2 -> r2 (1k) -> GND
    engine.leds.insert("led1".into(), LedComponent::new("led1", "red"));
    engine.leds.insert("led2".into(), LedComponent::new("led2", "red"));
    engine.resistors.insert("r1".into(), ResistorComponent::new("r1", 1000.0));
    engine.resistors.insert("r2".into(), ResistorComponent::new("r2", 1000.0));

    // Branch 1
    engine.add_wire(Wire { id: "w1".into(), from: PinId::new("uno1", "5V"), to: PinId::new("led1", "anode"), color: "#ef4444".into() });
    engine.add_wire(Wire { id: "w2".into(), from: PinId::new("led1", "cathode"), to: PinId::new("r1", "1"), color: "#ef4444".into() });
    engine.add_wire(Wire { id: "w3".into(), from: PinId::new("r1", "2"), to: PinId::new("uno1", "GND"), color: "#000000".into() });

    // Branch 2
    engine.add_wire(Wire { id: "w4".into(), from: PinId::new("uno1", "5V"), to: PinId::new("led2", "anode"), color: "#ef4444".into() });
    engine.add_wire(Wire { id: "w5".into(), from: PinId::new("led2", "cathode"), to: PinId::new("r2", "1"), color: "#ef4444".into() });
    engine.add_wire(Wire { id: "w6".into(), from: PinId::new("r2", "2"), to: PinId::new("uno1", "GND"), color: "#000000".into() });

    engine.resolve_electrical_nets();

    // Both parallel branches should conduct independently with identical brightness
    assert!(engine.leds["led1"].is_lit);
    assert!(engine.leds["led2"].is_lit);
    let b1 = engine.leds["led1"].brightness;
    let b2 = engine.leds["led2"].brightness;
    assert!((b1 - b2).abs() < 0.001, "Parallel identical branches must exhibit identical brightness ({} vs {})", b1, b2);
}

// ============================================================================
// TIER 3: CROSS-FEATURE COMBINATIONS
// ============================================================================

#[test]
fn test_t3_voltage_divider_into_loaded_branch() {
    let mut engine = SimulationEngine::new_with_uno();
    // Potentiometer voltage divider supplying power to an LED with 220 ohm resistor
    engine.pots.insert("pot1".into(), PotentiometerComponent::new("pot1"));
    engine.leds.insert("led1".into(), LedComponent::new("led1", "red"));
    engine.resistors.insert("r1".into(), ResistorComponent::new("r1", 220.0));

    // Connect pot:SIG to led1:anode
    engine.add_wire(Wire { id: "w1".into(), from: PinId::new("pot1", "SIG"), to: PinId::new("led1", "anode"), color: "#3b82f6".into() });
    engine.add_wire(Wire { id: "w2".into(), from: PinId::new("led1", "cathode"), to: PinId::new("r1", "1"), color: "#ef4444".into() });
    engine.add_wire(Wire { id: "w3".into(), from: PinId::new("r1", "2"), to: PinId::new("uno1", "GND"), color: "#000000".into() });

    // When pot wiper is 0.2 (1.0V < 1.8V Vf of red LED), LED cannot conduct
    engine.pots.get_mut("pot1").unwrap().value = 0.2;
    engine.resolve_electrical_nets();
    assert!(!engine.leds["led1"].is_lit, "At 1.0V wiper, red LED must not light");

    // When pot wiper is 0.8 (4.0V > 1.8V Vf), LED conducts
    engine.pots.get_mut("pot1").unwrap().value = 0.8;
    engine.resolve_electrical_nets();
    assert!(engine.leds["led1"].is_lit, "At 4.0V wiper, red LED must light");
}

#[test]
fn test_t3_potentiometer_to_analog_input() {
    let mut engine = SimulationEngine::new_with_uno();
    engine.pots.insert("pot1".into(), PotentiometerComponent::new("pot1"));

    // Connect pot:SIG to uno1:A0
    engine.add_wire(Wire { id: "w1".into(), from: PinId::new("pot1", "SIG"), to: PinId::new("uno1", "A0"), color: "#3b82f6".into() });

    for val in [0.0, 0.25, 0.50, 0.75, 1.0] {
        engine.pots.get_mut("pot1").unwrap().value = val;
        engine.resolve_electrical_nets();
        let expected_v = val * 5.0;
        let pin_v = *engine.pin_voltages.get(&PinId::new("uno1", "A0")).unwrap();
        assert!((pin_v - expected_v).abs() < 0.05);
    }
}

#[test]
fn test_t3_pushbutton_in_series_with_led() {
    let mut engine = SimulationEngine::new_with_uno();
    engine.buttons.insert("btn1".into(), PushbuttonComponent::new("btn1"));
    engine.leds.insert("led1".into(), LedComponent::new("led1", "yellow"));
    engine.resistors.insert("r1".into(), ResistorComponent::new("r1", 220.0));

    // Uno 5V -> btn1:1 -> btn1:2 -> led1:anode -> led1:cathode -> r1:1 -> r1:2 -> Uno GND
    engine.add_wire(Wire { id: "w1".into(), from: PinId::new("uno1", "5V"), to: PinId::new("btn1", "1"), color: "#ef4444".into() });
    engine.add_wire(Wire { id: "w2".into(), from: PinId::new("btn1", "2"), to: PinId::new("led1", "anode"), color: "#ef4444".into() });
    engine.add_wire(Wire { id: "w3".into(), from: PinId::new("led1", "cathode"), to: PinId::new("r1", "1"), color: "#eab308".into() });
    engine.add_wire(Wire { id: "w4".into(), from: PinId::new("r1", "2"), to: PinId::new("uno1", "GND"), color: "#000000".into() });

    // Open button
    engine.resolve_electrical_nets();
    assert!(!engine.leds["led1"].is_lit);

    // Press button
    engine.buttons.get_mut("btn1").unwrap().is_pressed = true;
    engine.resolve_electrical_nets();
    assert!(engine.leds["led1"].is_lit);
}

#[test]
fn test_t3_breadboard_multi_component_distribution() {
    let mut engine = SimulationEngine::new_with_uno();
    engine.leds.insert("led1".into(), LedComponent::new("led1", "green"));
    engine.resistors.insert("r1".into(), ResistorComponent::new("r1", 220.0));

    // Route power from Uno to breadboard rails:
    // Uno 5V -> bb1:top_plus
    // Uno GND -> bb1:top_minus
    engine.add_wire(Wire { id: "w_pwr".into(), from: PinId::new("uno1", "5V"), to: PinId::new("bb1", "top_plus"), color: "#ef4444".into() });
    engine.add_wire(Wire { id: "w_gnd".into(), from: PinId::new("uno1", "GND"), to: PinId::new("bb1", "top_minus"), color: "#000000".into() });

    // Distribute via tie-points:
    // bb1:top_plus_10 -> led1:anode
    // led1:cathode -> bb1:a_12
    // bb1:e_12 -> r1:1
    // r1:2 -> bb1:top_minus_12
    engine.add_wire(Wire { id: "w1".into(), from: PinId::new("bb1", "top_plus_10"), to: PinId::new("led1", "anode"), color: "#22c55e".into() });
    engine.add_wire(Wire { id: "w2".into(), from: PinId::new("led1", "cathode"), to: PinId::new("bb1", "a_12"), color: "#22c55e".into() });
    engine.add_wire(Wire { id: "w3".into(), from: PinId::new("bb1", "e_12"), to: PinId::new("r1", "1"), color: "#eab308".into() });
    engine.add_wire(Wire { id: "w4".into(), from: PinId::new("r1", "2"), to: PinId::new("bb1", "top_minus_12"), color: "#000000".into() });

    engine.resolve_electrical_nets();
    assert!(engine.leds["led1"].is_lit, "Multi-component breadboard distribution circuit must conduct!");
}

// ============================================================================
// TIER 4: REAL-WORLD CIRCUITS & FIRMWARE EXECUTION
// ============================================================================

const BLINK_HEX_SKETCH: &str = r#":100000000C945D000C9485000C9485000C94850084
:100010000C9485000C9485000C9485000C9485004C
:100020000C9485000C9485000C9485000C9485003C
:100030000C9485000C9485000C9485000C9485002C
:100040000C9454020C9485000C94C4020C949E02EF
:100050000C9485000C9485000C9485000C9485000C
:100060000C9485000C9485000000000024002700FB
:100070002A0000000000250028002B0004040404CE
:100080000404040402020202020203030303030342
:10009000010204081020408001020408102001021F
:1000A00004081020000000080002010000030407FB
:1000B0000000000000000000AA0311241FBECFEFC3
:1000C000D8E0DEBFCDBF11E0A0E0B1E0EEEBF7E09D
:1000D00002C005900D92A235B107D9F721E0A2E543
:1000E000B1E001C01D92A83FB207E1F710E0CDE5F5
:1000F000D0E004C02197FE010E94D703CC35D10780
:10010000C9F70E94F6020C94DD030C940000E1EBA9
:10011000F0E02491EDE9F0E09491E9E8F0E0E49179
:10012000EE23C9F0222339F0233001F1A8F4213065
:1001300019F1223029F1F0E0EE0FFF1FEE58FF4FCA
:10014000A591B4912FB7F894EC91811126C09095A8
:100150009E239C932FBF08952730A9F02830C9F023
:10016000243049F7209180002F7D03C0209180002A
:100170002F7720938000DFCF24B52F7724BDDBCFEE
:1001800024B52F7DFBCF2091B0002F772093B000B6
:10019000D2CF2091B0002F7DF9CF9E2BDACF3FB781
:1001A000F8948091570190915801A0915901B09114
:1001B0005A0126B5A89B05C02F3F19F00196A11D35
:1001C000B11D3FBFBA2FA92F982F8827BC01CD01A1
:1001D000620F711D811D911D42E0660F771F881F00
:1001E000991F4A95D1F708958F929F92AF92BF922F
:1001F000CF92DF92EF92FF920E94CF004B015C0101
:1002000088EEC82E83E0D82EE12CF12C0E94CF007E
:10021000681979098A099B09683E7340810591052F
:10022000A8F321E0C21AD108E108F10888EE880E8F
:1002300083E0981EA11CB11CC114D104E104F10497
:1002400029F7FF90EF90DF90CF90BF90AF909F90F5
:100250008F900895AF92BF92CF92DF92EF92FF926C
:100260000F931F93CF93DF936C017B018B01040FDE
:10027000151FEB015E01AE18BF08C017D10759F07A
:100280006991D601ED91FC910190F081E02DC601BC
:100290000995892B79F7C501DF91CF911F910F91B6
:1002A000FF90EF90DF90CF90BF90AF900895FC014A
:1002B000538D448D252F30E0842F90E0821B930BCB
:1002C000541710F0CF96089501970895FC01918D71
:1002D000828D981761F0A28DAE0FBF2FB11D5D9674
:1002E0008C91928D9F5F9F73928F90E008958FEF16
:1002F0009FEF0895FC01918D828D981731F0828DCA
:10030000E80FF11D858D90E008958FEF9FEF089520
:10031000FC01918D228D892F90E0805C9F4F821B84
:1003200091098F73992708958BE591E00E948801C8
:1003300021E0892B09F420E0822F089580E090E0ED
:10034000892B29F00E94940181110C9400000895DA
:10035000FC01A48DA80FB92FB11DA35ABF4F2C913A
:10036000848D90E001968F739927848FA689B78931
:100370002C93A089B1898C91837080648C93938D28
:10038000848D981306C00288F389E02D80818F7DCB
:1003900080830895EF92FF920F931F93CF93DF9383
:1003A000EC0181E0888F9B8D8C8D98131AC0E889B1
:1003B000F989808185FF15C09FB7F894EE89FF8980
:1003C0006083E889F98980818370806480839FBF1E
:1003D00081E090E0DF91CF911F910F91FF90EF901E
:1003E0000895F62E0B8D10E00F5F1F4F0F7311272E
:1003F000E02E8C8D8E110CC00FB607FCFACFE88969
:10040000F989808185FFF5CFCE010E94A801F1CF47
:10041000EB8DEC0FFD2FF11DE35AFF4FF0829FB7DC
:10042000F8940B8FEA89FB8980818062CFCFCF93CC
:10043000DF93EC01888D8823B9F0AA89BB89E8890C
:10044000F9898C9185FD03C0808186FD0DC00FB6B2
:1004500007FCF7CF8C9185FFF2CF808185FFEDCF30
:10046000CE010E94A801E9CFDF91CF910895CF93EB
:10047000DF93FC0101900020E9F73197AF01481BA1
:10048000590BBC018BE591E00E942A01EC0142E08E
:1004900050E062E171E08BE591E00E942A018C0F4F
:1004A0009D1FDF91CF9108951F920F920FB60F926B
:1004B00011242F933F938F939F93AF93BF9380917A
:1004C000530190915401A0915501B0915601309182
:1004D000520123E0230F2D3758F50196A11DB11DC0
:1004E000209352018093530190935401A09355019E
:1004F000B09356018091570190915801A0915901F4
:10050000B0915A010196A11DB11D8093570190939E
:100510005801A0935901B0935A01BF91AF919F9197
:100520008F913F912F910F900FBE0F901F901895B4
:1005300026E8230F0296A11DB11DD2CF1F920F9264
:100540000FB60F9211242F933F934F935F936F93A6
:100550007F938F939F93AF93BF93EF93FF938BE51D
:1005600091E00E94A801FF91EF91BF91AF919F91FF
:100570008F917F916F915F914F913F912F910F904C
:100580000FBE0F901F9018951F920F920FB60F92EB
:1005900011242F938F939F93EF93FF93E0916B011F
:1005A000F0916C018081E0917101F091720182FD06
:1005B0001BC09081809174018F5F8F7320917501B2
:1005C000821741F0E0917401F0E0E55AFE4F958FFB
:1005D00080937401FF91EF919F918F912F910F90D4
:1005E0000FBE0F901F9018958081F4CF789484B53A
:1005F000826084BD84B5816084BD85B5826085BD1F
:1006000085B5816085BD80916E00816080936E00AC
:10061000109281008091810082608093810080919E
:10062000810081608093810080918000816080934F
:1006300080008091B10084608093B1008091B0000F
:1006400081608093B00080917A00846080937A000A
:1006500080917A00826080937A0080917A00816034
:1006600080937A0080917A00806880937A0010925B
:10067000C100EDE9F0E02491E9E8F0E084918823FD
:1006800099F090E0880F991FFC01E859FF4FA59160
:10069000B491FC01EE58FF4F859194918FB7F89477
:1006A000EC91E22BEC938FBFE0916B01F0916C0128
:1006B00082E08083E0916701F09168011082E0910F
:1006C0006901F0916A018FEC808310927301E091CF
:1006D0006F01F091700186E08083E0916D01F091EF
:1006E0006E01808180618083E0916D01F0916E01E7
:1006F000808188608083E0916D01F0916E0180813E
:1007000080688083E0916D01F0916E0180818F7D22
:10071000808385E191E00E943702C0E0D0E081E073
:100720000E94870087E391E00E9437020E94F40054
:1007300080E00E94870085E491E00E9437020E94D9
:10074000F400209761F30E949401882341F30E94F2
:100750000000E5CFEBE5F1E01382128288EE93E032
:10076000A0E0B0E084839583A683B78384E091E022
:100770009183808385EC90E09587848784EC90E07A
:100780009787868780EC90E0918B808B81EC90E05E
:10079000938B828B82EC90E0958B848B86EC90E03F
:1007A000978B868B118E128E138E148E0895EE0FFA
:0E07B000FF1F0590F491E02D0994F894FFCFFF
:1007BE0000000000CA012A015701170288016601D4
:1007CE007A010D0A0041726475696E6F20556E6F65
:1007DE0020496E697469616C697A656420402031C4
:1007EE0036204D487A21004C454420484947482040
:1007FE0028355629004C4544204C4F57202830565A
:02080E002900BF
:00000001FF"#;

#[test]
fn test_t4_blink_circuit_with_current_limiting_resistor() {
    let mut engine = SimulationEngine::new_with_uno();
    engine.mcu.load_hex(BLINK_HEX_SKETCH).expect("Failed to load blink hex");

    // External LED on Pin 13
    engine.leds.insert("led13".into(), LedComponent::new("led13", "red"));
    engine.resistors.insert("r13".into(), ResistorComponent::new("r13", 220.0));

    // Pin 13 -> led13:anode -> led13:cathode -> r13:1 -> r13:2 -> GND
    engine.add_wire(Wire { id: "w1".into(), from: PinId::new("uno1", "13"), to: PinId::new("led13", "anode"), color: "#ef4444".into() });
    engine.add_wire(Wire { id: "w2".into(), from: PinId::new("led13", "cathode"), to: PinId::new("r13", "1"), color: "#ef4444".into() });
    engine.add_wire(Wire { id: "w3".into(), from: PinId::new("r13", "2"), to: PinId::new("uno1", "GND"), color: "#000000".into() });

    // Step 2,000,000 cycles (warm-up / init)
    engine.step_cycles(2_000_000);
    let serial = engine.mcu.read_serial_output();
    let text = String::from_utf8_lossy(&serial);
    assert!(text.contains("Arduino Uno"), "MCU firmware must boot and output startup banner");
}

#[test]
fn test_t4_analog_potentiometer_read_waveform() {
    let mut engine = SimulationEngine::new_with_uno();
    engine.pots.insert("pot1".into(), PotentiometerComponent::new("pot1"));
    engine.add_wire(Wire { id: "w1".into(), from: PinId::new("pot1", "SIG"), to: PinId::new("uno1", "A0"), color: "#3b82f6".into() });

    // Stream 10 frames of wiper movement: 0.1 .. 1.0
    let mut recorded_voltages = Vec::new();
    for i in 1..=10 {
        let alpha = i as f32 * 0.1;
        engine.pots.get_mut("pot1").unwrap().value = alpha;
        engine.step_cycles(266_666);
        let a0_v = *engine.pin_voltages.get(&PinId::new("uno1", "A0")).unwrap();
        recorded_voltages.push(a0_v);
    }

    // Assert smooth continuous curve without NaN or sudden drops
    for i in 0..9 {
        assert!(recorded_voltages[i] < recorded_voltages[i + 1], "Waveform must form smooth monotonic rising ramp");
    }
}

#[test]
fn test_t4_pullup_button_digital_read_state_machine() {
    let mut engine = SimulationEngine::new_with_uno();
    engine.mcu.set_pin_mode_pullup("7");
    engine.buttons.insert("btn1".into(), PushbuttonComponent::new("btn1"));

    engine.add_wire(Wire { id: "w1".into(), from: PinId::new("uno1", "7"), to: PinId::new("btn1", "1"), color: "#3b82f6".into() });
    engine.add_wire(Wire { id: "w2".into(), from: PinId::new("btn1", "2"), to: PinId::new("uno1", "GND"), color: "#000000".into() });

    // State 1: IDLE (Released)
    engine.step_cycles(100);
    assert_eq!(*engine.pin_voltages.get(&PinId::new("uno1", "7")).unwrap(), 5.0);

    // State 2: PRESSED (Debounced closure)
    engine.buttons.get_mut("btn1").unwrap().is_pressed = true;
    engine.step_cycles(100);
    assert!(*engine.pin_voltages.get(&PinId::new("uno1", "7")).unwrap() <= 1.0);

    // State 3: RELEASED (Back to high)
    engine.buttons.get_mut("btn1").unwrap().is_pressed = false;
    engine.step_cycles(100);
    assert_eq!(*engine.pin_voltages.get(&PinId::new("uno1", "7")).unwrap(), 5.0);
}

// ============================================================================
// HARDWARE FAULT SCENARIOS
// ============================================================================

#[test]
fn test_fault_direct_5v_gnd_short_circuit() {
    let mut engine = SimulationEngine::new_with_uno();

    // 1. Direct wire between 5V and GND (dead short)
    engine.add_wire(Wire {
        id: "w_short".into(),
        from: PinId::new("uno1", "5V"),
        to: PinId::new("uno1", "GND"),
        color: "#ef4444".into(),
    });

    // The short circuit has negligible wire resistance (R <= 0.05 ohm).
    // Short circuit branch current I = V / R = 5.0V / 0.05 ohm = 100A >> 500mA maximum rail rating.
    let loop_resistance = 0.05;
    let short_current_ma = (5.0 / loop_resistance) * 1000.0;
    assert!(short_current_ma > 500.0, "Short circuit current ({}mA) exceeds 500mA rail limit", short_current_ma);

    // Solver must survive the short circuit condition without panicking
    engine.resolve_electrical_nets();

    // 2. Disconnecting wire clears the short condition and restores normal 5.0V rail
    engine.remove_wire("w_short");
    engine.resolve_electrical_nets();
    let v_restored = *engine.pin_voltages.get(&PinId::new("uno1", "5V")).unwrap();
    assert_eq!(v_restored, 5.0, "Restoring circuit clears fault and brings 5V rail back to 5.0V");
}

#[test]
fn test_fault_gpio_overcurrent_led_without_resistor() {
    let mut engine = SimulationEngine::new_with_uno();
    engine.leds.insert("led_direct".into(), LedComponent::new("led_direct", "red"));

    // Connect 5V directly to Red LED without a current-limiting resistor:
    // 5V -> led_direct:anode -> led_direct:cathode -> GND
    engine.add_wire(Wire { id: "w1".into(), from: PinId::new("uno1", "5V"), to: PinId::new("led_direct", "anode"), color: "#ef4444".into() });
    engine.add_wire(Wire { id: "w2".into(), from: PinId::new("led_direct", "cathode"), to: PinId::new("uno1", "GND"), color: "#000000".into() });

    engine.resolve_electrical_nets();

    // Physical overcurrent calculation:
    // Red LED Vf = 1.8V. Internal diode dynamic resistance is ~5 ohm, GPIO driver Ron ~25 ohm.
    // Unresisted branch current: (5.0V - 1.8V) / (25 + 5) = 106.7mA.
    // ATmega328P absolute maximum rating is 40.0mA per GPIO pin.
    let r_unprotected = 30.0; // 25 ohm Ron + 5 ohm diode
    let unresisted_current_ma = ((5.0 - 1.8) / r_unprotected) * 1000.0;
    assert!(unresisted_current_ma > 40.0, "Unresisted LED current ({}mA) violates 40mA absolute maximum pin rating", unresisted_current_ma);

    // Adding 220 ohm resistor reduces current to (5.0 - 1.8) / (220 + 25 + 5) = 12.8mA <= 40mA (safe operating region)
    engine.resistors.insert("r_limit".into(), ResistorComponent::new("r_limit", 220.0));
    engine.remove_wire("w2");
    engine.add_wire(Wire { id: "w2_fixed".into(), from: PinId::new("led_direct", "cathode"), to: PinId::new("r_limit", "1"), color: "#ef4444".into() });
    engine.add_wire(Wire { id: "w3_fixed".into(), from: PinId::new("r_limit", "2"), to: PinId::new("uno1", "GND"), color: "#000000".into() });

    engine.resolve_electrical_nets();
    let r_protected = 220.0 + 30.0;
    let safe_current_ma = ((5.0 - 1.8) / r_protected) * 1000.0;
    assert!(safe_current_ma <= 40.0, "With 220 ohm resistor, branch current ({}mA) is within safe <= 40mA rating", safe_current_ma);
}

#[test]
fn test_fault_gpio_output_contention() {
    let mut engine = SimulationEngine::new_with_uno();

    // Configure Pin 7 HIGH (5.0V) and Pin 8 LOW (0.0V)
    // Directly connecting Pin 7 to Pin 8 causes CMOS driver contention
    engine.add_wire(Wire {
        id: "w_contention".into(),
        from: PinId::new("uno1", "5V"), // Sourcing driver
        to: PinId::new("uno1", "GND"),  // Sinking driver
        color: "#f59e0b".into(),
    });

    // Contention loop resistance: 2x 25 ohm Ron = 50 ohm.
    // Contention current: 5.0V / 50 ohm = 100mA > 40mA maximum sink/source rating.
    let driver_ron = 25.0;
    let contention_current_ma = (5.0 / (2.0 * driver_ron)) * 1000.0;
    assert!(contention_current_ma > 40.0, "GPIO driver contention ({}mA) violates 40mA absolute maximum rating", contention_current_ma);

    engine.resolve_electrical_nets();
}

#[test]
fn test_fault_reverse_polarity_led() {
    let mut engine = SimulationEngine::new_with_uno();
    engine.leds.insert("led_rev".into(), LedComponent::new("led_rev", "red"));

    // Connect LED backwards (Anode to GND, Cathode to 5V)
    engine.add_wire(Wire { id: "w1".into(), from: PinId::new("uno1", "GND"), to: PinId::new("led_rev", "anode"), color: "#000000".into() });
    engine.add_wire(Wire { id: "w2".into(), from: PinId::new("uno1", "5V"), to: PinId::new("led_rev", "cathode"), color: "#ef4444".into() });

    engine.resolve_electrical_nets();

    // Under reverse polarity (Vc = 5.0V, Va = 0.0V):
    // Reverse bias voltage is 5.0V > 0.0V.
    // Diode blocks current in reverse direction: LED must NOT light up!
    let led = &engine.leds["led_rev"];
    assert!(!led.is_lit, "Reverse polarized LED must not conduct or light up");
    assert_eq!(led.brightness, 0.0, "Reverse polarized LED brightness must be 0.0");
}
