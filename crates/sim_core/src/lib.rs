use std::collections::{HashMap, HashSet};
use std::rc::Rc;
use serde::{Deserialize, Serialize};

use avr8rs::board::{parse_hex, Board, PinState as AvrPinState};
use avr8rs::runtime::{Backend, Runtime};

/// Logic/Electrical state of a pin or node.
#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub enum LogicState {
    Low,
    High,
    Floating,
    Analog(f32), // Voltage 0.0 .. 5.0V
    Pwm { duty: u8, freq_hz: u32 },
}

impl LogicState {
    pub fn is_high(&self) -> bool {
        match self {
            LogicState::High => true,
            LogicState::Analog(v) => *v >= 2.5,
            LogicState::Pwm { duty, .. } => *duty > 127,
            _ => false,
        }
    }

    pub fn voltage(&self) -> f32 {
        match self {
            LogicState::Low => 0.0,
            LogicState::High => 5.0,
            LogicState::Floating => 0.0,
            LogicState::Analog(v) => *v,
            LogicState::Pwm { duty, .. } => (*duty as f32 / 255.0) * 5.0,
        }
    }
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
        }
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
            let step = remaining.min(40);
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
        // Builtin LED is pin 13 (PORTB 5)
        if pin_name == "13" || pin_name == "LED_BUILTIN" {
            let state = self.board.led_builtin(self.backend.as_ref(), &mut self.runtime);
            return match state {
                AvrPinState::High => LogicState::High,
                AvrPinState::Low => LogicState::Low,
                AvrPinState::Input => LogicState::Floating,
                AvrPinState::InputPullUp => LogicState::High,
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
                    AvrPinState::InputPullUp => LogicState::High,
                };
            } else if d <= 13 {
                // Digital pins 8-13 -> PORTB (0 to 5)
                let bit = d - 8;
                let state = self.board.pin_state(self.backend.as_ref(), &mut self.runtime, self.board.portb, bit);
                return match state {
                    AvrPinState::High => LogicState::High,
                    AvrPinState::Low => LogicState::Low,
                    AvrPinState::Input => LogicState::Floating,
                    AvrPinState::InputPullUp => LogicState::High,
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
                        AvrPinState::InputPullUp => LogicState::High,
                    };
                }
            }
        }

        // Power rails
        if pin_name == "5V" || pin_name == "3.3V" {
            LogicState::High
        } else if pin_name == "GND" {
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
        }
    }

    pub fn reset(&mut self) {
        self.mcu.reset();
        for led in self.leds.values_mut() {
            led.is_lit = false;
            led.brightness = 0.0;
        }
        self.pin_voltages.clear();
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

    /// Fast Netlist Resolution: resolves pin connections, LED illumination, and button inputs.
    pub fn resolve_electrical_nets(&mut self) {
        let mut node_voltages: HashMap<PinId, f32> = HashMap::new();

        // 1. Read MCU pin outputs and power rails
        let mcu_pins = [
            "0", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12", "13",
            "A0", "A1", "A2", "A3", "A4", "A5", "5V", "3.3V", "GND",
        ];

        for &pin_name in &mcu_pins {
            let pid = PinId::new("uno1", pin_name);
            let state = self.mcu.get_pin_state(pin_name);
            node_voltages.insert(pid, state.voltage());
        }

        // 2. Build adjacency for connected nets
        let mut adj: HashMap<PinId, Vec<PinId>> = HashMap::new();
        for wire in &self.wires {
            adj.entry(wire.from.clone()).or_default().push(wire.to.clone());
            adj.entry(wire.to.clone()).or_default().push(wire.from.clone());
        }

        // Also connect pushbutton terminals if pressed
        for (btn_id, btn) in &self.buttons {
            if btn.is_pressed {
                let pin_l = PinId::new(btn_id, "1");
                let pin_r = PinId::new(btn_id, "2");
                adj.entry(pin_l.clone()).or_default().push(pin_r.clone());
                adj.entry(pin_r.clone()).or_default().push(pin_l.clone());
            }
        }

        // Connect resistor terminals (ideal model: voltage propagates through)
        for res_id in self.resistors.keys() {
            let pin1 = PinId::new(res_id, "1");
            let pin2 = PinId::new(res_id, "2");
            adj.entry(pin1.clone()).or_default().push(pin2.clone());
            adj.entry(pin2.clone()).or_default().push(pin1.clone());
        }

        // Potentiometer wiper output voltage (0.0 to 5.0V)
        for (pot_id, pot) in &self.pots {
            let sig_pin = PinId::new(pot_id, "SIG");
            node_voltages.insert(sig_pin, pot.value * 5.0);
        }

        // Propagate known voltages across connected components using BFS/DFS
        let mut visited: HashSet<PinId> = HashSet::new();
        let source_pins: Vec<(PinId, f32)> = node_voltages.iter().map(|(k, v)| (k.clone(), *v)).collect();

        for (start_pin, volt) in source_pins {
            let mut queue = vec![start_pin];
            while let Some(current) = queue.pop() {
                if visited.insert(current.clone()) {
                    node_voltages.insert(current.clone(), volt);
                    if let Some(neighbors) = adj.get(&current) {
                        for neighbor in neighbors {
                            if !visited.contains(neighbor) {
                                queue.push(neighbor.clone());
                            }
                        }
                    }
                }
            }
        }

        // 3. Update LED illumination state based on Anode vs Cathode voltage
        for (led_id, led) in self.leds.iter_mut() {
            let anode_pid = PinId::new(led_id, "anode");
            let cathode_pid = PinId::new(led_id, "cathode");

            let v_anode = node_voltages.get(&anode_pid).copied().unwrap_or(0.0);
            let v_cathode = node_voltages.get(&cathode_pid).copied().unwrap_or(0.0);

            // Forward voltage drop threshold ~1.8V
            if v_anode - v_cathode >= 1.8 {
                led.is_lit = true;
                led.brightness = ((v_anode - v_cathode) / 5.0).clamp(0.0, 1.0);
            } else {
                led.is_lit = false;
                led.brightness = 0.0;
            }
        }

        // 4. Update MCU input pins driven by external nets
        for &pin_name in &mcu_pins {
            let pid = PinId::new("uno1", pin_name);
            if let Some(&volt) = node_voltages.get(&pid) {
                // If an external component drives voltage onto an MCU pin
                if volt >= 2.5 {
                    self.mcu.set_pin_input(pin_name, true);
                } else {
                    self.mcu.set_pin_input(pin_name, false);
                }
            }
        }

        self.pin_voltages = node_voltages;
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
}
