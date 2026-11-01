//! MicroRustSim: Physical Constants and Parameters Registry (constants.rs)
//!
//! Single Source of Truth (SSOT) for all physical constants, semiconductor parameters,
//! default ratings, and threshold limits in SI units (V, A, Ω, S, F, H, s, Hz, W, J, K, C).
//! Matches docs/PHYSICS_SPEC.md Section 6.

// ============================================================================
// 1. Fundamental Physical Constants (CODATA 2018 Standard)
// ============================================================================

/// Boltzmann Constant k in J / K (CODATA 2018 Standard)
pub const K_BOLTZMANN: f64 = 1.380649e-23;

/// Elementary Charge q in C (CODATA 2018 Standard)
pub const Q_ELECTRON: f64 = 1.602176634e-19;

/// Standard Room Temperature T_room in Kelvin (27 °C = 300.15 K)
pub const T_ROOM_KELVIN: f64 = 300.15;

/// Thermal Voltage V_t = k * T / q at 300.15 K (~25.852 mV)
pub const V_THERMAL: f64 = 0.025852;

// ============================================================================
// 2. Numerical Solver Tolerances & Convergence Criteria (SPICE3f5 Standard)
// ============================================================================

/// Default nodal shunt conductance g_min to ground to prevent singular matrices in S (1 pS = 1 TΩ)
/// Source: SPICE3f5 standard gmin
pub const G_MIN_DEFAULT: f64 = 1.0e-12;

/// Relative convergence tolerance for voltages and currents (0.1%)
pub const RELTOL: f64 = 1.0e-3;

/// Absolute voltage convergence tolerance vntol in V (1.0 µV)
pub const VNTOL: f64 = 1.0e-6;

/// Absolute current convergence tolerance abstol in A (1.0 pA)
pub const ABSTOL: f64 = 1.0e-12;

/// Maximum allowable Kirchhoff's Current Law (KCL) residual per node in A (1.0 nA)
pub const KCL_TOL_A: f64 = 1.0e-9;

/// Relative power balance error tolerance (1.0%)
pub const POWER_TOL_REL: f64 = 0.01;

/// Absolute power balance error tolerance in W (1.0 mW)
pub const POWER_TOL_ABS: f64 = 1.0e-3;

/// Maximum Newton-Raphson iterations before triggering gmin-stepping fallback
pub const MAX_NR_ITERATIONS: usize = 50;

/// Maximum gmin-stepping stages
pub const MAX_GMIN_STEPS: usize = 10;

/// Maximum source-stepping stages
pub const MAX_SOURCE_STEPS: usize = 10;

/// Minimum transient simulation time-step in s (100 ns)
pub const DT_MIN_TIMESTEP: f64 = 1.0e-7;

/// Maximum transient simulation time-step in s (100 µs)
pub const DT_MAX_TIMESTEP: f64 = 1.0e-4;

/// Local Truncation Error parameter trtol
pub const TRTOL: f64 = 7.0;

// ============================================================================
// 3. Arduino Uno (ATmega328P) Electrical Parameters
// ============================================================================

/// Nominal 5V rail voltage in V (Arduino Uno Schematic)
pub const V_SRC_5V_NOM: f64 = 5.0;

/// Default internal resistance of 5V rail in Ω (Measured from Uno + USB cable)
pub const R_OUT_5V_DEFAULT: f64 = 1.0;

/// 5V rail Polyfuse current limit in A (500 mA)
/// Source: Arduino Uno Eagle BOM
pub const I_LIMIT_5V: f64 = 0.500;

/// Nominal 3.3V rail voltage in V (LP2985-33 Datasheet)
pub const V_SRC_3V3_NOM: f64 = 3.3;

/// Default internal resistance of 3.3V rail in Ω (LP2985 Dropout Spec)
pub const R_OUT_3V3_DEFAULT: f64 = 2.0;

/// 3.3V LDO current limit in A (150 mA) (LP2985 Max Output Spec)
pub const I_LIMIT_3V3: f64 = 0.150;

/// PMOS driver on-resistance for GPIO OUTPUT HIGH in Ω (ATmega328P Datasheet V_OH)
pub const R_GPIO_OUT_P: f64 = 25.0;

/// NMOS driver on-resistance for GPIO OUTPUT LOW in Ω (ATmega328P Datasheet V_OL)
pub const R_GPIO_OUT_N: f64 = 25.0;

/// Nominal internal pullup resistance in Ω (ATmega328P Spec 20-50 kΩ)
pub const R_GPIO_PULLUP: f64 = 35000.0;

/// High-Z input leakage resistance in Ω (ATmega328P Leakage Spec > 100 MΩ)
pub const R_GPIO_INPUT_HIZ: f64 = 1.0e8;

/// Schmitt trigger negative-going threshold V_IL as a fraction of Vcc (0.30 * Vcc = 1.50V at 5V)
/// Source: ATmega328P Table 32-2
pub const V_SCHMITT_VIL_FRAC: f64 = 0.30;

/// Schmitt trigger positive-going threshold V_IH as a fraction of Vcc (0.60 * Vcc = 3.00V at 5V)
/// Source: ATmega328P Table 32-2
pub const V_SCHMITT_VIH_FRAC: f64 = 0.60;

/// ADC Sample-and-Hold internal capacitance in F (~14 pF)
/// Source: ATmega328P Section 24.6.1
pub const C_ADC_SAMPLE_HOLD: f64 = 1.4e-11;

/// Maximum recommended ADC source resistance in Ω (10 kΩ)
/// Source: ATmega328P Datasheet 24.6.1
pub const R_ADC_SOURCE_MAX: f64 = 10000.0;

/// Maximum continuous current per GPIO pin warning threshold in A (20 mA)
/// Source: ATmega328P Absolute Maximum Ratings
pub const I_GPIO_WARN_A: f64 = 0.020;

/// Absolute maximum damaging current per GPIO pin in A (40 mA)
/// Source: ATmega328P Absolute Maximum Ratings
pub const I_GPIO_MAX_A: f64 = 0.040;

/// Absolute maximum current through VCC and GND pins combined in A (200 mA)
/// Source: ATmega328P Absolute Maximum Ratings
pub const I_VCC_TOTAL_MAX_A: f64 = 0.200;

// ============================================================================
// 4. Passive & Electromechanical Component Parameters
// ============================================================================

/// Potentiometer wiper contact / terminal resistance R_c in Ω (Alps/Bourns Pot Spec)
pub const R_POT_WIPER_RC: f64 = 0.001;

/// Pushbutton closed contact resistance in Ω (Omron B3F Tactile Datasheet)
pub const R_PUSHBUTTON_ON: f64 = 0.05;

/// Pushbutton open insulation resistance in Ω (Omron B3F Spec > 100 MΩ)
pub const R_PUSHBUTTON_OFF: f64 = 1.0e8;

/// Breadboard tie-point spring clip contact resistance in Ω
/// Note: [ยังไม่ยืนยัน]
pub const R_BREADBOARD_CLIP: f64 = 0.010;

/// Stray capacitance between adjacent breadboard tie strips in F (2.0 pF)
/// Note: [ยังไม่ยืนยัน]
pub const C_BREADBOARD_STRIP: f64 = 2.0e-12;

/// Jumper wire series resistance (24 AWG 15cm copper wire) in Ω (Standard Copper Wire Resistance)
pub const R_JUMPER_WIRE: f64 = 0.020;

/// Resistor rated power default in W (0.25 W = 1/4 W)
pub const RESISTOR_RATED_POWER_DEF: f64 = 0.25;

/// Resistor thermal damage accumulator threshold in W * s
pub const RESISTOR_THERMAL_DAMAGE_J: f64 = 2.5;

// ============================================================================
// 5. Capacitor Parameters (Ceramic vs Electrolytic)
// ============================================================================

/// Default Equivalent Series Resistance for Ceramic MLCC in Ω (Murata GRM Series Datasheet)
pub const ESR_CERAMIC_DEF: f64 = 0.020;

/// Insulation leakage resistance for Ceramic capacitor in Ω (1 GΩ) (Murata Insulation Spec)
pub const R_LEAK_CERAMIC: f64 = 1.0e9;

/// Default Equivalent Series Resistance for Electrolytic capacitor in Ω (Nichicon UVZ Series Datasheet)
pub const ESR_ELECTRO_DEF: f64 = 0.500;

/// Default voltage rating for Electrolytic capacitor in V (Standard Starter Kit Spec)
pub const V_RAT_ELECTRO_DEF: f64 = 25.0;

/// Default voltage rating for Ceramic capacitor in V (Standard MLCC Spec)
pub const V_RAT_CERAMIC_DEF: f64 = 50.0;

/// Maximum reverse voltage tolerated by electrolytic capacitor before damage in V
pub const V_REV_ELECTRO_MAX: f64 = 1.0;

// ============================================================================
// 6. Semiconductor & LED Physical Specifications
// ============================================================================

/// Shockley diode ideality factor n for LED PN junctions
pub const LED_IDEALITY_FACTOR_N: f64 = 1.0;

/// Test current used for forward voltage rating in A (20 mA standard specified in T3)
pub const LED_TEST_CURRENT_A: f64 = 0.020;

/// Maximum continuous recommended LED forward current in A (30 mA)
pub const LED_MAX_CURRENT_A: f64 = 0.030;

/// LED thermal damage damage accumulator threshold in A^2 * s
pub const LED_DAMAGE_ACCUM_THRESHOLD: f64 = 1.0;

/// Persistence of vision time constant for eye averaging in s (20 ms)
pub const TAU_EYE_POV: f64 = 0.020;

/// Reverse breakdown voltage for standard LEDs in V
pub const LED_V_BREAKDOWN: f64 = 5.0;

/// Reverse leakage current for LEDs in A (10 nA)
pub const LED_I_LEAK_REVERSE: f64 = 1.0e-8;

/// Standard semiconductor properties per LED color
#[derive(Debug, Clone, Copy, PartialEq)]
pub struct LedColorProperties {
    pub name: &'static str,
    pub nominal_vf: f64,
    pub min_vf: f64,
    pub max_vf: f64,
    pub series_rs: f64,
    pub wavelength_nm: f64,
}

pub const LED_RED_PROPS: LedColorProperties = LedColorProperties {
    name: "red",
    nominal_vf: 1.95,
    min_vf: 1.80,
    max_vf: 2.20,
    series_rs: 5.0,
    wavelength_nm: 630.0,
};

pub const LED_ORANGE_PROPS: LedColorProperties = LedColorProperties {
    name: "orange",
    nominal_vf: 2.00,
    min_vf: 1.90,
    max_vf: 2.20,
    series_rs: 5.0,
    wavelength_nm: 610.0,
};

pub const LED_YELLOW_PROPS: LedColorProperties = LedColorProperties {
    name: "yellow",
    nominal_vf: 2.05,
    min_vf: 1.90,
    max_vf: 2.30,
    series_rs: 5.0,
    wavelength_nm: 590.0,
};

pub const LED_GREEN_PROPS: LedColorProperties = LedColorProperties {
    name: "green",
    nominal_vf: 2.20,
    min_vf: 2.00,
    max_vf: 3.20,
    series_rs: 5.0,
    wavelength_nm: 530.0,
};

pub const LED_BLUE_PROPS: LedColorProperties = LedColorProperties {
    name: "blue",
    nominal_vf: 3.10,
    min_vf: 2.90,
    max_vf: 3.40,
    series_rs: 5.0,
    wavelength_nm: 470.0,
};

pub const LED_WHITE_PROPS: LedColorProperties = LedColorProperties {
    name: "white",
    nominal_vf: 3.20,
    min_vf: 3.00,
    max_vf: 3.50,
    series_rs: 5.0,
    wavelength_nm: 450.0,
};

/// Get standard physical properties for an LED color name
pub fn get_led_color_properties(color: &str) -> LedColorProperties {
    match color.to_lowercase().as_str() {
        "red" | "#ef4444" => LED_RED_PROPS,
        "orange" | "#f97316" => LED_ORANGE_PROPS,
        "yellow" | "#eab308" => LED_YELLOW_PROPS,
        "green" | "#22c55e" => LED_GREEN_PROPS,
        "blue" | "#3b82f6" => LED_BLUE_PROPS,
        "white" | "#f8fafc" => LED_WHITE_PROPS,
        _ => LED_RED_PROPS,
    }
}
