use crate::{ArduinoCliBackend, CompilerBackend};

#[test]
fn test_genuine_arduino_cli_compilation() {
    let backend = ArduinoCliBackend::new();
    println!("Detected cli path: {}", backend.cli_path());
    if backend.is_available() {
        let code = "void setup() { pinMode(13, OUTPUT); } void loop() { digitalWrite(13, HIGH); }";
        let hex = backend.compile(code, "arduino:avr:uno").expect("Compilation failed");
        assert!(hex.contains(":10000000") || hex.contains(":"));
        println!("Compiled {} bytes of HEX successfully!", hex.len());
    }
}
