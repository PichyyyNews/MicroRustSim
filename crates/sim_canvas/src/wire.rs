use egui::{epaint::CubicBezierShape, Color32, Painter, Pos2, Stroke, Vec2};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VisualWire {
    pub id: String,
    pub from_comp: String,
    pub from_pin: String,
    pub to_comp: String,
    pub to_pin: String,
    pub color_hex: String,
}

impl VisualWire {
    pub fn new(
        id: impl Into<String>,
        from_comp: impl Into<String>,
        from_pin: impl Into<String>,
        to_comp: impl Into<String>,
        to_pin: impl Into<String>,
        color_hex: impl Into<String>,
    ) -> Self {
        Self {
            id: id.into(),
            from_comp: from_comp.into(),
            from_pin: from_pin.into(),
            to_comp: to_comp.into(),
            to_pin: to_pin.into(),
            color_hex: color_hex.into(),
        }
    }

    pub fn color(&self) -> Color32 {
        parse_hex_color(&self.color_hex)
    }

    pub fn draw(
        &self,
        painter: &Painter,
        p1: Pos2,
        p2: Pos2,
        zoom: f32,
        is_hovered: bool,
        is_selected: bool,
    ) {
        let dist = (p2 - p1).length();
        let droop = (dist * 0.25).clamp(20.0 * zoom, 120.0 * zoom);

        // Control points creating a realistic hanging cable effect
        let cp1 = p1 + Vec2::new(0.0, droop);
        let cp2 = p2 + Vec2::new(0.0, droop);

        let base_color = self.color();
        let wire_color = if is_selected {
            Color32::from_rgb(250, 204, 21) // Bright yellow selection outline
        } else if is_hovered {
            Color32::WHITE
        } else {
            base_color
        };

        let width = if is_selected || is_hovered {
            3.5 * zoom
        } else {
            2.5 * zoom
        };

        // Shadow for depth
        let shadow_offset = Vec2::new(2.0 * zoom, 4.0 * zoom);
        painter.add(CubicBezierShape::from_points_stroke(
            [p1 + shadow_offset, cp1 + shadow_offset, cp2 + shadow_offset, p2 + shadow_offset],
            false,
            Color32::TRANSPARENT,
            Stroke::new(width + 1.0 * zoom, Color32::from_black_alpha(40)),
        ));

        // Wire curve
        painter.add(CubicBezierShape::from_points_stroke(
            [p1, cp1, cp2, p2],
            false,
            Color32::TRANSPARENT,
            Stroke::new(width, wire_color),
        ));

        // Terminal end caps
        let cap_radius = (width * 0.8).max(2.0);
        painter.circle_filled(p1, cap_radius, wire_color);
        painter.circle_filled(p2, cap_radius, wire_color);
    }
}

pub fn parse_hex_color(hex: &str) -> Color32 {
    let hex = hex.trim_start_matches('#');
    if hex.len() == 6 {
        if let (Ok(r), Ok(g), Ok(b)) = (
            u8::from_str_radix(&hex[0..2], 16),
            u8::from_str_radix(&hex[2..4], 16),
            u8::from_str_radix(&hex[4..6], 16),
        ) {
            return Color32::from_rgb(r, g, b);
        }
    }
    Color32::from_rgb(59, 130, 246) // Default blue
}
