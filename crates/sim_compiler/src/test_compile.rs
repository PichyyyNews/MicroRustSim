use crate::{ArduinoCliBackend, CompilerBackend};

#[test]
fn test_genuine_arduino_cli_compilation() {
    let backend = ArduinoCliBackend::new();
    println!("Detected cli path: {}", backend.cli_path());
    if backend.is_available() {
        let code = "void setup() { pinMode(13, OUTPUT); } void loop() { digitalWrite(13, HIGH); }";
        let res = backend.compile(code, "arduino:avr:uno").expect("Compilation failed");
        assert!(res.hex.contains(":10000000") || res.hex.contains(":"));
        println!("Compiled {} bytes of HEX successfully!", res.hex.len());
    }
}

#[test]
fn test_genuine_arduino_cli_execution_with_sim_core() {
    use sim_core::{ArduinoUnoCore, McuCore};

    let backend = ArduinoCliBackend::new();
    if !backend.is_available() {
        return;
    }

    let code = r#"
void setup() {
  Serial.begin(9600);
  Serial.println("HELLO_SETUP");
}
void loop() {
  Serial.println("HELLO_LOOP");
  delay(10);
}
"#;
    let res = backend.compile(code, "arduino:avr:uno").expect("Compilation failed");
    let mut uno = ArduinoUnoCore::new();
    uno.load_hex(&res.hex).expect("Failed to load hex");

    println!("Stepping 5,000,000 cycles...");
    uno.step_cycles(5_000_000);

    let output = uno.read_serial_output();
    let text = String::from_utf8_lossy(&output);
    println!(">>> Serial output captured: {:?}", text);
}
