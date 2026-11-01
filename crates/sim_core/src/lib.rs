use std::collections::HashMap;
use std::rc::Rc;
use serde::{Deserialize, Serialize};

use avr8rs::board::{parse_hex, Board, PinState as AvrPinState};
use avr8rs::runtime::{Backend, Runtime};

pub mod constants;
pub mod device;
pub mod mcu;
pub mod solver;
pub use constants::*;
pub use device::*;
pub use mcu::*;
pub use solver::{
    deterministic_gaussian_noise, pnjlim, CircuitFault, FaultType, MnaCircuitSolver, PowerRealismConfig,
    PowerRealismLevel, PowerRealismMode, TopologyReport,
};

/// Logic/Electrical state of a pin or node.
#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub enum LogicState {
    Low,
    High,
    InputPullUp,
    Floating,
    Analog(f32), // Voltage 0.0 .. 5.0V
    Pwm { duty: u8, freq_hz: u32 },
}

impl LogicState {
    pub fn is_high(&self) -> bool {
        match self {
            LogicState::High | LogicState::InputPullUp => true,
            LogicState::Analog(v) => *v >= 2.5,
            LogicState::Pwm { duty, .. } => *duty > 127,
            _ => false,
        }
    }

    pub fn voltage(&self) -> f32 {
        match self {
            LogicState::Low => 0.0,
            LogicState::High | LogicState::InputPullUp => 5.0,
            LogicState::Floating => 0.0,
            LogicState::Analog(v) => *v,
            LogicState::Pwm { duty, .. } => (*duty as f32 / 255.0) * 5.0,
        }
    }
}

/// Helper function to normalize pin names across different schematic formats (Wokwi, EAGLE, Breadboard)
pub fn normalize_pin_name(comp: &str, pin: &str) -> String {
    let p_lower = pin.to_lowercase();
    let c_lower = comp.to_lowercase();

    if c_lower.starts_with("uno") || c_lower.starts_with("mcu") || c_lower.starts_with("arduino") {
        if p_lower.starts_with("gnd") {
            return "GND".to_string();
        }
        if p_lower == "5v" || p_lower == "vcc" {
            return "5V".to_string();
        }
        if p_lower == "3.3v" || p_lower == "3v3" {
            return "3.3V".to_string();
        }
    } else if c_lower.starts_with("btn") || c_lower.starts_with("sw") || c_lower.starts_with("button") || c_lower.starts_with("pushbutton") || c_lower.contains("btn") || c_lower.contains("button") {
        if p_lower == "1" || p_lower == "1.l" || p_lower == "1.r" || p_lower == "1a" || p_lower == "1b" || p_lower == "t1" {
            return "1".to_string();
        }
        if p_lower == "2" || p_lower == "2.l" || p_lower == "2.r" || p_lower == "2a" || p_lower == "2b" || p_lower == "t2" {
            return "2".to_string();
        }
    } else if c_lower.starts_with("led") {
        if p_lower == "anode" || p_lower == "a" || p_lower == "1" {
            return "anode".to_string();
        }
        if p_lower == "cathode" || p_lower == "c" || p_lower == "k" || p_lower == "2" {
            return "cathode".to_string();
        }
    } else if c_lower.starts_with("r") || c_lower.starts_with("res") {
        if p_lower == "1" || p_lower == "p1" || p_lower == "a" {
            return "1".to_string();
        }
        if p_lower == "2" || p_lower == "p2" || p_lower == "b" {
            return "2".to_string();
        }
    } else if c_lower.starts_with("pot") {
        if p_lower == "1" || p_lower == "vcc" {
            return "VCC".to_string();
        }
        if p_lower == "2" || p_lower == "sig" || p_lower == "wiper" {
            return "SIG".to_string();
        }
        if p_lower == "3" || p_lower == "gnd" {
            return "GND".to_string();
        }
    } else if c_lower.starts_with("c") || c_lower.starts_with("cap") {
        if p_lower == "1" || p_lower == "p1" || p_lower == "anode" || p_lower == "+" || p_lower == "pos" {
            return "1".to_string();
        }
        if p_lower == "2" || p_lower == "p2" || p_lower == "cathode" || p_lower == "-" || p_lower == "neg" {
            return "2".to_string();
        }
    }
    pin.to_string()
}

/// Identifies a specific pin on a component instance.
#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub struct PinId {
    pub component_id: String,
    pub pin_name: String,
}

impl PinId {
    pub fn new(component_id: impl Into<String>, pin_name: impl Into<String>) -> Self {
        Self {
            component_id: component_id.into(),
            pin_name: pin_name.into(),
        }
    }

    pub fn normalized(&self) -> Self {
        let norm = normalize_pin_name(&self.component_id, &self.pin_name);
        Self::new(&self.component_id, norm)
    }
}

/// Wire connecting two pins.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct Wire {
    pub id: String,
    pub from: PinId,
    pub to: PinId,
    pub color: String, // e.g. "#22c55e", "#ef4444", "#3b82f6"
}


/// McuCore trait allowing pluggable MCU targets (ATmega328P, ESP32-C3, etc.).
pub trait McuCore {
    fn name(&self) -> &str;
    fn reset(&mut self);
    fn load_hex(&mut self, hex: &str) -> Result<(), String>;
    fn step_cycles(&mut self, cycles: u64);
    fn get_pin_state(&mut self, pin_name: &str) -> LogicState;
    fn set_pin_input(&mut self, pin_name: &str, high: bool);
    fn get_pin_input(&self, _pin_name: &str) -> bool {
        false
    }
    fn set_pin_mode_pullup(&mut self, _pin_name: &str) {}
    fn set_pin_override(&mut self, _pin_name: &str, _state: LogicState) {}
    fn set_adc_voltage(&mut self, _channel: u8, _voltage: f32) {}
    fn set_adc_ref(&mut self, _avcc: f32, _aref: f32) {}
    fn read_serial_output(&mut self) -> Vec<u8>;
    fn write_serial_input(&mut self, bytes: &[u8]);
    fn cycles(&self) -> u64;
    fn millis(&self) -> f64;
}

/// Arduino Uno R3 implementation based on avr8rs
pub struct ArduinoUnoCore {
    backend: Rc<dyn Backend>,
    runtime: Runtime,
    board: Board,
    flash: Vec<u8>,
    rx_buffer: Vec<u8>,
    tx_buffer: Vec<u8>,
    pin_overrides: HashMap<String, LogicState>,
    register_bank: McuPinRegisterBank,
}

impl ArduinoUnoCore {
    pub fn new() -> Self {
        let backend = avr8rs::native_backend();
        let mut runtime = Runtime::new(backend.clone());
        let flash = vec![0; 32 * 1024]; // 32KB flash
        let board = Board::uno(backend.as_ref(), &mut runtime, flash.clone());
        Self {
            backend,
            runtime,
            board,
            flash,
            rx_buffer: Vec::new(),
            tx_buffer: Vec::new(),
            pin_overrides: HashMap::new(),
            register_bank: McuPinRegisterBank::new(),
        }
    }

    pub fn with_flash(flash: Vec<u8>) -> Self {
        let backend = avr8rs::native_backend();
        let mut runtime = Runtime::new(backend.clone());
        let board = Board::uno(backend.as_ref(), &mut runtime, flash.clone());
        Self {
            backend,
            runtime,
            board,
            flash,
            rx_buffer: Vec::new(),
            tx_buffer: Vec::new(),
            pin_overrides: HashMap::new(),
            register_bank: McuPinRegisterBank::new(),
        }
    }
    pub fn set_pin_mode_pullup(&mut self, pin_name: &str) {
        self.pin_overrides.insert(pin_name.to_string(), LogicState::InputPullUp);
    }
}

impl Default for ArduinoUnoCore {
    fn default() -> Self {
        Self::new()
    }
}

impl McuCore for ArduinoUnoCore {
    fn name(&self) -> &str {
        "Arduino Uno R3 (ATmega328P)"
    }

    fn reset(&mut self) {
        self.runtime = Runtime::new(self.backend.clone());
        self.board = Board::uno(self.backend.as_ref(), &mut self.runtime, self.flash.clone());
        self.rx_buffer.clear();
        self.tx_buffer.clear();
        self.pin_overrides.clear();
        self.register_bank.clear();
    }

    fn load_hex(&mut self, hex: &str) -> Result<(), String> {
        let flash = parse_hex(hex);
        self.flash = flash;
        self.reset();
        Ok(())
    }

    fn step_cycles(&mut self, cycles: u64) {
        let mut remaining = cycles;
        while remaining > 0 {
            if self.runtime.remaining_budget() < 500_000 {
                self.runtime.reset_budget();
            }
            let mut ucsra = self.board.read_data(self.backend.as_ref(), 0xc0);
            if (ucsra & 0x40) != 0 {
                let udr = self.board.read_data(self.backend.as_ref(), 0xc6);
                self.tx_buffer.push(udr);
                ucsra &= !0x40;
                self.backend.set(
                    &mut self.runtime,
                    self.board.data,
                    "192",
                    avr8rs::runtime::Value::Number(ucsra as f64),
                );
            }

            // RX buffer processing (Bidirectional Serial RX)
            if (ucsra & 0x80) == 0 && !self.rx_buffer.is_empty() {
                if self.board.adc.0 > 0 {
                    let usart_handle = avr8rs::runtime::Handle(self.board.adc.0 - 1);
                    let res = self.backend.call(
                        &mut self.runtime,
                        Some(usart_handle),
                        "writeByte",
                        vec![
                            avr8rs::runtime::Value::Number(self.rx_buffer[0] as f64),
                            avr8rs::runtime::Value::Bool(true),
                        ],
                    );
                    if matches!(res, avr8rs::runtime::Value::Bool(true) | avr8rs::runtime::Value::Undefined) {
                        self.rx_buffer.remove(0);
                    }
                }
            }

            let ucsrb = self.board.read_data(self.backend.as_ref(), 0xc1);
            let is_tx_busy = (ucsra & 0x20) == 0 || (ucsra & 0x40) != 0 || (ucsrb & 0x20) != 0;

            let step = if !self.rx_buffer.is_empty() {
                remaining.min(32)
            } else if is_tx_busy {
                remaining.min(32)
            } else {
                remaining.min(2048)
            };
            self.board.run_cycles(self.backend.as_ref(), &mut self.runtime, step);
            remaining -= step;
        }
    }

    fn get_pin_state(&mut self, pin_name: &str) -> LogicState {
        if let Some(&override_state) = self.pin_overrides.get(pin_name) {
            return override_state;
        }
        // Builtin LED is pin 13 (PORTB 5)
        if pin_name == "13" || pin_name == "LED_BUILTIN" {
            let state = self.board.led_builtin(self.backend.as_ref(), &mut self.runtime);
            return match state {
                AvrPinState::High => LogicState::High,
                AvrPinState::Low => LogicState::Low,
                AvrPinState::Input => LogicState::Floating,
                AvrPinState::InputPullUp => LogicState::InputPullUp,
            };
        }

        // Digital pins 0-7 -> PORTD (0 to 7)
        if let Ok(d) = pin_name.parse::<u8>() {
            if d <= 7 {
                let state = self.board.pin_state(self.backend.as_ref(), &mut self.runtime, self.board.portd, d);
                return match state {
                    AvrPinState::High => LogicState::High,
                    AvrPinState::Low => LogicState::Low,
                    AvrPinState::Input => LogicState::Floating,
                    AvrPinState::InputPullUp => LogicState::InputPullUp,
                };
            } else if d <= 13 {
                // Digital pins 8-13 -> PORTB (0 to 5)
                let bit = d - 8;
                let state = self.board.pin_state(self.backend.as_ref(), &mut self.runtime, self.board.portb, bit);
                return match state {
                    AvrPinState::High => LogicState::High,
                    AvrPinState::Low => LogicState::Low,
                    AvrPinState::Input => LogicState::Floating,
                    AvrPinState::InputPullUp => LogicState::InputPullUp,
                };
            }
        }

        // Analog pins A0-A5 -> PORTC (0 to 5)
        if let Some(rest) = pin_name.strip_prefix('A') {
            if let Ok(a) = rest.parse::<u8>() {
                if a <= 5 {
                    let state = self.board.pin_state(self.backend.as_ref(), &mut self.runtime, self.board.portc, a);
                    return match state {
                        AvrPinState::High => LogicState::High,
                        AvrPinState::Low => LogicState::Low,
                        AvrPinState::Input => LogicState::Floating,
                        AvrPinState::InputPullUp => LogicState::InputPullUp,
                    };
                }
            }
        }

        // Power rails
        if pin_name == "5V" || pin_name == "VIN" || pin_name == "IOREF" {
            LogicState::High
        } else if pin_name == "3.3V" || pin_name == "3V3" {
            LogicState::Analog(3.3)
        } else if pin_name == "GND" || pin_name.starts_with("GND_") || pin_name.starts_with("GND.") {
            LogicState::Low
        } else {
            LogicState::Floating
        }
    }

    fn set_pin_input(&mut self, pin_name: &str, high: bool) {
        self.register_bank.set_digital_input(pin_name, high);
        if let Ok(d) = pin_name.parse::<u8>() {
            if d <= 7 {
                self.board.set_input(self.backend.as_ref(), &mut self.runtime, self.board.portd, d, high);
            } else if d <= 13 {
                self.board.set_input(self.backend.as_ref(), &mut self.runtime, self.board.portb, d - 8, high);
            }
        } else if let Some(rest) = pin_name.strip_prefix('A') {
            if let Ok(a) = rest.parse::<u8>() {
                if a <= 5 {
                    self.board.set_input(self.backend.as_ref(), &mut self.runtime, self.board.portc, a, high);
                }
            }
        }
    }

    fn get_pin_input(&self, pin_name: &str) -> bool {
        self.register_bank.get_digital_input(pin_name)
    }

    fn set_pin_mode_pullup(&mut self, pin_name: &str) {
        self.pin_overrides.insert(pin_name.to_string(), LogicState::InputPullUp);
    }

    fn set_pin_override(&mut self, pin_name: &str, state: LogicState) {
        self.pin_overrides.insert(pin_name.to_string(), state);
    }

    fn set_adc_voltage(&mut self, channel: u8, voltage: f32) {
        if channel <= 7 {
            let val = self.backend.get(self.board.adc, "channelValues");
            if let avr8rs::runtime::Value::Array(channels) = val {
                let mut borrowed = channels.borrow_mut();
                if (channel as usize) < borrowed.len() {
                    borrowed[channel as usize] = avr8rs::runtime::Value::Number(voltage.clamp(0.0, 5.0) as f64);
                }
            }
        }
    }

    fn set_adc_ref(&mut self, avcc: f32, aref: f32) {
        if self.board.adc.0 > 0 {
            self.backend.set(
                &mut self.runtime,
                self.board.adc,
                "avcc",
                avr8rs::runtime::Value::Number(avcc.clamp(0.0, 5.5) as f64),
            );
            self.backend.set(
                &mut self.runtime,
                self.board.adc,
                "aref",
                avr8rs::runtime::Value::Number(aref.clamp(0.0, 5.5) as f64),
            );
        }
    }

    fn read_serial_output(&mut self) -> Vec<u8> {
        std::mem::take(&mut self.tx_buffer)
    }

    fn write_serial_input(&mut self, bytes: &[u8]) {
        self.rx_buffer.extend_from_slice(bytes);
    }

    fn cycles(&self) -> u64 {
        self.board.cycles(self.backend.as_ref()) as u64
    }

    fn millis(&self) -> f64 {
        self.board.millis(self.backend.as_ref())
    }
}

/// Component definitions and models
pub mod components {
    use super::*;
    use std::collections::HashMap;

    #[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
    pub enum PotentiometerTaper {
        Linear,
        AudioLog,
    }

    impl Default for PotentiometerTaper {
        fn default() -> Self {
            Self::Linear
        }
    }

    #[derive(Debug, Clone, Serialize, Deserialize)]
    pub struct LedComponent {
        pub id: String,
        pub color: String, // "red", "green", "blue", "yellow", "white"
        pub is_lit: bool,
        pub brightness: f32, // 0.0 to 1.0
        #[serde(default)]
        pub custom_forward_voltage: Option<f32>,
        #[serde(default)]
        pub is_blown: bool,
        #[serde(default)]
        pub damage_accumulator: f64,
        #[serde(default)]
        pub current_ma: f32,
        #[serde(default)]
        pub avg_current_ma: f32,
        #[serde(skip)]
        pub terminal_nodes: HashMap<String, Option<usize>>,
    }

    impl LedComponent {
        pub fn new(id: impl Into<String>, color: impl Into<String>) -> Self {
            Self {
                id: id.into(),
                color: color.into(),
                is_lit: false,
                brightness: 0.0,
                custom_forward_voltage: None,
                is_blown: false,
                damage_accumulator: 0.0,
                current_ma: 0.0,
                avg_current_ma: 0.0,
                terminal_nodes: HashMap::new(),
            }
        }

        pub fn set_pin_node(&mut self, pin: &str, node: Option<usize>) {
            self.terminal_nodes.insert(pin.to_string(), node);
        }

        pub fn get_pin_node(&self, pin: &str) -> Option<usize> {
            self.terminal_nodes.get(pin).copied().flatten()
        }

        pub fn forward_voltage(&self) -> f32 {
            let c = self.color.to_lowercase();
            if let Some(vf) = self.custom_forward_voltage {
                if c == "red" || c == "#ef4444" {
                    // Semiconductor limit: Red GaAsP/AlInGaP bandgap restricts Vf <= 2.4V (fixing B3)
                    return vf.min(2.4);
                }
                return vf;
            }
            match c.as_str() {
                "red" | "#ef4444" => 2.2, // Unified to 2.2V per PHYSICS_SPEC.md §4.3 and R3 (fixing B2)
                "yellow" | "#eab308" => 2.0,
                "orange" | "#f97316" => 2.0,
                "green" | "#22c55e" => 2.2,
                "blue" | "#3b82f6" => 3.2,
                "white" | "#f8fafc" => 3.2,
                _ => 2.2,
            }
        }

        pub fn series_rs(&self) -> f64 {
            let c = self.color.to_lowercase();
            match c.as_str() {
                "red" | "#ef4444" | "orange" | "#f97316" => 8.0,
                "yellow" | "#eab308" => 9.0,
                "green" | "#22c55e" => 12.0,
                "blue" | "#3b82f6" | "white" | "#f8fafc" => 15.0,
                _ => 10.0,
            }
        }

        pub fn saturation_current_is(&self) -> f64 {
            let vf = self.forward_voltage() as f64;
            let rs = self.series_rs();
            let vt = crate::constants::V_THERMAL * crate::constants::LED_IDEALITY_FACTOR_N;
            let i_test = crate::constants::LED_TEST_CURRENT_A; // 20mA
            let arg = (vf - i_test * rs) / vt;
            if arg > 0.0 && arg < 80.0 {
                (i_test / (arg.exp() - 1.0)).max(1e-25)
            } else {
                1e-20
            }
        }

        pub fn reverse_breakdown_voltage(&self) -> f64 {
            -5.0
        }

        pub fn update_current_and_brightness(&mut self, current_a: f64, dt: f64) {
            if self.is_blown {
                self.current_ma = 0.0;
                self.avg_current_ma = 0.0;
                self.is_lit = false;
                self.brightness = 0.0;
                return;
            }

            self.current_ma = (current_a * 1000.0) as f32;

            // Persistence of vision time averaging (tau ≈ 20 ms)
            let tau = crate::constants::TAU_EYE_POV;
            let alpha = 1.0 - (-dt / tau).exp();
            self.avg_current_ma = ((1.0 - alpha) * self.avg_current_ma as f64 + alpha * self.current_ma as f64) as f32;

            // Visible threshold at 50 uA (0.05 mA)
            if self.avg_current_ma >= 0.05 {
                self.is_lit = true;
                self.brightness = (self.avg_current_ma / 15.0).clamp(0.01, 1.0);
            } else {
                self.is_lit = false;
                self.brightness = 0.0;
            }

            // Thermal damage accumulator for overcurrent (> 50 mA)
            if current_a > 0.050 {
                let excess = (current_a - 0.050) / 0.050;
                self.damage_accumulator += excess * excess * dt;
                if self.damage_accumulator >= crate::constants::LED_DAMAGE_ACCUM_THRESHOLD || current_a > 0.200 {
                    self.is_blown = true;
                    self.is_lit = false;
                    self.brightness = 0.0;
                }
            }
        }
    }

    #[derive(Debug, Clone, Serialize, Deserialize)]
    pub struct ResistorComponent {
        pub id: String,
        pub resistance_ohms: f32, // e.g. 220.0, 1000.0, 10000.0
        #[serde(default)]
        pub tolerance_percent: f32, // 0.0 (nominal), 1.0 (metal film 1%), 5.0 (carbon film 5%)
        #[serde(default = "default_resistor_power_rating")]
        pub power_rating_watts: f32, // default 0.25 W
        #[serde(default)]
        pub energy_absorbed_j: f64,
        #[serde(default)]
        pub is_blown: bool,
        #[serde(skip)]
        pub terminal_nodes: HashMap<String, Option<usize>>,
    }

    fn default_resistor_power_rating() -> f32 {
        0.25
    }

    impl ResistorComponent {
        pub fn new(id: impl Into<String>, resistance_ohms: f32) -> Self {
            Self {
                id: id.into(),
                resistance_ohms,
                tolerance_percent: 0.0,
                power_rating_watts: 0.25,
                energy_absorbed_j: 0.0,
                is_blown: false,
                terminal_nodes: HashMap::new(),
            }
        }

        pub fn set_pin_node(&mut self, pin: &str, node: Option<usize>) {
            self.terminal_nodes.insert(pin.to_string(), node);
        }

        pub fn get_pin_node(&self, pin: &str) -> Option<usize> {
            self.terminal_nodes.get(pin).copied().flatten()
        }

        pub fn actual_resistance(&self) -> f64 {
            let nom = (self.resistance_ohms as f64).max(0.001);
            if self.tolerance_percent > 0.0 {
                let mut hash: u64 = 0x811c9dc5;
                for b in self.id.bytes() {
                    hash = (hash ^ (b as u64)).wrapping_mul(0x1000193);
                }
                let norm = ((hash % 20000) as f64 - 10000.0) / 10000.0; // [-1.0, 1.0]
                let factor = 1.0 + norm * (self.tolerance_percent as f64 / 100.0);
                (nom * factor).max(0.001)
            } else {
                nom
            }
        }

        pub fn check_power(&mut self, voltage_drop: f64, dt: f64) -> (f64, bool) {
            let r = self.actual_resistance();
            let p = (voltage_drop * voltage_drop) / r;
            let rated = self.power_rating_watts as f64;
            let is_overpower = p > rated;

            if is_overpower {
                let excess_p = p - rated;
                self.energy_absorbed_j += excess_p * dt;
                if self.energy_absorbed_j >= crate::constants::RESISTOR_THERMAL_DAMAGE_J {
                    self.is_blown = true;
                }
            } else if self.energy_absorbed_j > 0.0 {
                self.energy_absorbed_j = (self.energy_absorbed_j - dt * 0.1).max(0.0);
            }

            (p, is_overpower || self.is_blown)
        }
    }

    #[derive(Debug, Clone, Serialize, Deserialize)]
    pub struct PushbuttonComponent {
        pub id: String,
        pub is_pressed: bool,
        #[serde(default)]
        pub bounce_enabled: bool,
        #[serde(default = "default_pushbutton_bounce_ms")]
        pub bounce_duration_ms: f32, // 1 to 5 ms
        #[serde(default)]
        pub bounce_timer_s: f64,
        #[serde(skip)]
        pub terminal_nodes: HashMap<String, Option<usize>>,
    }

    fn default_pushbutton_bounce_ms() -> f32 {
        3.0
    }

    impl PushbuttonComponent {
        pub fn new(id: impl Into<String>) -> Self {
            Self {
                id: id.into(),
                is_pressed: false,
                bounce_enabled: false,
                bounce_duration_ms: 3.0,
                bounce_timer_s: 0.0,
                terminal_nodes: HashMap::new(),
            }
        }

        pub fn set_pin_node(&mut self, pin: &str, node: Option<usize>) {
            self.terminal_nodes.insert(pin.to_string(), node);
        }

        pub fn get_pin_node(&self, pin: &str) -> Option<usize> {
            self.terminal_nodes.get(pin).copied().flatten()
        }

        pub fn contact_resistance(&self) -> f64 {
            if self.is_pressed {
                crate::constants::R_PUSHBUTTON_ON // <= 0.1 ohm (0.05 ohm)
            } else {
                crate::constants::R_PUSHBUTTON_OFF // >= 100 Mohm (1e8 ohm)
            }
        }
    }

    #[derive(Debug, Clone, Serialize, Deserialize)]
    pub struct PotentiometerComponent {
        pub id: String,
        pub value: f32, // 0.0 to 1.0 (wiper position)
        #[serde(default = "default_pot_total_r")]
        pub total_resistance_ohms: f32, // default 10000.0
        #[serde(default)]
        pub taper: PotentiometerTaper,
        #[serde(default = "default_pot_contact_rc")]
        pub terminal_contact_resistance: f32, // default 1.0 ohm
        #[serde(skip)]
        pub terminal_nodes: HashMap<String, Option<usize>>,
    }

    fn default_pot_total_r() -> f32 {
        10000.0
    }

    fn default_pot_contact_rc() -> f32 {
        1.0
    }

    impl PotentiometerComponent {
        pub fn new(id: impl Into<String>) -> Self {
            Self {
                id: id.into(),
                value: 0.5,
                total_resistance_ohms: 10000.0,
                taper: PotentiometerTaper::Linear,
                terminal_contact_resistance: 1.0,
                terminal_nodes: HashMap::new(),
            }
        }

        pub fn set_pin_node(&mut self, pin: &str, node: Option<usize>) {
            self.terminal_nodes.insert(pin.to_string(), node);
        }

        pub fn get_pin_node(&self, pin: &str) -> Option<usize> {
            self.terminal_nodes.get(pin).copied().flatten()
        }

        pub fn effective_wiper_ratio(&self) -> f64 {
            let x = (self.value as f64).clamp(0.0, 1.0);
            match self.taper {
                PotentiometerTaper::Linear => x,
                PotentiometerTaper::AudioLog => {
                    // Audio log taper curve where x=0.5 corresponds to 10%
                    if x <= 0.0 {
                        0.0
                    } else if x >= 1.0 {
                        1.0
                    } else {
                        (10.0f64.powf(x) - 1.0) / 9.0
                    }
                }
            }
        }

        pub fn r_top(&self, rc: f64) -> f64 {
            let ratio = self.effective_wiper_ratio();
            let total = (self.total_resistance_ohms as f64).max(10.0);
            (1.0 - ratio) * total + rc
        }

        pub fn r_bot(&self, rc: f64) -> f64 {
            let ratio = self.effective_wiper_ratio();
            let total = (self.total_resistance_ohms as f64).max(10.0);
            ratio * total + rc
        }
    }

    #[derive(Debug, Clone, Serialize, Deserialize)]
    pub struct CapacitorComponent {
        pub id: String,
        pub capacitance_farads: f32, // e.g. 100e-9 (100nF), 10e-6 (10uF)
        pub is_polarized: bool,
        pub voltage_rating: f32, // e.g. 25.0
        pub esr_ohms: f32, // e.g. 0.5
        pub voltage: f32, // instantaneous charged voltage across capacitor V(1) - V(2)
        #[serde(default)]
        pub leakage_resistance_ohms: f64,
        #[serde(default)]
        pub is_damaged: bool,
        #[serde(default)]
        pub reverse_damage_timer_s: f64,
        #[serde(skip)]
        pub terminal_nodes: HashMap<String, Option<usize>>,
    }

    impl CapacitorComponent {
        pub fn new(id: impl Into<String>, capacitance_farads: f32, is_polarized: bool) -> Self {
            let r_leak = if is_polarized { 2.0e7 } else { crate::constants::R_LEAK_CERAMIC };
            Self {
                id: id.into(),
                capacitance_farads,
                is_polarized,
                voltage_rating: if is_polarized { crate::constants::V_RAT_ELECTRO_DEF as f32 } else { crate::constants::V_RAT_CERAMIC_DEF as f32 },
                esr_ohms: if is_polarized { crate::constants::ESR_ELECTRO_DEF as f32 } else { crate::constants::ESR_CERAMIC_DEF as f32 },
                voltage: 0.0,
                leakage_resistance_ohms: r_leak,
                is_damaged: false,
                reverse_damage_timer_s: 0.0,
                terminal_nodes: HashMap::new(),
            }
        }

        pub fn set_pin_node(&mut self, pin: &str, node: Option<usize>) {
            self.terminal_nodes.insert(pin.to_string(), node);
        }

        pub fn get_pin_node(&self, pin: &str) -> Option<usize> {
            self.terminal_nodes.get(pin).copied().flatten()
        }

        pub fn effective_leakage(&self) -> f64 {
            if self.leakage_resistance_ohms > 0.0 {
                self.leakage_resistance_ohms
            } else if self.is_polarized {
                2.0e7
            } else {
                crate::constants::R_LEAK_CERAMIC
            }
        }
    }

    #[derive(Debug, Clone, Serialize, Deserialize)]
    pub struct BreadboardComponent {
        pub id: String,
        // Half breadboard has 30 rows of 5 pins (A-E, F-J) and 2 power rails (+/-)
    }

    impl BreadboardComponent {
        pub fn new(id: impl Into<String>) -> Self {
            Self {
                id: id.into(),
            }
        }

        pub fn clip_resistance() -> f64 {
            crate::constants::R_BREADBOARD_CLIP // 0.010 ohm
        }

        pub fn wire_resistance() -> f64 {
            crate::constants::R_JUMPER_WIRE // 0.020 ohm
        }
    }
}

/// The overall simulation engine coordinating MCU, components, and netlist signal flow.
pub struct SimulationEngine {
    pub mcu: Box<dyn McuCore>,
    pub wires: Vec<Wire>,
    pub leds: HashMap<String, components::LedComponent>,
    pub resistors: HashMap<String, components::ResistorComponent>,
    pub buttons: HashMap<String, components::PushbuttonComponent>,
    pub pots: HashMap<String, components::PotentiometerComponent>,
    pub capacitors: HashMap<String, components::CapacitorComponent>,
    pub pin_voltages: HashMap<PinId, f32>,
    pub branch_currents: HashMap<String, f32>,
    pub faults: Vec<CircuitFault>,
    pub power_config: PowerRealismConfig,
    pub step_counter: u64,
}

impl SimulationEngine {
    pub fn new_with_uno() -> Self {
        Self {
            mcu: Box::new(ArduinoUnoCore::new()),
            wires: Vec::new(),
            leds: HashMap::new(),
            resistors: HashMap::new(),
            buttons: HashMap::new(),
            pots: HashMap::new(),
            capacitors: HashMap::new(),
            pin_voltages: HashMap::new(),
            branch_currents: HashMap::new(),
            faults: Vec::new(),
            power_config: PowerRealismConfig::default(),
            step_counter: 0,
        }
    }

    pub fn reset(&mut self) {
        self.mcu.reset();
        for led in self.leds.values_mut() {
            led.is_lit = false;
            led.brightness = 0.0;
        }
        for cap in self.capacitors.values_mut() {
            cap.voltage = 0.0;
        }
        self.pin_voltages.clear();
        self.branch_currents.clear();
        self.faults.clear();
        self.step_counter = 0;
    }

    pub fn add_wire(&mut self, wire: Wire) {
        self.wires.push(wire);
    }

    pub fn remove_wire(&mut self, wire_id: &str) {
        self.wires.retain(|w| w.id != wire_id);
    }

    /// Step simulation by `cycles` and resolve connected pin states across wires.
    pub fn step_cycles(&mut self, cycles: u64) {
        self.mcu.step_cycles(cycles);
        self.resolve_electrical_nets();
    }

    /// Physical Netlist Resolution: solves closed-circuit conduction, voltage division, LED forward drop, and faults using MNA.
    pub fn resolve_electrical_nets(&mut self) {
        self.step_counter = self.step_counter.wrapping_add(1);
        MnaCircuitSolver::solve(
            &mut self.mcu,
            &self.wires,
            &mut self.leds,
            &self.resistors,
            &self.buttons,
            &self.pots,
            &mut self.capacitors,
            &mut self.pin_voltages,
            &mut self.branch_currents,
            &mut self.faults,
            &self.power_config,
            self.step_counter,
        );
    }

    pub fn get_pin_voltage(&self, comp: &str, pin: &str) -> f32 {
        self.pin_voltages.get(&PinId::new(comp, pin)).copied().unwrap_or(0.0)
    }

    pub fn pin_voltages_map(&self) -> HashMap<String, f32> {
        self.pin_voltages.iter().map(|(pid, &v)| (format!("{}:{}", pid.component_id, pid.pin_name), v)).collect()
    }

    pub fn mcu_pin_voltages_map(&self) -> HashMap<String, f32> {
        let mut map = HashMap::new();
        for (pid, &v) in &self.pin_voltages {
            let c_lower = pid.component_id.to_lowercase();
            if c_lower.starts_with("uno") || c_lower.starts_with("mcu") || c_lower.starts_with("arduino") {
                map.insert(pid.pin_name.clone(), v);
            }
        }
        if !map.contains_key("GND") {
            map.insert("GND".to_string(), 0.0);
        }
        map
    }

    pub fn faults(&self) -> &[CircuitFault] {
        &self.faults
    }
}

#[cfg(test)]
mod test_usart;

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_simulation_engine_led_propagation() {
        let mut engine = SimulationEngine::new_with_uno();
        let led = components::LedComponent::new("led1", "red");
        engine.leds.insert("led1".into(), led);

        // Connect Uno pin 13 to LED anode, and Uno GND to LED cathode
        engine.add_wire(Wire {
            id: "w1".into(),
            from: PinId::new("uno1", "13"),
            to: PinId::new("led1", "anode"),
            color: "#ef4444".into(),
        });
        engine.add_wire(Wire {
            id: "w2".into(),
            from: PinId::new("uno1", "GND"),
            to: PinId::new("led1", "cathode"),
            color: "#000000".into(),
        });

        // Step engine
        engine.step_cycles(100);
        // Initially without code, pin 13 is floating or low
        assert!(!engine.leds["led1"].is_lit);
    }

    #[test]
    fn test_series_leds_both_light_up() {
        let mut engine = SimulationEngine::new_with_uno();
        engine.leds.insert("led1".into(), components::LedComponent::new("led1", "red"));
        engine.leds.insert("led2".into(), components::LedComponent::new("led2", "red"));
        engine.resistors.insert("r1".into(), components::ResistorComponent::new("r1", 220.0));

        // Connect 5V -> led1:anode -> led1:cathode -> led2:anode -> led2:cathode -> r1:1 -> r1:2 -> GND
        engine.add_wire(Wire {
            id: "w1".into(),
            from: PinId::new("uno1", "5V"),
            to: PinId::new("led1", "anode"),
            color: "#22c55e".into(),
        });
        engine.add_wire(Wire {
            id: "w2".into(),
            from: PinId::new("led1", "cathode"),
            to: PinId::new("led2", "anode"),
            color: "#22c55e".into(),
        });
        engine.add_wire(Wire {
            id: "w3".into(),
            from: PinId::new("led2", "cathode"),
            to: PinId::new("r1", "1"),
            color: "#eab308".into(),
        });
        engine.add_wire(Wire {
            id: "w4".into(),
            from: PinId::new("r1", "2"),
            to: PinId::new("uno1", "GND"),
            color: "#000000".into(),
        });

        engine.resolve_electrical_nets();

        assert!(engine.leds["led1"].is_lit, "LED1 in series must be lit!");
        assert!(engine.leds["led2"].is_lit, "LED2 in series must be lit!");

        // Now remove wire w1 (cut the wire)
        engine.remove_wire("w1");
        engine.resolve_electrical_nets();

        assert!(!engine.leds["led1"].is_lit, "LED1 must turn off when wire is cut!");
        assert!(!engine.leds["led2"].is_lit, "LED2 must turn off when wire is cut!");
    }

    #[test]
    fn test_pushbutton_pullup_toggle_and_conduction() {
        let mut engine = SimulationEngine::new_with_uno();
        engine.mcu.set_pin_mode_pullup("2");
        engine.buttons.insert("btn1".into(), components::PushbuttonComponent::new("btn1"));

        // Connect Uno pin 2 to btn1:1.l, and btn1:2.r to uno1:GND.1
        engine.add_wire(Wire {
            id: "w1".into(),
            from: PinId::new("uno1", "2"),
            to: PinId::new("btn1", "1.l"),
            color: "#3b82f6".into(),
        });
        engine.add_wire(Wire {
            id: "w2".into(),
            from: PinId::new("btn1", "2.r"),
            to: PinId::new("uno1", "GND.1"),
            color: "#000000".into(),
        });

        // 1. Initially button is NOT pressed
        engine.resolve_electrical_nets();
        let unpressed_v = *engine.pin_voltages.get(&PinId::new("uno1", "2")).unwrap_or(&0.0);
        assert!(unpressed_v >= 4.0, "Pin 2 with pullup unpressed must be HIGH (>=4V), got {}", unpressed_v);

        // 2. Press tactile button (contact closure ~0.05 ohm to GND)
        engine.buttons.get_mut("btn1").unwrap().is_pressed = true;
        engine.resolve_electrical_nets();
        let pressed_v = *engine.pin_voltages.get(&PinId::new("uno1", "2")).unwrap_or(&5.0);
        assert!(pressed_v <= 1.0, "Pin 2 with button pressed must be pulled down to GND (<=1V), got {}", pressed_v);

        // 3. Release button (springs back open)
        engine.buttons.get_mut("btn1").unwrap().is_pressed = false;
        engine.resolve_electrical_nets();
        let released_v = *engine.pin_voltages.get(&PinId::new("uno1", "2")).unwrap_or(&0.0);
        assert!(released_v >= 4.0, "Pin 2 after release must return to HIGH (>=4V), got {}", released_v);
    }

    #[test]
    fn test_breadboard_row_and_potentiometer() {
        let mut engine = SimulationEngine::new_with_uno();
        engine.pots.insert("pot1".into(), components::PotentiometerComponent::new("pot1"));
        engine.pots.get_mut("pot1").unwrap().value = 0.6; // 60% = 3.0V

        // Connect pot1:SIG to breadboard column 10 row a, and breadboard column 10 row e to uno1:A0
        engine.add_wire(Wire {
            id: "w1".into(),
            from: PinId::new("pot1", "SIG"),
            to: PinId::new("bb1", "a_10"),
            color: "#3b82f6".into(),
        });
        engine.add_wire(Wire {
            id: "w2".into(),
            from: PinId::new("bb1", "e_10"),
            to: PinId::new("uno1", "A0"),
            color: "#3b82f6".into(),
        });

        engine.resolve_electrical_nets();
        let a0_v = *engine.pin_voltages.get(&PinId::new("uno1", "A0")).unwrap_or(&0.0);
        assert!((a0_v - 3.0).abs() < 0.2, "A0 through breadboard row 10 must receive 3.0V wiper, got {}", a0_v);

        // Test at 0.0V (0% wiper position)
        engine.pots.get_mut("pot1").unwrap().value = 0.0;
        engine.resolve_electrical_nets();
        let zero_v = *engine.pin_voltages.get(&PinId::new("uno1", "A0")).unwrap_or(&0.0);
        assert!(zero_v < 0.05, "A0 at 0% wiper must receive 0.0V, got {}", zero_v);
    }

    #[test]
    fn test_led_brightness_scales_with_resistance() {
        let mut engine = SimulationEngine::new_with_uno();
        engine.leds.insert("led1".into(), components::LedComponent::new("led1", "red"));
        engine.resistors.insert("r1".into(), components::ResistorComponent::new("r1", 220.0));

        // Connect 5V -> led1:anode -> led1:cathode -> r1:1 -> r1:2 -> GND
        engine.add_wire(Wire { id: "w1".into(), from: PinId::new("uno1", "5V"), to: PinId::new("led1", "anode"), color: "#ef4444".into() });
        engine.add_wire(Wire { id: "w2".into(), from: PinId::new("led1", "cathode"), to: PinId::new("r1", "1"), color: "#ef4444".into() });
        engine.add_wire(Wire { id: "w3".into(), from: PinId::new("r1", "2"), to: PinId::new("uno1", "GND"), color: "#000000".into() });

        // 1. With 220 ohm resistor, LED should be bright (~0.90)
        engine.resolve_electrical_nets();
        assert!(engine.leds["led1"].is_lit);
        let bright_220 = engine.leds["led1"].brightness;
        assert!(bright_220 > 0.8, "At 220 ohms, LED brightness should be > 0.8, got {}", bright_220);

        // 2. With 1000 ohm (1k) resistor, LED should be noticeably dimmer
        engine.resistors.get_mut("r1").unwrap().resistance_ohms = 1000.0;
        engine.resolve_electrical_nets();
        assert!(engine.leds["led1"].is_lit);
        let bright_1k = engine.leds["led1"].brightness;
        assert!(bright_1k < bright_220 * 0.4, "At 1k ohms, LED brightness should be < 40% of 220 ohms, got {}", bright_1k);

        // 3. With 100k ohm resistor, current is tiny (< 0.05mA) so LED turns off
        engine.resistors.get_mut("r1").unwrap().resistance_ohms = 100_000.0;
        engine.resolve_electrical_nets();
        assert!(!engine.leds["led1"].is_lit, "At 100k ohms, LED should not be lit");
        assert_eq!(engine.leds["led1"].brightness, 0.0);
    }

    #[test]
    fn test_mcu_pin_voltages_and_fault_access() {
        let mut engine = SimulationEngine::new_with_uno();
        // Direct short-circuit between 5V and GND
        engine.add_wire(Wire {
            id: "short_wire".into(),
            from: PinId::new("uno1", "5V"),
            to: PinId::new("uno1", "GND"),
            color: "#ff0000".into(),
        });
        engine.resolve_electrical_nets();

        // 1. Verify faults access
        let faults = engine.faults();
        assert!(!faults.is_empty(), "Direct 5V-to-GND wire must produce a fault");
        assert!(
            faults.iter().any(|f| f.fault_type == FaultType::ShortCircuit && f.pin_name == "5V"),
            "Fault must be a ShortCircuit on 5V"
        );

        // 2. Verify mcu_pin_voltages_map
        let mcu_volts = engine.mcu_pin_voltages_map();
        assert!(mcu_volts.contains_key("5V"));
        assert!(mcu_volts.contains_key("3.3V"));
        assert!(mcu_volts.contains_key("GND"));
        assert!(mcu_volts.contains_key("13"));
        assert!(mcu_volts.contains_key("A0"));
        assert_eq!(*mcu_volts.get("GND").unwrap(), 0.0);

        // 3. Verify pin_voltages_map
        let pin_volts = engine.pin_voltages_map();
        assert!(pin_volts.contains_key("uno1:5V"));
        assert!(pin_volts.contains_key("uno1:GND"));
        assert!(pin_volts.contains_key("uno1:13"));

        // 4. Clear wire and verify recovery
        engine.remove_wire("short_wire");
        engine.resolve_electrical_nets();
        assert!(engine.faults().is_empty(), "Removing short must clear faults");
        let recovered_mcu_volts = engine.mcu_pin_voltages_map();
        assert_eq!(*recovered_mcu_volts.get("5V").unwrap(), 5.0);
    }

    #[test]
    fn test_power_realism_ideal_vs_realistic_physics() {
        let mut engine = SimulationEngine::new_with_uno();

        // 1. In default Ideal mode, 5V rail is exactly 5.000V
        assert_eq!(engine.power_config.mode, PowerRealismMode::Ideal);
        engine.resolve_electrical_nets();
        let v5_ideal = engine.get_pin_voltage("uno1", "5V");
        assert!((v5_ideal - 5.0).abs() < 1e-4, "Ideal mode 5V rail must be exactly 5.00V, got {}", v5_ideal);

        // 2. Deterministic Gaussian noise reproducibility check
        let n1 = deterministic_gaussian_noise(42, 100, 0.015);
        let n2 = deterministic_gaussian_noise(42, 100, 0.015);
        assert_eq!(n1, n2, "Deterministic Gaussian noise must match identically for same (seed, step)");

        let n3 = deterministic_gaussian_noise(999, 100, 0.015);
        assert_ne!(n1, n3, "Different seed must yield different noise value");

        // 3. Switch to Realistic mode and add heavy load to observe physical voltage sag
        engine.power_config = PowerRealismConfig {
            mode: PowerRealismMode::Realistic,
            level: PowerRealismLevel::High,
            r_internal_5v: 0.50, // 0.5 ohm internal resistance
            r_internal_3v3: 0.50,
            ripple_vpp_5v: 0.0,
            ripple_freq_hz: 100.0,
            noise_sigma_5v: 0.0,
            enable_sag: true,
            enable_ripple: false,
            enable_noise: false,
            seed: 42,
        };

        // Add 10 ohm load resistor between 5V and GND (draws ~500mA)
        engine.resistors.insert("r_load".into(), components::ResistorComponent::new("r_load", 10.0));
        engine.add_wire(Wire { id: "w_load1".into(), from: PinId::new("uno1", "5V"), to: PinId::new("r_load", "1"), color: "#ff0000".into() });
        engine.add_wire(Wire { id: "w_load2".into(), from: PinId::new("r_load", "2"), to: PinId::new("uno1", "GND"), color: "#000000".into() });
        engine.resolve_electrical_nets();

        let v5_loaded = engine.get_pin_voltage("uno1", "5V");
        // Voltage divider: V = 5.0 * 10 / (10 + 0.5) = 4.7619 V
        let expected_v = 5.0 * 10.0 / (10.0 + 0.5);
        assert!(
            (v5_loaded - expected_v as f32).abs() < 0.05,
            "Loaded 5V rail must sag physically according to MNA equation! Expected ~{:.3}V, got {:.3}V",
            expected_v,
            v5_loaded
        );
        assert!(v5_loaded < 4.90, "Loaded 5V rail must sag under load, got {}", v5_loaded);
    }

    #[test]
    fn test_serial_rx_bidirectional() {
        let mut engine = SimulationEngine::new_with_uno();
        assert_eq!(engine.mcu.read_serial_output().len(), 0);
        engine.mcu.write_serial_input(b"HELLO_RX\n");
        engine.step_cycles(100);
    }

    #[test]
    fn test_circuit_device_trait_implementations() {
        use crate::device::CircuitDevice;

        let r = components::ResistorComponent::new("r1", 220.0);
        assert_eq!(r.id(), "r1");
        assert_eq!(r.terminal_pins(), vec!["1", "2"]);
        assert!(!r.is_damaged());

        let pot = components::PotentiometerComponent::new("pot1");
        assert_eq!(pot.id(), "pot1");
        assert_eq!(pot.terminal_pins(), vec!["1", "2", "3"]);
        assert!(!pot.is_damaged());

        let led = components::LedComponent::new("led1", "red");
        assert_eq!(led.id(), "led1");
        assert_eq!(led.terminal_pins(), vec!["anode", "cathode"]);
        assert!(!led.is_damaged());

        let btn = components::PushbuttonComponent::new("btn1");
        assert_eq!(btn.id(), "btn1");
        assert_eq!(btn.terminal_pins().len(), 4);
        assert!(!btn.is_damaged());

        let cap = components::CapacitorComponent::new("c1", 10e-6, true);
        assert_eq!(cap.id(), "c1");
        assert_eq!(cap.terminal_pins(), vec!["1", "2"]);
        assert!(!cap.is_damaged());
    }

    #[test]
    fn test_resistor_tolerance_and_thermal_overload() {
        let mut r = components::ResistorComponent::new("r_tol", 1000.0);
        r.tolerance_percent = 5.0; // 5% carbon film
        let r_actual = r.actual_resistance();
        assert!(r_actual >= 950.0 && r_actual <= 1050.0);

        // Apply 2.0 W (exceeds 0.25 W rating) for 2.0 seconds
        let (_p, is_over) = r.check_power(45.0, 2.0); // 45V across ~1000 ohm ≈ 2.025 W
        assert!(is_over);
        assert!(r.energy_absorbed_j > 0.0);
    }

    #[test]
    fn test_potentiometer_audio_taper_and_smoothness() {
        let mut pot = components::PotentiometerComponent::new("pot_audio");
        pot.taper = components::PotentiometerTaper::AudioLog;

        pot.value = 0.0;
        assert_eq!(pot.effective_wiper_ratio(), 0.0);

        pot.value = 1.0;
        assert_eq!(pot.effective_wiper_ratio(), 1.0);

        pot.value = 0.5;
        // Audio log at midpoint should be around 10% - 25%
        let ratio_mid = pot.effective_wiper_ratio();
        assert!(ratio_mid > 0.05 && ratio_mid < 0.35);

        // Verify continuity of R_top and R_bot
        let r_top = pot.r_top(1.0);
        let r_bot = pot.r_bot(1.0);
        assert!(r_top > 0.0 && r_bot > 0.0);
    }

    #[test]
    fn test_capacitor_physical_models_and_leakage() {
        let c_ceramic = components::CapacitorComponent::new("c_cer", 100e-9, false);
        assert_eq!(c_ceramic.voltage_rating, 50.0);
        assert_eq!(c_ceramic.esr_ohms, 0.02);
        assert_eq!(c_ceramic.effective_leakage(), 1.0e9);

        let c_electro = components::CapacitorComponent::new("c_el", 10e-6, true);
        assert_eq!(c_electro.voltage_rating, 25.0);
        assert_eq!(c_electro.esr_ohms, 0.50);
        assert_eq!(c_electro.effective_leakage(), 2.0e7);
    }
}
