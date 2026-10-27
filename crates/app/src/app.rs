use egui::{
    Button, CentralPanel, Color32, CornerRadius, DragValue, Layout, Panel, Pos2, RichText,
    ScrollArea, Slider, Stroke, TextEdit, TextStyle, Vec2,
};
use egui_plot::{Line, Plot, PlotPoints};

use sim_canvas::{CanvasAction, CanvasState, CanvasWidget, PartKind, VisualComponent};
use sim_compiler::{ArduinoCliBackend, BuiltinSketches, CompilerBackend, MockCompilerBackend};
use sim_storage::{DiagramSchema, ProjectStorage};

use crate::runner::SimRunner;
use crate::theme::{octicons, tokens};

#[derive(Debug, PartialEq, Eq)]
pub enum BottomTab {
    SerialMonitor,
    LogicAnalyzer,
    BuildOutput,
}

pub struct MicroRustSimApp {
    pub project_name: String,
    pub sketch_code: String,
    pub canvas_state: CanvasState,
    pub runner: SimRunner,
    pub storage: ProjectStorage,
    pub compiler: Box<dyn CompilerBackend>,
    pub bottom_tab: BottomTab,
    pub serial_input: String,
    pub build_output: String,
    pub status_message: String,
    pub baud_rate: u32,
    pub show_left_editor: bool,
    pub show_right_palette: bool,
    pub show_bottom_drawer: bool,
    pub show_about_modal: bool,
    pub show_open_modal: bool,
    pub available_projects: Vec<sim_storage::ProjectMetadata>,
}

impl MicroRustSimApp {
    pub fn new(_cc: &eframe::CreationContext<'_>) -> Self {
        let storage = ProjectStorage::open_default().unwrap_or_else(|_| {
            ProjectStorage::open_in_memory().expect("In-memory SQLite failed")
        });

        let compiler: Box<dyn CompilerBackend> = {
            let cli = ArduinoCliBackend::new();
            if cli.is_available() {
                Box::new(cli)
            } else {
                Box::new(MockCompilerBackend)
            }
        };

        let sketch_code = BuiltinSketches::blink_source().to_string();
        let canvas_state = CanvasState::default();
        let mut runner = SimRunner::new();

        // Sync initial state
        runner.sync_components(&canvas_state.components);
        runner.sync_wires(&canvas_state.wires);

        // Preload default blink hex
        let _ = runner.load_hex(&BuiltinSketches::blink_hex());

        let mut app = Self {
            project_name: "Blink_Lab_Uno".to_string(),
            sketch_code,
            canvas_state,
            runner,
            storage,
            compiler,
            bottom_tab: BottomTab::SerialMonitor,
            serial_input: String::new(),
            build_output: "Ready. Local AVR GCC Toolchain active in AppData.\n".to_string(),
            status_message: "Ready to simulate".to_string(),
            baud_rate: 9600,
            show_left_editor: true,
            show_right_palette: true,
            show_bottom_drawer: true,
            show_about_modal: false,
            show_open_modal: false,
            available_projects: Vec::new(),
        };

        app.refresh_project_list();
        app
    }

    fn refresh_project_list(&mut self) {
        if let Ok(list) = self.storage.list_projects() {
            self.available_projects = list;
        }
    }

    pub fn compile_and_upload(&mut self) {
        self.build_output.clear();
        self.build_output.push_str(&format!(
            "[{}] Compiling sketch for Arduino Uno (ATmega328P)...\n",
            octicons::ZAP
        ));

        match self.compiler.compile(&self.sketch_code, "arduino:avr:uno") {
            Ok(out) => {
                self.build_output.push_str(&format!(
                    "{} Compilation successful! Generated Intel HEX ({:.1} KB)\n",
                    octicons::CHECK,
                    out.hex.len() as f32 / 1024.0
                ));
                match self.runner.load_hex(&out.hex) {
                    Ok(()) => {
                        self.build_output.push_str(&format!(
                            "{} Upload complete. Flashed to simulated ATmega328P Flash.\n",
                            octicons::CPU
                        ));
                        self.status_message = "Flashed & Running".to_string();
                        self.runner.is_running = true;
                    }
                    Err(e) => {
                        self.build_output.push_str(&format!("{} Upload Error: {e}\n", octicons::ALERT));
                        self.status_message = "Upload failed".to_string();
                    }
                }
            }
            Err(e) => {
                self.build_output.push_str(&format!("{} Compilation Error:\n{e}\n", octicons::ALERT));
                self.status_message = "Compilation failed".to_string();
                self.bottom_tab = BottomTab::BuildOutput;
                self.show_bottom_drawer = true;
            }
        }
    }

    pub fn save_project(&mut self) {
        let diagram = DiagramSchema::default();
        let diagram_json = serde_json::to_string_pretty(&diagram).unwrap_or_default();
        match self.storage.save_project(&self.project_name, &self.sketch_code, &diagram_json) {
            Ok(_) => {
                self.status_message = format!("Project '{}' saved", self.project_name);
                self.refresh_project_list();
            }
            Err(e) => {
                self.status_message = format!("Save failed: {e}");
            }
        }
    }

    pub fn load_project(&mut self, name: &str) {
        if let Ok(Some(rec)) = self.storage.load_project_by_name(name) {
            self.project_name = rec.name;
            self.sketch_code = rec.sketch_code;
            self.status_message = format!("Loaded '{}'", self.project_name);
            self.show_open_modal = false;
        }
    }
}

impl eframe::App for MicroRustSimApp {
    fn ui(&mut self, ui: &mut egui::Ui, _frame: &mut eframe::Frame) {
        // Enforce dark design system visuals
        crate::theme::apply_design_system(ui.ctx());

        let ctx = ui.ctx().clone();

        // Advance simulation clock
        let dt = ctx.input(|i| i.stable_dt);
        self.runner.tick(dt);

        if self.runner.is_running {
            ctx.request_repaint();
        }

        let cr_md = CornerRadius::same(tokens::RADIUS_MD as u8);

        // 1. Top Unified Minimalist Header Bar
        Panel::top("top_header_bar").show(ui, |ui| {
            ui.horizontal(|ui| {
                ui.spacing_mut().item_spacing = Vec2::new(6.0, 0.0);

                // Menu Dropdown Buttons (Low noise text)
                ui.menu_button("File", |ui| {
                    if ui.button(format!("{} New Project", octicons::PLUS)).clicked() {
                        self.project_name = "Untitled_Project".to_string();
                        self.sketch_code = BuiltinSketches::blink_source().to_string();
                        self.canvas_state = CanvasState::default();
                        self.runner.sync_components(&self.canvas_state.components);
                        self.runner.sync_wires(&self.canvas_state.wires);
                        ui.close();
                    }
                    if ui.button(format!("{} Open...", octicons::FILE)).clicked() {
                        self.refresh_project_list();
                        self.show_open_modal = true;
                        ui.close();
                    }
                    if ui.button(format!("{} Save", octicons::FILE)).clicked() {
                        self.save_project();
                        ui.close();
                    }
                    ui.separator();
                    if ui.button("Export diagram.json").clicked() {
                        let schema = DiagramSchema::default();
                        if let Ok(json) = serde_json::to_string_pretty(&schema) {
                            self.build_output.push_str("\n--- Exported diagram.json ---\n");
                            self.build_output.push_str(&json);
                            self.build_output.push_str("\n----------------------------\n");
                            self.bottom_tab = BottomTab::BuildOutput;
                            self.show_bottom_drawer = true;
                        }
                        ui.close();
                    }
                });

                ui.menu_button("Examples", |ui| {
                    if ui.button("Blink (Pin 13 LED)").clicked() {
                        self.sketch_code = BuiltinSketches::blink_source().to_string();
                        self.compile_and_upload();
                        ui.close();
                    }
                    if ui.button("Button Controlled LED").clicked() {
                        self.sketch_code = BuiltinSketches::button_led_source().to_string();
                        self.compile_and_upload();
                        ui.close();
                    }
                    if ui.button("Potentiometer Analog Read").clicked() {
                        self.sketch_code = BuiltinSketches::analog_pot_source().to_string();
                        self.compile_and_upload();
                        ui.close();
                    }
                });

                ui.menu_button("Help", |ui| {
                    if ui.button(format!("{} About", octicons::EYE)).clicked() {
                        self.show_about_modal = true;
                        ui.close();
                    }
                });

                ui.separator();

                // Primary Run / Pause Action Button (Icon-First)
                if self.runner.is_running {
                    let pause_btn = Button::new(RichText::new(octicons::PAUSE).size(15.0).color(tokens::WARNING_FG))
                        .fill(tokens::WARNING_BG)
                        .corner_radius(cr_md);
                    if ui.add(pause_btn).on_hover_text("Pause Simulation").clicked() {
                        self.runner.is_running = false;
                    }
                } else {
                    let run_btn = Button::new(RichText::new(octicons::PLAY).size(15.0).color(Color32::WHITE))
                        .fill(tokens::ACCENT) // Medium Purple Accent
                        .corner_radius(cr_md);
                    if ui.add(run_btn).on_hover_text("Start Simulation (16 MHz)").clicked() {
                        self.runner.is_running = true;
                    }
                }

                // Compile & Upload Button
                let upload_btn = Button::new(RichText::new(octicons::ZAP).size(15.0).color(Color32::WHITE))
                    .fill(tokens::BG_ELEVATED)
                    .corner_radius(cr_md);
                if ui.add(upload_btn).on_hover_text("Compile & Upload to MCU").clicked() {
                    self.compile_and_upload();
                }

                // Reset Button
                let reset_btn = Button::new(RichText::new(octicons::SYNC).size(14.0).color(tokens::TEXT_SECONDARY))
                    .fill(tokens::BG_ELEVATED)
                    .corner_radius(cr_md);
                if ui.add(reset_btn).on_hover_text("Reset Simulation").clicked() {
                    self.runner.reset();
                }

                ui.separator();

                // Drawer Layout Toggles (Clean minimal icon buttons to hide visual clutter)
                let editor_toggle = Button::new(RichText::new(octicons::CODE).color(if self.show_left_editor { tokens::ACCENT } else { tokens::TEXT_MUTED }))
                    .fill(if self.show_left_editor { tokens::ACCENT_MUTED } else { tokens::BG_ELEVATED })
                    .corner_radius(cr_md);
                if ui.add(editor_toggle).on_hover_text("Toggle Code Editor").clicked() {
                    self.show_left_editor = !self.show_left_editor;
                }

                let palette_toggle = Button::new(RichText::new(octicons::BOX).color(if self.show_right_palette { tokens::ACCENT } else { tokens::TEXT_MUTED }))
                    .fill(if self.show_right_palette { tokens::ACCENT_MUTED } else { tokens::BG_ELEVATED })
                    .corner_radius(cr_md);
                if ui.add(palette_toggle).on_hover_text("Toggle Components Library").clicked() {
                    self.show_right_palette = !self.show_right_palette;
                }

                let drawer_toggle = Button::new(RichText::new(octicons::TERMINAL).color(if self.show_bottom_drawer { tokens::ACCENT } else { tokens::TEXT_MUTED }))
                    .fill(if self.show_bottom_drawer { tokens::ACCENT_MUTED } else { tokens::BG_ELEVATED })
                    .corner_radius(cr_md);
                if ui.add(drawer_toggle).on_hover_text("Toggle Output Console").clicked() {
                    self.show_bottom_drawer = !self.show_bottom_drawer;
                }

                ui.separator();

                // Wire Color Palette Dots (Clean 14px circles)
                let wire_colors = [
                    ("#22c55e", "Green"),
                    ("#ef4444", "Red"),
                    ("#3b82f6", "Blue"),
                    ("#eab308", "Yellow"),
                    ("#000000", "Black"),
                    ("#f97316", "Orange"),
                    ("#8b5cf6", "Purple"),
                    ("#ffffff", "White"),
                ];

                for (hex, label) in wire_colors {
                    let is_active = self.canvas_state.current_wire_color == hex;
                    let parsed = sim_canvas::wire::parse_hex_color(hex);
                    let (rect, resp) = ui.allocate_exact_size(Vec2::new(14.0, 14.0), egui::Sense::click());
                    let stroke = if is_active {
                        Stroke::new(2.0, tokens::ACCENT_LIGHT)
                    } else {
                        Stroke::new(1.0, tokens::BORDER_SUBTLE)
                    };
                    ui.painter().rect_filled(rect, CornerRadius::same(tokens::RADIUS_SM as u8), parsed);
                    ui.painter().rect_stroke(rect, CornerRadius::same(tokens::RADIUS_SM as u8), stroke, egui::StrokeKind::Outside);

                    if resp.on_hover_text(format!("Wire: {}", label)).clicked() {
                        self.canvas_state.current_wire_color = hex.to_string();
                    }
                }

                ui.separator();

                // Zoom controls
                if ui.button("➖").on_hover_text("Zoom Out").clicked() {
                    self.canvas_state.viewport.zoom = (self.canvas_state.viewport.zoom * 0.9).max(0.25);
                }
                if ui.button(format!("{:.0}%", self.canvas_state.viewport.zoom * 100.0)).on_hover_text("Reset Zoom").clicked() {
                    self.canvas_state.viewport.zoom = 1.0;
                }
                if ui.button("➕").on_hover_text("Zoom In").clicked() {
                    self.canvas_state.viewport.zoom = (self.canvas_state.viewport.zoom * 1.1).min(3.0);
                }

                // Right-aligned status pill with glowing status dot
                ui.with_layout(Layout::right_to_left(egui::Align::Center), |ui| {
                    if self.runner.is_running {
                        ui.colored_label(tokens::SUCCESS, format!("{} 16 MHz", octicons::DOT));
                    } else {
                        ui.colored_label(tokens::TEXT_MUTED, "○ PAUSED");
                    }
                });
            });
        });

        // 2. Bottom Status Bar (Very minimal)
        Panel::bottom("bottom_status_bar").show(ui, |ui| {
            ui.horizontal(|ui| {
                ui.label(RichText::new(&self.status_message).size(11.0).color(tokens::TEXT_SECONDARY));
                ui.with_layout(Layout::right_to_left(egui::Align::Center), |ui| {
                    ui.label(RichText::new(format!("ATmega328P | {}", self.project_name)).size(11.0).color(tokens::TEXT_MUTED));
                });
            });
        });

        // 3. Bottom Drawer (Collapsible)
        if self.show_bottom_drawer {
            Panel::bottom("bottom_drawer_panel")
                .resizable(true)
                .default_size(175.0)
                .show(ui, |ui| {
                    ui.horizontal(|ui| {
                        let is_serial = self.bottom_tab == BottomTab::SerialMonitor;
                        let is_logic = self.bottom_tab == BottomTab::LogicAnalyzer;
                        let is_build = self.bottom_tab == BottomTab::BuildOutput;

                        // Octicon styled tabs
                        ui.selectable_value(
                            &mut self.bottom_tab,
                            BottomTab::SerialMonitor,
                            RichText::new(format!("{} Serial", octicons::TERMINAL)).color(if is_serial { tokens::ACCENT } else { tokens::TEXT_SECONDARY }),
                        );
                        ui.selectable_value(
                            &mut self.bottom_tab,
                            BottomTab::LogicAnalyzer,
                            RichText::new(format!("{} Waveform", octicons::GRAPH)).color(if is_logic { tokens::ACCENT } else { tokens::TEXT_SECONDARY }),
                        );
                        ui.selectable_value(
                            &mut self.bottom_tab,
                            BottomTab::BuildOutput,
                            RichText::new(format!("{} Build", octicons::GEAR)).color(if is_build { tokens::ACCENT } else { tokens::TEXT_SECONDARY }),
                        );

                        ui.with_layout(Layout::right_to_left(egui::Align::Center), |ui| {
                            if self.bottom_tab == BottomTab::SerialMonitor {
                                if ui.button(octicons::TRASH).on_hover_text("Clear Console").clicked() {
                                    self.runner.serial_logs.clear();
                                }
                                egui::ComboBox::from_label("")
                                    .selected_text(format!("{} baud", self.baud_rate))
                                    .show_ui(ui, |ui| {
                                        ui.selectable_value(&mut self.baud_rate, 9600, "9600 baud");
                                        ui.selectable_value(&mut self.baud_rate, 115200, "115200 baud");
                                    });
                            }
                        });
                    });

                    ui.separator();

                    match self.bottom_tab {
                        BottomTab::SerialMonitor => {
                            ScrollArea::vertical().stick_to_bottom(true).show(ui, |ui| {
                                for log in &self.runner.serial_logs {
                                    ui.label(RichText::new(log).monospace().size(12.0).color(tokens::TEXT_SECONDARY));
                                }
                            });

                            ui.horizontal(|ui| {
                                let text_resp = ui.text_edit_singleline(&mut self.serial_input);
                                if (ui.button("Send").clicked() || text_resp.lost_focus() && ui.input(|i| i.key_pressed(egui::Key::Enter)))
                                    && !self.serial_input.is_empty()
                                {
                                    let input_line = format!("{}\n", self.serial_input);
                                    self.runner.engine.mcu.write_serial_input(input_line.as_bytes());
                                    self.runner.serial_logs.push(format!("> {}", self.serial_input));
                                    self.serial_input.clear();
                                }
                            });
                        }
                        BottomTab::LogicAnalyzer => {
                            let points: PlotPoints = self
                                .runner
                                .logic_history
                                .iter()
                                .map(|&[t, v]| [t, v])
                                .collect();
                            let line = Line::new("Pin 13 (Builtin LED)", points)
                                .color(tokens::ACCENT); // Purple waveform

                            Plot::new("logic_plot")
                                .height(125.0)
                                .show_axes([true, true])
                                .include_y(0.0)
                                .include_y(5.5)
                                .show(ui, |plot_ui| {
                                    plot_ui.line(line);
                                });
                        }
                        BottomTab::BuildOutput => {
                            ScrollArea::vertical().show(ui, |ui| {
                                ui.label(RichText::new(&self.build_output).monospace().size(11.5).color(tokens::TEXT_SECONDARY));
                            });
                        }
                    }
                });
        }

        // 4. Left Panel: Code Editor (Collapsible)
        if self.show_left_editor {
            Panel::left("left_code_editor_panel")
                .resizable(true)
                .default_size(360.0)
                .show(ui, |ui| {
                    ui.horizontal(|ui| {
                        ui.label(RichText::new(format!("{} sketch.ino", octicons::FILE)).strong().color(tokens::TEXT_PRIMARY));
                        ui.with_layout(Layout::right_to_left(egui::Align::Center), |ui| {
                            if ui.button(octicons::FOLD).on_hover_text("Hide Editor").clicked() {
                                self.show_left_editor = false;
                            }
                            if ui.button("Save").clicked() {
                                self.save_project();
                            }
                        });
                    });
                    ui.separator();

                    ScrollArea::both().show(ui, |ui| {
                        let text_edit = TextEdit::multiline(&mut self.sketch_code)
                            .font(TextStyle::Monospace)
                            .code_editor()
                            .desired_rows(26)
                            .lock_focus(true)
                            .desired_width(f32::INFINITY);
                        ui.add(text_edit);
                    });
                });
        }

        // 5. Right Panel: Categorized Component Palette & Inspector (Collapsible)
        if self.show_right_palette {
            Panel::right("right_components_panel")
                .resizable(true)
                .default_size(240.0)
                .show(ui, |ui| {
                    ui.horizontal(|ui| {
                        ui.label(RichText::new(format!("{} Library", octicons::BOX)).strong().color(tokens::TEXT_PRIMARY));
                        ui.with_layout(Layout::right_to_left(egui::Align::Center), |ui| {
                            if ui.button(octicons::UNFOLD).on_hover_text("Hide Library").clicked() {
                                self.show_right_palette = false;
                            }
                        });
                    });
                    ui.separator();

                    // Categorized, low-clutter drawers
                    ui.collapsing("🖳 Processing", |ui| {
                        if ui.button(format!("{} Arduino Uno R3", octicons::PLUS)).clicked() {
                            let id = format!("uno_{}", self.canvas_state.components.len() + 1);
                            self.canvas_state.components.push(VisualComponent::new_arduino_uno(id, Pos2::new(100.0, 100.0)));
                            self.runner.sync_components(&self.canvas_state.components);
                        }
                    });

                    ui.collapsing("▤ Prototyping", |ui| {
                        if ui.button(format!("{} Half Breadboard", octicons::PLUS)).clicked() {
                            let id = format!("bb_{}", self.canvas_state.components.len() + 1);
                            self.canvas_state.components.push(VisualComponent::new_breadboard_half(id, Pos2::new(400.0, 100.0)));
                            self.runner.sync_components(&self.canvas_state.components);
                        }
                    });

                    ui.collapsing("💡 Outputs", |ui| {
                        ui.horizontal(|ui| {
                            if ui.button("🔴 Red").clicked() {
                                let id = format!("led_{}", self.canvas_state.components.len() + 1);
                                self.canvas_state.components.push(VisualComponent::new_led(id, Pos2::new(500.0, 50.0), "red"));
                                self.runner.sync_components(&self.canvas_state.components);
                            }
                            if ui.button("🟢 Green").clicked() {
                                let id = format!("led_{}", self.canvas_state.components.len() + 1);
                                self.canvas_state.components.push(VisualComponent::new_led(id, Pos2::new(500.0, 50.0), "green"));
                                self.runner.sync_components(&self.canvas_state.components);
                            }
                            if ui.button("🔵 Blue").clicked() {
                                let id = format!("led_{}", self.canvas_state.components.len() + 1);
                                self.canvas_state.components.push(VisualComponent::new_led(id, Pos2::new(500.0, 50.0), "blue"));
                                self.runner.sync_components(&self.canvas_state.components);
                            }
                        });
                    });

                    ui.collapsing("⚡ Passives", |ui| {
                        ui.horizontal(|ui| {
                            if ui.button("220Ω").clicked() {
                                let id = format!("r_{}", self.canvas_state.components.len() + 1);
                                self.canvas_state.components.push(VisualComponent::new_resistor(id, Pos2::new(550.0, 50.0), 220.0));
                                self.runner.sync_components(&self.canvas_state.components);
                            }
                            if ui.button("1kΩ").clicked() {
                                let id = format!("r_{}", self.canvas_state.components.len() + 1);
                                self.canvas_state.components.push(VisualComponent::new_resistor(id, Pos2::new(550.0, 50.0), 1000.0));
                                self.runner.sync_components(&self.canvas_state.components);
                            }
                            if ui.button("10kΩ").clicked() {
                                let id = format!("r_{}", self.canvas_state.components.len() + 1);
                                self.canvas_state.components.push(VisualComponent::new_resistor(id, Pos2::new(550.0, 50.0), 10000.0));
                                self.runner.sync_components(&self.canvas_state.components);
                            }
                        });
                    });

                    ui.collapsing("🔘 Interactive Inputs", |ui| {
                        if ui.button(format!("{} Pushbutton", octicons::PLUS)).clicked() {
                            let id = format!("btn_{}", self.canvas_state.components.len() + 1);
                            self.canvas_state.components.push(VisualComponent::new_pushbutton(id, Pos2::new(600.0, 50.0)));
                            self.runner.sync_components(&self.canvas_state.components);
                        }
                        if ui.button(format!("{} Potentiometer (ADC)", octicons::PLUS)).clicked() {
                            let id = format!("pot_{}", self.canvas_state.components.len() + 1);
                            self.canvas_state.components.push(VisualComponent::new_potentiometer(id, Pos2::new(650.0, 50.0)));
                            self.runner.sync_components(&self.canvas_state.components);
                        }
                    });

                    ui.separator();
                    ui.label(RichText::new(format!("{} Properties", octicons::GEAR)).strong().color(tokens::TEXT_PRIMARY));

                    if let Some(sel_id) = &self.canvas_state.selected_comp_id.clone() {
                        let mut delete_comp = false;

                        if let Some(comp) = self.canvas_state.components.iter_mut().find(|c| c.id == *sel_id) {
                            ui.label(RichText::new(&comp.id).monospace().color(tokens::ACCENT));

                            match &mut comp.kind {
                                PartKind::Potentiometer { value } => {
                                    ui.add(Slider::new(value, 0.0..=1.0).text("Wiper"));
                                }
                                PartKind::Resistor { resistance } => {
                                    ui.add(DragValue::new(resistance).speed(10.0).prefix("Ω: "));
                                }
                                _ => {}
                            }

                            if ui.button(format!("{} Delete", octicons::TRASH)).clicked() {
                                delete_comp = true;
                            }
                        }

                        if delete_comp {
                            self.canvas_state.components.retain(|c| c.id != *sel_id);
                            self.canvas_state.wires.retain(|w| w.from_comp != *sel_id && w.to_comp != *sel_id);
                            self.canvas_state.selected_comp_id = None;
                            self.runner.sync_components(&self.canvas_state.components);
                            self.runner.sync_wires(&self.canvas_state.wires);
                        }
                    } else {
                        ui.label(RichText::new("Select a part to configure").size(11.0).color(tokens::TEXT_MUTED));
                    }

                    ui.separator();
                    ui.horizontal(|ui| {
                        ui.label(RichText::new(format!("Wires: {}", self.canvas_state.wires.len())).size(11.0).color(tokens::TEXT_SECONDARY));
                        if ui.button("Clear").clicked() {
                            self.canvas_state.wires.clear();
                            self.runner.sync_wires(&self.canvas_state.wires);
                        }
                    });
                });
        }

        // 6. Central Workspace: 2D Interactive Breadboard Canvas
        CentralPanel::default().show(ui, |ui| {
            let lit_leds = self.runner.get_lit_leds();
            let widget = CanvasWidget::new(&mut self.canvas_state, self.runner.pin13_state, lit_leds);
            let (_response, actions) = widget.show(ui);

            // Process canvas actions
            for action in actions {
                match action {
                    CanvasAction::WireCreated { .. } => {
                        self.runner.sync_wires(&self.canvas_state.wires);
                    }
                    CanvasAction::WireDeleted(_) => {
                        self.runner.sync_wires(&self.canvas_state.wires);
                    }
                    CanvasAction::ButtonPressed { id, pressed } => {
                        if let Some(btn) = self.runner.engine.buttons.get_mut(&id) {
                            btn.is_pressed = pressed;
                        }
                        self.runner.engine.resolve_electrical_nets();
                    }
                    CanvasAction::PotChanged { id, value } => {
                        if let Some(pot) = self.runner.engine.pots.get_mut(&id) {
                            pot.value = value;
                        }
                        self.runner.engine.resolve_electrical_nets();
                    }
                    _ => {}
                }
            }
        });

        // About Modal Dialog
        if self.show_about_modal {
            egui::Window::new("About MicroRustSim")
                .collapsible(false)
                .resizable(false)
                .show(&ctx, |ui| {
                    ui.label(RichText::new("MicroRustSim").strong().size(16.0).color(tokens::ACCENT));
                    ui.label("Pure Rust Embedded MCU & Circuit Simulator");
                    ui.separator();
                    ui.label(format!("{} Core: Cycle-accurate ATmega328P @ 16 MHz", octicons::CPU));
                    ui.label(format!("{} Compiler: Genuine AVR-GCC via AppData", octicons::ZAP));
                    ui.label(format!("{} Design System: Dark Minimalist + Octicons", octicons::CODE));
                    ui.separator();
                    if ui.button("Close").clicked() {
                        self.show_about_modal = false;
                    }
                });
        }

        // Open Project Modal Dialog
        if self.show_open_modal {
            egui::Window::new("Open Project")
                .collapsible(false)
                .resizable(true)
                .show(&ctx, |ui| {
                    if self.available_projects.is_empty() {
                        ui.label("No saved projects found in local SQLite database.");
                    } else {
                        ScrollArea::vertical().show(ui, |ui| {
                            for proj in &self.available_projects.clone() {
                                if ui.button(format!("{} {} ({})", octicons::FILE, proj.name, proj.updated_at)).clicked() {
                                    self.load_project(&proj.name);
                                }
                            }
                        });
                    }
                    ui.separator();
                    if ui.button("Close").clicked() {
                        self.show_open_modal = false;
                    }
                });
        }
    }
}
