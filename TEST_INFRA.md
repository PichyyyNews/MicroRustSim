# MicroRustSim v0.2.1: Test Infrastructure & Verification Plan

## 1. Test Philosophy

MicroRustSim v0.2.1 is verified using an **opaque-box, requirement-driven, physics-based testing philosophy**:
1. **Opaque-Box Boundary**: Tests interact with simulation crates strictly through public API boundaries (`SimulationEngine`, `McuCore`, `Wire`, `PinId`, `components`). Tests do not rely on private internal solver details.
2. **Authoritative Physical Ground Truth**: Expected outputs are derived directly from the fundamental laws of electrical engineering:
   - **Ohm's Law**: $V = IR$, $I = V / R$.
   - **Kirchhoff's Laws**: Nodal current conservation ($\sum I_{in} = \sum I_{out}$) and loop voltage conservation ($\sum V = 0$).
   - **Diode Forward Conduction**: Color-specific threshold drops ($V_f \in \{1.8\text{V}, 2.0\text{V}, 2.2\text{V}, 3.2\text{V}\}$), reverse-bias blocking ($I_{rev} \approx 0$).
   - **Voltage Division**: Three-terminal potentiometer track $V_{wiper} = V_{bot} + \alpha (V_{top} - V_{bot})$.
   - **Pushbutton Contact Physics**: Ideal open air gap ($R > 10\text{G}\Omega$), mechanical contact closure ($R \approx 0.05\Omega$).
   - **ATmega328P Pin Characteristics**: CMOS driver internal impedance ($R_{on} \approx 25\Omega$), internal pull-up ($R_{pu} \approx 35\text{k}\Omega$), absolute maximum ratings ($I_{max} = 40\text{mA}$).
3. **Zero Facade Testing**: Every test exercises real cycle advancement, circuit graph traversal / nodal solving, and state transitions. No mocks, synthetic sine waves, or trivial pass assertions.
4. **Adversarial & Fault Verification**: Validates behavior under extreme conditions: floating nodes, zero-ohm jumpers, rapid switching cycles, short circuits (5V to GND), pin overcurrents, and reverse polarity.

---

## 2. Feature Inventory to Test Tier Mapping (F1 – F18)

| Feature | Description | Primary Test Tier | Verification Target |
| :--- | :--- | :--- | :--- |
| **F1** | MNA Physical Solver ($\mathbf{G}\mathbf{v} = \mathbf{j}$) | Tier 1, Tier 3 | Nodal voltage convergence across networks |
| **F2** | ATmega328P Pin Driver Models ($R_{on} \approx 25\Omega$) | Tier 1.5, Tier 4 | Output voltage under load, input pull-up |
| **F3** | Linear Resistors ($V = IR$) | Tier 1.1, Tier 2.1 | Linear current sweep without artificial clamps |
| **F4** | Potentiometer Voltage Division | Tier 1.2, Tier 2.3 | Continuous $0.00\text{V}-5.00\text{V}$ wiper linearity |
| **F5** | LED Diode $V_f$ & Physical Brightness | Tier 1.3, Tier 4.1 | Color-specific threshold drops & brightness |
| **F6** | Pushbutton Contact Impedance | Tier 1.4, Tier 2.4 | High-Z open vs low-R closed contact transition |
| **F7** | Breadboard Tie-Points & Dual Rails | Tier 1, Tier 3 | 5-hole column continuity & dual power distribution |
| **F8** | Short-Circuit Fault Detection | Fault Tier F.1 | Power rail to GND direct short (>500mA rail) |
| **F9** | GPIO Overcurrent Protection | Fault Tier F.2, F.3 | Absolute maximum rating violation (>40mA pin) |
| **F10** | Reverse Polarity Detection | Fault Tier F.4 | Reverse bias on polarized diode ($V_c > V_a$) |
| **F11** | Tauri IPC Protocol Extension | Tier 4 | Streaming analog `pin_voltages` & `faults` |
| **F12** | Real-Voltage Oscilloscope (0.0V–5.0V) | Tier 3, Tier 4 | Continuous analog voltage waveform fidelity |
| **F13** | Discrete Visual Fault Indicator | Fault Tier | Overlay dot positioning & coordinate alignment |
| **F14** | Fault Tooltips & Instant Auto-Clear | Fault Tier | Clearance of fault upon restoring valid circuit |
| **F15** | Complete Mock Removal | Tier 1–4 | Elimination of synthetic multipliers & clamps |
| **F16** | Release Version Bump to `0.2.1` | Manifests | Workspace manifest version synchronization |
| **F17** | Design System Integrity | UI / Smoke | Flat dark zinc palette, Octicons, drawer layout |
| **F18** | Comprehensive E2E Test Suite | All Tiers | Automated test suite execution & reporting |

---

## 3. Test Architecture & Directory Structure

```
crates/sim_core/tests/
└── e2e_circuit_tests.rs
    ├── tier1_feature_coverage (25 tests: 5 tests x 5 features)
    │   ├── resistors (5 tests)
    │   │   ├── test_t1_resistor_ohm_law_220
    │   │   ├── test_t1_resistor_ohm_law_1k
    │   │   ├── test_t1_resistor_ohm_law_4k7
    │   │   ├── test_t1_resistor_ohm_law_10k
    │   │   └── test_t1_resistor_sweep_series_addition
    │   ├── potentiometer (5 tests)
    │   │   ├── test_t1_pot_wiper_voltage_sweep_5v
    │   │   ├── test_t1_pot_wiper_voltage_sweep_3v3
    │   │   ├── test_t1_pot_intermediate_ratios
    │   │   ├── test_t1_pot_track_resistance
    │   │   └── test_t1_pot_wiper_reverse_orientation
    │   ├── led_diodes (5 tests)
    │   │   ├── test_t1_led_red_forward_voltage
    │   │   ├── test_t1_led_yellow_forward_voltage
    │   │   ├── test_t1_led_green_forward_voltage
    │   │   ├── test_t1_led_blue_white_forward_voltage
    │   │   └── test_t1_led_brightness_scaling_with_current
    │   ├── pushbuttons (5 tests)
    │   │   ├── test_t1_button_open_state_high_impedance
    │   │   ├── test_t1_button_closed_state_low_resistance
    │   │   ├── test_t1_button_toggle_conduction
    │   │   ├── test_t1_button_pullup_logic_transition
    │   │   └── test_t1_button_release_recovery
    │   └── uno_pin_drivers (5 tests)
    │       ├── test_t1_uno_gpio_high_output_level
    │       ├── test_t1_uno_gpio_low_sink_level
    │       ├── test_t1_uno_gpio_internal_driver_impedance
    │       ├── test_t1_uno_power_rails_5v_and_3v3
    │       └── test_t1_uno_floating_pin_impedance
    ├── tier2_boundary_corner_cases (5 tests)
    │   ├── test_t2_zero_resistance_jumper
    │   ├── test_t2_open_circuit_floating_nodes
    │   ├── test_t2_potentiometer_extrema_0_and_100
    │   ├── test_t2_rapid_switching_stability
    │   └── test_t2_parallel_resistor_branches
    ├── tier3_cross_feature_combinations (4 tests)
    │   ├── test_t3_voltage_divider_into_loaded_branch
    │   ├── test_t3_potentiometer_to_analog_input
    │   ├── test_t3_pushbutton_in_series_with_led
    │   └── test_t3_breadboard_multi_component_distribution
    ├── tier4_real_world_circuits (3 tests)
    │   ├── test_t4_blink_circuit_with_current_limiting_resistor
    │   ├── test_t4_analog_potentiometer_read_waveform
    │   └── test_t4_pullup_button_digital_read_state_machine
    └── hardware_fault_scenarios (4 tests)
        ├── test_fault_direct_5v_gnd_short_circuit
        ├── test_fault_gpio_overcurrent_led_without_resistor
        ├── test_fault_gpio_output_contention
        └── test_fault_reverse_polarity_led
```

---

## 4. Coverage Thresholds & Quality Gates

| Metric | Target Requirement | Status |
| :--- | :--- | :--- |
| **Total E2E Circuit Tests** | $\ge 40$ discrete tests | Enforced |
| **Tier 1 Feature Coverage** | $\ge 5$ tests per feature (25 tests) | Enforced |
| **Tier 2 Boundary Tests** | $\ge 5$ tests | Enforced |
| **Tier 3 Combination Tests** | $\ge 3$ tests | Enforced |
| **Tier 4 Real-World Tests** | $\ge 3$ tests | Enforced |
| **Hardware Fault Tests** | $\ge 3$ tests | Enforced |
| **Test Pass Rate** | 100% PASS with 0 failures | Target |
| **Execution Duration** | $\le 10$ seconds for complete suite | Monitored |
| **Compiler Warnings** | Zero warnings on test code | Enforced |

---

## 5. Verification Commands

Run the full E2E test suite:
```bash
cargo test --test e2e_circuit_tests --target-dir target_tests
```

Run specific test tiers:
```bash
# Tier 1 - Feature Coverage
cargo test --test e2e_circuit_tests tier1 --target-dir target_tests

# Tier 2 - Boundary Cases
cargo test --test e2e_circuit_tests tier2 --target-dir target_tests

# Tier 3 - Combination Circuits
cargo test --test e2e_circuit_tests tier3 --target-dir target_tests

# Tier 4 - Real-World Scenarios
cargo test --test e2e_circuit_tests tier4 --target-dir target_tests

# Hardware Fault Scenarios
cargo test --test e2e_circuit_tests fault --target-dir target_tests
```
