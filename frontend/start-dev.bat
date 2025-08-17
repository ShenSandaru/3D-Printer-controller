@echo off
echo Starting 3D Printer Controller Frontend...
echo.

REM Kill any existing processes on Vite ports
echo Cleaning up any existing Vite processes...
call "%~dp0kill-ports.bat"

REM Clear Vite cache to prevent permission issues on OneDrive
echo Clearing Vite cache to prevent permission issues...
call npm run clean:cache

echo Opening browser at http://localhost:5173
echo Press Ctrl+C to stop the server
echo.

REM Start the development server with force flag to bypass cache issues
call npm run dev:force

pause
