# This script installs the python dependencies from requirements.txt

# The '&' is the call operator in PowerShell, used to execute a command.
# The path to the python executable is quoted to handle spaces in the path.
& "..\.venv\Scripts\python.exe" -m pip install -r requirements.txt

# Pause the script to see the output before the window closes.
Read-Host -Prompt "Press Enter to exit"
