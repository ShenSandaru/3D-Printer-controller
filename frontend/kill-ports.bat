@echo off
echo ============================================
echo   Killing processes on Vite ports
echo ============================================
echo.

echo [1/4] Checking for processes on port 5173...
netstat -ano | findstr :5173 > nul
if %errorlevel% == 0 (
    echo     Found processes on port 5173, killing...
    for /f "tokens=5" %%i in ('netstat -ano ^| findstr :5173') do taskkill /PID %%i /F > nul 2>&1
    echo     ✓ Port 5173 cleared
) else (
    echo     ✓ Port 5173 is free
)

echo [2/4] Checking for processes on port 5174...
netstat -ano | findstr :5174 > nul
if %errorlevel% == 0 (
    echo     Found processes on port 5174, killing...
    for /f "tokens=5" %%i in ('netstat -ano ^| findstr :5174') do taskkill /PID %%i /F > nul 2>&1
    echo     ✓ Port 5174 cleared
) else (
    echo     ✓ Port 5174 is free
)

echo [3/4] Checking for processes on port 5175...
netstat -ano | findstr :5175 > nul
if %errorlevel% == 0 (
    echo     Found processes on port 5175, killing...
    for /f "tokens=5" %%i in ('netstat -ano ^| findstr :5175') do taskkill /PID %%i /F > nul 2>&1
    echo     ✓ Port 5175 cleared
) else (
    echo     ✓ Port 5175 is free
)

echo [4/4] Checking for processes on port 5176...
netstat -ano | findstr :5176 > nul
if %errorlevel% == 0 (
    echo     Found processes on port 5176, killing...
    for /f "tokens=5" %%i in ('netstat -ano ^| findstr :5176') do taskkill /PID %%i /F > nul 2>&1
    echo     ✓ Port 5176 cleared
) else (
    echo     ✓ Port 5176 is free
)

echo.
echo ============================================
echo   All Vite ports cleared successfully!
echo ============================================
echo.

REM Also kill any remaining Node.js processes that might be hanging
echo Cleaning up any hanging Node.js processes...
taskkill /f /im node.exe > nul 2>&1
echo ✓ Node.js cleanup complete
echo.
