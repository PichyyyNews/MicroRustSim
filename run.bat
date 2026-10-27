@echo off
title MicroRustSim Dev Runner
echo ==============================================
echo   Starting MicroRustSim (Pure Rust + egui)
echo ==============================================
cargo run --bin microrustsim
if %errorlevel% neq 0 (
    echo.
    echo Application exited with error code %errorlevel%
    pause
)
