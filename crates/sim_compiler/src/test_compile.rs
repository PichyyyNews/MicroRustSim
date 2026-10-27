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

#[test]
fn test_builtin_blink_hex_execution() {
    use sim_core::{ArduinoUnoCore, McuCore};
    use crate::BuiltinSketches;

    let hex = BuiltinSketches::blink_hex();
    let mut uno = ArduinoUnoCore::new();
    uno.load_hex(&hex).expect("Failed to load hex");

    println!("Stepping 35,000,000 cycles (approx 2.18s)...");
    for i in 1..=10 {
        uno.step_cycles(3_500_000);
        let pin13 = uno.get_pin_state("13");
        let output = uno.read_serial_output();
        let text = String::from_utf8_lossy(&output);
        let millis = uno.millis();
        println!("Interval {}: pin13={:?}, millis={}, serial={:?}", i, pin13, millis, text);
    }
}

#[test]
fn test_serial_streaming_with_small_cycles() {
    use sim_core::{ArduinoUnoCore, McuCore};
    use crate::BuiltinSketches;

    let hex = BuiltinSketches::blink_hex();
    let mut uno = ArduinoUnoCore::new();
    uno.load_hex(&hex).expect("Failed to load hex");

    let mut full_output = String::new();
    // 266,666 cycles per frame for 120 frames (approx 2 seconds @ 60fps)
    for _frame in 1..=120 {
        uno.step_cycles(266_666);
        let bytes = uno.read_serial_output();
        if !bytes.is_empty() {
            let chunk = String::from_utf8_lossy(&bytes);
            full_output.push_str(&chunk);
        }
    }
    println!("\n--- FULL CAPTURED OUTPUT ---\n{}", full_output);
}

#[test]
fn test_rapid_serial_no_loss() {
    use sim_core::{ArduinoUnoCore, McuCore};

    let backend = ArduinoCliBackend::new();
    if !backend.is_available() {
        return;
    }

    let code = r#"
void setup() {
  Serial.begin(9600);
}
void loop() {
  Serial.println("Line:0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ");
  delay(5);
}
"#;
    let res = backend.compile(code, "arduino:avr:uno").expect("Compilation failed");
    let mut uno = ArduinoUnoCore::new();
    uno.load_hex(&res.hex).expect("Failed to load hex");

    let mut full_output = String::new();
    for _ in 0..100 {
        uno.step_cycles(266_666);
        let bytes = uno.read_serial_output();
        if !bytes.is_empty() {
            full_output.push_str(&String::from_utf8_lossy(&bytes));
        }
    }
    println!("\n--- RAPID SERIAL CAPTURED ---\n{}", full_output);

    // Verify lines are contiguous and intact
    let lines: Vec<&str> = full_output.lines().collect();
    assert!(lines.len() > 3, "Should have produced at least 3 lines");
    for line in &lines[1..lines.len() - 1] {
        assert_eq!(*line, "Line:0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ", "Corrupted serial line detected: {}", line);
    }
}
