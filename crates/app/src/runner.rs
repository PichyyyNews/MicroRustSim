use std::collections::VecDeque;
use sim_core::{components, PinId, SimulationEngine, Wire};

pub struct SimRunner {
    pub engine: SimulationEngine,
    pub is_running: bool,
    pub cycles_per_frame: u64,
    pub pin13_state: bool,
    pub logic_history: VecDeque<[f64; 2]>, // [time_sec, voltage]
    pub max_history_points: usize,
    pub virtual_time_sec: f64,
    pub serial_logs: Vec<String>,
}

impl SimRunner {
    pub fn new() -> Self {
        let engine = SimulationEngine::new_with_uno();
        Self {
            engine,
            is_running: false,
            // 16 MHz / 60 FPS ~= 266,666 cycles per frame for 1x real-time simulation
            cycles_per_frame: 100_000,
            pin13_state: false,
            logic_history: VecDeque::with_capacity(1000),
            max_history_points: 1000,
            virtual_time_sec: 0.0,
            serial_logs: Vec::new(),
        }
    }

    pub fn load_hex(&mut self, hex: &str) -> Result<(), String> {
        self.engine.mcu.load_hex(hex)?;
        self.logic_history.clear();
        self.virtual_time_sec = 0.0;
        self.serial_logs.clear();
        self.serial_logs.push("[SIM] Loaded program HEX successfully into ATmega328P Flash (32KB).".to_string());
        Ok(())
    }

    pub fn get_lit_leds(&self) -> std::collections::HashSet<String> {
        self.engine
            .leds
            .iter()
            .filter(|(_, led)| led.is_lit)
            .map(|(id, _)| id.clone())
            .collect()
    }

    pub fn reset(&mut self) {
        self.engine.reset();
        self.pin13_state = false;
        self.logic_history.clear();
        self.virtual_time_sec = 0.0;
        self.serial_logs.push("[SIM] MCU System Reset.".to_string());
    }

    pub fn sync_wires(&mut self, visual_wires: &[sim_canvas::VisualWire]) {
        self.engine.wires.clear();
        for vw in visual_wires {
            self.engine.add_wire(Wire {
                id: vw.id.clone(),
                from: PinId::new(vw.from_comp.clone(), vw.from_pin.clone()),
                to: PinId::new(vw.to_comp.clone(), vw.to_pin.clone()),
                color: vw.color_hex.clone(),
            });
        }
    }

    pub fn sync_components(&mut self, comps: &[sim_canvas::VisualComponent]) {
        self.engine.leds.clear();
        self.engine.resistors.clear();
        self.engine.buttons.clear();
        self.engine.pots.clear();

        for c in comps {
            match &c.kind {
                sim_canvas::PartKind::Led { color } => {
                    self.engine.leds.insert(c.id.clone(), components::LedComponent::new(c.id.clone(), color));
                }
                sim_canvas::PartKind::Resistor { resistance } => {
                    self.engine.resistors.insert(c.id.clone(), components::ResistorComponent::new(c.id.clone(), *resistance));
                }
                sim_canvas::PartKind::Pushbutton => {
                    self.engine.buttons.insert(c.id.clone(), components::PushbuttonComponent::new(c.id.clone()));
                }
                sim_canvas::PartKind::Potentiometer { value } => {
                    let mut pot = components::PotentiometerComponent::new(c.id.clone());
                    pot.value = *value;
                    self.engine.pots.insert(c.id.clone(), pot);
                }
                _ => {}
            }
        }
    }

    pub fn tick(&mut self, dt_seconds: f32) {
        if !self.is_running {
            return;
        }

        // Run simulation slice
        self.engine.step_cycles(self.cycles_per_frame);

        // Read Builtin Pin 13
        let state13 = self.engine.mcu.get_pin_state("13");
        self.pin13_state = state13.is_high();

        // Advance simulated time
        self.virtual_time_sec += dt_seconds as f64;
        let v13 = if self.pin13_state { 5.0 } else { 0.0 };

        if self.logic_history.len() >= self.max_history_points {
            self.logic_history.pop_front();
        }
        self.logic_history.push_back([self.virtual_time_sec, v13]);

        // Read any serial logs
        let serial_bytes = self.engine.mcu.read_serial_output();
        if !serial_bytes.is_empty() {
            let msg = String::from_utf8_lossy(&serial_bytes);
            self.serial_logs.push(msg.to_string());
        }
    }
}
