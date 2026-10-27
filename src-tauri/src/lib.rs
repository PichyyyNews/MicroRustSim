use std::sync::mpsc::{channel, sync_channel, Sender, SyncSender};
use std::thread;
use parking_lot::Mutex;
use serde::{Deserialize, Serialize};
use sim_compiler::{ArduinoCliBackend, BuiltinSketches, CompilerBackend, MockCompilerBackend};
use sim_core::{components, LogicState, PinId, SimulationEngine, Wire};
use sim_storage::{
    DirectoryProject, FileEntry, ProjectData, ProjectMetadata, ProjectStorage,
    RecentProject,
};
use tauri::State;

#[derive(Serialize, Deserialize, Clone)]
pub struct InitialData {
    pub sketch_code: String,
    pub is_running: bool,
    pub baud_rate: u32,
    pub project_name: String,
}

#[derive(Serialize, Deserialize, Clone)]
pub struct CompileResult {
    pub success: bool,
    pub output: String,
    pub hex: Option<String>,
}

#[derive(Serialize, Deserialize, Clone)]
pub struct StepResult {
    pub pin13: bool,
    pub lit_leds: Vec<String>,
    pub serial_output: Option<String>,
    pub millis: f64,
}

pub enum SimCommand {
    CompileAndUpload { sketch: String, reply: SyncSender<CompileResult> },
    Start,
    Pause,
    Reset,
    Step { cycles: u64, reply: SyncSender<StepResult> },
    PressButton { id: String, pressed: bool },
    SetPot { id: String, value: f32 },
    WriteSerial { input: String },
    SyncWire { wire: Wire },
    RemoveWire { id: String },
    AddLed { id: String, color: String },
    AddResistor { id: String, ohms: f32 },
    AddButton { id: String },
    AddPot { id: String },
}

pub struct AppState {
    pub sim_tx: Sender<SimCommand>,
    pub storage: Mutex<ProjectStorage>,
}

#[tauri::command]
fn minimize_window(window: tauri::Window) {
    let _ = window.minimize();
}

#[tauri::command]
fn toggle_maximize_window(window: tauri::Window) {
    if let Ok(is_max) = window.is_maximized() {
        if is_max {
            let _ = window.unmaximize();
        } else {
            let _ = window.maximize();
        }
    }
}

#[tauri::command]
fn close_window(window: tauri::Window) {
    let _ = window.close();
}

#[tauri::command]
fn start_drag_window(window: tauri::Window) {
    let _ = window.start_dragging();
}

#[tauri::command]
fn get_initial_data() -> InitialData {
    InitialData {
        sketch_code: BuiltinSketches::blink_source().to_string(),
        is_running: false,
        baud_rate: 9600,
        project_name: "Blink_Lab_Uno".to_string(),
    }
}

#[tauri::command]
fn compile_and_upload(sketch: String, state: State<'_, AppState>) -> Result<CompileResult, String> {
    let (tx, rx) = sync_channel(1);
    state.sim_tx
        .send(SimCommand::CompileAndUpload { sketch, reply: tx })
        .map_err(|e| e.to_string())?;
    rx.recv().map_err(|e| e.to_string())
}

#[tauri::command]
fn start_simulation(state: State<'_, AppState>) {
    let _ = state.sim_tx.send(SimCommand::Start);
}

#[tauri::command]
fn pause_simulation(state: State<'_, AppState>) {
    let _ = state.sim_tx.send(SimCommand::Pause);
}

#[tauri::command]
fn reset_simulation(state: State<'_, AppState>) {
    let _ = state.sim_tx.send(SimCommand::Reset);
}

#[tauri::command]
fn step_simulation(cycles: u64, state: State<'_, AppState>) -> Result<StepResult, String> {
    let (tx, rx) = sync_channel(1);
    state.sim_tx
        .send(SimCommand::Step { cycles, reply: tx })
        .map_err(|e| e.to_string())?;
    rx.recv().map_err(|e| e.to_string())
}

#[tauri::command]
fn press_button(id: String, pressed: bool, state: State<'_, AppState>) {
    let _ = state.sim_tx.send(SimCommand::PressButton { id, pressed });
}

#[tauri::command]
fn set_potentiometer(id: String, value: f32, state: State<'_, AppState>) {
    let _ = state.sim_tx.send(SimCommand::SetPot { id, value });
}

#[tauri::command]
fn write_serial(input: String, state: State<'_, AppState>) {
    let _ = state.sim_tx.send(SimCommand::WriteSerial { input });
}

#[tauri::command]
fn sync_wire(id: String, from_comp: String, from_pin: String, to_comp: String, to_pin: String, color: String, state: State<'_, AppState>) {
    let wire = Wire {
        id,
        from: PinId::new(from_comp, from_pin),
        to: PinId::new(to_comp, to_pin),
        color,
    };
    let _ = state.sim_tx.send(SimCommand::SyncWire { wire });
}

#[tauri::command]
fn remove_wire(id: String, state: State<'_, AppState>) {
    let _ = state.sim_tx.send(SimCommand::RemoveWire { id });
}

#[tauri::command]
fn add_led(id: String, color: String, state: State<'_, AppState>) {
    let _ = state.sim_tx.send(SimCommand::AddLed { id, color });
}

#[tauri::command]
fn add_resistor(id: String, ohms: f32, state: State<'_, AppState>) {
    let _ = state.sim_tx.send(SimCommand::AddResistor { id, ohms });
}

#[tauri::command]
fn add_button(id: String, state: State<'_, AppState>) {
    let _ = state.sim_tx.send(SimCommand::AddButton { id });
}

#[tauri::command]
fn add_potentiometer(id: String, state: State<'_, AppState>) {
    let _ = state.sim_tx.send(SimCommand::AddPot { id });
}

#[tauri::command]
fn save_project_db(name: String, sketch: String, state: State<'_, AppState>) -> Result<(), String> {
    let storage = state.storage.lock();
    storage.save_project(&name, &sketch, "{}")
        .map(|_| ())
        .map_err(|e| e.to_string())
}

#[tauri::command]
fn load_project_db(name: String, state: State<'_, AppState>) -> Result<Option<String>, String> {
    let storage = state.storage.lock();
    storage.load_project_by_name(&name)
        .map(|opt| opt.map(|r| r.sketch_code))
        .map_err(|e| e.to_string())
}

#[tauri::command]
fn list_projects_db(state: State<'_, AppState>) -> Result<Vec<ProjectMetadata>, String> {
    let storage = state.storage.lock();
    storage.list_projects().map_err(|e| e.to_string())
}

#[tauri::command]
fn create_project_dir(
    parent_path: String,
    name: String,
    sketch: Option<String>,
    diagram: Option<String>,
    state: State<'_, AppState>,
) -> Result<ProjectData, String> {
    let proj = DirectoryProject::create_project_dir(
        std::path::Path::new(&parent_path),
        &name,
        sketch.as_deref(),
        diagram.as_deref(),
    )?;
    let storage = state.storage.lock();
    let _ = storage.add_recent_project(&proj.name, &proj.path);
    Ok(proj)
}

#[tauri::command]
fn open_project_dir(
    path: String,
    state: State<'_, AppState>,
) -> Result<ProjectData, String> {
    let proj = DirectoryProject::open_project_dir(std::path::Path::new(&path))?;
    let storage = state.storage.lock();
    let _ = storage.add_recent_project(&proj.name, &proj.path);
    Ok(proj)
}

#[tauri::command]
fn save_project_to_disk(
    path: String,
    sketch: String,
    diagram: String,
    meta: Option<String>,
) -> Result<(), String> {
    DirectoryProject::save_project_files(
        std::path::Path::new(&path),
        &sketch,
        &diagram,
        meta.as_deref(),
    )
}

#[tauri::command]
fn read_dir_tree(path: String) -> Result<Vec<FileEntry>, String> {
    DirectoryProject::read_dir_tree(std::path::Path::new(&path))
}

#[tauri::command]
fn read_project_file(path: String) -> Result<String, String> {
    std::fs::read_to_string(&path).map_err(|e| format!("Failed to read file: {}", e))
}

#[tauri::command]
fn write_project_file(path: String, content: String) -> Result<(), String> {
    DirectoryProject::write_file_content(std::path::Path::new(&path), &content)
}

#[tauri::command]
fn delete_project_file(path: String) -> Result<(), String> {
    DirectoryProject::delete_file_entry(std::path::Path::new(&path))
}

#[tauri::command]
fn list_recent_projects(state: State<'_, AppState>) -> Result<Vec<RecentProject>, String> {
    let storage = state.storage.lock();
    storage.list_recent_projects().map_err(|e| e.to_string())
}

#[tauri::command]
fn remove_recent_project(path: String, state: State<'_, AppState>) -> Result<(), String> {
    let storage = state.storage.lock();
    storage.remove_recent_project(&path).map_err(|e| e.to_string())
}

#[tauri::command]
fn get_user_setting(key: String, state: State<'_, AppState>) -> Result<Option<String>, String> {
    let storage = state.storage.lock();
    storage.get_setting(&key).map_err(|e| e.to_string())
}

#[tauri::command]
fn save_user_setting(key: String, value: String, state: State<'_, AppState>) -> Result<(), String> {
    let storage = state.storage.lock();
    storage.set_setting(&key, &value).map_err(|e| e.to_string())
}

#[tauri::command]
async fn select_folder_dialog() -> Result<Option<String>, String> {
    let folder = rfd::AsyncFileDialog::new()
        .set_title("Select Project Working Folder")
        .pick_folder()
        .await;

    Ok(folder.map(|h| h.path().to_string_lossy().replace('\\', "/")))
}

#[tauri::command]
fn create_project_dir_entry(dir_path: String, relative_path: String, is_dir: bool) -> Result<(), String> {
    let base = std::path::Path::new(&dir_path);
    let target = base.join(&relative_path);
    if is_dir {
        std::fs::create_dir_all(&target).map_err(|e| format!("Failed to create directory: {}", e))?;
    } else {
        if let Some(parent) = target.parent() {
            let _ = std::fs::create_dir_all(parent);
        }
        std::fs::write(&target, "").map_err(|e| format!("Failed to create file: {}", e))?;
    }
    Ok(())
}

pub fn run() {
    let (sim_tx, sim_rx) = channel::<SimCommand>();

    // Dedicated simulation thread: isolates !Send Rc from UI thread
    thread::spawn(move || {
        let mut engine = SimulationEngine::new_with_uno();
        let mut is_running = false;

        let compiler: Box<dyn CompilerBackend> = {
            let cli = ArduinoCliBackend::new();
            if cli.is_available() {
                Box::new(cli)
            } else {
                Box::new(MockCompilerBackend)
            }
        };

        // Default setup: LED on pin 13 with 220 ohm resistor to GND
        engine.leds.insert("led1".to_string(), components::LedComponent::new("led1", "red"));
        engine.resistors.insert("r1".to_string(), components::ResistorComponent::new("r1", 220.0));
        engine.buttons.insert("btn1".to_string(), components::PushbuttonComponent::new("btn1"));
        engine.pots.insert("pot1".to_string(), components::PotentiometerComponent::new("pot1"));

        engine.add_wire(Wire {
            id: "w1".to_string(),
            from: PinId::new("uno1", "13"),
            to: PinId::new("led1", "anode"),
            color: "#22c55e".to_string(),
        });
        engine.add_wire(Wire {
            id: "w2".to_string(),
            from: PinId::new("led1", "cathode"),
            to: PinId::new("r1", "1"),
            color: "#eab308".to_string(),
        });
        engine.add_wire(Wire {
            id: "w3".to_string(),
            from: PinId::new("r1", "2"),
            to: PinId::new("uno1", "GND"),
            color: "#000000".to_string(),
        });

        // Preload blink hex
        let _ = engine.mcu.load_hex(&BuiltinSketches::blink_hex());
        engine.resolve_electrical_nets();

        while let Ok(cmd) = sim_rx.recv() {
            match cmd {
                SimCommand::CompileAndUpload { sketch, reply } => {
                    let res = compiler.compile(&sketch, "arduino:avr:uno");
                    match res {
                        Ok(comp_out) => {
                            let _ = engine.mcu.load_hex(&comp_out.hex);
                            engine.reset();
                            engine.resolve_electrical_nets();
                            is_running = true;
                            let _ = reply.send(CompileResult {
                                success: true,
                                output: format!("Build Succeeded!\n\n{}", comp_out.stdout),
                                hex: Some(comp_out.hex),
                            });
                        }
                        Err(err) => {
                            let _ = reply.send(CompileResult {
                                success: false,
                                output: err,
                                hex: None,
                            });
                        }
                    }
                }
                SimCommand::Start => {
                    is_running = true;
                }
                SimCommand::Pause => {
                    is_running = false;
                }
                SimCommand::Reset => {
                    engine.reset();
                    engine.resolve_electrical_nets();
                    is_running = false;
                }
                SimCommand::Step { cycles, reply } => {
                    if is_running {
                        engine.step_cycles(cycles);
                    }
                    let pin13 = engine.mcu.get_pin_state("13") == LogicState::High;
                    let lit_leds: Vec<String> = engine
                        .leds
                        .values()
                        .filter(|l| l.is_lit)
                        .map(|l| l.id.clone())
                        .collect();

                    let raw_bytes = engine.mcu.read_serial_output();
                    let serial_output = if !raw_bytes.is_empty() {
                        Some(String::from_utf8_lossy(&raw_bytes).to_string())
                    } else {
                        None
                    };

                    let millis = engine.mcu.millis();
                    let _ = reply.send(StepResult {
                        pin13,
                        lit_leds,
                        serial_output,
                        millis,
                    });
                }
                SimCommand::PressButton { id, pressed } => {
                    if let Some(btn) = engine.buttons.get_mut(&id) {
                        btn.is_pressed = pressed;
                    }
                    engine.resolve_electrical_nets();
                }
                SimCommand::SetPot { id, value } => {
                    if let Some(pot) = engine.pots.get_mut(&id) {
                        pot.value = value.clamp(0.0, 1.0);
                    }
                    engine.resolve_electrical_nets();
                }
                SimCommand::WriteSerial { input } => {
                    let line = format!("{}\n", input);
                    engine.mcu.write_serial_input(line.as_bytes());
                }
                SimCommand::SyncWire { wire } => {
                    engine.wires.retain(|w| w.id != wire.id);
                    engine.add_wire(wire);
                    engine.resolve_electrical_nets();
                }
                SimCommand::RemoveWire { id } => {
                    engine.remove_wire(&id);
                    engine.resolve_electrical_nets();
                }
                SimCommand::AddLed { id, color } => {
                    engine.leds.insert(id.clone(), components::LedComponent::new(id, color));
                    engine.resolve_electrical_nets();
                }
                SimCommand::AddResistor { id, ohms } => {
                    engine.resistors.insert(id.clone(), components::ResistorComponent::new(id, ohms));
                    engine.resolve_electrical_nets();
                }
                SimCommand::AddButton { id } => {
                    engine.buttons.insert(id.clone(), components::PushbuttonComponent::new(id));
                    engine.resolve_electrical_nets();
                }
                SimCommand::AddPot { id } => {
                    engine.pots.insert(id.clone(), components::PotentiometerComponent::new(id));
                    engine.resolve_electrical_nets();
                }
            }
        }
    });

    let storage = ProjectStorage::open_default().unwrap_or_else(|_| {
        ProjectStorage::open_in_memory().expect("In-memory SQLite failed")
    });

    let app_state = AppState {
        sim_tx,
        storage: Mutex::new(storage),
    };

    tauri::Builder::default()
        .setup(|app| {
            use tauri::Manager;
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.remove_menu();
            }
            Ok(())
        })
        .manage(app_state)
        .invoke_handler(tauri::generate_handler![
            start_drag_window,
            minimize_window,
            toggle_maximize_window,
            close_window,
            get_initial_data,
            compile_and_upload,
            start_simulation,
            pause_simulation,
            reset_simulation,
            step_simulation,
            press_button,
            set_potentiometer,
            write_serial,
            sync_wire,
            remove_wire,
            add_led,
            add_resistor,
            add_button,
            add_potentiometer,
            save_project_db,
            load_project_db,
            list_projects_db,
            create_project_dir,
            open_project_dir,
            save_project_to_disk,
            read_dir_tree,
            read_project_file,
            write_project_file,
            delete_project_file,
            list_recent_projects,
            remove_recent_project,
            get_user_setting,
            save_user_setting,
            select_folder_dialog,
            create_project_dir_entry,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
