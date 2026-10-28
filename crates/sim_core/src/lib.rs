use std::collections::HashMap;
use std::rc::Rc;
use serde::{Deserialize, Serialize};

use avr8rs::board::{parse_hex, Board, PinState as AvrPinState};
use avr8rs::runtime::{Backend, Runtime};

pub mod solver;
pub use solver::{CircuitFault, FaultType, MnaCircuitSolver};

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
    } else if c_lower.starts_with("btn") || c_lower.starts_with("sw") || c_lower.starts_with("button") {
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
    fn set_pin_mode_pullup(&mut self, _pin_name: &str) {}
    fn set_adc_voltage(&mut self, _channel: u8, _voltage: f32) {}
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
            let step = remaining.min(32);
            self.board.run_cycles(self.backend.as_ref(), &mut self.runtime, step);
            let ucsra = self.board.read_data(self.backend.as_ref(), 0xc0);
            if (ucsra & 0x40) != 0 {
                let udr = self.board.read_data(self.backend.as_ref(), 0xc6);
                self.tx_buffer.push(udr);
                self.backend.set(
                    &mut self.runtime,
                    self.board.data,
                    "192",
                    avr8rs::runtime::Value::Number((ucsra & !0x40) as f64),
                );
            }
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

    fn set_pin_mode_pullup(&mut self, pin_name: &str) {
        self.pin_overrides.insert(pin_name.to_string(), LogicState::InputPullUp);
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

    #[derive(Debug, Clone, Serialize, Deserialize)]
    pub struct LedComponent {
        pub id: String,
        pub color: String, // "red", "green", "blue", "yellow", "white"
        pub is_lit: bool,
        pub brightness: f32, // 0.0 to 1.0
    }

    impl LedComponent {
        pub fn new(id: impl Into<String>, color: impl Into<String>) -> Self {
            Self {
                id: id.into(),
                color: color.into(),
                is_lit: false,
                brightness: 0.0,
            }
        }

        pub fn forward_voltage(&self) -> f32 {
            let c = self.color.to_lowercase();
            match c.as_str() {
                "red" | "#ef4444" => 1.8,
                "yellow" | "#eab308" => 2.0,
                "orange" | "#f97316" => 2.0,
                "green" | "#22c55e" => 2.2,
                "blue" | "#3b82f6" => 3.2,
                "white" | "#f8fafc" => 3.2,
                _ => 2.0,
            }
        }
    }

    #[derive(Debug, Clone, Serialize, Deserialize)]
    pub struct ResistorComponent {
        pub id: String,
        pub resistance_ohms: f32, // e.g. 220.0, 1000.0, 10000.0
    }

    impl ResistorComponent {
        pub fn new(id: impl Into<String>, resistance_ohms: f32) -> Self {
            Self {
                id: id.into(),
                resistance_ohms,
            }
        }
    }

    #[derive(Debug, Clone, Serialize, Deserialize)]
    pub struct PushbuttonComponent {
        pub id: String,
        pub is_pressed: bool,
    }

    impl PushbuttonComponent {
        pub fn new(id: impl Into<String>) -> Self {
            Self {
                id: id.into(),
                is_pressed: false,
            }
        }
    }

    #[derive(Debug, Clone, Serialize, Deserialize)]
    pub struct PotentiometerComponent {
        pub id: String,
        pub value: f32, // 0.0 to 1.0 (wiper position)
    }

    impl PotentiometerComponent {
        pub fn new(id: impl Into<String>) -> Self {
            Self {
                id: id.into(),
                value: 0.5,
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
    pub pin_voltages: HashMap<PinId, f32>,
    pub branch_currents: HashMap<String, f32>,
    pub faults: Vec<CircuitFault>,
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
            pin_voltages: HashMap::new(),
            branch_currents: HashMap::new(),
            faults: Vec::new(),
        }
    }

    pub fn reset(&mut self) {
        self.mcu.reset();
        for led in self.leds.values_mut() {
            led.is_lit = false;
            led.brightness = 0.0;
        }
        self.pin_voltages.clear();
        self.branch_currents.clear();
        self.faults.clear();
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
        MnaCircuitSolver::solve(
            &mut self.mcu,
            &self.wires,
            &mut self.leds,
            &self.resistors,
            &self.buttons,
            &self.pots,
            &mut self.pin_voltages,
            &mut self.branch_currents,
            &mut self.faults,
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
}
