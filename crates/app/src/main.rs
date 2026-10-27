mod app;
mod runner;
pub mod theme;

use app::MicroRustSimApp;

fn main() -> eframe::Result<()> {
    let native_options = eframe::NativeOptions {
        viewport: egui::ViewportBuilder::default()
            .with_inner_size([1400.0, 850.0])
            .with_min_inner_size([1000.0, 600.0])
            .with_title("MicroRustSim - Embedded MCU Simulator"),
        ..Default::default()
    };

    eframe::run_native(
        "MicroRustSim",
        native_options,
        Box::new(|cc| {
            // Apply refined dark theme with medium purple accent and custom tokens
            theme::apply_design_system(&cc.egui_ctx);
            Ok(Box::new(MicroRustSimApp::new(cc)))
        }),
    )
}
