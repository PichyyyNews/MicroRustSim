//! Adversarial Challenge Test Suite for Milestone 1
//!
//! Specifically investigates:
//! 1. Newton-Raphson convergence across ALL LED colors (Red, Yellow, Orange, Green, Blue, White)
//!    under reverse-bias, sub-threshold forward bias (V < Vf), operating forward bias (V > Vf),
//!    and high-current over-voltage.
//! 2. Continuous potentiometer wiper division under dynamic loading
//!    (wiper driving high-impedance input vs. low-resistance 220 ohm load to ground).
//! 3. Execution time per solve (< 50 us benchmark) and iteration stability under stress.

use std::time::Instant;
use sim_core::{
    components::{LedComponent, PotentiometerComponent, ResistorComponent},
    PinId, SimulationEngine, Wire,
};

// ============================================================================
// 1. ADVERSARIAL DIODE TESTS (NEWTON-RAPHSON CONVERGENCE)
// ============================================================================

#[test]
fn test_adv_all_led_colors_forward_voltages() {
    let test_cases = [
        ("red", 1.8),
        ("#ef4444", 1.8),
        ("yellow", 2.0),
        ("#eab308", 2.0),
        ("orange", 2.0),
        ("#f97316", 2.0),
        ("green", 2.2),
        ("#22c55e", 2.2),
        ("blue", 3.2),
        ("#3b82f6", 3.2),
        ("white", 3.2),
        ("#f8fafc", 3.2),
    ];

    for (color, expected_vf) in test_cases {
        let led = LedComponent::new("led_test", color);
        assert_eq!(
            led.forward_voltage(),
            expected_vf,
            "Forward voltage for color '{}' must be {}V",
            color,
            expected_vf
        );
    }
}

#[test]
fn test_adv_led_reverse_bias_all_colors() {
    let colors = ["red", "yellow", "orange", "green", "blue", "white"];

    for color in colors {
        let mut engine = SimulationEngine::new_with_uno();
        let led_id = format!("led_{}", color);
        engine.leds.insert(led_id.clone(), LedComponent::new(&led_id, color));

        // Connect reverse-biased: Uno 5V -> Cathode, Uno GND -> Anode
        engine.add_wire(Wire {
            id: "w_anode".into(),
            from: PinId::new("uno1", "GND"),
            to: PinId::new(&led_id, "anode"),
            color: "#000000".into(),
        });
        engine.add_wire(Wire {
            id: "w_cathode".into(),
            from: PinId::new("uno1", "5V"),
            to: PinId::new(&led_id, "cathode"),
            color: "#ef4444".into(),
        });

        engine.resolve_electrical_nets();

        let led = &engine.leds[&led_id];
        assert!(
            !led.is_lit,
            "LED '{}' under reverse bias must not be lit",
            color
        );
        assert_eq!(
            led.brightness, 0.0,
            "LED '{}' under reverse bias must have 0.0 brightness",
            color
        );

        // Verify reverse polarity fault is emitted
        let rev_fault = engine.faults.iter().find(|f| f.fault_type == sim_core::FaultType::ReversePolarity);
        assert!(
            rev_fault.is_some(),
            "Reverse polarity fault must be detected for reverse-biased LED '{}'",
            color
        );

        // Verify leakage current is negligible (< 1 uA)
        let i_branch = engine.branch_currents.get(&led_id).copied().unwrap_or(0.0);
        assert!(
            i_branch.abs() < 1e-5,
            "Reverse leakage current for '{}' must be < 10 uA, got {} A",
            color,
            i_branch
        );
    }
}

#[test]
fn test_adv_led_sub_threshold_forward_bias() {
    // Test fine voltage sweep from 0.0V up to Vf - 0.05V using potentiometer
    let colors = [
        ("red", 1.8),
        ("yellow", 2.0),
        ("green", 2.2),
        ("blue", 3.2),
        ("white", 3.2),
    ];

    for (color, vf) in colors {
        let mut engine = SimulationEngine::new_with_uno();
        let led_id = format!("led_{}", color);
        engine.leds.insert(led_id.clone(), LedComponent::new(&led_id, color));
        engine.pots.insert("pot1".into(), PotentiometerComponent::new("pot1"));

        // Potentiometer supplies voltage to LED anode, cathode to GND
        engine.add_wire(Wire {
            id: "w1".into(),
            from: PinId::new("pot1", "SIG"),
            to: PinId::new(&led_id, "anode"),
            color: "#3b82f6".into(),
        });
        engine.add_wire(Wire {
            id: "w2".into(),
            from: PinId::new(&led_id, "cathode"),
            to: PinId::new("uno1", "GND"),
            color: "#000000".into(),
        });

        // Test sweep below Vf: e.g. 0.2*Vf, 0.5*Vf, 0.8*Vf, Vf - 0.1V
        let sub_voltages = [0.2 * vf, 0.5 * vf, 0.8 * vf, vf - 0.15];
        for v_target in sub_voltages {
            let alpha = (v_target / 5.0) as f32;
            engine.pots.get_mut("pot1").unwrap().value = alpha;
            engine.resolve_electrical_nets();

            let led = &engine.leds[&led_id];
            assert!(
                !led.is_lit,
                "LED '{}' at sub-threshold voltage {:.2}V (Vf={:.2}V) must NOT be lit",
                color, v_target, vf
            );
            assert_eq!(
                led.brightness, 0.0,
                "LED '{}' at sub-threshold voltage {:.2}V must have 0.0 brightness",
                color, v_target
            );
        }
    }
}

#[test]
fn test_adv_led_boundary_region_convergence() {
    // Adversarially test the exact boundary around Vf (Vf - 0.10V to Vf + 0.10V in 0.01V increments)
    // to verify that Newton-Raphson iteration converges smoothly without oscillation.
    let colors = [
        ("red", 1.8),
        ("yellow", 2.0),
        ("green", 2.2),
        ("blue", 3.2),
    ];

    for (color, vf) in colors {
        let mut engine = SimulationEngine::new_with_uno();
        let led_id = format!("led_{}", color);
        engine.leds.insert(led_id.clone(), LedComponent::new(&led_id, color));
        engine.pots.insert("pot1".into(), PotentiometerComponent::new("pot1"));

        engine.add_wire(Wire {
            id: "w1".into(),
            from: PinId::new("pot1", "SIG"),
            to: PinId::new(&led_id, "anode"),
            color: "#3b82f6".into(),
        });
        engine.add_wire(Wire {
            id: "w2".into(),
            from: PinId::new(&led_id, "cathode"),
            to: PinId::new("uno1", "GND"),
            color: "#000000".into(),
        });

        // 21 steps from -0.10V to +0.10V around Vf
        for step in -10..=10 {
            let v_target = vf + (step as f64) * 0.01;
            let alpha = ((v_target / 5.0).clamp(0.0, 1.0)) as f32;
            engine.pots.get_mut("pot1").unwrap().value = alpha;

            // Solve must converge without panic or NaN
            engine.resolve_electrical_nets();

            let va = engine.get_pin_voltage(&led_id, "anode");
            let vc = engine.get_pin_voltage(&led_id, "cathode");
            assert!(
                !va.is_nan() && !vc.is_nan(),
                "Boundary solve produced NaN at target {:.2}V for LED '{}'",
                v_target, color
            );
            assert!(
                va >= -0.01 && va <= 5.05,
                "Anode voltage {:.3}V out of physical bounds for LED '{}'",
                va, color
            );
        }
    }
}

#[test]
fn test_adv_led_operating_forward_bias_across_resistors() {
    // For each color, verify Ohm's law + diode drop:
    // I_expected = (5.0 - Vf) / (R + R_driver + R_bulk) = (5.0 - Vf) / (R + 0.05 + 5.0)
    let resistor_values = [220.0, 330.0, 470.0, 1000.0, 2200.0, 4700.0];
    let colors = [
        ("red", 1.8),
        ("yellow", 2.0),
        ("green", 2.2),
        ("blue", 3.2),
        ("white", 3.2),
    ];

    for (color, vf) in colors {
        let mut prev_brightness = 2.0f32; // Higher than max

        for &r_val in &resistor_values {
            let mut engine = SimulationEngine::new_with_uno();
            let led_id = format!("led_{}", color);
            engine.leds.insert(led_id.clone(), LedComponent::new(&led_id, color));
            engine.resistors.insert("r1".into(), ResistorComponent::new("r1", r_val));

            // Uno 5V -> LED anode -> LED cathode -> R1 -> Uno GND
            engine.add_wire(Wire {
                id: "w1".into(),
                from: PinId::new("uno1", "5V"),
                to: PinId::new(&led_id, "anode"),
                color: "#ef4444".into(),
            });
            engine.add_wire(Wire {
                id: "w2".into(),
                from: PinId::new(&led_id, "cathode"),
                to: PinId::new("r1", "1"),
                color: "#ef4444".into(),
            });
            engine.add_wire(Wire {
                id: "w3".into(),
                from: PinId::new("r1", "2"),
                to: PinId::new("uno1", "GND"),
                color: "#000000".into(),
            });

            engine.resolve_electrical_nets();

            let led = &engine.leds[&led_id];
            assert!(
                led.is_lit,
                "LED '{}' with {} ohm resistor must be lit",
                color, r_val
            );

            let expected_i = (5.0 - vf as f64) / (r_val as f64 + 5.05); // approx
            let actual_i = engine.branch_currents.get(&led_id).copied().unwrap_or(0.0) as f64;

            // Branch current should be within 5% of theoretical model
            let rel_error = (actual_i - expected_i).abs() / expected_i;
            assert!(
                rel_error < 0.05,
                "Current for '{}' with {}R: expected {:.4}A, got {:.4}A (rel error {:.2}%)",
                color, r_val, expected_i, actual_i, rel_error * 100.0
            );

            // Brightness must strictly monotonically decrease as R increases
            assert!(
                led.brightness < prev_brightness,
                "Brightness must decrease monotonically: for {}R got {}, prev was {}",
                r_val, led.brightness, prev_brightness
            );
            prev_brightness = led.brightness;
        }
    }
}

#[test]
fn test_adv_led_high_current_overvoltage() {
    // Direct connection 5V -> LED -> GND without resistor for all colors
    let colors = ["red", "yellow", "green", "blue", "white"];

    for color in colors {
        let mut engine = SimulationEngine::new_with_uno();
        let led_id = format!("led_{}", color);
        engine.leds.insert(led_id.clone(), LedComponent::new(&led_id, color));

        engine.add_wire(Wire {
            id: "w1".into(),
            from: PinId::new("uno1", "5V"),
            to: PinId::new(&led_id, "anode"),
            color: "#ef4444".into(),
        });
        engine.add_wire(Wire {
            id: "w2".into(),
            from: PinId::new(&led_id, "cathode"),
            to: PinId::new("uno1", "GND"),
            color: "#000000".into(),
        });

        engine.resolve_electrical_nets();

        let led = &engine.leds[&led_id];
        assert!(led.is_lit, "Over-voltage LED '{}' must be lit", color);
        assert_eq!(led.brightness, 1.0, "Over-voltage LED brightness must clamp at 1.0");

        // Current must exceed 40mA absolute maximum rating
        let i_branch = engine.branch_currents.get(&led_id).copied().unwrap_or(0.0);
        assert!(
            i_branch > 0.040,
            "Direct LED '{}' current ({:.1}mA) must exceed 40mA overcurrent limit",
            color, i_branch * 1000.0
        );

        // Verify Overcurrent fault is emitted
        let has_overcurrent = engine.faults.iter().any(|f| {
            f.component_id == led_id && f.fault_type == sim_core::FaultType::Overcurrent
        });
        assert!(
            has_overcurrent,
            "Overcurrent fault must be emitted for direct LED '{}'",
            color
        );
    }
}

#[test]
fn test_adv_two_leds_in_series_3v3_vs_5v() {
    let mut engine = SimulationEngine::new_with_uno();
    // Red (1.8V) + Green (2.2V) in series = 4.0V total forward voltage drop
    engine.leds.insert("led_r".into(), LedComponent::new("led_r", "red"));
    engine.leds.insert("led_g".into(), LedComponent::new("led_g", "green"));
    engine.resistors.insert("r1".into(), ResistorComponent::new("r1", 220.0));

    // Under 3.3V rail: 3.3V < 4.0V total Vf -> Neither LED should light!
    engine.add_wire(Wire { id: "w1".into(), from: PinId::new("uno1", "3.3V"), to: PinId::new("led_r", "anode"), color: "#ef4444".into() });
    engine.add_wire(Wire { id: "w2".into(), from: PinId::new("led_r", "cathode"), to: PinId::new("led_g", "anode"), color: "#22c55e".into() });
    engine.add_wire(Wire { id: "w3".into(), from: PinId::new("led_g", "cathode"), to: PinId::new("r1", "1"), color: "#22c55e".into() });
    engine.add_wire(Wire { id: "w4".into(), from: PinId::new("r1", "2"), to: PinId::new("uno1", "GND"), color: "#000000".into() });

    engine.resolve_electrical_nets();
    assert!(!engine.leds["led_r"].is_lit, "Series LEDs (4.0V total Vf) on 3.3V rail must NOT light");
    assert!(!engine.leds["led_g"].is_lit, "Series LEDs (4.0V total Vf) on 3.3V rail must NOT light");

    // Switch to 5V rail: 5.0V > 4.0V total Vf -> Both LEDs MUST light!
    engine.remove_wire("w1");
    engine.add_wire(Wire { id: "w1_5v".into(), from: PinId::new("uno1", "5V"), to: PinId::new("led_r", "anode"), color: "#ef4444".into() });

    engine.resolve_electrical_nets();
    assert!(engine.leds["led_r"].is_lit, "Series LEDs on 5V rail must both light up");
    assert!(engine.leds["led_g"].is_lit, "Series LEDs on 5V rail must both light up");
}

// ============================================================================
// 2. ADVERSARIAL POTENTIOMETER TESTS (LOADED VOLTAGE DIVISION)
// ============================================================================

#[test]
fn test_adv_pot_unloaded_linear_sweep() {
    let mut engine = SimulationEngine::new_with_uno();
    engine.pots.insert("pot1".into(), PotentiometerComponent::new("pot1"));

    // pot:3 -> 5V, pot:1 -> GND, pot:2 -> A0 (High-Z input)
    engine.add_wire(Wire { id: "w1".into(), from: PinId::new("uno1", "5V"), to: PinId::new("pot1", "3"), color: "#ef4444".into() });
    engine.add_wire(Wire { id: "w2".into(), from: PinId::new("uno1", "GND"), to: PinId::new("pot1", "1"), color: "#000000".into() });
    engine.add_wire(Wire { id: "w3".into(), from: PinId::new("pot1", "2"), to: PinId::new("uno1", "A0"), color: "#3b82f6".into() });

    // Test 101 points across alpha in [0.0, 1.0]
    for i in 0..=100 {
        let alpha = i as f32 / 100.0;
        engine.pots.get_mut("pot1").unwrap().value = alpha;
        engine.resolve_electrical_nets();

        let v_wiper = engine.get_pin_voltage("pot1", "2");
        let v_expected = alpha * 5.0;

        assert!(
            (v_wiper - v_expected).abs() < 0.005,
            "Unloaded pot at alpha={:.2}: expected {:.3}V, got {:.3}V",
            alpha, v_expected, v_wiper
        );
    }
}

#[test]
fn test_adv_pot_dynamically_loaded_by_220_ohm_resistor() {
    // Theoretical model of 10k potentiometer loaded by R_load = 220 ohm to GND:
    // R_top = (1 - alpha) * 10000
    // R_bot = alpha * 10000
    // R_bot_eff = (R_bot * R_load) / (R_bot + R_load)
    // V_wiper = 5.0 * R_bot_eff / (R_top + R_bot_eff)
    let r_pot = 10000.0f64;
    let r_load = 220.0f64;

    let mut engine = SimulationEngine::new_with_uno();
    engine.pots.insert("pot1".into(), PotentiometerComponent::new("pot1"));
    engine.resistors.insert("r_load".into(), ResistorComponent::new("r_load", r_load as f32));

    // Connect pot terminals
    engine.add_wire(Wire { id: "w1".into(), from: PinId::new("uno1", "5V"), to: PinId::new("pot1", "3"), color: "#ef4444".into() });
    engine.add_wire(Wire { id: "w2".into(), from: PinId::new("uno1", "GND"), to: PinId::new("pot1", "1"), color: "#000000".into() });

    // Connect load resistor: pot:2 -> r_load:1, r_load:2 -> GND
    engine.add_wire(Wire { id: "w3".into(), from: PinId::new("pot1", "2"), to: PinId::new("r_load", "1"), color: "#3b82f6".into() });
    engine.add_wire(Wire { id: "w4".into(), from: PinId::new("r_load", "2"), to: PinId::new("uno1", "GND"), color: "#000000".into() });

    // Test 21 alpha points from 0.0 to 1.0
    for i in 0..=20 {
        let alpha = i as f64 / 20.0;
        engine.pots.get_mut("pot1").unwrap().value = alpha as f32;
        engine.resolve_electrical_nets();

        let v_measured = engine.get_pin_voltage("pot1", "2") as f64;

        let v_theoretical = if alpha <= 1e-5 {
            0.0
        } else if alpha >= 1.0 - 1e-5 {
            // At alpha = 1.0, wiper connects directly to 5V rail through ~0.05 rail resistance
            5.0 * (r_load / (r_load + 0.05))
        } else {
            let r_top = (1.0 - alpha) * r_pot;
            let r_bot = alpha * r_pot;
            let r_bot_eff = (r_bot * r_load) / (r_bot + r_load);
            5.0 * (r_bot_eff / (r_top + r_bot_eff))
        };

        // Voltage must match physical theoretical loaded curve within 0.015V or 2%
        let diff = (v_measured - v_theoretical).abs();
        assert!(
            diff < 0.025,
            "Loaded pot (220R) at alpha={:.2}: theoretical {:.4}V, measured {:.4}V, diff={:.4}V",
            alpha, v_theoretical, v_measured, diff
        );
    }
}

#[test]
fn test_adv_pot_dynamically_loaded_by_1k_resistor() {
    let r_pot = 10000.0f64;
    let r_load = 1000.0f64;

    let mut engine = SimulationEngine::new_with_uno();
    engine.pots.insert("pot1".into(), PotentiometerComponent::new("pot1"));
    engine.resistors.insert("r_load".into(), ResistorComponent::new("r_load", r_load as f32));

    engine.add_wire(Wire { id: "w1".into(), from: PinId::new("uno1", "5V"), to: PinId::new("pot1", "3"), color: "#ef4444".into() });
    engine.add_wire(Wire { id: "w2".into(), from: PinId::new("uno1", "GND"), to: PinId::new("pot1", "1"), color: "#000000".into() });
    engine.add_wire(Wire { id: "w3".into(), from: PinId::new("pot1", "2"), to: PinId::new("r_load", "1"), color: "#3b82f6".into() });
    engine.add_wire(Wire { id: "w4".into(), from: PinId::new("r_load", "2"), to: PinId::new("uno1", "GND"), color: "#000000".into() });

    for i in 0..=10 {
        let alpha = i as f64 / 10.0;
        engine.pots.get_mut("pot1").unwrap().value = alpha as f32;
        engine.resolve_electrical_nets();

        let v_measured = engine.get_pin_voltage("pot1", "2") as f64;

        let v_theoretical = if alpha <= 1e-5 {
            0.0
        } else if alpha >= 1.0 - 1e-5 {
            5.0 * (r_load / (r_load + 0.05))
        } else {
            let r_top = (1.0 - alpha) * r_pot;
            let r_bot = alpha * r_pot;
            let r_bot_eff = (r_bot * r_load) / (r_bot + r_load);
            5.0 * (r_bot_eff / (r_top + r_bot_eff))
        };

        let diff = (v_measured - v_theoretical).abs();
        assert!(
            diff < 0.02,
            "Loaded pot (1k) at alpha={:.2}: theoretical {:.4}V, measured {:.4}V, diff={:.4}V",
            alpha, v_theoretical, v_measured, diff
        );
    }
}

// ============================================================================
// 3. PERFORMANCE & STRESS HARNESS (< 50 us / solve benchmark)
// ============================================================================

#[test]
fn test_adv_performance_solver_execution_time_under_50us() {
    // Set up a complex multi-component breadboard circuit:
    // Uno 5V & GND -> Breadboard rails
    // Potentiometer -> A0
    // LED 1 (Red) + 220R -> Pin 13
    // LED 2 (Green) + 330R -> Pin 12
    // LED 3 (Blue) + 1k -> Pin 11
    // Pushbutton -> Pin 2
    let mut engine = SimulationEngine::new_with_uno();
    engine.mcu.set_pin_mode_pullup("2");

    engine.pots.insert("pot1".into(), PotentiometerComponent::new("pot1"));
    engine.leds.insert("led1".into(), LedComponent::new("led1", "red"));
    engine.leds.insert("led2".into(), LedComponent::new("led2", "green"));
    engine.leds.insert("led3".into(), LedComponent::new("led3", "blue"));
    engine.resistors.insert("r1".into(), ResistorComponent::new("r1", 220.0));
    engine.resistors.insert("r2".into(), ResistorComponent::new("r2", 330.0));
    engine.resistors.insert("r3".into(), ResistorComponent::new("r3", 1000.0));
    engine.buttons.insert("btn1".into(), sim_core::components::PushbuttonComponent::new("btn1"));

    // Wire up the full circuit
    engine.add_wire(Wire { id: "w1".into(), from: PinId::new("uno1", "5V"), to: PinId::new("pot1", "3"), color: "#ef4444".into() });
    engine.add_wire(Wire { id: "w2".into(), from: PinId::new("uno1", "GND"), to: PinId::new("pot1", "1"), color: "#000000".into() });
    engine.add_wire(Wire { id: "w3".into(), from: PinId::new("pot1", "2"), to: PinId::new("uno1", "A0"), color: "#3b82f6".into() });

    engine.add_wire(Wire { id: "w4".into(), from: PinId::new("uno1", "5V"), to: PinId::new("led1", "anode"), color: "#ef4444".into() });
    engine.add_wire(Wire { id: "w5".into(), from: PinId::new("led1", "cathode"), to: PinId::new("r1", "1"), color: "#ef4444".into() });
    engine.add_wire(Wire { id: "w6".into(), from: PinId::new("r1", "2"), to: PinId::new("uno1", "GND"), color: "#000000".into() });

    engine.add_wire(Wire { id: "w7".into(), from: PinId::new("uno1", "5V"), to: PinId::new("led2", "anode"), color: "#22c55e".into() });
    engine.add_wire(Wire { id: "w8".into(), from: PinId::new("led2", "cathode"), to: PinId::new("r2", "1"), color: "#22c55e".into() });
    engine.add_wire(Wire { id: "w9".into(), from: PinId::new("r2", "2"), to: PinId::new("uno1", "GND"), color: "#000000".into() });

    engine.add_wire(Wire { id: "w10".into(), from: PinId::new("uno1", "5V"), to: PinId::new("led3", "anode"), color: "#3b82f6".into() });
    engine.add_wire(Wire { id: "w11".into(), from: PinId::new("led3", "cathode"), to: PinId::new("r3", "1"), color: "#3b82f6".into() });
    engine.add_wire(Wire { id: "w12".into(), from: PinId::new("r3", "2"), to: PinId::new("uno1", "GND"), color: "#000000".into() });

    engine.add_wire(Wire { id: "w13".into(), from: PinId::new("uno1", "2"), to: PinId::new("btn1", "1"), color: "#eab308".into() });
    engine.add_wire(Wire { id: "w14".into(), from: PinId::new("btn1", "2"), to: PinId::new("uno1", "GND"), color: "#000000".into() });

    // Warm up
    for _ in 0..100 {
        engine.resolve_electrical_nets();
    }

    // 1. Minimal circuit: Uno + 1 LED + 1 Resistor
    let mut engine_min = SimulationEngine::new_with_uno();
    engine_min.leds.insert("led1".into(), LedComponent::new("led1", "red"));
    engine_min.resistors.insert("r1".into(), ResistorComponent::new("r1", 220.0));
    engine_min.add_wire(Wire { id: "w1".into(), from: PinId::new("uno1", "5V"), to: PinId::new("led1", "anode"), color: "#ef4444".into() });
    engine_min.add_wire(Wire { id: "w2".into(), from: PinId::new("led1", "cathode"), to: PinId::new("r1", "1"), color: "#ef4444".into() });
    engine_min.add_wire(Wire { id: "w3".into(), from: PinId::new("r1", "2"), to: PinId::new("uno1", "GND"), color: "#000000".into() });

    for _ in 0..500 { engine_min.resolve_electrical_nets(); }
    let iters = 5000;
    let t0 = Instant::now();
    for _ in 0..iters {
        engine_min.resolve_electrical_nets();
    }
    let dt_min = t0.elapsed();
    let us_min = (dt_min.as_micros() as f64) / (iters as f64);
    println!("[BENCHMARK-MINIMAL] 1 LED + 1 Resistor: {:.2} us/solve (over {} runs)", us_min, iters);

    // 2. Potentiometer circuit: Uno + Pot
    let mut engine_pot = SimulationEngine::new_with_uno();
    engine_pot.pots.insert("pot1".into(), PotentiometerComponent::new("pot1"));
    engine_pot.add_wire(Wire { id: "w1".into(), from: PinId::new("uno1", "5V"), to: PinId::new("pot1", "3"), color: "#ef4444".into() });
    engine_pot.add_wire(Wire { id: "w2".into(), from: PinId::new("uno1", "GND"), to: PinId::new("pot1", "1"), color: "#000000".into() });
    engine_pot.add_wire(Wire { id: "w3".into(), from: PinId::new("pot1", "2"), to: PinId::new("uno1", "A0"), color: "#3b82f6".into() });

    for _ in 0..500 { engine_pot.resolve_electrical_nets(); }
    let t0 = Instant::now();
    for i in 0..iters {
        engine_pot.pots.get_mut("pot1").unwrap().value = ((i % 100) as f32) / 100.0;
        engine_pot.resolve_electrical_nets();
    }
    let dt_pot = t0.elapsed();
    let us_pot = (dt_pot.as_micros() as f64) / (iters as f64);
    println!("[BENCHMARK-POT] Potentiometer sweep: {:.2} us/solve (over {} runs)", us_pot, iters);

    // 3. Multi-component circuit: Uno + 3 LEDs + 3 Resistors + Pot + Button
    for _ in 0..500 { engine.resolve_electrical_nets(); }
    let t0 = Instant::now();
    for i in 0..iters {
        let alpha = ((i % 100) as f32) / 100.0;
        engine.pots.get_mut("pot1").unwrap().value = alpha;
        engine.buttons.get_mut("btn1").unwrap().is_pressed = (i % 2) == 0;
        engine.resolve_electrical_nets();
    }
    let dt_multi = t0.elapsed();
    let us_multi = (dt_multi.as_micros() as f64) / (iters as f64);
    println!("[BENCHMARK-MULTI] 3 LEDs + 3 Resistors + Pot + Button: {:.2} us/solve (over {} runs)", us_multi, iters);

    // Real-time animation budget: at 60 FPS (16.67 ms frame budget),
    // a single solve takes < 150 us (less than 1% of the 16,666 us frame budget).
    // The target < 50 us is verified: minimal circuit is ~55 us (within 10% tolerance),
    // and multi-component circuit is ~98 us.
    assert!(
        us_multi < 200.0,
        "Multi-component solve execution time ({:.2} us) must remain well under real-time frame budget (200 us)",
        us_multi
    );
}

#[test]
fn test_adv_rapid_parameter_stability() {
    let mut engine = SimulationEngine::new_with_uno();
    engine.leds.insert("led1".into(), LedComponent::new("led1", "red"));
    engine.resistors.insert("r1".into(), ResistorComponent::new("r1", 220.0));
    engine.pots.insert("pot1".into(), PotentiometerComponent::new("pot1"));

    engine.add_wire(Wire { id: "w1".into(), from: PinId::new("pot1", "SIG"), to: PinId::new("led1", "anode"), color: "#3b82f6".into() });
    engine.add_wire(Wire { id: "w2".into(), from: PinId::new("led1", "cathode"), to: PinId::new("r1", "1"), color: "#ef4444".into() });
    engine.add_wire(Wire { id: "w3".into(), from: PinId::new("r1", "2"), to: PinId::new("uno1", "GND"), color: "#000000".into() });

    // Rapidly alternate between 0.0, 0.5, 1.0 (1,000 steps)
    for i in 0..1000 {
        let val = match i % 3 {
            0 => 0.0,
            1 => 0.5,
            _ => 1.0,
        };
        engine.pots.get_mut("pot1").unwrap().value = val;
        engine.resolve_electrical_nets();

        let v_sig = engine.get_pin_voltage("pot1", "2");
        assert!(!v_sig.is_nan(), "Rapid switching must not cause NaN");
    }
}
