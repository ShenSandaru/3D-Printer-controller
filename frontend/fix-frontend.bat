@echo off
REM Fix Frontend Vite EPERM Errors - Windows Script
REM This script resolves common Vite permission and cache issues on Windows

echo ============================================
echo   3D Printer Controller - Frontend Fix
echo ============================================
echo.

echo [1/4] Stopping any running Node.js processes...
taskkill /f /im node.exe >nul 2>&1
echo     ✓ Node processes stopped

echo.
echo [2/4] Clearing Vite cache directories...
cd /d "%~dp0"
if exist "node_modules\.vite" rmdir /s /q "node_modules\.vite" >nul 2>&1
if exist ".vite" rmdir /s /q ".vite" >nul 2>&1
if exist ".vite-cache" rmdir /s /q ".vite-cache" >nul 2>&1
echo     ✓ Cache directories cleared

echo.
echo [3/4] Cleaning npm cache...
npm cache clean --force >nul 2>&1
echo     ✓ NPM cache cleaned

echo.
echo [4/4] Starting development server with force flag...
echo     Starting Vite on http://localhost:5173/
echo     Press Ctrl+C to stop the server
echo.

npm run dev:force

pause
