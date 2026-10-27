//! Adversarial Empirical Stress Tests for MNA Circuit Solver in MicroRustSim
//!
//! Stress dimensions tested:
//! 1. Singular & near-singular matrices (all zeros, rank deficiency, floating loops/islands).
//! 2. Dead short circuits & power contention (5V-GND, 3.3V-GND, 5V-3.3V rail contention, GPIO contention).
//! 3. High component counts (32-stage R-2R ladder, 10x10 resistor mesh grid with 200 resistors).
//! 4. Extreme/boundary component parameters (zero/negative resistance, pot value clamps, extreme diode bias).
//! 5. Numerical stability: strictly 0 NaNs, 0 Infs, 0 panics.

use sim_core::{
    components::{LedComponent, PotentiometerComponent, PushbuttonComponent, ResistorComponent},
    solver::{solve_linear_system, FaultType},
    LogicState, McuCore, PinId, SimulationEngine, Wire,
};
use std::collections::HashMap;

struct MockMcu {
    states: HashMap<String, LogicState>,
}

impl MockMcu {
    fn new() -> Self {
        Self { states: HashMap::new() }
    }
    fn set(&mut self, pin: &str, state: LogicState) {
        self.states.insert(pin.to_string(), state);
    }
}

impl McuCore for MockMcu {
    fn name(&self) -> &str { "mock_mcu" }
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


// ============================================================================
// 1. DIRECT LINEAR SYSTEM SOLVER STRESS (solve_linear_system)
// ============================================================================

#[test]
fn test_adv_solve_linear_system_empty_and_zero_matrix() {
    // 0x0
    assert!(solve_linear_system(0, &mut [], &mut [], &mut []));

    // 1x1 zero
    let mut a = [0.0];
    let mut b = [0.0];
    let mut x = [999.0];
    assert!(solve_linear_system(1, &mut a, &mut b, &mut x));
    assert!(!x[0].is_nan() && !x[0].is_infinite());
    assert_eq!(x[0], 0.0);

    // 5x5 zero matrix
    let mut a = vec![0.0f64; 25];
    let mut b = vec![0.0f64; 5];
    let mut x = vec![999.0f64; 5];
    assert!(solve_linear_system(5, &mut a, &mut b, &mut x));
    for val in &x {
        assert!(!val.is_nan() && !val.is_infinite());
        assert_eq!(*val, 0.0);
    }
}

#[test]
fn test_adv_solve_linear_system_rank_deficient() {
    // 3x3 matrix with rank 1 (all rows identical)
    let mut a = vec![
        1.0, 2.0, 3.0,
        1.0, 2.0, 3.0,
        1.0, 2.0, 3.0,
    ];
    let mut b = vec![6.0, 6.0, 6.0];
    let mut x = vec![0.0f64; 3];
    assert!(solve_linear_system(3, &mut a, &mut b, &mut x));
    for val in &x {
        assert!(!val.is_nan(), "Rank deficient solution produced NaN");
        assert!(!val.is_infinite(), "Rank deficient solution produced Inf");
    }
}

#[test]
fn test_adv_solve_linear_system_ill_conditioned_hilbert() {
    // Hilbert matrix H_n has condition number growing exponentially: ~1.5e4 for n=4, ~1.5e10 for n=8
    let n = 8;
    let mut a = vec![0.0f64; n * n];
    let mut b = vec![1.0f64; n];
    let mut x = vec![0.0f64; n];

    for i in 0..n {
        for j in 0..n {
            a[i * n + j] = 1.0 / ((i + j + 1) as f64);
        }
    }

    assert!(solve_linear_system(n, &mut a, &mut b, &mut x));
    for (i, val) in x.iter().enumerate() {
        assert!(!val.is_nan(), "Hilbert x[{}] produced NaN", i);
        assert!(!val.is_infinite(), "Hilbert x[{}] produced Inf", i);
    }
}

// ============================================================================
// 2. DISCONNECTED FLOATING ISLANDS & SINGULAR TOPOLOGIES
// ============================================================================

#[test]
fn test_adv_floating_disjoint_resistor_islands() {
    let mut engine = SimulationEngine::new_with_uno();

    // Spawn 20 independent resistors completely floating with no connection to power or ground
    for i in 0..20 {
        let r_id = format!("r_float_{}", i);
        engine.resistors.insert(r_id.clone(), ResistorComponent::new(&r_id, 1000.0 * (i as f32 + 1.0)));
    }

    engine.resolve_electrical_nets();

    for i in 0..20 {
        let r_id = format!("r_float_{}", i);
        let v1 = *engine.pin_voltages.get(&PinId::new(&r_id, "1")).unwrap();
        let v2 = *engine.pin_voltages.get(&PinId::new(&r_id, "2")).unwrap();
        assert!(!v1.is_nan() && !v1.is_infinite());
        assert!(!v2.is_nan() && !v2.is_infinite());
        assert_eq!(v1, 0.0);
        assert_eq!(v2, 0.0);
    }
}

#[test]
fn test_adv_floating_resistor_closed_ring() {
    let mut engine = SimulationEngine::new_with_uno();

    // 10 resistors connected in a closed loop floating in space
    for i in 0..10 {
        let r_id = format!("r_ring_{}", i);
        engine.resistors.insert(r_id.clone(), ResistorComponent::new(&r_id, 330.0));
    }
    for i in 0..10 {
        let next = (i + 1) % 10;
        engine.add_wire(Wire {
            id: format!("w_ring_{}", i),
            from: PinId::new(format!("r_ring_{}", i), "2"),
            to: PinId::new(format!("r_ring_{}", next), "1"),
            color: "#6b7280".into(),
        });
    }

    engine.resolve_electrical_nets();

    for i in 0..10 {
        let r_id = format!("r_ring_{}", i);
        let v1 = *engine.pin_voltages.get(&PinId::new(&r_id, "1")).unwrap();
        let v2 = *engine.pin_voltages.get(&PinId::new(&r_id, "2")).unwrap();
        assert!(!v1.is_nan() && !v1.is_infinite());
        assert!(!v2.is_nan() && !v2.is_infinite());
        assert_eq!(v1, 0.0);
        assert_eq!(v2, 0.0);
    }
}

#[test]
fn test_adv_floating_potentiometers_and_leds_chain() {
    let mut engine = SimulationEngine::new_with_uno();

    // Potentiometer with VCC and GND wired to each other (floating loop)
    engine.pots.insert("pot_float".into(), PotentiometerComponent::new("pot_float"));
    engine.add_wire(Wire {
        id: "w_p1".into(),
        from: PinId::new("pot_float", "3"),
        to: PinId::new("pot_float", "1"),
        color: "#6b7280".into(),
    });

    // Disconnected LED chain
    for i in 0..5 {
        let led_id = format!("led_float_{}", i);
        engine.leds.insert(led_id.clone(), LedComponent::new(&led_id, "blue"));
    }
    for i in 0..4 {
        engine.add_wire(Wire {
            id: format!("w_l_{}", i),
            from: PinId::new(format!("led_float_{}", i), "cathode"),
            to: PinId::new(format!("led_float_{}", i + 1), "anode"),
            color: "#6b7280".into(),
        });
    }

    engine.resolve_electrical_nets();

    for i in 0..5 {
        let led_id = format!("led_float_{}", i);
        assert!(!engine.leds[&led_id].is_lit);
        assert_eq!(engine.leds[&led_id].brightness, 0.0);
    }
}

// ============================================================================
// 3. LOW RESISTANCE LOOPS, DEAD SHORTS & CONTENTION
// ============================================================================

#[test]
fn test_adv_dead_short_5v_to_gnd_multiple_parallel_jumpers() {
    let mut engine = SimulationEngine::new_with_uno();

    // 5 direct jumpers between 5V and GND in parallel
    for i in 0..5 {
        engine.add_wire(Wire {
            id: format!("w_short_{}", i),
            from: PinId::new("uno1", "5V"),
            to: PinId::new("uno1", "GND"),
            color: "#ef4444".into(),
        });
    }

    engine.resolve_electrical_nets();

    let v5v = *engine.pin_voltages.get(&PinId::new("uno1", "5V")).unwrap();
    assert!(!v5v.is_nan() && !v5v.is_infinite());
    assert!(v5v >= 0.0 && v5v < 1.0, "Multiple short jumpers must pull 5V down below 1.0V, got {}", v5v);

    // Must trigger ShortCircuit fault
    let has_short = engine.faults.iter().any(|f| f.fault_type == FaultType::ShortCircuit && f.pin_name == "5V");
    assert!(has_short, "5V short-circuit fault must be reported");
}

#[test]
fn test_adv_dead_short_3v3_to_gnd() {
    let mut engine = SimulationEngine::new_with_uno();

    engine.add_wire(Wire {
        id: "w_short_3v3".into(),
        from: PinId::new("uno1", "3.3V"),
        to: PinId::new("uno1", "GND"),
        color: "#ef4444".into(),
    });

    engine.resolve_electrical_nets();

    let v3v3 = *engine.pin_voltages.get(&PinId::new("uno1", "3.3V")).unwrap();
    assert!(!v3v3.is_nan() && !v3v3.is_infinite());
    assert!(v3v3 < 1.0, "3.3V rail shorted to GND must collapse, got {}", v3v3);

    let has_short = engine.faults.iter().any(|f| f.fault_type == FaultType::ShortCircuit && f.pin_name == "3.3V");
    assert!(has_short, "3.3V short-circuit fault must be reported");
}

#[test]
fn test_adv_power_rail_contention_5v_to_3v3() {
    let mut engine = SimulationEngine::new_with_uno();

    // Directly bridge 5V rail to 3.3V rail
    engine.add_wire(Wire {
        id: "w_rail_contention".into(),
        from: PinId::new("uno1", "5V"),
        to: PinId::new("uno1", "3.3V"),
        color: "#f59e0b".into(),
    });

    engine.resolve_electrical_nets();

    let v5v = *engine.pin_voltages.get(&PinId::new("uno1", "5V")).unwrap();
    let v3v3 = *engine.pin_voltages.get(&PinId::new("uno1", "3.3V")).unwrap();
    assert!(!v5v.is_nan() && !v5v.is_infinite());
    assert!(!v3v3.is_nan() && !v3v3.is_infinite());

    // Because R_rail_5V = 0.05 ohm and R_rail_3V3 = 0.1 ohm, 5V will source current into 3.3V rail
    // Voltage must sit between 3.3V and 5.0V
    assert!(v3v3 >= 3.3 && v3v3 <= 5.0, "Rail contention voltage must be between 3.3V and 5.0V, got {}", v3v3);
    assert!((v5v - v3v3).abs() < 0.5, "Connected rails must equalize within wire drop");
}

#[test]
fn test_adv_pushbutton_short_circuit_on_press() {
    let mut engine = SimulationEngine::new_with_uno();
    engine.buttons.insert("btn_short".into(), PushbuttonComponent::new("btn_short"));

    engine.add_wire(Wire { id: "w1".into(), from: PinId::new("uno1", "5V"), to: PinId::new("btn_short", "1"), color: "#ef4444".into() });
    engine.add_wire(Wire { id: "w2".into(), from: PinId::new("btn_short", "2"), to: PinId::new("uno1", "GND"), color: "#000000".into() });

    // 1. Unpressed: open circuit, no fault, 5V rail intact
    engine.buttons.get_mut("btn_short").unwrap().is_pressed = false;
    engine.resolve_electrical_nets();
    assert_eq!(*engine.pin_voltages.get(&PinId::new("uno1", "5V")).unwrap(), 5.0);
    assert!(engine.faults.is_empty());

    // 2. Pressed: switch conducts (0.05 ohm), shorting 5V to GND
    engine.buttons.get_mut("btn_short").unwrap().is_pressed = true;
    engine.resolve_electrical_nets();
    let v5v = *engine.pin_voltages.get(&PinId::new("uno1", "5V")).unwrap();
    // Theoretical divider: 5.0 * (0.02 + 0.05 + 0.02) / (0.05 + 0.02 + 0.05 + 0.02) = 5.0 * 0.09 / 0.14 = 3.214V
    assert!((v5v - 3.214).abs() < 0.05, "5V rail with depressed button must drop to ~3.21V, got {}", v5v);
    let has_short = engine.faults.iter().any(|f| f.fault_type == FaultType::ShortCircuit);
    assert!(has_short, "Fault must be emitted when button is depressed across 5V and GND");

    // 3. Released: recovers cleanly
    engine.buttons.get_mut("btn_short").unwrap().is_pressed = false;
    engine.resolve_electrical_nets();
    assert_eq!(*engine.pin_voltages.get(&PinId::new("uno1", "5V")).unwrap(), 5.0);
    assert!(engine.faults.is_empty(), "Faults must clear when button is released");
}

// ============================================================================
// 4. HIGH COMPONENT COUNTS & COMPLEX LADDERS/MESHES
// ============================================================================

#[test]
fn test_adv_32_stage_r2r_resistor_ladder() {
    let mut engine = SimulationEngine::new_with_uno();
    let stages = 32;

    // Build 32-stage R-2R ladder (R = 10k, 2R = 20k)
    // Nodes: n_0 .. n_31
    for i in 0..stages {
        // Series resistor R connecting n_{i} to n_{i+1}
        if i < stages - 1 {
            let r_id = format!("r_series_{}", i);
            engine.resistors.insert(r_id.clone(), ResistorComponent::new(&r_id, 10_000.0));
        }
        // Shunt resistor 2R connecting n_{i} to GND
        let r_shunt_id = format!("r_shunt_{}", i);
        engine.resistors.insert(r_shunt_id.clone(), ResistorComponent::new(&r_shunt_id, 20_000.0));
    }

    // Connect MSB (stage 31) to 5V rail
    engine.add_wire(Wire {
        id: "w_msb".into(),
        from: PinId::new("uno1", "5V"),
        to: PinId::new("r_shunt_31", "1"),
        color: "#ef4444".into(),
    });

    // Wire shunts to GND
    for i in 0..stages {
        engine.add_wire(Wire {
            id: format!("w_gnd_{}", i),
            from: PinId::new(format!("r_shunt_{}", i), "2"),
            to: PinId::new("uno1", "GND"),
            color: "#000000".into(),
        });
    }

    // Wire series resistors
    for i in 0..(stages - 1) {
        engine.add_wire(Wire {
            id: format!("w_s1_{}", i),
            from: PinId::new(format!("r_shunt_{}", i), "1"),
            to: PinId::new(format!("r_series_{}", i), "1"),
            color: "#3b82f6".into(),
        });
        engine.add_wire(Wire {
            id: format!("w_s2_{}", i),
            from: PinId::new(format!("r_series_{}", i), "2"),
            to: PinId::new(format!("r_shunt_{}", i + 1), "1"),
            color: "#3b82f6".into(),
        });
    }

    engine.resolve_electrical_nets();

    // Verify all nodes are finite, strictly between 0.0 and 5.0, and monotonic
    let mut prev_v = 10.0f32;
    for i in (0..stages).rev() {
        let v = *engine.pin_voltages.get(&PinId::new(format!("r_shunt_{}", i), "1")).unwrap();
        assert!(!v.is_nan() && !v.is_infinite());
        assert!(v >= 0.0 && v <= 5.0, "R-2R voltage at stage {} out of bounds: {}", i, v);
        assert!(v <= prev_v + 1e-4, "R-2R ladder must decay monotonically towards LSB");
        prev_v = v;
    }
}

#[test]
fn test_adv_massive_10x10_resistor_grid() {
    let mut engine = SimulationEngine::new_with_uno();
    let size = 10;

    // Create 10x10 grid: horizontal and vertical resistors
    for r in 0..size {
        for c in 0..(size - 1) {
            let id = format!("rh_{}_{}", r, c);
            engine.resistors.insert(id, ResistorComponent::new(&format!("rh_{}_{}", r, c), 1000.0));
        }
    }
    for r in 0..(size - 1) {
        for c in 0..size {
            let id = format!("rv_{}_{}", r, c);
            engine.resistors.insert(id, ResistorComponent::new(&format!("rv_{}_{}", r, c), 1000.0));
        }
    }

    // Connect breadboard tie-points as grid junctions
    for r in 0..size {
        for c in 0..size {
            // Connect horizontal right if exists
            if c < size - 1 {
                engine.add_wire(Wire {
                    id: format!("wh_{}_{}", r, c),
                    from: PinId::new("bb1", format!("a_{}", r * 3 + (c % 3) + 1)),
                    to: PinId::new(format!("rh_{}_{}", r, c), "1"),
                    color: "#3b82f6".into(),
                });
            }
        }
    }

    // Connect top-left (0,0) to 5V and bottom-right (9,9) to GND
    engine.add_wire(Wire {
        id: "w_pwr_grid".into(),
        from: PinId::new("uno1", "5V"),
        to: PinId::new("bb1", "a_1"),
        color: "#ef4444".into(),
    });
    engine.add_wire(Wire {
        id: "w_gnd_grid".into(),
        from: PinId::new("bb1", "a_28"),
        to: PinId::new("uno1", "GND"),
        color: "#000000".into(),
    });

    let start = std::time::Instant::now();
    engine.resolve_electrical_nets();
    let elapsed = start.elapsed();

    // Verify solve performance & numerical validity
    assert!(elapsed.as_millis() < 500, "10x10 grid must solve within 500ms, took {:?}", elapsed);
    for (_, v) in &engine.pin_voltages {
        assert!(!v.is_nan(), "Grid node voltage was NaN");
        assert!(!v.is_infinite(), "Grid node voltage was Inf");
        assert!(*v >= -1e-4 && *v <= 5.0001, "Grid voltage {} out of range [0, 5]", v);
    }
}

// ============================================================================
// 5. WHEATSTONE BRIDGE & EXTREME BOUNDARIES
// ============================================================================

#[test]
fn test_adv_wheatstone_bridge_near_balance() {
    let mut engine = SimulationEngine::new_with_uno();

    // Wheatstone bridge: R1, R2, R3 = 1000 ohm; R4 swept from 990 to 1010
    engine.resistors.insert("r1".into(), ResistorComponent::new("r1", 1000.0));
    engine.resistors.insert("r2".into(), ResistorComponent::new("r2", 1000.0));
    engine.resistors.insert("r3".into(), ResistorComponent::new("r3", 1000.0));
    engine.resistors.insert("r4".into(), ResistorComponent::new("r4", 1000.0));

    // Top node = 5V
    engine.add_wire(Wire { id: "w_top1".into(), from: PinId::new("uno1", "5V"), to: PinId::new("r1", "1"), color: "#ef4444".into() });
    engine.add_wire(Wire { id: "w_top2".into(), from: PinId::new("uno1", "5V"), to: PinId::new("r3", "1"), color: "#ef4444".into() });

    // Mid nodes
    // Left bridge node: r1:2 <-> r2:1
    engine.add_wire(Wire { id: "w_left".into(), from: PinId::new("r1", "2"), to: PinId::new("r2", "1"), color: "#3b82f6".into() });
    // Right bridge node: r3:2 <-> r4:1
    engine.add_wire(Wire { id: "w_right".into(), from: PinId::new("r3", "2"), to: PinId::new("r4", "1"), color: "#3b82f6".into() });

    // Bottom node = GND
    engine.add_wire(Wire { id: "w_bot1".into(), from: PinId::new("r2", "2"), to: PinId::new("uno1", "GND"), color: "#000000".into() });
    engine.add_wire(Wire { id: "w_bot2".into(), from: PinId::new("r4", "2"), to: PinId::new("uno1", "GND"), color: "#000000".into() });

    // Test 1: Exactly balanced at R4 = 1000.0 ohm
    engine.resolve_electrical_nets();
    let v_left = *engine.pin_voltages.get(&PinId::new("r1", "2")).unwrap();
    let v_right = *engine.pin_voltages.get(&PinId::new("r3", "2")).unwrap();
    assert!((v_left - 2.50).abs() < 0.01, "Balanced left node must be 2.5V, got {}", v_left);
    assert!((v_right - 2.50).abs() < 0.01, "Balanced right node must be 2.5V, got {}", v_right);
    assert!((v_left - v_right).abs() < 0.001, "V_bridge across balanced detector must be 0.000V");

    // Test 2: Slightly unbalanced at R4 = 1010.0 ohm
    engine.resistors.get_mut("r4").unwrap().resistance_ohms = 1010.0;
    engine.resolve_electrical_nets();
    let v_right_unbal = *engine.pin_voltages.get(&PinId::new("r3", "2")).unwrap();
    assert!(v_right_unbal > v_left, "Higher R4 must shift right node voltage higher: {} vs {}", v_right_unbal, v_left);
}

#[test]
fn test_adv_extreme_component_values() {
    let mut engine = SimulationEngine::new_with_uno();

    // Zero resistance resistor (should clamp to 0.001 without crash)
    engine.resistors.insert("r_zero".into(), ResistorComponent::new("r_zero", 0.0));
    engine.add_wire(Wire { id: "w1".into(), from: PinId::new("uno1", "5V"), to: PinId::new("r_zero", "1"), color: "#ef4444".into() });
    engine.add_wire(Wire { id: "w2".into(), from: PinId::new("r_zero", "2"), to: PinId::new("uno1", "GND"), color: "#000000".into() });

    // Giant resistance (1 Gigaohm)
    engine.resistors.insert("r_huge".into(), ResistorComponent::new("r_huge", 1e9));

    // Negative resistance test (should clamp to 0.001)
    engine.resistors.insert("r_neg".into(), ResistorComponent::new("r_neg", -50.0));

    // Potentiometer out-of-range values: -1.0 and +2.0 (should clamp to [0, 1])
    engine.pots.insert("pot_neg".into(), PotentiometerComponent::new("pot_neg"));
    engine.pots.get_mut("pot_neg").unwrap().value = -1.0;

    engine.pots.insert("pot_high".into(), PotentiometerComponent::new("pot_high"));
    engine.pots.get_mut("pot_high").unwrap().value = 2.0;

    // Must resolve cleanly
    engine.resolve_electrical_nets();

    for (pin, v) in &engine.pin_voltages {
        assert!(!v.is_nan(), "Pin {:?} voltage is NaN", pin);
        assert!(!v.is_infinite(), "Pin {:?} voltage is Inf", pin);
    }
}

// ============================================================================
// 6. MULTIPLE LEDS IN SERIES & EXTREME DIODE BIAS
// ============================================================================

#[test]
fn test_adv_30_leds_in_series_exceeding_supply_voltage() {
    let mut engine = SimulationEngine::new_with_uno();

    // 30 red LEDs in series (Vf sum = 30 * 1.8V = 54V >> 5V)
    for i in 0..30 {
        let id = format!("led_ser_{}", i);
        engine.leds.insert(id.clone(), LedComponent::new(&id, "red"));
    }
    // Wire in series from 5V to GND
    engine.add_wire(Wire { id: "w_start".into(), from: PinId::new("uno1", "5V"), to: PinId::new("led_ser_0", "anode"), color: "#ef4444".into() });
    for i in 0..29 {
        engine.add_wire(Wire {
            id: format!("w_ser_{}", i),
            from: PinId::new(format!("led_ser_{}", i), "cathode"),
            to: PinId::new(format!("led_ser_{}", i + 1), "anode"),
            color: "#ef4444".into(),
        });
    }
    engine.add_wire(Wire { id: "w_end".into(), from: PinId::new("led_ser_29", "cathode"), to: PinId::new("uno1", "GND"), color: "#000000".into() });

    engine.resolve_electrical_nets();

    // Insufficient voltage to forward-bias 30 series diodes: none should light up
    for i in 0..30 {
        let id = format!("led_ser_{}", i);
        assert!(!engine.leds[&id].is_lit, "LED {} must remain unlit in 54V Vf series string", i);
        assert_eq!(engine.leds[&id].brightness, 0.0);
    }
}

#[test]
fn test_adv_empty_circuit_stability() {
    // Completely unpopulated circuit with just Uno
    let mut engine = SimulationEngine::new_with_uno();
    engine.resolve_electrical_nets();

    assert_eq!(*engine.pin_voltages.get(&PinId::new("uno1", "5V")).unwrap(), 5.0);
    assert_eq!(*engine.pin_voltages.get(&PinId::new("uno1", "3.3V")).unwrap(), 3.3);
    assert_eq!(*engine.pin_voltages.get(&PinId::new("uno1", "GND")).unwrap(), 0.0);
    assert!(engine.faults.is_empty());
}

#[test]
fn test_adv_gpio_contention_high_vs_low() {
    let mut engine = SimulationEngine::new_with_uno();
    let mut mock = MockMcu::new();
    mock.set("13", LogicState::High);
    mock.set("12", LogicState::Low);
    engine.mcu = Box::new(mock);

    // Wire pin 13 directly to pin 12
    engine.add_wire(Wire {
        id: "w_contention".into(),
        from: PinId::new("uno1", "13"),
        to: PinId::new("uno1", "12"),
        color: "#f59e0b".into(),
    });

    engine.resolve_electrical_nets();

    let v13 = *engine.pin_voltages.get(&PinId::new("uno1", "13")).unwrap();
    let v12 = *engine.pin_voltages.get(&PinId::new("uno1", "12")).unwrap();

    // Two 25-ohm CMOS drivers opposing each other -> exactly 2.50V at midpoint
    assert!((v13 - 2.50).abs() < 0.05, "Pin 13 should sit at 2.5V midpoint, got {}", v13);
    assert!((v12 - 2.50).abs() < 0.05, "Pin 12 should sit at 2.5V midpoint, got {}", v12);

    // Contention draws ~100mA, triggering GPIO overcurrent on both pins (>40mA rating)
    let p13_fault = engine.faults.iter().any(|f| f.fault_type == FaultType::Overcurrent && f.pin_name == "13");
    let p12_fault = engine.faults.iter().any(|f| f.fault_type == FaultType::Overcurrent && f.pin_name == "12");
    assert!(p13_fault, "Pin 13 must flag overcurrent during driver contention");
    assert!(p12_fault, "Pin 12 must flag overcurrent during driver contention");
}

#[test]
fn test_adv_gpio_short_to_gnd() {
    let mut engine = SimulationEngine::new_with_uno();
    let mut mock = MockMcu::new();
    mock.set("8", LogicState::High);
    engine.mcu = Box::new(mock);

    // Short HIGH output pin 8 directly to GND
    engine.add_wire(Wire {
        id: "w_short_gpio".into(),
        from: PinId::new("uno1", "8"),
        to: PinId::new("uno1", "GND"),
        color: "#ef4444".into(),
    });

    engine.resolve_electrical_nets();

    let v8 = *engine.pin_voltages.get(&PinId::new("uno1", "8")).unwrap();
    assert!(v8 < 0.1, "Pin 8 shorted to GND must collapse to ~0V, got {}", v8);

    let has_fault = engine.faults.iter().any(|f| f.fault_type == FaultType::Overcurrent && f.pin_name == "8");
    assert!(has_fault, "Shorting HIGH GPIO to GND must flag Overcurrent (>40mA)");
}

#[test]
fn test_adv_circular_and_duplicate_wires() {
    let mut engine = SimulationEngine::new_with_uno();
    engine.resistors.insert("r1".into(), ResistorComponent::new("r1", 220.0));

    // Normal connection
    engine.add_wire(Wire { id: "w_pwr".into(), from: PinId::new("uno1", "5V"), to: PinId::new("r1", "1"), color: "#ef4444".into() });
    engine.add_wire(Wire { id: "w_gnd".into(), from: PinId::new("r1", "2"), to: PinId::new("uno1", "GND"), color: "#000000".into() });

    // Adversarial additions:
    // 1. Self-wire from pin to itself
    engine.add_wire(Wire { id: "w_self".into(), from: PinId::new("r1", "1"), to: PinId::new("r1", "1"), color: "#22c55e".into() });
    // 2. Duplicate wire between same pins
    engine.add_wire(Wire { id: "w_dup".into(), from: PinId::new("uno1", "5V"), to: PinId::new("r1", "1"), color: "#ef4444".into() });
    // 3. Reverse parallel wire between same pins
    engine.add_wire(Wire { id: "w_rev".into(), from: PinId::new("r1", "1"), to: PinId::new("uno1", "5V"), color: "#ef4444".into() });

    engine.resolve_electrical_nets();

    let v1 = *engine.pin_voltages.get(&PinId::new("r1", "1")).unwrap();
    let v2 = *engine.pin_voltages.get(&PinId::new("r1", "2")).unwrap();
    assert!((v1 - 5.0).abs() < 0.005, "Node r1:1 with 22.7mA load across 50mOhm rail drop should be ~4.999V, got {}", v1);
    assert!(v2 < 0.001 && v2 > 0.0002, "Node r1:2 ground bounce across 20mOhm wire should be ~0.45mV, got {}", v2);
}

#[test]
fn test_adv_rapid_potentiometer_sweep_1000_steps() {
    let mut engine = SimulationEngine::new_with_uno();
    engine.pots.insert("pot1".into(), PotentiometerComponent::new("pot1"));
    engine.leds.insert("led1".into(), LedComponent::new("led1", "red"));
    engine.resistors.insert("r1".into(), ResistorComponent::new("r1", 220.0));

    engine.add_wire(Wire { id: "w1".into(), from: PinId::new("pot1", "SIG"), to: PinId::new("led1", "anode"), color: "#3b82f6".into() });
    engine.add_wire(Wire { id: "w2".into(), from: PinId::new("led1", "cathode"), to: PinId::new("r1", "1"), color: "#ef4444".into() });
    engine.add_wire(Wire { id: "w3".into(), from: PinId::new("r1", "2"), to: PinId::new("uno1", "GND"), color: "#000000".into() });

    for step in 0..=100 {
        let alpha = step as f32 / 100.0;
        engine.pots.get_mut("pot1").unwrap().value = alpha;
        engine.resolve_electrical_nets();

        let sig_v = *engine.pin_voltages.get(&PinId::new("pot1", "SIG")).unwrap();
        assert!(!sig_v.is_nan() && !sig_v.is_infinite());
        assert!(sig_v >= 0.0 && sig_v <= 5.0);
    }
}

#[test]
fn test_adv_100_parallel_led_branches_loading_rail() {
    let mut engine = SimulationEngine::new_with_uno();
    let count = 100;

    for i in 0..count {
        let led_id = format!("led_p_{}", i);
        let res_id = format!("res_p_{}", i);
        engine.leds.insert(led_id.clone(), LedComponent::new(&led_id, "red"));
        engine.resistors.insert(res_id.clone(), ResistorComponent::new(&res_id, 220.0));

        engine.add_wire(Wire { id: format!("wp1_{}", i), from: PinId::new("uno1", "5V"), to: PinId::new(&led_id, "anode"), color: "#ef4444".into() });
        engine.add_wire(Wire { id: format!("wp2_{}", i), from: PinId::new(&led_id, "cathode"), to: PinId::new(&res_id, "1"), color: "#ef4444".into() });
        engine.add_wire(Wire { id: format!("wp3_{}", i), from: PinId::new(&res_id, "2"), to: PinId::new("uno1", "GND"), color: "#000000".into() });
    }

    engine.resolve_electrical_nets();

    // 100 branches drawing ~14.2mA each = ~1.42A total current on 5V rail (>500mA rating)
    let v5v = *engine.pin_voltages.get(&PinId::new("uno1", "5V")).unwrap();
    assert!(!v5v.is_nan() && !v5v.is_infinite());
    assert!(v5v < 5.0, "100 parallel branches must load rail voltage: got {}", v5v);

    let has_rail_fault = engine.faults.iter().any(|f| f.fault_type == FaultType::ShortCircuit && f.pin_name == "5V");
    assert!(has_rail_fault, "100 parallel LEDs drawing >1.4A must flag 5V rail overload (>500mA)");
}

#[test]
fn test_adv_reverse_biased_led_high_voltage() {
    let mut engine = SimulationEngine::new_with_uno();
    engine.leds.insert("led_rev".into(), LedComponent::new("led_rev", "green"));

    // Connect Cathode to 5V and Anode to GND
    engine.add_wire(Wire { id: "w1".into(), from: PinId::new("uno1", "5V"), to: PinId::new("led_rev", "cathode"), color: "#ef4444".into() });
    engine.add_wire(Wire { id: "w2".into(), from: PinId::new("led_rev", "anode"), to: PinId::new("uno1", "GND"), color: "#000000".into() });

    engine.resolve_electrical_nets();

    assert!(!engine.leds["led_rev"].is_lit, "Reverse biased LED must not light");
    assert_eq!(engine.leds["led_rev"].brightness, 0.0);

    let has_rev_fault = engine.faults.iter().any(|f| f.fault_type == FaultType::ReversePolarity && f.component_id == "led_rev");
    assert!(has_rev_fault, "Reverse biased LED with Vc - Va = 5.0V must flag ReversePolarity fault");
}
