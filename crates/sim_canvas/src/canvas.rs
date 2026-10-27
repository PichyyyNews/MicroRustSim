use std::collections::HashSet;
use egui::{Color32, PointerButton, Pos2, Response, Sense, Stroke, Ui, Vec2};
use serde::{Deserialize, Serialize};

use crate::parts::{PartKind, VisualComponent};
use crate::viewport::Viewport;
use crate::wire::VisualWire;

#[derive(Debug, Clone)]
pub enum CanvasAction {
    WireCreated {
        from_comp: String,
        from_pin: String,
        to_comp: String,
        to_pin: String,
        color_hex: String,
    },
    WireDeleted(String),
    ComponentMoved {
        id: String,
        pos: Pos2,
    },
    ComponentSelected(Option<String>),
    ButtonPressed {
        id: String,
        pressed: bool,
    },
    PotChanged {
        id: String,
        value: f32,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CanvasState {
    pub viewport: Viewport,
    pub components: Vec<VisualComponent>,
    pub wires: Vec<VisualWire>,
    pub selected_comp_id: Option<String>,
    pub selected_wire_id: Option<String>,
    #[serde(skip)]
    pub dragging_comp_id: Option<String>,
    #[serde(skip)]
    pub dragging_wire_start: Option<(String, String, Pos2)>, // (comp_id, pin_name, screen_pos)
    #[serde(skip)]
    pub interacting_pot_id: Option<String>,
    #[serde(skip)]
    pub active_pressed_button: Option<String>,
    pub current_wire_color: String,
}

impl Default for CanvasState {
    fn default() -> Self {
        Self {
            viewport: Viewport::default(),
            components: vec![
                VisualComponent::new_arduino_uno("uno1", Pos2::new(100.0, 150.0)),
                VisualComponent::new_breadboard_half("bb1", Pos2::new(420.0, 150.0)),
                VisualComponent::new_led("led1", Pos2::new(500.0, 70.0), "red"),
                VisualComponent::new_resistor("r1", Pos2::new(600.0, 85.0), 220.0),
                VisualComponent::new_pushbutton("btn1", Pos2::new(720.0, 80.0)),
                VisualComponent::new_potentiometer("pot1", Pos2::new(820.0, 70.0)),
            ],
            wires: vec![
                VisualWire::new("w1", "uno1", "13", "led1", "anode", "#22c55e"),
                VisualWire::new("w2", "led1", "cathode", "r1", "1", "#eab308"),
                VisualWire::new("w3", "r1", "2", "uno1", "GND", "#000000"),
            ],
            selected_comp_id: None,
            selected_wire_id: None,
            dragging_comp_id: None,
            dragging_wire_start: None,
            interacting_pot_id: None,
            active_pressed_button: None,
            current_wire_color: "#22c55e".to_string(), // Green wire by default
        }
    }
}

pub struct CanvasWidget<'a> {
    state: &'a mut CanvasState,
    builtin_led_on: bool,
    lit_leds: HashSet<String>,
    actions: Vec<CanvasAction>,
}

impl<'a> CanvasWidget<'a> {
    pub fn new(state: &'a mut CanvasState, builtin_led_on: bool, lit_leds: HashSet<String>) -> Self {
        Self {
            state,
            builtin_led_on,
            lit_leds,
            actions: Vec::new(),
        }
    }

    pub fn take_actions(&mut self) -> Vec<CanvasAction> {
        std::mem::take(&mut self.actions)
    }

    pub fn show(mut self, ui: &mut Ui) -> (Response, Vec<CanvasAction>) {
        let (rect, response) = ui.allocate_exact_size(ui.available_size(), Sense::click_and_drag());
        let painter = ui.painter_at(rect);

        // Background canvas fill (Sleek dark theme canvas)
        painter.rect_filled(rect, egui::CornerRadius::ZERO, Color32::from_rgb(18, 24, 38));

        // 1. Handle Pan and Zoom
        let scroll_delta = ui.input(|i| i.smooth_scroll_delta.y);
        if scroll_delta != 0.0 && response.hovered() {
            let zoom_factor = if scroll_delta > 0.0 { 1.1 } else { 0.9 };
            let old_zoom = self.state.viewport.zoom;
            let new_zoom = (old_zoom * zoom_factor).clamp(0.25, 3.0);

            if let Some(mouse_pos) = response.hover_pos() {
                self.state.viewport.pan = mouse_pos.to_vec2()
                    - (mouse_pos.to_vec2() - self.state.viewport.pan) * (new_zoom / old_zoom);
            }
            self.state.viewport.zoom = new_zoom;
        }

        // Pan with right mouse or middle mouse drag
        if response.dragged_by(PointerButton::Secondary) || response.dragged_by(PointerButton::Middle) {
            self.state.viewport.pan += response.drag_delta();
        }

        // Draw background grid
        self.state.viewport.draw_grid(&painter, rect);

        // 2. Interaction: Find hovered pin or component
        let mouse_pos = response.hover_pos();
        let mouse_world = mouse_pos.map(|p| self.state.viewport.screen_to_world(p));

        let mut hovered_pin: Option<(String, String, Pos2)> = None; // (comp_id, pin_name, pin_world_pos)
        let pin_hit_radius = 8.0 / self.state.viewport.zoom;

        if let Some(m_world) = mouse_world {
            for comp in &self.state.components {
                if let Some(pin) = comp.find_pin_at(m_world, pin_hit_radius) {
                    hovered_pin = Some((comp.id.clone(), pin.name.clone(), comp.pin_world_pos(pin)));
                    break;
                }
            }
        }

        // 3. Handle Wire Creation or Dragging Components
        if response.drag_started_by(PointerButton::Primary) {
            if let Some((comp_id, pin_name, pin_wpos)) = &hovered_pin {
                // Start drawing wire from this pin
                self.state.dragging_wire_start = Some((
                    comp_id.clone(),
                    pin_name.clone(),
                    self.state.viewport.world_to_screen(*pin_wpos),
                ));
            } else if let Some(m_world) = mouse_world {
                // Check if clicking inside a component
                let mut clicked_comp = None;
                for comp in self.state.components.iter().rev() {
                    if comp.hit_test(m_world) {
                        clicked_comp = Some(comp.clone());
                        break;
                    }
                }

                if let Some(comp) = clicked_comp {
                    self.state.selected_comp_id = Some(comp.id.clone());
                    self.actions.push(CanvasAction::ComponentSelected(Some(comp.id.clone())));

                    match &comp.kind {
                        PartKind::Pushbutton => {
                            // Check if clicking center cap
                            let center = comp.pos + Vec2::new(24.0, 24.0);
                            if (m_world - center).length() <= 16.0 {
                                self.state.active_pressed_button = Some(comp.id.clone());
                                self.actions.push(CanvasAction::ButtonPressed {
                                    id: comp.id.clone(),
                                    pressed: true,
                                });
                            } else {
                                self.state.dragging_comp_id = Some(comp.id.clone());
                            }
                        }
                        PartKind::Potentiometer { .. } => {
                            // Check if clicking rotary dial
                            let center = comp.pos + Vec2::new(30.0, 30.0);
                            if (m_world - center).length() <= 22.0 {
                                self.state.interacting_pot_id = Some(comp.id.clone());
                            } else {
                                self.state.dragging_comp_id = Some(comp.id.clone());
                            }
                        }
                        _ => {
                            self.state.dragging_comp_id = Some(comp.id);
                        }
                    }
                } else {
                    self.state.selected_comp_id = None;
                    self.actions.push(CanvasAction::ComponentSelected(None));
                }
            }
        }

        // Potentiometer rotary adjustment on drag
        if let Some(pot_id) = &self.state.interacting_pot_id {
            if response.dragged_by(PointerButton::Primary) {
                let delta = response.drag_delta().x * 0.005;
                for comp in &mut self.state.components {
                    if comp.id == *pot_id {
                        if let PartKind::Potentiometer { value } = &mut comp.kind {
                            *value = (*value + delta).clamp(0.0, 1.0);
                            self.actions.push(CanvasAction::PotChanged {
                                id: comp.id.clone(),
                                value: *value,
                            });
                        }
                        break;
                    }
                }
            }
        }

        // Continue dragging component
        if let Some(drag_id) = &self.state.dragging_comp_id {
            if response.dragged_by(PointerButton::Primary) {
                let delta_world = response.drag_delta() / self.state.viewport.zoom;
                for comp in &mut self.state.components {
                    if comp.id == *drag_id {
                        comp.pos += delta_world;
                        self.actions.push(CanvasAction::ComponentMoved {
                            id: comp.id.clone(),
                            pos: comp.pos,
                        });
                        break;
                    }
                }
            }
        }

        // Wire creation or button release
        if response.drag_stopped() {
            if let Some((from_comp, from_pin, _)) = self.state.dragging_wire_start.take() {
                if let Some((to_comp, to_pin, _)) = &hovered_pin {
                    if &from_comp != to_comp || &from_pin != to_pin {
                        let wire_color = self.state.current_wire_color.clone();
                        let wire_id = format!("w_{}", fastrand_num());
                        self.state.wires.push(VisualWire::new(
                            wire_id.clone(),
                            from_comp.clone(),
                            from_pin.clone(),
                            to_comp.clone(),
                            to_pin.clone(),
                            wire_color.clone(),
                        ));
                        self.actions.push(CanvasAction::WireCreated {
                            from_comp,
                            from_pin,
                            to_comp: to_comp.clone(),
                            to_pin: to_pin.clone(),
                            color_hex: wire_color,
                        });
                    }
                }
            }

            if let Some(btn_id) = self.state.active_pressed_button.take() {
                self.actions.push(CanvasAction::ButtonPressed {
                    id: btn_id,
                    pressed: false,
                });
            }

            self.state.dragging_comp_id = None;
            self.state.interacting_pot_id = None;
        }

        // 4. Render Components
        for comp in &self.state.components {
            let is_sel = self.state.selected_comp_id.as_deref() == Some(&comp.id);
            let is_active = match &comp.kind {
                PartKind::ArduinoUno => self.builtin_led_on,
                PartKind::Led { .. } => self.lit_leds.contains(&comp.id),
                PartKind::Pushbutton => self.state.active_pressed_button.as_deref() == Some(&comp.id),
                _ => false,
            };
            comp.draw(&painter, &self.state.viewport, is_sel, is_active);
        }

        // 5. Render Existing Wires
        for wire in &self.state.wires {
            let p1 = self.find_pin_screen_pos(&wire.from_comp, &wire.from_pin);
            let p2 = self.find_pin_screen_pos(&wire.to_comp, &wire.to_pin);
            if let (Some(p1), Some(p2)) = (p1, p2) {
                let is_sel = self.state.selected_wire_id.as_deref() == Some(&wire.id);
                wire.draw(&painter, p1, p2, self.state.viewport.zoom, false, is_sel);
            }
        }

        // 6. Render Wire currently being drawn
        if let (Some((_, _, start_screen)), Some(curr_screen)) =
            (&self.state.dragging_wire_start, mouse_pos)
        {
            let temp_wire = VisualWire::new(
                "temp",
                "a",
                "b",
                "c",
                "d",
                self.state.current_wire_color.clone(),
            );
            temp_wire.draw(
                &painter,
                *start_screen,
                curr_screen,
                self.state.viewport.zoom,
                true,
                false,
            );
        }

        // 7. Highlight hovered pin
        if let Some((_, _, pin_wpos)) = hovered_pin {
            let pin_screen = self.state.viewport.world_to_screen(pin_wpos);
            let r = 7.0 * self.state.viewport.zoom;
            painter.circle_stroke(
                pin_screen,
                r,
                Stroke::new(2.0, Color32::from_rgb(250, 204, 21)),
            );
        }

        // Canvas stats / Controls overlay
        let overlay_pos = rect.min + Vec2::new(12.0, 12.0);
        painter.text(
            overlay_pos,
            egui::Align2::LEFT_TOP,
            format!("Zoom: {:.0}%  |  Pan: Right-click Drag  |  Connect: Left-click Pin  |  Click Pushbutton / Drag Pot", self.state.viewport.zoom * 100.0),
            egui::FontId::new(12.0, egui::FontFamily::Proportional),
            Color32::from_rgb(148, 163, 184),
        );

        let actions = self.take_actions();
        (response, actions)
    }

    fn find_pin_screen_pos(&self, comp_id: &str, pin_name: &str) -> Option<Pos2> {
        for comp in &self.state.components {
            if comp.id == comp_id {
                for pin in &comp.pins {
                    if pin.name == pin_name {
                        return Some(self.state.viewport.world_to_screen(comp.pin_world_pos(pin)));
                    }
                }
            }
        }
        None
    }
}

fn fastrand_num() -> u64 {
    use std::time::{SystemTime, UNIX_EPOCH};
    SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_nanos() as u64
}
