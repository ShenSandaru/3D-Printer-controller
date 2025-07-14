# backend/app.py - FINAL PRODUCTION VERSION
from flask import Flask, jsonify, request, send_from_directory
from flask_cors import CORS
import serial
import time
import os
import threading
import re

app = Flask(__name__)
CORS(app)

# --- Setup ---
UPLOADS_DIR = 'uploads'
if not os.path.exists(UPLOADS_DIR):
    os.makedirs(UPLOADS_DIR)

# --- Global State ---
printer = None
print_thread = None
IS_PRINTING = False
PRINT_PROGRESS = 0
TOTAL_LINES = 0
CURRENT_FILE = ""

# --- Helper Functions ---
def get_printer_response():
    lines = []
    if printer and printer.is_open:
        while printer.in_waiting > 0:
            line = printer.readline().decode('utf-8').strip()
            if line: 
                lines.append(line)
    return lines

# --- API Endpoints ---
@app.route('/api/connect', methods=['POST'])
def connect_printer():
    global printer
    if printer and printer.is_open: 
        return jsonify(status='success', message='Already connected.')
    try:
        port = request.json.get('port', 'COM3')
        printer = serial.Serial(port, 250000, timeout=1)
        time.sleep(2)
        get_printer_response()  # Clear buffer
        return jsonify(status='success', message=f'Connected to printer on {port}')
    except serial.SerialException as e:
        return jsonify(status='error', message=str(e)), 500

@app.route('/api/disconnect', methods=['POST'])
def disconnect_printer():
    global printer, IS_PRINTING
    if IS_PRINTING:
        IS_PRINTING = False  # Stop any ongoing print
    if printer and printer.is_open: 
        printer.close()
    printer = None
    return jsonify(status='success', message='Disconnected.')

@app.route('/api/command', methods=['POST'])
def send_command():
    if not printer or not printer.is_open:
        return jsonify(status='error', message='Printer not connected.'), 400
    
    command = request.json.get('command')
    if not command:
        return jsonify(status='error', message='No command provided.'), 400
    
    printer.write(command.encode() + b'\n')
    time.sleep(0.1)  # Small delay for response
    response = get_printer_response()
    return jsonify(status='success', command=command, response=response)

@app.route('/api/status', methods=['GET'])
def get_status():
    if not printer or not printer.is_open:
        return jsonify(status='not_connected')

    printer.write(b'M105\n')
    time.sleep(0.1)  # Wait for response
    response_lines = get_printer_response()

    temps = { 'hotend_actual': 0, 'hotend_target': 0, 'bed_actual': 0, 'bed_target': 0 }
    for line in response_lines:
        if 'T:' in line:
            matches = re.findall(r'(\d+\.\d+)', line)
            if len(matches) >= 2:
                temps.update({'hotend_actual': float(matches[0]), 'hotend_target': float(matches[1])})
            if len(matches) >= 4:
                temps.update({'bed_actual': float(matches[2]), 'bed_target': float(matches[3])})
            break

    if IS_PRINTING:
        progress = (PRINT_PROGRESS / TOTAL_LINES) * 100 if TOTAL_LINES > 0 else 0
        return jsonify(status='printing', progress=round(progress, 2), filename=CURRENT_FILE, temperatures=temps)
    else:
        return jsonify(status='connected', progress=0, filename="", temperatures=temps)

# --- File Management API ---
@app.route('/api/files', methods=['GET'])
def list_files():
    files = [f for f in os.listdir(UPLOADS_DIR) if f.endswith(('.gcode', '.gco'))]
    return jsonify(files=files)

@app.route('/api/upload', methods=['POST'])
def upload_file():
    if 'file' not in request.files: 
        return jsonify(status='error', message='No file part'), 400
    file = request.files['file']
    if file and file.filename.endswith(('.gcode', '.gco')):
        file.save(os.path.join(UPLOADS_DIR, file.filename))
        return jsonify(status='success', message=f'File {file.filename} uploaded.')
    return jsonify(status='error', message='Invalid file type.'), 400

# --- Legacy G-code serving for 3D viewer ---
@app.route('/api/gcode/<filename>', methods=['GET'])
def get_gcode(filename):
    """Serves a G-code file from uploads directory or root for legacy files."""
    try:
        # Try uploads directory first
        if os.path.exists(os.path.join(UPLOADS_DIR, filename)):
            return send_from_directory(UPLOADS_DIR, filename)
        # Fall back to root directory for legacy files like sample.gcode
        return send_from_directory('.', filename)
    except FileNotFoundError:
        return jsonify(status='error', message='File not found.'), 404

# --- Print Streaming Logic ---
def print_job_thread(filepath):
    global IS_PRINTING, PRINT_PROGRESS, TOTAL_LINES
    try:
        with open(filepath, 'r') as f:
            gcode_lines = [line.strip() for line in f if line.strip() and not line.strip().startswith(';')]
            TOTAL_LINES = len(gcode_lines)

        IS_PRINTING = True
        PRINT_PROGRESS = 0

        for i, line in enumerate(gcode_lines):
            if not IS_PRINTING:
                if printer and printer.is_open:
                    printer.write(b'M104 S0\nM140 S0\nM84\n')  # Turn off heaters and motors
                print("Print cancelled.")
                break

            if printer and printer.is_open:
                printer.write(line.encode() + b'\n')
                # Wait for "ok" response
                timeout_count = 0
                while timeout_count < 50:  # 5 second timeout
                    response = printer.readline().decode('utf-8').strip()
                    if 'ok' in response.lower():
                        break
                    time.sleep(0.1)
                    timeout_count += 1
                
            PRINT_PROGRESS = i + 1
            time.sleep(0.01)  # Small delay between commands
            
    except Exception as e:
        print(f"Print error: {e}")
    finally:
        IS_PRINTING = False
        print("Print finished or stopped.")

@app.route('/api/print/start', methods=['POST'])
def start_print():
    global print_thread, CURRENT_FILE
    if IS_PRINTING: 
        return jsonify(status='error', message='Print already in progress.'), 400
    
    if not printer or not printer.is_open:
        return jsonify(status='error', message='Printer not connected.'), 400

    filename = request.json.get('filename')
    if not filename:
        return jsonify(status='error', message='No filename provided.'), 400
        
    filepath = os.path.join(UPLOADS_DIR, filename)
    if not os.path.exists(filepath): 
        return jsonify(status='error', message='File not found.'), 404

    CURRENT_FILE = filename
    print_thread = threading.Thread(target=print_job_thread, args=(filepath,))
    print_thread.start()

    return jsonify(status='success', message=f'Printing {filename}...')

@app.route('/api/print/cancel', methods=['POST'])
def cancel_print():
    global IS_PRINTING
    if not IS_PRINTING: 
        return jsonify(status='error', message='No active print.'), 400
    IS_PRINTING = False  # Signal the thread to stop
    return jsonify(status='success', message='Cancelling print...')

@app.route('/api/print/status', methods=['GET'])
def get_print_status():
    """Returns the current print status and progress"""
    if IS_PRINTING:
        progress = (PRINT_PROGRESS / TOTAL_LINES) * 100 if TOTAL_LINES > 0 else 0
        return jsonify(status='printing', progress=round(progress, 2), filename=CURRENT_FILE)
    else:
        return jsonify(status='idle', progress=0, filename='')

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000)
