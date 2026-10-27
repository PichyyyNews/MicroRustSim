use std::path::{Path, PathBuf};
use rusqlite::{params, Connection, Result as SqlResult};
use serde::{Deserialize, Serialize};

/// Wokwi-compatible diagram component part definition
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DiagramPart {
    #[serde(rename = "type")]
    pub part_type: String,
    pub id: String,
    pub top: f32,
    pub left: f32,
    #[serde(default)]
    pub attrs: serde_json::Value,
}

/// Wokwi-compatible diagram connection: [from_pin, to_pin, color, [routing_rules]]
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DiagramConnection(
    pub String,                  // from (e.g. "uno:13")
    pub String,                  // to (e.g. "led1:A")
    pub String,                  // color (e.g. "red", "green")
    pub Vec<serde_json::Value>,  // routing points
);

/// Wokwi-compatible diagram.json schema
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DiagramSchema {
    pub version: u32,
    pub author: String,
    pub editor: String,
    pub parts: Vec<DiagramPart>,
    pub connections: Vec<DiagramConnection>,
}

impl Default for DiagramSchema {
    fn default() -> Self {
        Self {
            version: 1,
            author: "MicroRustSim User".to_string(),
            editor: "microrustsim".to_string(),
            parts: vec![
                DiagramPart {
                    part_type: "wokwi-arduino-uno".to_string(),
                    id: "uno1".to_string(),
                    top: 150.0,
                    left: 200.0,
                    attrs: serde_json::json!({}),
                },
                DiagramPart {
                    part_type: "wokwi-led".to_string(),
                    id: "led1".to_string(),
                    top: 180.0,
                    left: 550.0,
                    attrs: serde_json::json!({ "color": "red" }),
                },
                DiagramPart {
                    part_type: "wokwi-resistor".to_string(),
                    id: "r1".to_string(),
                    top: 250.0,
                    left: 550.0,
                    attrs: serde_json::json!({ "value": "220" }),
                },
            ],
            connections: vec![
                DiagramConnection("uno1:13".into(), "led1:A".into(), "#22c55e".into(), vec![]),
                DiagramConnection("led1:C".into(), "r1:1".into(), "#eab308".into(), vec![]),
                DiagramConnection("r1:2".into(), "uno1:GND".into(), "#000000".into(), vec![]),
            ],
        }
    }
}

/// Project summary for listing in the IDE UI
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProjectMetadata {
    pub id: i64,
    pub name: String,
    pub created_at: String,
    pub updated_at: String,
}

/// Full project model from SQLite
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProjectRecord {
    pub id: i64,
    pub name: String,
    pub sketch_code: String,
    pub diagram_json: String,
    pub created_at: String,
    pub updated_at: String,
}

/// File or directory entry in the project explorer
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FileEntry {
    pub name: String,
    pub path: String,
    pub relative_path: String,
    pub is_dir: bool,
    pub size: u64,
}

/// Full project loaded from an on-disk project directory
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProjectData {
    pub name: String,
    pub path: String,
    pub sketch_code: String,
    pub diagram_json: String,
    pub metadata_json: String,
    pub files: Vec<FileEntry>,
}

/// Item in the "Open Recent" list
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RecentProject {
    pub name: String,
    pub path: String,
    pub last_opened: String,
}

/// On-Disk Project Directory Management
pub struct DirectoryProject;

impl DirectoryProject {
    /// Recursively read the files within a project directory (skips hidden and build folders)
    pub fn read_dir_tree(project_dir: &Path) -> Result<Vec<FileEntry>, String> {
        let mut entries = Vec::new();
        Self::scan_dir(project_dir, project_dir, &mut entries)
            .map_err(|e| format!("Failed to read directory tree: {}", e))?;
        entries.sort_by(|a, b| {
            if a.is_dir == b.is_dir {
                a.relative_path.cmp(&b.relative_path)
            } else if a.is_dir {
                std::cmp::Ordering::Less
            } else {
                std::cmp::Ordering::Greater
            }
        });
        Ok(entries)
    }

    fn scan_dir(base: &Path, current: &Path, list: &mut Vec<FileEntry>) -> std::io::Result<()> {
        if !current.exists() || !current.is_dir() {
            return Ok(());
        }
        for entry in std::fs::read_dir(current)? {
            let entry = entry?;
            let path = entry.path();
            let file_name = entry.file_name().to_string_lossy().to_string();

            if file_name == ".git"
                || file_name == ".vscode"
                || file_name == "build"
                || file_name == "target"
                || file_name == "node_modules"
            {
                continue;
            }

            let is_dir = path.is_dir();
            let relative_path = path
                .strip_prefix(base)
                .unwrap_or(&path)
                .to_string_lossy()
                .replace('\\', "/");

            let size = if is_dir {
                0
            } else {
                entry.metadata().map(|m| m.len()).unwrap_or(0)
            };

            list.push(FileEntry {
                name: file_name,
                path: path.to_string_lossy().replace('\\', "/"),
                relative_path,
                is_dir,
                size,
            });

            if is_dir {
                Self::scan_dir(base, &path, list)?;
            }
        }
        Ok(())
    }

    /// Create a new project directory with standard sketch.ino, diagram.json, and project.json
    pub fn create_project_dir(
        parent_dir: &Path,
        name: &str,
        sketch_code: Option<&str>,
        diagram_json: Option<&str>,
    ) -> Result<ProjectData, String> {
        let sanitized_name = name.trim().replace(['\\', '/', ':', '*', '?', '"', '<', '>', '|'], "_");
        let project_dir = parent_dir.join(&sanitized_name);

        if project_dir.exists() {
            return Err(format!("Directory already exists: {}", project_dir.display()));
        }

        std::fs::create_dir_all(&project_dir)
            .map_err(|e| format!("Failed to create project directory: {}", e))?;

        let src_dir = project_dir.join("src");
        let _ = std::fs::create_dir_all(&src_dir);

        let default_sketch = r#"#include "config.h"

// MicroRustSim Arduino Firmware
// Target: ATmega328P @ 16 MHz (Arduino Uno R3)

void setup() {
  pinMode(LED_PIN, OUTPUT);
  Serial.begin(9600);
  Serial.println("[MicroRustSim] System online. Firmware loaded.");
}

void loop() {
  digitalWrite(LED_PIN, HIGH);
  delay(1000);
  digitalWrite(LED_PIN, LOW);
  delay(1000);
}
"#;

        let code_to_write = sketch_code.unwrap_or(default_sketch);
        std::fs::write(project_dir.join("sketch.ino"), code_to_write)
            .map_err(|e| format!("Failed to write sketch.ino: {}", e))?;

        let default_config = r#"#pragma once

// Hardware Pin Definitions
#define LED_PIN 13
#define BUTTON_PIN 2
#define POT_PIN A0

// UART Baud Configuration
#define SYSTEM_BAUD 9600
"#;
        let _ = std::fs::write(project_dir.join("config.h"), default_config);

        let default_diagram = serde_json::to_string_pretty(&DiagramSchema::default())
            .unwrap_or_else(|_| "{}".to_string());
        let diagram_to_write = diagram_json.unwrap_or(&default_diagram);
        std::fs::write(project_dir.join("diagram.json"), diagram_to_write)
            .map_err(|e| format!("Failed to write diagram.json: {}", e))?;

        let readme_content = format!(
            "# {}\n\nArduino firmware and circuit simulation built with **MicroRustSim**.\n\n## Project Structure\n- `sketch.ino`: Main firmware (setup and loop routines)\n- `config.h`: Hardware pin definitions and constants\n- `diagram.json`: Circuit schematic and breadboard wiring (Wokwi-compatible)\n- `project.json`: Target MCU and board metadata\n\n## Execution\n- Click **⚡ Compile & Upload** to compile using genuine `arduino-cli`.\n- Click **▶ Run Simulation** to execute cycle-accurate AVR simulation at 16 MHz.\n",
            sanitized_name
        );
        let _ = std::fs::write(project_dir.join("README.md"), readme_content);

        let gitignore_content = "build/\n*.hex\n*.elf\n";
        let _ = std::fs::write(project_dir.join(".gitignore"), gitignore_content);

        let now_str = chrono_like_now();
        let meta = serde_json::json!({
            "name": sanitized_name,
            "board": "arduino:avr:uno",
            "mcu": "atmega328p",
            "baud_rate": 9600,
            "version": "1.0.0",
            "created_at": now_str,
            "updated_at": now_str,
        });
        let meta_str = serde_json::to_string_pretty(&meta).unwrap();
        std::fs::write(project_dir.join("project.json"), &meta_str)
            .map_err(|e| format!("Failed to write project.json: {}", e))?;

        let files = Self::read_dir_tree(&project_dir)?;

        Ok(ProjectData {
            name: sanitized_name,
            path: project_dir.to_string_lossy().replace('\\', "/"),
            sketch_code: code_to_write.to_string(),
            diagram_json: diagram_to_write.to_string(),
            metadata_json: meta_str,
            files,
        })
    }

    /// Open an existing project directory
    pub fn open_project_dir(project_dir: &Path) -> Result<ProjectData, String> {
        if !project_dir.exists() || !project_dir.is_dir() {
            return Err(format!("Project directory not found: {}", project_dir.display()));
        }

        let name = project_dir
            .file_name()
            .map(|n| n.to_string_lossy().to_string())
            .unwrap_or_else(|| "project".to_string());

        let sketch_path = project_dir.join("sketch.ino");
        let sketch_code = if sketch_path.exists() {
            std::fs::read_to_string(&sketch_path).unwrap_or_default()
        } else {
            let mut found = String::new();
            if let Ok(entries) = std::fs::read_dir(project_dir) {
                for e in entries.flatten() {
                    let p = e.path();
                    if p.extension().map_or(false, |ext| ext == "ino") {
                        if let Ok(c) = std::fs::read_to_string(&p) {
                            found = c;
                            break;
                        }
                    }
                }
            }
            if found.is_empty() {
                let default_sketch = format!(
                    "#include \"config.h\"\n\n// MicroRustSim Project: {}\n// Target: ATmega328P @ 16 MHz (Arduino Uno R3)\n\nvoid setup() {{\n  pinMode(LED_PIN, OUTPUT);\n  Serial.begin(9600);\n  Serial.println(\"[MicroRustSim] System online.\");\n}}\n\nvoid loop() {{\n  digitalWrite(LED_PIN, HIGH);\n  delay(1000);\n  digitalWrite(LED_PIN, LOW);\n  delay(1000);\n}}\n",
                    name
                );
                let _ = std::fs::write(&sketch_path, &default_sketch);
                default_sketch
            } else {
                found
            }
        };

        let config_path = project_dir.join("config.h");
        if !config_path.exists() {
            let default_config = "#pragma once\n\n// Hardware Pin Definitions\n#define LED_PIN 13\n#define BUTTON_PIN 2\n#define POT_PIN A0\n\n#define SYSTEM_BAUD 9600\n";
            let _ = std::fs::write(&config_path, default_config);
        }

        let diagram_path = project_dir.join("diagram.json");
        let diagram_json = if diagram_path.exists() {
            std::fs::read_to_string(&diagram_path).unwrap_or_default()
        } else {
            let default_diag = serde_json::to_string_pretty(&DiagramSchema::default())
                .unwrap_or_else(|_| "{}".to_string());
            let _ = std::fs::write(&diagram_path, &default_diag);
            default_diag
        };

        let readme_path = project_dir.join("README.md");
        if !readme_path.exists() {
            let readme_content = format!(
                "# {}\n\nArduino firmware and circuit simulation built with **MicroRustSim**.\n\n## Project Structure\n- `sketch.ino`: Main firmware (setup and loop routines)\n- `config.h`: Hardware pin definitions and constants\n- `diagram.json`: Circuit schematic and breadboard wiring (Wokwi-compatible)\n- `project.json`: Target MCU and board metadata\n\n## Execution\n- Click **⚡ Compile & Upload** to compile using genuine `arduino-cli`.\n- Click **▶ Run Simulation** to execute cycle-accurate AVR simulation at 16 MHz.\n",
                name
            );
            let _ = std::fs::write(&readme_path, readme_content);
        }

        let meta_path = project_dir.join("project.json");
        let metadata_json = if meta_path.exists() {
            std::fs::read_to_string(&meta_path).unwrap_or_default()
        } else {
            let default_meta = serde_json::json!({
                "name": name,
                "board": "arduino:avr:uno",
                "mcu": "atmega328p",
                "baud_rate": 9600,
            })
            .to_string();
            let _ = std::fs::write(&meta_path, &default_meta);
            default_meta
        };

        let gitignore_path = project_dir.join(".gitignore");
        if !gitignore_path.exists() {
            let _ = std::fs::write(&gitignore_path, "build/\n*.hex\n*.elf\n");
        }

        let files = Self::read_dir_tree(project_dir)?;

        Ok(ProjectData {
            name,
            path: project_dir.to_string_lossy().replace('\\', "/"),
            sketch_code,
            diagram_json,
            metadata_json,
            files,
        })
    }

    /// Save sketch.ino, diagram.json, and project.json to disk
    pub fn save_project_files(
        project_dir: &Path,
        sketch_code: &str,
        diagram_json: &str,
        metadata_json: Option<&str>,
    ) -> Result<(), String> {
        if !project_dir.exists() {
            std::fs::create_dir_all(project_dir)
                .map_err(|e| format!("Failed to create directory: {}", e))?;
        }

        std::fs::write(project_dir.join("sketch.ino"), sketch_code)
            .map_err(|e| format!("Failed to save sketch.ino: {}", e))?;

        std::fs::write(project_dir.join("diagram.json"), diagram_json)
            .map_err(|e| format!("Failed to save diagram.json: {}", e))?;

        if let Some(meta) = metadata_json {
            std::fs::write(project_dir.join("project.json"), meta)
                .map_err(|e| format!("Failed to save project.json: {}", e))?;
        }

        Ok(())
    }

    /// Write content to an individual file in the project
    pub fn write_file_content(file_path: &Path, content: &str) -> Result<(), String> {
        if let Some(parent) = file_path.parent() {
            let _ = std::fs::create_dir_all(parent);
        }
        std::fs::write(file_path, content).map_err(|e| format!("Failed to write file: {}", e))
    }

    /// Delete a file or directory in the project
    pub fn delete_file_entry(file_path: &Path) -> Result<(), String> {
        if !file_path.exists() {
            return Ok(());
        }
        if file_path.is_dir() {
            std::fs::remove_dir_all(file_path).map_err(|e| format!("Failed to remove directory: {}", e))
        } else {
            std::fs::remove_file(file_path).map_err(|e| format!("Failed to remove file: {}", e))
        }
    }
}

fn chrono_like_now() -> String {
    use std::time::{SystemTime, UNIX_EPOCH};
    let now = SystemTime::now().duration_since(UNIX_EPOCH).unwrap_or_default().as_secs();
    format!("{}", now)
}

/// SQLite Database Manager for MicroRustSim (projects and recent files)
pub struct ProjectStorage {
    conn: Connection,
}

impl ProjectStorage {
    /// Open SQLite database at given path
    pub fn open<P: AsRef<Path>>(path: P) -> SqlResult<Self> {
        let conn = Connection::open(path)?;
        let storage = Self { conn };
        storage.init_tables()?;
        Ok(storage)
    }

    /// Open in-memory SQLite database (ideal for tests or ephemeral web sessions)
    pub fn open_in_memory() -> SqlResult<Self> {
        let conn = Connection::open_in_memory()?;
        let storage = Self { conn };
        storage.init_tables()?;
        Ok(storage)
    }

    /// Default database location in user's home or current directory
    pub fn open_default() -> SqlResult<Self> {
        let path = Self::default_db_path();
        if let Some(parent) = path.parent() {
            let _ = std::fs::create_dir_all(parent);
        }
        Self::open(path)
    }

    pub fn default_db_path() -> PathBuf {
        if let Some(proj_dirs) = dirs::data_local_dir() {
            proj_dirs.join("MicroRustSim").join("projects.db")
        } else {
            PathBuf::from("projects.db")
        }
    }

    fn init_tables(&self) -> SqlResult<()> {
        self.conn.execute(
            "CREATE TABLE IF NOT EXISTS projects (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL UNIQUE,
                sketch_code TEXT NOT NULL,
                diagram_json TEXT NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            );",
            [],
        )?;

        self.conn.execute(
            "CREATE TABLE IF NOT EXISTS recent_projects (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                path TEXT NOT NULL UNIQUE,
                last_opened DATETIME DEFAULT CURRENT_TIMESTAMP
            );",
            [],
        )?;

        self.conn.execute(
            "CREATE TABLE IF NOT EXISTS user_settings (
                key TEXT PRIMARY KEY,
                value TEXT NOT NULL,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            );",
            [],
        )?;

        Ok(())
    }

    pub fn list_projects(&self) -> SqlResult<Vec<ProjectMetadata>> {
        let mut stmt = self.conn.prepare(
            "SELECT id, name, created_at, updated_at FROM projects ORDER BY updated_at DESC",
        )?;
        let rows = stmt.query_map([], |row| {
            Ok(ProjectMetadata {
                id: row.get(0)?,
                name: row.get(1)?,
                created_at: row.get(2)?,
                updated_at: row.get(3)?,
            })
        })?;

        let mut list = Vec::new();
        for r in rows {
            list.push(r?);
        }
        Ok(list)
    }

    pub fn save_project(&self, name: &str, sketch_code: &str, diagram_json: &str) -> SqlResult<i64> {
        self.conn.execute(
            "INSERT INTO projects (name, sketch_code, diagram_json, updated_at)
             VALUES (?1, ?2, ?3, CURRENT_TIMESTAMP)
             ON CONFLICT(name) DO UPDATE SET
                sketch_code = excluded.sketch_code,
                diagram_json = excluded.diagram_json,
                updated_at = CURRENT_TIMESTAMP;",
            params![name, sketch_code, diagram_json],
        )?;
        Ok(self.conn.last_insert_rowid())
    }

    pub fn load_project_by_name(&self, name: &str) -> SqlResult<Option<ProjectRecord>> {
        let mut stmt = self.conn.prepare(
            "SELECT id, name, sketch_code, diagram_json, created_at, updated_at
             FROM projects WHERE name = ?1",
        )?;
        let mut rows = stmt.query(params![name])?;
        if let Some(row) = rows.next()? {
            Ok(Some(ProjectRecord {
                id: row.get(0)?,
                name: row.get(1)?,
                sketch_code: row.get(2)?,
                diagram_json: row.get(3)?,
                created_at: row.get(4)?,
                updated_at: row.get(5)?,
            }))
        } else {
            Ok(None)
        }
    }

    pub fn add_recent_project(&self, name: &str, path: &str) -> SqlResult<()> {
        self.conn.execute(
            "INSERT INTO recent_projects (name, path, last_opened)
             VALUES (?1, ?2, CURRENT_TIMESTAMP)
             ON CONFLICT(path) DO UPDATE SET
                name = excluded.name,
                last_opened = CURRENT_TIMESTAMP;",
            params![name, path],
        )?;
        Ok(())
    }

    pub fn list_recent_projects(&self) -> SqlResult<Vec<RecentProject>> {
        let mut stmt = self.conn.prepare(
            "SELECT name, path, last_opened FROM recent_projects ORDER BY last_opened DESC, id DESC LIMIT 15",
        )?;
        let rows = stmt.query_map([], |row| {
            Ok(RecentProject {
                name: row.get(0)?,
                path: row.get(1)?,
                last_opened: row.get(2)?,
            })
        })?;

        let mut list = Vec::new();
        for r in rows {
            list.push(r?);
        }
        Ok(list)
    }

    pub fn remove_recent_project(&self, path: &str) -> SqlResult<()> {
        self.conn.execute("DELETE FROM recent_projects WHERE path = ?1", params![path])?;
        Ok(())
    }

    pub fn get_setting(&self, key: &str) -> SqlResult<Option<String>> {
        let mut stmt = self.conn.prepare("SELECT value FROM user_settings WHERE key = ?1")?;
        let mut rows = stmt.query(params![key])?;
        if let Some(row) = rows.next()? {
            Ok(Some(row.get(0)?))
        } else {
            Ok(None)
        }
    }

    pub fn set_setting(&self, key: &str, value: &str) -> SqlResult<()> {
        self.conn.execute(
            "INSERT INTO user_settings (key, value, updated_at) 
             VALUES (?1, ?2, CURRENT_TIMESTAMP)
             ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP;",
            params![key, value],
        )?;
        Ok(())
    }
}

// Simple fallback for dirs crate if not imported
mod dirs {
    use std::path::PathBuf;
    pub fn data_local_dir() -> Option<PathBuf> {
        std::env::var_os("LOCALAPPDATA")
            .or_else(|| std::env::var_os("APPDATA"))
            .map(PathBuf::from)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_sqlite_storage_crud() {
        let storage = ProjectStorage::open_in_memory().unwrap();
        let default_diagram = DiagramSchema::default();
        let json_str = serde_json::to_string_pretty(&default_diagram).unwrap();

        storage.save_project("Blink Lab", "void setup() {}", &json_str).unwrap();

        let projects = storage.list_projects().unwrap();
        assert_eq!(projects.len(), 1);
        assert_eq!(projects[0].name, "Blink Lab");

        let loaded = storage.load_project_by_name("Blink Lab").unwrap().unwrap();
        assert_eq!(loaded.sketch_code, "void setup() {}");
    }

    #[test]
    fn test_recent_projects_tracking() {
        let storage = ProjectStorage::open_in_memory().unwrap();
        storage.add_recent_project("Lab1", "C:/Projects/Lab1").unwrap();
        storage.add_recent_project("Lab2", "C:/Projects/Lab2").unwrap();

        let recents = storage.list_recent_projects().unwrap();
        assert_eq!(recents.len(), 2);
        assert_eq!(recents[0].name, "Lab2");
    }

    #[test]
    fn test_directory_project_lifecycle() {
        let temp = std::env::temp_dir().join(format!("mrsim_test_{}", chrono_like_now()));
        let _ = std::fs::create_dir_all(&temp);

        let proj = DirectoryProject::create_project_dir(&temp, "TrafficLight", None, None).unwrap();
        assert_eq!(proj.name, "TrafficLight");
        assert!(proj.files.iter().any(|f| f.name == "sketch.ino"));
        assert!(proj.files.iter().any(|f| f.name == "diagram.json"));
        assert!(proj.files.iter().any(|f| f.name == "config.h"));
        assert!(proj.files.iter().any(|f| f.name == "project.json"));
        assert!(proj.files.iter().any(|f| f.name == "README.md"));
        assert!(proj.files.iter().any(|f| f.name == ".gitignore"));

        let opened = DirectoryProject::open_project_dir(Path::new(&proj.path)).unwrap();
        assert_eq!(opened.name, "TrafficLight");
        assert!(opened.files.iter().any(|f| f.name == ".gitignore"));

        let _ = std::fs::remove_dir_all(&temp);
    }

    #[test]
    fn test_user_settings_persistence() {
        let storage = ProjectStorage::open_in_memory().unwrap();
        assert_eq!(storage.get_setting("workspace_layout").unwrap(), None);

        let layout_json = r#"{"leftColumnSize":26,"centerColumnSize":52,"rightColumnSize":22}"#;
        storage.set_setting("workspace_layout", layout_json).unwrap();

        assert_eq!(
            storage.get_setting("workspace_layout").unwrap(),
            Some(layout_json.to_string())
        );

        // Update existing setting
        let updated_json = r#"{"leftColumnSize":30,"centerColumnSize":48,"rightColumnSize":22}"#;
        storage.set_setting("workspace_layout", updated_json).unwrap();
        assert_eq!(
            storage.get_setting("workspace_layout").unwrap(),
            Some(updated_json.to_string())
        );
    }
}
