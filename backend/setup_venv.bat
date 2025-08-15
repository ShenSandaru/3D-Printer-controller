@echo off
echo Setting up virtual environment...
python -m venv venv
echo.
echo Activating virtual environment...
call venv\Scripts\activate.bat
echo.
echo Installing dependencies...
pip install -r requirements.txt
echo.
echo Setup complete! 
echo To activate the virtual environment in future sessions, run:
echo   venv\Scripts\activate.bat
echo Then run: python app.py
pause
