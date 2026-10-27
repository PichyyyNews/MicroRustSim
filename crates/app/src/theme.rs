use egui::{Color32, CornerRadius, Stroke, Visuals};

/// Design Tokens for MicroRustSim
/// Enforces consistent radii, dark mode colors, purple accent, and low-noise hierarchy.
pub mod tokens {
    use egui::Color32;

    // --- Radius Tokens (matching spec) ---
    pub const RADIUS_BASE: f32 = 8.0;
    pub const RADIUS_SM: f32 = RADIUS_BASE * 0.6; // 4.8px
    pub const RADIUS_MD: f32 = RADIUS_BASE * 0.8; // 6.4px
    pub const RADIUS_LG: f32 = RADIUS_BASE;       // 8.0px
    pub const RADIUS_XL: f32 = RADIUS_BASE * 1.4; // 11.2px
    pub const RADIUS_2XL: f32 = RADIUS_BASE * 1.8;// 14.4px
    pub const RADIUS_3XL: f32 = RADIUS_BASE * 2.2;// 17.6px
    pub const RADIUS_4XL: f32 = RADIUS_BASE * 2.6;// 20.8px

    // --- Background & Surface Tokens (Sleek Dark Theme) ---
    pub const BG_CANVAS: Color32 = Color32::from_rgb(15, 17, 23);     // #0f1117 (Deep canvas)
    pub const BG_APP: Color32 = Color32::from_rgb(19, 22, 31);        // #13161f (Base workspace)
    pub const BG_SURFACE: Color32 = Color32::from_rgb(24, 27, 38);    // #181b26 (Panels & drawers)
    pub const BG_ELEVATED: Color32 = Color32::from_rgb(32, 37, 51);   // #202533 (Cards, active buttons)
    pub const BG_HOVER: Color32 = Color32::from_rgb(42, 48, 66);      // #2a3042 (Hover state)

    // --- Border Tokens ---
    pub const BORDER_SUBTLE: Color32 = Color32::from_rgb(38, 43, 60); // #262b3c
    pub const BORDER_FOCUS: Color32 = Color32::from_rgb(139, 92, 246);// #8b5cf6 (Purple Focus)

    // --- Medium Purple Accent Tokens (Spec: ไม่เข้มมาก กำลังดี) ---
    pub const ACCENT: Color32 = Color32::from_rgb(139, 92, 246);      // #8b5cf6 (Violet 500)
    pub const ACCENT_LIGHT: Color32 = Color32::from_rgb(167, 139, 250);// #a78bfa (Violet 400 hover)
    pub const ACCENT_MUTED: Color32 = Color32::from_rgb(60, 45, 105); // #3c2d69 (Tinted bg)
    pub const ACCENT_GLOW: Color32 = Color32::from_rgba_premultiplied(139, 92, 246, 50);

    // --- Semantic Tokens (Warning from user's oklch spec) ---
    // .dark { --warning: oklch(0.41 0.11 46); --warning-foreground: oklch(0.99 0.02 95); }
    pub const WARNING_BG: Color32 = Color32::from_rgb(180, 83, 9);    // #b45309 Amber-700
    pub const WARNING_FG: Color32 = Color32::from_rgb(254, 243, 199); // #fef3c7 Amber-100
    pub const SUCCESS: Color32 = Color32::from_rgb(16, 185, 129);     // #10b981 Emerald
    pub const DANGER: Color32 = Color32::from_rgb(239, 68, 68);       // #ef4444 Rose

    // --- Typography & Content Tokens ---
    pub const TEXT_PRIMARY: Color32 = Color32::from_rgb(248, 250, 252);// #f8fafc
    pub const TEXT_SECONDARY: Color32 = Color32::from_rgb(148, 163, 184);// #94a3b8
    pub const TEXT_MUTED: Color32 = Color32::from_rgb(100, 116, 139); // #64748b
}

/// GitHub Octicons inspired iconography (`react-icons/go`)
pub mod octicons {
    pub const PLAY: &str = "▶";            // GoPlay
    pub const PAUSE: &str = "⏸";          // GoPause
    pub const SYNC: &str = "⟳";           // GoSync
    pub const ZAP: &str = "⚡";            // GoZap
    pub const CODE: &str = "</>";          // GoCode
    pub const TERMINAL: &str = ">_";       // GoTerminal
    pub const GRAPH: &str = "∿";           // GoGraph / Pulse
    pub const PLUS: &str = "+";            // GoPlus
    pub const TRASH: &str = "🗑";          // GoTrash
    pub const GEAR: &str = "⚙";            // GoGear
    pub const CHECK: &str = "✔";           // GoCheck
    pub const ALERT: &str = "⚠";           // GoAlert
    pub const FILE: &str = "🗎";           // GoFile
    pub const EYE: &str = "👁";            // GoEye
    pub const FOLD: &str = "⏴";            // Fold Left
    pub const UNFOLD: &str = "⏵";          // Unfold Right
    pub const DOT: &str = "●";             // GoDotFill
    pub const CPU: &str = "🖳";            // GoCpu
    pub const BOX: &str = "⊞";             // Package / Components
    pub const COLOR_PICKER: &str = "🎨";
}

/// Applies the clean, minimal, dark-mode design system with purple accent to egui
pub fn apply_design_system(ctx: &egui::Context) {
    let mut visuals = Visuals::dark();

    // Base background colors
    visuals.override_text_color = Some(tokens::TEXT_PRIMARY);
    visuals.panel_fill = tokens::BG_SURFACE;
    visuals.window_fill = tokens::BG_ELEVATED;
    visuals.window_stroke = Stroke::new(1.0, tokens::BORDER_SUBTLE);
    visuals.window_corner_radius = CornerRadius::same(tokens::RADIUS_LG as u8);

    // Widgets styling (Minimal, rounded, clean borders)
    let cr = CornerRadius::same(tokens::RADIUS_MD as u8);

    // Non-interactive (labels, containers)
    visuals.widgets.noninteractive.bg_fill = tokens::BG_SURFACE;
    visuals.widgets.noninteractive.bg_stroke = Stroke::new(1.0, tokens::BORDER_SUBTLE);
    visuals.widgets.noninteractive.fg_stroke = Stroke::new(1.0, tokens::TEXT_PRIMARY);
    visuals.widgets.noninteractive.corner_radius = cr;

    // Inactive buttons / widgets
    visuals.widgets.inactive.bg_fill = tokens::BG_ELEVATED;
    visuals.widgets.inactive.bg_stroke = Stroke::new(1.0, tokens::BORDER_SUBTLE);
    visuals.widgets.inactive.fg_stroke = Stroke::new(1.0, tokens::TEXT_SECONDARY);
    visuals.widgets.inactive.corner_radius = cr;

    // Hovered buttons / widgets (Glow purple border + lighter background)
    visuals.widgets.hovered.bg_fill = tokens::BG_HOVER;
    visuals.widgets.hovered.bg_stroke = Stroke::new(1.0, tokens::ACCENT);
    visuals.widgets.hovered.fg_stroke = Stroke::new(1.0, tokens::TEXT_PRIMARY);
    visuals.widgets.hovered.corner_radius = cr;

    // Active / Pressed buttons (Purple accent)
    visuals.widgets.active.bg_fill = tokens::ACCENT;
    visuals.widgets.active.bg_stroke = Stroke::new(1.0, tokens::ACCENT_LIGHT);
    visuals.widgets.active.fg_stroke = Stroke::new(1.0, Color32::WHITE);
    visuals.widgets.active.corner_radius = cr;

    // Selections & text highlight
    visuals.selection.bg_fill = tokens::ACCENT;
    visuals.selection.stroke = Stroke::new(1.0, tokens::ACCENT_LIGHT);

    ctx.set_visuals(visuals);
}
