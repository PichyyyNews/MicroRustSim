use egui::{Color32, Painter, Pos2, Rect, Vec2};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Viewport {
    pub pan: Vec2,
    pub zoom: f32,
}

impl Default for Viewport {
    fn default() -> Self {
        Self {
            pan: Vec2::new(100.0, 80.0),
            zoom: 1.0,
        }
    }
}

impl Viewport {
    pub fn world_to_screen(&self, world_pos: Pos2) -> Pos2 {
        Pos2::new(
            world_pos.x * self.zoom + self.pan.x,
            world_pos.y * self.zoom + self.pan.y,
        )
    }

    pub fn screen_to_world(&self, screen_pos: Pos2) -> Pos2 {
        Pos2::new(
            (screen_pos.x - self.pan.x) / self.zoom,
            (screen_pos.y - self.pan.y) / self.zoom,
        )
    }

    pub fn scale_val(&self, val: f32) -> f32 {
        val * self.zoom
    }

    pub fn draw_grid(&self, painter: &Painter, rect: Rect) {
        let grid_size = 20.0 * self.zoom;
        if grid_size < 5.0 {
            return;
        }

        let start_x = ((rect.min.x - self.pan.x) % grid_size) + self.pan.x;
        let start_y = ((rect.min.y - self.pan.y) % grid_size) + self.pan.y;

        let dot_color = Color32::from_gray(45); // Subtle dark dot grid
        let radius = (1.2 * self.zoom).clamp(0.8, 2.0);

        let mut x = start_x;
        while x < rect.max.x {
            let mut y = start_y;
            while y < rect.max.y {
                if rect.contains(Pos2::new(x, y)) {
                    painter.circle_filled(Pos2::new(x, y), radius, dot_color);
                }
                y += grid_size;
            }
            x += grid_size;
        }
    }
}
