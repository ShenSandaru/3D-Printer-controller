@echo off
echo Trying different methods to install Python packages...
echo.

echo Method 1: Using python -m pip
python -m pip install Flask Flask-CORS pyserial
if %errorlevel% == 0 (
    echo Success with python -m pip!
    goto :success
)

echo.
echo Method 2: Using py -m pip
py -m pip install Flask Flask-CORS pyserial
if %errorlevel% == 0 (
    echo Success with py -m pip!
    goto :success
)

echo.
echo Method 3: Using python3 -m pip
python3 -m pip install Flask Flask-CORS pyserial
if %errorlevel% == 0 (
    echo Success with python3 -m pip!
    goto :success
)

echo.
echo Method 4: Direct installation from requirements
python -m pip install -r requirements.txt
if %errorlevel% == 0 (
    echo Success with requirements file!
    goto :success
)

echo.
echo All methods failed. Please try:
echo 1. Reinstall Python from python.org
echo 2. Make sure to check "Add Python to PATH" during installation
echo 3. Or use: py -m ensurepip --upgrade
goto :end

:success
echo.
echo Dependencies installed successfully!
echo You can now run: python app.py
echo.

:end
pause
