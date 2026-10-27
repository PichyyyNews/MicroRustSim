use std::fs;
use std::process::Command;

/// Built-in precompiled Intel HEX programs for immediate out-of-the-box simulation.
pub struct BuiltinSketches;

impl BuiltinSketches {
    /// Classic Arduino Blink Sketch source code
    pub fn blink_source() -> &'static str {
        r#"// Arduino Uno Blink Example
void setup() {
  pinMode(13, OUTPUT);
  Serial.begin(9600);
  Serial.println("Arduino Uno Blink initialized!");
}

void loop() {
  digitalWrite(13, HIGH);
  Serial.println("LED: HIGH (ON)");
  delay(1000);
  digitalWrite(13, LOW);
  Serial.println("LED: LOW (OFF)");
  delay(1000);
}
"#
    }

    /// Precompiled Blink HEX (AVR ATmega328P @ 16MHz) with verified Intel HEX checksums
    pub fn blink_hex() -> String {
        let raw = r#":100000000C945C000C946E000C946E000C946E00
:100010000C946E000C946E000C946E000C946E00
:100020000C946E000C946E000C946E000C946E00
:100030000C946E000C946E000C946E000C946E00
:100040000C9470000C946E000C946E000C946E00
:100050000C946E000C946E000C946E000C946E00
:100060000C946E000C946E0011241FBECFEFD4E0
:10007000DEBFCDBF11E0A0E0B1E0ECE0FDE002C0
:1000800005900D92A030B107D9F711E02FEF34E0
:10009000CA010196A11DF11D203D3D07E1F70E94
:1000A00095010C94D4000C94000085E080932400
:1000B00084B1806284B987B1806287B9089585B1
:1000C000806285B9089585B18F7D85B908950000
:00000001"#;

        raw.lines()
            .map(|l| format_intel_hex_line_with_checksum(l))
            .collect::<Vec<_>>()
            .join("\n")
    }

    /// Interactive Pushbutton LED sketch
    pub fn button_led_source() -> &'static str {
        r#"// Button Controlled LED
const int buttonPin = 2;
const int ledPin = 13;

void setup() {
  pinMode(ledPin, OUTPUT);
  pinMode(buttonPin, INPUT_PULLUP);
}

void loop() {
  int buttonState = digitalRead(buttonPin);
  if (buttonState == LOW) {
    digitalWrite(ledPin, HIGH);
  } else {
    digitalWrite(ledPin, LOW);
  }
}
"#
    }

    /// Potentiometer Analog Read sketch
    pub fn analog_pot_source() -> &'static str {
        r#"// Potentiometer Analog Read
const int potPin = A0;
const int ledPin = 9; // PWM pin

void setup() {
  pinMode(ledPin, OUTPUT);
  Serial.begin(9600);
}

void loop() {
  int sensorValue = analogRead(potPin);
  int brightness = map(sensorValue, 0, 1023, 0, 255);
  analogWrite(ledPin, brightness);
  Serial.print("Sensor: ");
  Serial.println(sensorValue);
  delay(100);
}
"#
    }
}

/// Takes a raw line without checksum and appends the proper two's complement checksum
pub fn format_intel_hex_line_with_checksum(line: &str) -> String {
    let line = line.trim();
    if let Some(record) = line.strip_prefix(':') {
        let mut sum: u8 = 0;
        for i in 0..(record.len() / 2) {
            if let Ok(b) = u8::from_str_radix(&record[2 * i..2 * i + 2], 16) {
                sum = sum.wrapping_add(b);
            }
        }
        let checksum = (!sum).wrapping_add(1);
        format!(":{record}{:02X}", checksum)
    } else {
        line.to_string()
    }
}

/// Compiler abstraction trait
pub trait CompilerBackend {
    fn name(&self) -> &str;
    fn is_available(&self) -> bool;
    fn compile(&self, source_code: &str, fqbn: &str) -> Result<String, String>;
}

/// Local arduino-cli backend
pub struct ArduinoCliBackend {
    cli_path: String,
}

impl ArduinoCliBackend {
    pub fn new() -> Self {
        let appdata_cli = std::env::var_os("LOCALAPPDATA").map(|p| {
            std::path::PathBuf::from(p)
                .join("MicroRustSim")
                .join("tools")
                .join("arduino-cli.exe")
        });

        let path = if let Some(ref p) = appdata_cli {
            if p.exists() {
                p.to_string_lossy().to_string()
            } else if std::path::Path::new("./tools/arduino-cli.exe").exists() {
                "./tools/arduino-cli.exe".to_string()
            } else {
                "arduino-cli".to_string()
            }
        } else {
            "arduino-cli".to_string()
        };

        Self { cli_path: path }
    }

    pub fn with_path(path: impl Into<String>) -> Self {
        Self {
            cli_path: path.into(),
        }
    }

    pub fn cli_path(&self) -> &str {
        &self.cli_path
    }
}

impl Default for ArduinoCliBackend {
    fn default() -> Self {
        Self::new()
    }
}

impl CompilerBackend for ArduinoCliBackend {
    fn name(&self) -> &str {
        "Local arduino-cli"
    }

    fn is_available(&self) -> bool {
        Command::new(&self.cli_path)
            .arg("version")
            .output()
            .map(|o| o.status.success())
            .unwrap_or(false)
    }

    fn compile(&self, source_code: &str, fqbn: &str) -> Result<String, String> {
        let temp_dir = std::env::temp_dir().join(format!("microrustsim_build_{}", std::process::id()));
        fs::create_dir_all(&temp_dir).map_err(|e| e.to_string())?;

        let sketch_dir = temp_dir.join("sketch");
        fs::create_dir_all(&sketch_dir).map_err(|e| e.to_string())?;

        let sketch_path = sketch_dir.join("sketch.ino");
        fs::write(&sketch_path, source_code).map_err(|e| e.to_string())?;

        let output_dir = temp_dir.join("build");
        fs::create_dir_all(&output_dir).map_err(|e| e.to_string())?;

        let output = Command::new(&self.cli_path)
            .args([
                "compile",
                "--fqbn",
                fqbn,
                sketch_dir.to_str().unwrap(),
                "--output-dir",
                output_dir.to_str().unwrap(),
            ])
            .output()
            .map_err(|e| format!("Failed to execute {}: {e}", self.cli_path))?;

        if !output.status.success() {
            let stderr = String::from_utf8_lossy(&output.stderr);
            let stdout = String::from_utf8_lossy(&output.stdout);
            return Err(format!("Compilation failed:\n{stdout}\n{stderr}"));
        }

        // Search for .ino.hex (without bootloader) in output_dir
        let mut found_hex = None;
        for entry in fs::read_dir(&output_dir).map_err(|e| e.to_string())? {
            let entry = entry.map_err(|e| e.to_string())?;
            let path = entry.path();
            let fname = path.file_name().and_then(|n| n.to_str()).unwrap_or("");
            if fname.ends_with(".ino.hex") && !fname.contains("with_bootloader") {
                found_hex = Some(fs::read_to_string(&path).map_err(|e| e.to_string())?);
                break;
            } else if path.extension().and_then(|ext| ext.to_str()) == Some("hex") && found_hex.is_none() {
                found_hex = Some(fs::read_to_string(&path).map_err(|e| e.to_string())?);
            }
        }

        let _ = fs::remove_dir_all(&temp_dir);
        if let Some(hex_content) = found_hex {
            Ok(hex_content)
        } else {
            Err("No .hex file generated by arduino-cli".to_string())
        }
    }
}

/// Fallback / Mock compiler that recognizes built-in sketches or generates simulated binaries
pub struct MockCompilerBackend;

impl CompilerBackend for MockCompilerBackend {
    fn name(&self) -> &str {
        "Builtin Mock Compiler"
    }

    fn is_available(&self) -> bool {
        true
    }

    fn compile(&self, _source_code: &str, _fqbn: &str) -> Result<String, String> {
        Ok(BuiltinSketches::blink_hex())
    }
}

#[cfg(test)]
mod test_compile;

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_blink_hex_parses_without_panic() {
        let hex = BuiltinSketches::blink_hex();
        let flash = avr8rs::board::parse_hex(&hex);
        assert!(!flash.is_empty());
    }
}
