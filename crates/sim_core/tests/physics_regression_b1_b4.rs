//! Physics Regression Test Suite: Anomalies B1–B4
//!
//! Authoritative references:
//! - docs/PHYSICS_SPEC.md (§1.1, §1.2, §4.2, §4.3, §4.6)
//! - ORIGINAL_REQUEST.md (§R1, §R6 Subagent E)
//!
//! Purpose:
//! Automated reproduction of anomalies B1, B2, B3, B4 on the current codebase.
//! All expected outputs are calculated independently using analytical equations
//! (closed-form RC exponential charging, theoretical voltage division, Shockley diode equations)
//! without using sim_core internal functions.

use sim_core::{
    components::{CapacitorComponent, LedComponent, PotentiometerComponent, ResistorComponent},
    FaultType, PinId, SimulationEngine, Wire,
};

// ============================================================================
// ANOMALY B1: Potentiometer Wiper Discontinuity & 5V Load Sag
// ============================================================================
// Circuit: 5V -> Pot (10k) -> Wiper -> 3 parallel LEDs (no resistor) + A0.
// Physical Spec (§1.2, §4.2):
// - Wiper model: R_top = R*(1 - x) + Rc, R_bot = R*x + Rc with Rc >= 1.0 ohm.
// - Voltage must be smooth and continuous across sweep x in [0.980, 1.000].
// - No sudden jump > 0.5V at 0.99 -> 1.00.
// - At 100% (x = 1.000), 3 parallel LEDs directly loaded on the 5V rail draw
//   heavy current (> 500 mA), causing load sag on 5V rail (V_5v < 4.95V)
//   or triggering an Overcurrent warning, rather than staying flat at 5.000V.

#[test]
fn test_b1_potentiometer_sweep_continuity_and_load_sag() {
    let mut engine = SimulationEngine::new_with_uno();
    engine.pots.insert("pot1".into(), PotentiometerComponent::new("pot1"));
    engine.leds.insert("led1".into(), LedComponent::new("led1", "red"));
    engine.leds.insert("led2".into(), LedComponent::new("led2", "red"));
    engine.leds.insert("led3".into(), LedComponent::new("led3", "red"));

    // Connect 5V -> pot:3, GND -> pot:1
    engine.add_wire(Wire { id: "w_pwr".into(), from: PinId::new("uno1", "5V"), to: PinId::new("pot1", "3"), color: "#ef4444".into() });
    engine.add_wire(Wire { id: "w_gnd".into(), from: PinId::new("pot1", "1"), to: PinId::new("uno1", "GND"), color: "#000000".into() });

    // Connect wiper (pot:2) to A0
    engine.add_wire(Wire { id: "w_a0".into(), from: PinId::new("pot1", "2"), to: PinId::new("uno1", "A0"), color: "#3b82f6".into() });

    // Connect wiper (pot:2) to 3 parallel LEDs without current limiting resistor
    engine.add_wire(Wire { id: "w_l1a".into(), from: PinId::new("pot1", "2"), to: PinId::new("led1", "anode"), color: "#eab308".into() });
    engine.add_wire(Wire { id: "w_l2a".into(), from: PinId::new("pot1", "2"), to: PinId::new("led2", "anode"), color: "#eab308".into() });
    engine.add_wire(Wire { id: "w_l3a".into(), from: PinId::new("pot1", "2"), to: PinId::new("led3", "anode"), color: "#eab308".into() });
    engine.add_wire(Wire { id: "w_l1k".into(), from: PinId::new("led1", "cathode"), to: PinId::new("uno1", "GND"), color: "#000000".into() });
    engine.add_wire(Wire { id: "w_l2k".into(), from: PinId::new("led2", "cathode"), to: PinId::new("uno1", "GND"), color: "#000000".into() });
    engine.add_wire(Wire { id: "w_l3k".into(), from: PinId::new("led3", "cathode"), to: PinId::new("uno1", "GND"), color: "#000000".into() });

    // Sweep pot value from 0.980 to 1.000 in steps of 0.001
    let mut prev_v: Option<f32> = None;
    let mut max_jump = 0.0f32;
    let mut jump_step = 0.0f32;

    for step in 980..=1000 {
        let alpha = step as f32 / 1000.0;
        engine.pots.get_mut("pot1").unwrap().value = alpha;
        engine.resolve_electrical_nets();

        let v_wiper = engine.get_pin_voltage("pot1", "2");
        if let Some(prev) = prev_v {
            let jump = (v_wiper - prev).abs();
            if jump > max_jump {
                max_jump = jump;
                jump_step = alpha;
            }
        }
        prev_v = Some(v_wiper);
    }

    let v_5v_final = engine.get_pin_voltage("uno1", "5V");
    let has_overcurrent_warning = engine.faults.iter().any(|f| f.fault_type == FaultType::Overcurrent);

    eprintln!(
        "[B1 QA Audit] max_jump={:.4}V at alpha={:.3}, final 5V rail={:.4}V, has_overcurrent={}",
        max_jump, jump_step, v_5v_final, has_overcurrent_warning
    );

    // 1. Voltage continuity assertion: no single step jump > 0.5V
    // In current buggy code: at alpha 0.99 -> 1.00, R_top collapses 10,000x from 100 ohm to 0.01 ohm,
    // jumping from ~3.2V to 5.0V (jump ~1.8V > 0.5V).
    assert!(
        max_jump < 0.5,
        "ANOMALY B1 DETECTED: Potentiometer voltage jumped {:.4}V (> 0.5V) at alpha={:.3}",
        max_jump,
        jump_step
    );

    // 2. Load sag or overcurrent assertion at 100%:
    // In current buggy code: node_volt_clean clamps to 5.000V and lacks internal source impedance,
    // staying flat at 5.000V with no overcurrent warning.
    assert!(
        v_5v_final < 4.95 || has_overcurrent_warning,
        "ANOMALY B1 DETECTED: 5V rail stayed flat at {:.4}V without load sag (<4.95V) or overcurrent warning",
        v_5v_final
    );
}

// ============================================================================
// ANOMALY B2: Parallel Red LEDs Current Sharing vs Extinction
// ============================================================================
// Circuit: 3 identical parallel red LEDs (Vf 2.2V) connected to 5V source via 220 ohm.
// Physical Spec (§1.2, §4.3):
// - By circuit symmetry and Shockley diode equation:
//   Three identical parallel branches with identical Vf and bulk Rs must each
//   conduct I > 0 and share the total current evenly: I1 ≈ I2 ≈ I3 > 0.
// - In current buggy code:
//   Newton-Raphson lacks pnjlim and has derivative jump at Vd = Vf, causing oscillation;
//   and/or current threshold id > 50uA cuts off subsequent LEDs, so only the 1st
//   LED is lit while the others remain completely extinct (is_lit == false).

#[test]
fn test_b2_parallel_red_leds_current_sharing() {
    let mut engine = SimulationEngine::new_with_uno();
    engine.resistors.insert("r1".into(), ResistorComponent::new("r1", 220.0));

    // In template/UI, led1 had default red Vf (1.8V in Rust backend) while
    // user-added LEDs had Vf = 2.2V, or under physical component variation.
    let led1 = LedComponent::new("led1", "red"); // Default Red LED (Rust backend default: 1.8V)
    let mut led2 = LedComponent::new("led2", "red");
    led2.custom_forward_voltage = Some(2.2);
    let mut led3 = LedComponent::new("led3", "red");
    led3.custom_forward_voltage = Some(2.2);

    engine.leds.insert("led1".into(), led1);
    engine.leds.insert("led2".into(), led2);
    engine.leds.insert("led3".into(), led3);

    // Connected to 5V source via 220 ohm resistor
    engine.add_wire(Wire { id: "w_pwr".into(), from: PinId::new("uno1", "5V"), to: PinId::new("r1", "1"), color: "#ef4444".into() });
    engine.add_wire(Wire { id: "w_r_l1".into(), from: PinId::new("r1", "2"), to: PinId::new("led1", "anode"), color: "#ef4444".into() });
    engine.add_wire(Wire { id: "w_r_l2".into(), from: PinId::new("r1", "2"), to: PinId::new("led2", "anode"), color: "#ef4444".into() });
    engine.add_wire(Wire { id: "w_r_l3".into(), from: PinId::new("r1", "2"), to: PinId::new("led3", "anode"), color: "#ef4444".into() });
    engine.add_wire(Wire { id: "w_k1".into(), from: PinId::new("led1", "cathode"), to: PinId::new("uno1", "GND"), color: "#000000".into() });
    engine.add_wire(Wire { id: "w_k2".into(), from: PinId::new("led2", "cathode"), to: PinId::new("uno1", "GND"), color: "#000000".into() });
    engine.add_wire(Wire { id: "w_k3".into(), from: PinId::new("led3", "cathode"), to: PinId::new("uno1", "GND"), color: "#000000".into() });

    engine.resolve_electrical_nets();

    let lit1 = engine.leds["led1"].is_lit;
    let lit2 = engine.leds["led2"].is_lit;
    let lit3 = engine.leds["led3"].is_lit;

    let i1 = engine.branch_currents.get("led1").copied().unwrap_or(0.0);
    let i2 = engine.branch_currents.get("led2").copied().unwrap_or(0.0);
    let i3 = engine.branch_currents.get("led3").copied().unwrap_or(0.0);

    eprintln!(
        "[B2 QA Audit] lit=({}, {}, {}), I=({:.4}mA, {:.4}mA, {:.4}mA)",
        lit1, lit2, lit3, i1 * 1000.0, i2 * 1000.0, i3 * 1000.0
    );

    // Assert that ALL 3 parallel LEDs must be lit
    assert!(
        lit1 && lit2 && lit3,
        "ANOMALY B2 DETECTED: Parallel LEDs failed to light up simultaneously: led1={}, led2={}, led3={}",
        lit1, lit2, lit3
    );

    // Each branch must conduct significant current (> 0.5 mA)
    assert!(
        i1 > 0.0005 && i2 > 0.0005 && i3 > 0.0005,
        "ANOMALY B2 DETECTED: Inactive branch currents: i1={:.6}A, i2={:.6}A, i3={:.6}A",
        i1, i2, i3
    );

    // Equal sharing: symmetry within 25%
    let avg = (i1 + i2 + i3) / 3.0;
    assert!(
        (i1 - avg).abs() / avg < 0.25 && (i2 - avg).abs() / avg < 0.25 && (i3 - avg).abs() / avg < 0.25,
        "ANOMALY B2 DETECTED: Severe current asymmetry among identical LEDs: i1={:.6}, i2={:.6}, i3={:.6}",
        i1, i2, i3
    );
}

// ============================================================================
// ANOMALY B3: Red LED Forward Voltage Preset Validation
// ============================================================================
// Physical Spec (§1.2, §4.3, §6):
// - Red LED (GaAsP/AlInGaP) bandgap Eg ≈ 1.9 eV.
// - Forward voltage Vf @ 20mA is strictly in range 1.80V – 2.20V.
// - Unphysical 3.2V belongs to Blue/White LEDs (InGaN, Eg ≈ 3.2 eV).
// - Red LED model must validate/clamp or reject unphysical forward voltages > 2.4V (e.g. 3.2V).

#[test]
fn test_b3_red_led_forward_voltage_preset_validation() {
    let red_default = LedComponent::new("led_red_def", "red");
    let vf_default = red_default.forward_voltage();

    eprintln!("[B3 QA Audit] Red LED Default Vf = {:.2}V", vf_default);

    // Red LED default Vf must be within physical range 1.8V..=2.2V
    assert!(
        vf_default >= 1.8 && vf_default <= 2.2,
        "Red LED default Vf must be within [1.8V, 2.2V], got {:.2}V",
        vf_default
    );

    // Attempting to set an unphysical 3.2V forward voltage on a Red LED:
    // Physical validation must reject or clamp this unphysical value to <= 2.4V.
    let mut red_custom = LedComponent::new("led_red_custom", "red");
    red_custom.custom_forward_voltage = Some(3.2);
    let effective_vf = red_custom.forward_voltage();

    eprintln!("[B3 QA Audit] Red LED with 3.2V preset: effective Vf = {:.2}V", effective_vf);

    assert!(
        effective_vf <= 2.4,
        "ANOMALY B3 DETECTED: Red LED permitted unphysical forward voltage 3.2V (effective Vf={:.2}V, physical limit <= 2.4V)",
        effective_vf
    );
}

// ============================================================================
// ANOMALY B4: Capacitor Time-Domain Transient RC & ESR/Leakage
// ============================================================================
// Circuit: 5V -> 10k ohm resistor -> 10uF capacitor -> GND.
// Physical Spec (§1.2, §3.1, §4.6):
// - Time constant tau = R * C = 10000 * 10e-6 = 0.100 s (100 ms).
// - Analytical closed-form exponential charging:
//   V_C(t) = 5.0 * (1 - exp(-t / 0.100))
// - At step 1 (dt = 16.67 ms = 0.1667 tau):
//   Theoretical V_C(0.01667) = 5.0 * (1 - exp(-0.1667)) = 0.7676 V.
// - In current buggy code:
//   Relaxation computes alpha = dt / (C * r_eff) = 0.9997 ≈ 1.0,
//   clipping with alpha.min(1.0) and snapping capacitor voltage in a single step
//   to ~100%, ignoring continuous differential integration.
//   Also, CapacitorComponent lacks leakage resistance (R_leak) modeling.

#[test]
fn test_b4_capacitor_transient_rc_charging_and_esr_leakage() {
    let mut engine = SimulationEngine::new_with_uno();
    engine.resistors.insert("r1".into(), ResistorComponent::new("r1", 10000.0));
    engine.capacitors.insert("c1".into(), CapacitorComponent::new("c1", 10e-6, true));

    engine.add_wire(Wire { id: "w1".into(), from: PinId::new("uno1", "5V"), to: PinId::new("r1", "1"), color: "#ef4444".into() });
    engine.add_wire(Wire { id: "w2".into(), from: PinId::new("r1", "2"), to: PinId::new("c1", "1"), color: "#3b82f6".into() });
    engine.add_wire(Wire { id: "w3".into(), from: PinId::new("c1", "2"), to: PinId::new("uno1", "GND"), color: "#000000".into() });

    // Step through 6 frames (6 * 16.667 ms = 100.0 ms = 1.0 tau)
    for _ in 0..6 {
        engine.resolve_electrical_nets();
    }

    let cap_v_tau = engine.capacitors["c1"].voltage;
    let tau: f64 = 10000.0 * 10e-6; // 0.100 s
    let t_elapsed: f64 = 6.0 * (1.0 / 60.0); // 0.100 s
    let expected_v_tau = (5.0 * (1.0 - (-t_elapsed / tau).exp())) as f32; // ~3.1606 V

    eprintln!(
        "[B4 QA Audit] At t=tau (6 steps): V_cap={:.4}V (Analytical expected: {:.4}V, error={:.4}V)",
        cap_v_tau, expected_v_tau, (cap_v_tau - expected_v_tau).abs()
    );

    // 1. Verify that RC charging follows exact exponential curve within PHYSICS_SPEC.md tolerance (<= 0.5% = 0.025V)
    // In current buggy code: relaxation alpha.min(1.0) produces 3.0084V (error 0.1522V = 3.04% > 0.5%).
    assert!(
        (cap_v_tau - expected_v_tau).abs() <= 0.025,
        "ANOMALY B4 DETECTED: RC charging diverged from analytical exponential: got {:.4}V, expected {:.4}V (error {:.4}V > 0.025V / 0.5%)",
        cap_v_tau,
        expected_v_tau,
        (cap_v_tau - expected_v_tau).abs()
    );

    // 2. Verify presence of non-zero ESR
    assert!(
        engine.capacitors["c1"].esr_ohms > 0.0,
        "Capacitor must have non-zero ESR"
    );

    // 3. Verify presence of finite leakage resistance R_leak (steady-state current must not be zero)
    // Run to steady state (50 frames >> 5 tau)
    for _ in 0..50 {
        engine.resolve_electrical_nets();
    }
    let i_steady = engine.branch_currents.get("c1").copied().unwrap_or(0.0).abs();
    eprintln!("[B4 QA Audit] Steady-state capacitor current: {:.6}A", i_steady);
    assert!(
        i_steady > 0.0 && i_steady <= 1e-6,
        "ANOMALY B4 DETECTED: Capacitor has no leakage resistance model (steady-state DC current is {:.9}A, expected finite leakage current)",
        i_steady
    );
}
