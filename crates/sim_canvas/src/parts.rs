use egui::{
    Color32, CornerRadius, FontFamily, FontId, Painter, Pos2, Rect, Stroke, Vec2,
};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum PartKind {
    ArduinoUno,
    BreadboardHalf,
    Led { color: String },
    Resistor { resistance: f32 },
    Pushbutton,
    Potentiometer { value: f32 },
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VisualPin {
    pub name: String,
    pub rel_pos: Vec2,
    pub is_analog: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VisualComponent {
    pub id: String,
    pub kind: PartKind,
    pub pos: Pos2,
    pub size: Vec2,
    pub pins: Vec<VisualPin>,
}

impl VisualComponent {
    pub fn new_arduino_uno(id: impl Into<String>, pos: Pos2) -> Self {
        let mut pins = Vec::new();
        // Top Digital header (D0 - D13, GND, AREF)
        let top_y = 12.0;
        let right_x = 245.0;
        let pin_pitch = 12.0;

        let digital_names = [
            "AREF", "GND", "13", "12", "11", "10", "9", "8",
            "7", "6", "5", "4", "3", "2", "1", "0",
        ];
        for (i, &name) in digital_names.iter().enumerate() {
            // Gap between 8 and 7
            let gap = if i >= 8 { 6.0 } else { 0.0 };
            pins.push(VisualPin {
                name: name.to_string(),
                rel_pos: Vec2::new(right_x - (i as f32 * pin_pitch) - gap, top_y),
                is_analog: false,
            });
        }

        // Bottom Power & Analog header
        let bot_y = 188.0;
        let pwr_names = ["IOREF", "RESET", "3.3V", "5V", "GND", "GND", "VIN"];
        for (i, &name) in pwr_names.iter().enumerate() {
            pins.push(VisualPin {
                name: name.to_string(),
                rel_pos: Vec2::new(105.0 + (i as f32 * pin_pitch), bot_y),
                is_analog: false,
            });
        }

        let analog_names = ["A0", "A1", "A2", "A3", "A4", "A5"];
        for (i, &name) in analog_names.iter().enumerate() {
            pins.push(VisualPin {
                name: name.to_string(),
                rel_pos: Vec2::new(198.0 + (i as f32 * pin_pitch), bot_y),
                is_analog: true,
            });
        }

        Self {
            id: id.into(),
            kind: PartKind::ArduinoUno,
            pos,
            size: Vec2::new(260.0, 200.0),
            pins,
        }
    }

    pub fn new_breadboard_half(id: impl Into<String>, pos: Pos2) -> Self {
        let mut pins = Vec::new();
        // Half breadboard: 30 columns, rails + & - top/bottom, and 2 banks of 5 (A-E, F-J)
        let col_pitch = 12.0;
        let start_x = 25.0;

        // Top power rails (+, -)
        for c in 0..30 {
            pins.push(VisualPin {
                name: format!("top_plus_{}", c + 1),
                rel_pos: Vec2::new(start_x + c as f32 * col_pitch, 18.0),
                is_analog: false,
            });
            pins.push(VisualPin {
                name: format!("top_minus_{}", c + 1),
                rel_pos: Vec2::new(start_x + c as f32 * col_pitch, 28.0),
                is_analog: false,
            });
        }

        // Main terminal strips A-E (top bank) & F-J (bottom bank)
        let row_letters_top = ["A", "B", "C", "D", "E"];
        let row_letters_bot = ["F", "G", "H", "I", "J"];

        for c in 0..30 {
            let col_num = c + 1;
            for (r, &letter) in row_letters_top.iter().enumerate() {
                pins.push(VisualPin {
                    name: format!("{}{}", letter, col_num),
                    rel_pos: Vec2::new(start_x + c as f32 * col_pitch, 48.0 + r as f32 * 10.0),
                    is_analog: false,
                });
            }
            for (r, &letter) in row_letters_bot.iter().enumerate() {
                pins.push(VisualPin {
                    name: format!("{}{}", letter, col_num),
                    rel_pos: Vec2::new(start_x + c as f32 * col_pitch, 115.0 + r as f32 * 10.0),
                    is_analog: false,
                });
            }
        }

        Self {
            id: id.into(),
            kind: PartKind::BreadboardHalf,
            pos,
            size: Vec2::new(400.0, 195.0),
            pins,
        }
    }

    pub fn new_led(id: impl Into<String>, pos: Pos2, color: impl Into<String>) -> Self {
        Self {
            id: id.into(),
            kind: PartKind::Led { color: color.into() },
            pos,
            size: Vec2::new(40.0, 60.0),
            pins: vec![
                VisualPin {
                    name: "anode".to_string(),
                    rel_pos: Vec2::new(14.0, 56.0),
                    is_analog: false,
                },
                VisualPin {
                    name: "cathode".to_string(),
                    rel_pos: Vec2::new(26.0, 56.0),
                    is_analog: false,
                },
            ],
        }
    }

    pub fn new_resistor(id: impl Into<String>, pos: Pos2, ohms: f32) -> Self {
        Self {
            id: id.into(),
            kind: PartKind::Resistor { resistance: ohms },
            pos,
            size: Vec2::new(70.0, 24.0),
            pins: vec![
                VisualPin {
                    name: "1".to_string(),
                    rel_pos: Vec2::new(4.0, 12.0),
                    is_analog: false,
                },
                VisualPin {
                    name: "2".to_string(),
                    rel_pos: Vec2::new(66.0, 12.0),
                    is_analog: false,
                },
            ],
        }
    }

    pub fn new_pushbutton(id: impl Into<String>, pos: Pos2) -> Self {
        Self {
            id: id.into(),
            kind: PartKind::Pushbutton,
            pos,
            size: Vec2::new(48.0, 48.0),
            pins: vec![
                VisualPin {
                    name: "1".to_string(),
                    rel_pos: Vec2::new(6.0, 12.0),
                    is_analog: false,
                },
                VisualPin {
                    name: "2".to_string(),
                    rel_pos: Vec2::new(42.0, 12.0),
                    is_analog: false,
                },
                VisualPin {
                    name: "3".to_string(),
                    rel_pos: Vec2::new(6.0, 36.0),
                    is_analog: false,
                },
                VisualPin {
                    name: "4".to_string(),
                    rel_pos: Vec2::new(42.0, 36.0),
                    is_analog: false,
                },
            ],
        }
    }

    pub fn new_potentiometer(id: impl Into<String>, pos: Pos2) -> Self {
        Self {
            id: id.into(),
            kind: PartKind::Potentiometer { value: 0.5 },
            pos,
            size: Vec2::new(60.0, 70.0),
            pins: vec![
                VisualPin {
                    name: "GND".to_string(),
                    rel_pos: Vec2::new(14.0, 65.0),
                    is_analog: false,
                },
                VisualPin {
                    name: "SIG".to_string(),
                    rel_pos: Vec2::new(30.0, 65.0),
                    is_analog: true,
                },
                VisualPin {
                    name: "VCC".to_string(),
                    rel_pos: Vec2::new(46.0, 65.0),
                    is_analog: false,
                },
            ],
        }
    }

    pub fn hit_test(&self, world_pos: Pos2) -> bool {
        Rect::from_min_size(self.pos, self.size).contains(world_pos)
    }

    pub fn pin_world_pos(&self, pin: &VisualPin) -> Pos2 {
        self.pos + pin.rel_pos
    }

    pub fn find_pin_at(&self, world_pos: Pos2, radius: f32) -> Option<&VisualPin> {
        self.pins.iter().find(|pin| {
            let p = self.pin_world_pos(pin);
            (p - world_pos).length() <= radius
        })
    }

    pub fn draw(
        &self,
        painter: &Painter,
        viewport: &crate::viewport::Viewport,
        is_selected: bool,
        is_active: bool,
    ) {
        let screen_min = viewport.world_to_screen(self.pos);
        let screen_size = self.size * viewport.zoom;
        let screen_rect = Rect::from_min_size(screen_min, screen_size);

        match &self.kind {
            PartKind::ArduinoUno => self.draw_uno(painter, screen_rect, viewport, is_selected, is_active),
            PartKind::BreadboardHalf => self.draw_breadboard(painter, screen_rect, viewport, is_selected),
            PartKind::Led { color } => self.draw_led(painter, screen_rect, viewport, color, is_selected, is_active),
            PartKind::Resistor { resistance } => self.draw_resistor(painter, screen_rect, viewport, *resistance, is_selected),
            PartKind::Pushbutton => self.draw_pushbutton(painter, screen_rect, viewport, is_selected, is_active),
            PartKind::Potentiometer { value } => self.draw_potentiometer(painter, screen_rect, viewport, *value, is_selected),
        }

        // Draw pin connection hot-spots
        for pin in &self.pins {
            let pin_screen = viewport.world_to_screen(self.pin_world_pos(pin));
            let r = (3.5 * viewport.zoom).clamp(2.0, 6.0);
            painter.circle_filled(pin_screen, r, Color32::from_rgb(15, 23, 42));
            painter.circle_stroke(
                pin_screen,
                r,
                Stroke::new(1.0 * viewport.zoom, Color32::from_rgb(203, 213, 225)),
            );
        }
    }

    fn draw_uno(
        &self,
        painter: &Painter,
        rect: Rect,
        viewport: &crate::viewport::Viewport,
        is_selected: bool,
        is_active: bool,
    ) {
        let zoom = viewport.zoom;
        // Selection glow
        if is_selected {
            painter.rect_stroke(
                rect.expand(4.0 * zoom),
                CornerRadius::same((8.0 * zoom) as u8),
                Stroke::new(2.5 * zoom, Color32::from_rgb(59, 130, 246)),
                egui::StrokeKind::Outside,
            );
        }

        // Arduino PCB Main Body (Classic Arduino Teal-Navy Blue)
        painter.rect_filled(
            rect,
            CornerRadius::same((6.0 * zoom) as u8),
            Color32::from_rgb(0, 102, 128),
        );

        // Mounting holes in corners
        let hole_color = Color32::from_rgb(30, 41, 59);
        let hole_r = 4.0 * zoom;
        painter.circle_filled(rect.min + Vec2::new(12.0 * zoom, 15.0 * zoom), hole_r, hole_color);
        painter.circle_filled(rect.min + Vec2::new(12.0 * zoom, rect.height() - 15.0 * zoom), hole_r, hole_color);
        painter.circle_filled(rect.max - Vec2::new(15.0 * zoom, 15.0 * zoom), hole_r, hole_color);

        // Silver USB Type-B Port
        let usb_rect = Rect::from_min_size(
            rect.min + Vec2::new(0.0, 25.0 * zoom),
            Vec2::new(45.0 * zoom, 40.0 * zoom),
        );
        painter.rect_filled(usb_rect, CornerRadius::same((3.0 * zoom) as u8), Color32::from_rgb(180, 185, 190));
        painter.rect_filled(
            usb_rect.shrink(6.0 * zoom),
            CornerRadius::same((2.0 * zoom) as u8),
            Color32::from_rgb(40, 45, 50),
        );

        // DC Power Jack (Black)
        let dc_rect = Rect::from_min_size(
            rect.min + Vec2::new(0.0, 130.0 * zoom),
            Vec2::new(48.0 * zoom, 45.0 * zoom),
        );
        painter.rect_filled(dc_rect, CornerRadius::same((3.0 * zoom) as u8), Color32::from_rgb(25, 25, 30));

        // ATmega328P DIP Chip (Dark grey rectangle with IC notch)
        let ic_rect = Rect::from_min_size(
            rect.min + Vec2::new(130.0 * zoom, 90.0 * zoom),
            Vec2::new(95.0 * zoom, 30.0 * zoom),
        );
        painter.rect_filled(ic_rect, CornerRadius::same((2.0 * zoom) as u8), Color32::from_rgb(20, 20, 25));
        painter.text(
            ic_rect.center(),
            egui::Align2::CENTER_CENTER,
            "ATmega328P",
            FontId::new(9.0 * zoom, FontFamily::Monospace),
            Color32::from_rgb(200, 200, 210),
        );

        // Builtin "L" LED (Pin 13 indicator)
        let led_pos = rect.min + Vec2::new(115.0 * zoom, 60.0 * zoom);
        let (led_color, glow_color) = if is_active {
            (Color32::from_rgb(250, 204, 21), Color32::from_rgba_premultiplied(250, 204, 21, 100))
        } else {
            (Color32::from_rgb(80, 75, 40), Color32::TRANSPARENT)
        };
        if is_active {
            painter.circle_filled(led_pos, 8.0 * zoom, glow_color);
        }
        painter.circle_filled(led_pos, 3.5 * zoom, led_color);
        painter.text(
            led_pos + Vec2::new(8.0 * zoom, 0.0),
            egui::Align2::LEFT_CENTER,
            "L",
            FontId::new(8.0 * zoom, FontFamily::Proportional),
            Color32::WHITE,
        );

        // Header sockets strip backgrounds
        let top_header = Rect::from_min_size(
            rect.min + Vec2::new(50.0 * zoom, 5.0 * zoom),
            Vec2::new(200.0 * zoom, 15.0 * zoom),
        );
        painter.rect_filled(top_header, CornerRadius::same((2.0 * zoom) as u8), Color32::from_rgb(25, 30, 35));

        let bot_header = Rect::from_min_size(
            rect.min + Vec2::new(95.0 * zoom, 180.0 * zoom),
            Vec2::new(155.0 * zoom, 15.0 * zoom),
        );
        painter.rect_filled(bot_header, CornerRadius::same((2.0 * zoom) as u8), Color32::from_rgb(25, 30, 35));

        // Arduino Uno Label text
        painter.text(
            rect.min + Vec2::new(60.0 * zoom, 105.0 * zoom),
            egui::Align2::LEFT_CENTER,
            "ARDUINO",
            FontId::new(13.0 * zoom, FontFamily::Proportional),
            Color32::WHITE,
        );
        painter.text(
            rect.min + Vec2::new(60.0 * zoom, 120.0 * zoom),
            egui::Align2::LEFT_CENTER,
            "UNO",
            FontId::new(11.0 * zoom, FontFamily::Proportional),
            Color32::from_rgb(250, 204, 21),
        );
    }

    fn draw_breadboard(
        &self,
        painter: &Painter,
        rect: Rect,
        viewport: &crate::viewport::Viewport,
        is_selected: bool,
    ) {
        let zoom = viewport.zoom;
        if is_selected {
            painter.rect_stroke(
                rect.expand(4.0 * zoom),
                CornerRadius::same((6.0 * zoom) as u8),
                Stroke::new(2.5 * zoom, Color32::from_rgb(59, 130, 246)),
                egui::StrokeKind::Outside,
            );
        }

        // Breadboard White/Cream Plastic Body
        painter.rect_filled(
            rect,
            CornerRadius::same((5.0 * zoom) as u8),
            Color32::from_rgb(245, 246, 248),
        );
        painter.rect_stroke(
            rect,
            CornerRadius::same((5.0 * zoom) as u8),
            Stroke::new(1.0 * zoom, Color32::from_rgb(209, 213, 219)),
            egui::StrokeKind::Inside,
        );

        // Positive Rail (Red Line) and Negative Rail (Blue Line)
        let red_rail_y = rect.min.y + 14.0 * zoom;
        let blue_rail_y = rect.min.y + 32.0 * zoom;
        painter.line_segment(
            [
                Pos2::new(rect.min.x + 15.0 * zoom, red_rail_y),
                Pos2::new(rect.max.x - 15.0 * zoom, red_rail_y),
            ],
            Stroke::new(1.5 * zoom, Color32::from_rgb(239, 68, 68)),
        );
        painter.line_segment(
            [
                Pos2::new(rect.min.x + 15.0 * zoom, blue_rail_y),
                Pos2::new(rect.max.x - 15.0 * zoom, blue_rail_y),
            ],
            Stroke::new(1.5 * zoom, Color32::from_rgb(59, 130, 246)),
        );

        // Center divider groove
        let divider_y = rect.min.y + 105.0 * zoom;
        painter.rect_filled(
            Rect::from_min_size(
                Pos2::new(rect.min.x + 10.0 * zoom, divider_y - 2.0 * zoom),
                Vec2::new(rect.width() - 20.0 * zoom, 4.0 * zoom),
            ),
            CornerRadius::ZERO,
            Color32::from_rgb(229, 231, 235),
        );
    }

    fn draw_led(
        &self,
        painter: &Painter,
        rect: Rect,
        viewport: &crate::viewport::Viewport,
        color_name: &str,
        is_selected: bool,
        is_active: bool,
    ) {
        let zoom = viewport.zoom;
        if is_selected {
            painter.rect_stroke(
                rect.expand(2.0 * zoom),
                CornerRadius::same((4.0 * zoom) as u8),
                Stroke::new(2.0 * zoom, Color32::from_rgb(59, 130, 246)),
                egui::StrokeKind::Outside,
            );
        }

        let dome_color = match color_name.to_lowercase().as_str() {
            "green" => Color32::from_rgb(34, 197, 94),
            "blue" => Color32::from_rgb(59, 130, 246),
            "yellow" => Color32::from_rgb(234, 179, 8),
            "white" => Color32::from_rgb(241, 245, 249),
            _ => Color32::from_rgb(239, 68, 68), // Red default
        };

        let dome_center = rect.min + Vec2::new(rect.width() * 0.5, 20.0 * zoom);
        let dome_r = 14.0 * zoom;

        // Glow Aura when lit
        if is_active {
            painter.circle_filled(
                dome_center,
                dome_r * 2.2,
                Color32::from_rgba_premultiplied(dome_color.r(), dome_color.g(), dome_color.b(), 90),
            );
        }

        // Translucent LED dome
        painter.circle_filled(dome_center, dome_r, dome_color);
        // Highlight reflection shine
        painter.circle_filled(
            dome_center - Vec2::new(4.0 * zoom, 4.0 * zoom),
            3.0 * zoom,
            Color32::from_rgba_premultiplied(255, 255, 255, 180),
        );

        // Legs (Metal leads)
        let lead_color = Color32::from_rgb(160, 165, 175);
        let lead_width = 2.0 * zoom;
        let anode_x = rect.min.x + 14.0 * zoom;
        let cathode_x = rect.min.x + 26.0 * zoom;
        let bottom_y = rect.min.y + 56.0 * zoom;

        painter.line_segment(
            [Pos2::new(anode_x, dome_center.y + dome_r), Pos2::new(anode_x, bottom_y)],
            Stroke::new(lead_width, lead_color),
        );
        painter.line_segment(
            [Pos2::new(cathode_x, dome_center.y + dome_r), Pos2::new(cathode_x, bottom_y)],
            Stroke::new(lead_width, lead_color),
        );
    }

    fn draw_resistor(
        &self,
        painter: &Painter,
        rect: Rect,
        viewport: &crate::viewport::Viewport,
        _ohms: f32,
        is_selected: bool,
    ) {
        let zoom = viewport.zoom;
        if is_selected {
            painter.rect_stroke(
                rect.expand(2.0 * zoom),
                CornerRadius::same((4.0 * zoom) as u8),
                Stroke::new(2.0 * zoom, Color32::from_rgb(59, 130, 246)),
                egui::StrokeKind::Outside,
            );
        }

        let mid_y = rect.center().y;
        let lead_color = Color32::from_rgb(180, 185, 195);
        let lead_width = 2.0 * zoom;

        // Metal Wire Leads extending outwards
        painter.line_segment(
            [Pos2::new(rect.min.x, mid_y), Pos2::new(rect.min.x + 16.0 * zoom, mid_y)],
            Stroke::new(lead_width, lead_color),
        );
        painter.line_segment(
            [Pos2::new(rect.max.x - 16.0 * zoom, mid_y), Pos2::new(rect.max.x, mid_y)],
            Stroke::new(lead_width, lead_color),
        );

        // Resistor Ceramic Body (Beige/Tan)
        let body_rect = Rect::from_center_size(
            rect.center(),
            Vec2::new(36.0 * zoom, 14.0 * zoom),
        );
        painter.rect_filled(
            body_rect,
            CornerRadius::same((4.0 * zoom) as u8),
            Color32::from_rgb(212, 185, 150),
        );

        // Color Code Bands (e.g. 220 Ohm = Red, Red, Brown, Gold)
        let band_w = 3.0 * zoom;
        let bands = [
            (Color32::from_rgb(220, 38, 38), -10.0), // Red
            (Color32::from_rgb(220, 38, 38), -4.0),  // Red
            (Color32::from_rgb(139, 69, 19), 2.0),   // Brown
            (Color32::from_rgb(234, 179, 8), 9.0),   // Gold
        ];
        for (col, offset_x) in bands {
            let b_rect = Rect::from_center_size(
                rect.center() + Vec2::new(offset_x * zoom, 0.0),
                Vec2::new(band_w, 14.0 * zoom),
            );
            painter.rect_filled(b_rect, CornerRadius::ZERO, col);
        }
    }

    fn draw_pushbutton(
        &self,
        painter: &Painter,
        rect: Rect,
        viewport: &crate::viewport::Viewport,
        is_selected: bool,
        is_pressed: bool,
    ) {
        let zoom = viewport.zoom;
        if is_selected {
            painter.rect_stroke(
                rect.expand(2.0 * zoom),
                CornerRadius::same((4.0 * zoom) as u8),
                Stroke::new(2.0 * zoom, Color32::from_rgb(59, 130, 246)),
                egui::StrokeKind::Outside,
            );
        }

        // Tactile Switch Housing (Dark Charcoal)
        let body_rect = rect.shrink(6.0 * zoom);
        painter.rect_filled(
            body_rect,
            CornerRadius::same((3.0 * zoom) as u8),
            Color32::from_rgb(30, 41, 59),
        );

        // Button Cap (Round Blue or Red button that depresses when pressed)
        let cap_center = body_rect.center();
        let cap_r = if is_pressed { 10.0 * zoom } else { 12.0 * zoom };
        let cap_color = if is_pressed {
            Color32::from_rgb(37, 99, 235) // Deep clicked blue
        } else {
            Color32::from_rgb(59, 130, 246) // Vibrant blue
        };
        painter.circle_filled(cap_center, cap_r, cap_color);
    }

    fn draw_potentiometer(
        &self,
        painter: &Painter,
        rect: Rect,
        viewport: &crate::viewport::Viewport,
        value: f32,
        is_selected: bool,
    ) {
        let zoom = viewport.zoom;
        if is_selected {
            painter.rect_stroke(
                rect.expand(2.0 * zoom),
                CornerRadius::same((4.0 * zoom) as u8),
                Stroke::new(2.0 * zoom, Color32::from_rgb(59, 130, 246)),
                egui::StrokeKind::Outside,
            );
        }

        // Circular Rotary Body
        let center = rect.min + Vec2::new(rect.width() * 0.5, 30.0 * zoom);
        let dial_r = 22.0 * zoom;

        painter.circle_filled(center, dial_r, Color32::from_rgb(51, 65, 85));
        painter.circle_stroke(
            center,
            dial_r,
            Stroke::new(2.0 * zoom, Color32::from_rgb(148, 163, 184)),
        );

        // Rotary Indicator notch (angle maps from -135 deg to +135 deg)
        let angle = -std::f32::consts::FRAC_PI_2 * 1.5 + value * (std::f32::consts::PI * 1.5);
        let notch_dir = Vec2::new(angle.cos(), angle.sin());
        painter.line_segment(
            [center, center + notch_dir * (dial_r - 4.0 * zoom)],
            Stroke::new(3.0 * zoom, Color32::from_rgb(250, 204, 21)),
        );
    }
}
