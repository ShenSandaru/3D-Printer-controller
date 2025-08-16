@echo off
echo ========================================
echo 3D Printer Controller - Garbage Value Fix
echo ========================================
echo.

echo Creating backup of current app.py...
copy app.py app_backup_%date:~-4,4%%date:~-10,2%%date:~-7,2%.py >nul
if errorlevel 1 (
    echo ERROR: Failed to create backup!
    pause
    exit /b 1
)

echo Replacing app.py with improved version...
copy improved_app.py app.py >nul
if errorlevel 1 (
    echo ERROR: Failed to replace app.py!
    pause
    exit /b 1
)

echo.
echo ========================================
echo SUCCESS: Garbage Value Protection Applied!
echo ========================================
echo.
echo Changes implemented:
echo - Enhanced command verification with checksums
echo - Improved buffer cleanup to prevent garbage data
echo - G-code validation to filter out invalid commands
echo - Better error handling and timeout management
echo - Enhanced logging for debugging issues
echo.
echo The improved version includes:
echo 1. Buffer overflow prevention
echo 2. Command integrity verification
echo 3. Enhanced G-code validation
echo 4. Better serial communication handling
echo 5. Debugging endpoints for monitoring
echo.
echo You can now restart your application.
echo.
pause
