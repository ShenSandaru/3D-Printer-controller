@echo off
echo Starting 3D Printer Controller Frontend...
echo.

REM Kill any existing processes on Vite ports
echo Cleaning up any existing Vite processes...
call "%~dp0kill-ports.bat"

echo Opening browser at http://localhost:5173
echo Press Ctrl+C to stop the server
echo.

REM Start the development server with force flag and specific port
npx vite --port 5173 --force

pause
