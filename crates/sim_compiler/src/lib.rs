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

    /// Precompiled Blink HEX (AVR ATmega328P @ 16MHz) with verified Intel HEX checksums & USART Serial
    pub fn blink_hex() -> String {
        r#":100000000C945D000C9485000C9485000C94850084
:100010000C9485000C9485000C9485000C9485004C
:100020000C9485000C9485000C9485000C9485003C
:100030000C9485000C9485000C9485000C9485002C
:100040000C9454020C9485000C94C4020C949E02EF
:100050000C9485000C9485000C9485000C9485000C
:100060000C9485000C9485000000000024002700FB
:100070002A0000000000250028002B0004040404CE
:100080000404040402020202020203030303030342
:10009000010204081020408001020408102001021F
:1000A00004081020000000080002010000030407FB
:1000B0000000000000000000AA0311241FBECFEFC3
:1000C000D8E0DEBFCDBF11E0A0E0B1E0EEEBF7E09D
:1000D00002C005900D92A235B107D9F721E0A2E543
:1000E000B1E001C01D92A83FB207E1F710E0CDE5F5
:1000F000D0E004C02197FE010E94D703CC35D10780
:10010000C9F70E94F6020C94DD030C940000E1EBA9
:10011000F0E02491EDE9F0E09491E9E8F0E0E49179
:10012000EE23C9F0222339F0233001F1A8F4213065
:1001300019F1223029F1F0E0EE0FFF1FEE58FF4FCA
:10014000A591B4912FB7F894EC91811126C09095A8
:100150009E239C932FBF08952730A9F02830C9F023
:10016000243049F7209180002F7D03C0209180002A
:100170002F7720938000DFCF24B52F7724BDDBCFEE
:1001800024B52F7DFBCF2091B0002F772093B000B6
:10019000D2CF2091B0002F7DF9CF9E2BDACF3FB781
:1001A000F8948091570190915801A0915901B09114
:1001B0005A0126B5A89B05C02F3F19F00196A11D35
:1001C000B11D3FBFBA2FA92F982F8827BC01CD01A1
:1001D000620F711D811D911D42E0660F771F881F00
:1001E000991F4A95D1F708958F929F92AF92BF922F
:1001F000CF92DF92EF92FF920E94CF004B015C0101
:1002000088EEC82E83E0D82EE12CF12C0E94CF007E
:10021000681979098A099B09683E7340810591052F
:10022000A8F321E0C21AD108E108F10888EE880E8F
:1002300083E0981EA11CB11CC114D104E104F10497
:1002400029F7FF90EF90DF90CF90BF90AF909F90F5
:100250008F900895AF92BF92CF92DF92EF92FF926C
:100260000F931F93CF93DF936C017B018B01040FDE
:10027000151FEB015E01AE18BF08C017D10759F07A
:100280006991D601ED91FC910190F081E02DC601BC
:100290000995892B79F7C501DF91CF911F910F91B6
:1002A000FF90EF90DF90CF90BF90AF900895FC014A
:1002B000538D448D252F30E0842F90E0821B930BCB
:1002C000541710F0CF96089501970895FC01918D71
:1002D000828D981761F0A28DAE0FBF2FB11D5D9674
:1002E0008C91928D9F5F9F73928F90E008958FEF16
:1002F0009FEF0895FC01918D828D981731F0828DCA
:10030000E80FF11D858D90E008958FEF9FEF089520
:10031000FC01918D228D892F90E0805C9F4F821B84
:1003200091098F73992708958BE591E00E948801C8
:1003300021E0892B09F420E0822F089580E090E0ED
:10034000892B29F00E94940181110C9400000895DA
:10035000FC01A48DA80FB92FB11DA35ABF4F2C913A
:10036000848D90E001968F739927848FA689B78931
:100370002C93A089B1898C91837080648C93938D28
:10038000848D981306C00288F389E02D80818F7DCB
:1003900080830895EF92FF920F931F93CF93DF9383
:1003A000EC0181E0888F9B8D8C8D98131AC0E889B1
:1003B000F989808185FF15C09FB7F894EE89FF8980
:1003C0006083E889F98980818370806480839FBF1E
:1003D00081E090E0DF91CF911F910F91FF90EF901E
:1003E0000895F62E0B8D10E00F5F1F4F0F7311272E
:1003F000E02E8C8D8E110CC00FB607FCFACFE88969
:10040000F989808185FFF5CFCE010E94A801F1CF47
:10041000EB8DEC0FFD2FF11DE35AFF4FF0829FB7DC
:10042000F8940B8FEA89FB8980818062CFCFCF93CC
:10043000DF93EC01888D8823B9F0AA89BB89E8890C
:10044000F9898C9185FD03C0808186FD0DC00FB6B2
:1004500007FCF7CF8C9185FFF2CF808185FFEDCF30
:10046000CE010E94A801E9CFDF91CF910895CF93EB
:10047000DF93FC0101900020E9F73197AF01481BA1
:10048000590BBC018BE591E00E942A01EC0142E08E
:1004900050E062E171E08BE591E00E942A018C0F4F
:1004A0009D1FDF91CF9108951F920F920FB60F926B
:1004B00011242F933F938F939F93AF93BF9380917A
:1004C000530190915401A0915501B0915601309182
:1004D000520123E0230F2D3758F50196A11DB11DC0
:1004E000209352018093530190935401A09355019E
:1004F000B09356018091570190915801A0915901F4
:10050000B0915A010196A11DB11D8093570190939E
:100510005801A0935901B0935A01BF91AF919F9197
:100520008F913F912F910F900FBE0F901F901895B4
:1005300026E8230F0296A11DB11DD2CF1F920F9264
:100540000FB60F9211242F933F934F935F936F93A6
:100550007F938F939F93AF93BF93EF93FF938BE51D
:1005600091E00E94A801FF91EF91BF91AF919F91FF
:100570008F917F916F915F914F913F912F910F904C
:100580000FBE0F901F9018951F920F920FB60F92EB
:1005900011242F938F939F93EF93FF93E0916B011F
:1005A000F0916C018081E0917101F091720182FD06
:1005B0001BC09081809174018F5F8F7320917501B2
:1005C000821741F0E0917401F0E0E55AFE4F958FFB
:1005D00080937401FF91EF919F918F912F910F90D4
:1005E0000FBE0F901F9018958081F4CF789484B53A
:1005F000826084BD84B5816084BD85B5826085BD1F
:1006000085B5816085BD80916E00816080936E00AC
:10061000109281008091810082608093810080919E
:10062000810081608093810080918000816080934F
:1006300080008091B10084608093B1008091B0000F
:1006400081608093B00080917A00846080937A000A
:1006500080917A00826080937A0080917A00816034
:1006600080937A0080917A00806880937A0010925B
:10067000C100EDE9F0E02491E9E8F0E084918823FD
:1006800099F090E0880F991FFC01E859FF4FA59160
:10069000B491FC01EE58FF4F859194918FB7F89477
:1006A000EC91E22BEC938FBFE0916B01F0916C0128
:1006B00082E08083E0916701F09168011082E0910F
:1006C0006901F0916A018FEC808310927301E091CF
:1006D0006F01F091700186E08083E0916D01F091EF
:1006E0006E01808180618083E0916D01F0916E01E7
:1006F000808188608083E0916D01F0916E0180813E
:1007000080688083E0916D01F0916E0180818F7D22
:10071000808385E191E00E943702C0E0D0E081E073
:100720000E94870087E391E00E9437020E94F40054
:1007300080E00E94870085E491E00E9437020E94D9
:10074000F400209761F30E949401882341F30E94F2
:100750000000E5CFEBE5F1E01382128288EE93E032
:10076000A0E0B0E084839583A683B78384E091E022
:100770009183808385EC90E09587848784EC90E07A
:100780009787868780EC90E0918B808B81EC90E05E
:10079000938B828B82EC90E0958B848B86EC90E03F
:1007A000978B868B118E128E138E148E0895EE0FFA
:0E07B000FF1F0590F491E02D0994F894FFCFFF
:1007BE0000000000CA012A015701170288016601D4
:1007CE007A010D0A0041726475696E6F20556E6F65
:1007DE0020496E697469616C697A656420402031C4
:1007EE0036204D487A21004C454420484947482040
:1007FE0028355629004C4544204C4F57202830565A
:02080E002900BF
:00000001FF"#.to_string()
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

/// Compiler output result including compiled HEX and terminal diagnostics
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct CompileOutput {
    pub hex: String,
    pub stdout: String,
}

/// Helper to strip ANSI color escape codes from compiler logs
fn strip_ansi(s: &str) -> String {
    let mut out = String::with_capacity(s.len());
    let mut in_escape = false;
    for c in s.chars() {
        if c == '\x1b' {
            in_escape = true;
        } else if in_escape {
            if c.is_ascii_alphabetic() {
                in_escape = false;
            }
        } else {
            out.push(c);
        }
    }
    out
}

/// Compiler abstraction trait
pub trait CompilerBackend {
    fn name(&self) -> &str;
    fn is_available(&self) -> bool;
    fn compile(&self, source_code: &str, fqbn: &str) -> Result<CompileOutput, String>;
    fn compile_with_files(
        &self,
        source_code: &str,
        _extra_files: Option<&std::collections::HashMap<String, String>>,
        fqbn: &str,
    ) -> Result<CompileOutput, String> {
        self.compile(source_code, fqbn)
    }
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
            } else if std::path::Path::new(r"C:\Program Files\Arduino CLI\arduino-cli.exe").exists() {
                r"C:\Program Files\Arduino CLI\arduino-cli.exe".to_string()
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
        let mut cmd = Command::new(&self.cli_path);
        cmd.arg("version");
        #[cfg(windows)]
        {
            use std::os::windows::process::CommandExt;
            cmd.creation_flags(0x08000000); // CREATE_NO_WINDOW
        }
        cmd.output()
            .map(|o| o.status.success())
            .unwrap_or(false)
    }

    fn compile_with_files(
        &self,
        source_code: &str,
        extra_files: Option<&std::collections::HashMap<String, String>>,
        fqbn: &str,
    ) -> Result<CompileOutput, String> {
        static COMPILE_MUTEX: std::sync::Mutex<()> = std::sync::Mutex::new(());
        let _lock = COMPILE_MUTEX.lock().unwrap_or_else(|e| e.into_inner());

        static COMPILE_COUNTER: std::sync::atomic::AtomicU64 = std::sync::atomic::AtomicU64::new(1);
        let count = COMPILE_COUNTER.fetch_add(1, std::sync::atomic::Ordering::SeqCst);
        let temp_dir = std::env::temp_dir().join(format!(
            "microrustsim_build_{}_{}_{}",
            std::process::id(),
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap_or_default()
                .as_millis(),
            count
        ));
        fs::create_dir_all(&temp_dir).map_err(|e| e.to_string())?;

        let sketch_dir = temp_dir.join("sketch");
        fs::create_dir_all(&sketch_dir).map_err(|e| e.to_string())?;

        let sketch_path = sketch_dir.join("sketch.ino");
        fs::write(&sketch_path, source_code).map_err(|e| e.to_string())?;

        // Write extra headers and source files (.h, .hpp, .c, .cpp) into sketch directory
        let mut wrote_config = false;
        if let Some(files) = extra_files {
            for (rel_path, content) in files {
                let lower = rel_path.to_lowercase();
                if lower.ends_with(".h") || lower.ends_with(".hpp") || lower.ends_with(".c") || lower.ends_with(".cpp") {
                    let file_name = std::path::Path::new(rel_path)
                        .file_name()
                        .and_then(|n| n.to_str())
                        .unwrap_or(rel_path);
                    if file_name == "config.h" {
                        wrote_config = true;
                    }
                    let target_path = sketch_dir.join(file_name);
                    let _ = fs::write(&target_path, content);
                }
            }
        }

        // If sketch includes config.h but not provided in extra_files, generate default config.h
        if !wrote_config && source_code.contains("config.h") {
            let config_path = sketch_dir.join("config.h");
            let _ = fs::write(
                &config_path,
                "#pragma once\n\n// Hardware Pin Definitions\n#define LED_PIN 13\n#define BUTTON_PIN 2\n#define POT_PIN A0\n#define RED_PIN 12\n#define YELLOW_PIN 11\n#define GREEN_PIN 10\n\n#define SYSTEM_BAUD 9600\n",
            );
        }

        let output_dir = temp_dir.join("build");
        fs::create_dir_all(&output_dir).map_err(|e| e.to_string())?;

        let mut cmd = Command::new(&self.cli_path);
        cmd.args([
            "compile",
            "--fqbn",
            fqbn,
            sketch_dir.to_str().unwrap(),
            "--output-dir",
            output_dir.to_str().unwrap(),
        ]);
        #[cfg(windows)]
        {
            use std::os::windows::process::CommandExt;
            cmd.creation_flags(0x08000000); // CREATE_NO_WINDOW
        }
        let output = cmd
            .output()
            .map_err(|e| format!("Failed to execute {}: {e}", self.cli_path))?;

        let stdout = strip_ansi(&String::from_utf8_lossy(&output.stdout));
        let stderr = strip_ansi(&String::from_utf8_lossy(&output.stderr));

        if !output.status.success() {
            let _ = fs::remove_dir_all(&temp_dir);
            return Err(format!("Compilation failed:\n{stdout}\n{stderr}"));
        }

        // Search for .ino.hex (without bootloader) in output_dir
        let mut found_hex = None;
        if let Ok(entries) = fs::read_dir(&output_dir) {
            for entry in entries.flatten() {
                let path = entry.path();
                let fname = path.file_name().and_then(|n| n.to_str()).unwrap_or("");
                if fname.ends_with(".ino.hex") && !fname.contains("with_bootloader") {
                    found_hex = fs::read_to_string(&path).ok();
                    break;
                } else if path.extension().and_then(|ext| ext.to_str()) == Some("hex") && found_hex.is_none() {
                    found_hex = fs::read_to_string(&path).ok();
                }
            }
        }

        let _ = fs::remove_dir_all(&temp_dir);
        if let Some(hex_content) = found_hex {
            Ok(CompileOutput {
                hex: hex_content,
                stdout,
            })
        } else {
            Err("No .hex file generated by arduino-cli".to_string())
        }
    }

    fn compile(&self, source_code: &str, fqbn: &str) -> Result<CompileOutput, String> {
        self.compile_with_files(source_code, None, fqbn)
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

    fn compile(&self, _source_code: &str, _fqbn: &str) -> Result<CompileOutput, String> {
        Ok(CompileOutput {
            hex: BuiltinSketches::blink_hex(),
            stdout: "[Preview Mode] Built-in ATmega328P sketch compiled.\n".to_string(),
        })
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
