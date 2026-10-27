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

/// Full project model
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProjectRecord {
    pub id: i64,
    pub name: String,
    pub sketch_code: String,
    pub diagram_json: String,
    pub created_at: String,
    pub updated_at: String,
}

/// SQLite Database Manager for MicroRustSim
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
}
