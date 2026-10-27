@echo off
title MicroRustSim (Tauri v2 + Rust)
echo ==============================================
echo   Starting MicroRustSim (Tauri v2 + Rust)
echo ==============================================
echo Starting Tauri v2 Desktop App with React + Monaco Editor...
call npx.cmd @tauri-apps/cli dev
if %errorlevel% neq 0 (
    echo.
    echo Application exited with code %errorlevel%
    echo Tip: You can also preview the web frontend directly with 'npm run dev'
    pause
)
