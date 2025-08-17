# backend/app.py - CLEAN PRODUCTION VERSION
from flask import Flask, jsonify, request, send_from_directory
from flask_cors import CORS
import serial
import time
import os
import threading
import re
import logging
import serial.tools.list_ports

app = Flask(__name__)
CORS(app)

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# --- Setup ---
UPLOADS_DIR = 'uploads'
if not os.path.exists(UPLOADS_DIR):
    os.makedirs(UPLOADS_DIR)

# --- Global State ---
printer = None
print_thread = None
IS_PRINTING = False
IS_PAUSED = False
PRINT_PROGRESS = 0
TOTAL_LINES = 0
CURRENT_FILE = ""
PRINT_ERROR = None

# --- Helper Functions ---
def get_printer_response():
    lines = []
    if printer and printer.is_open:
        while printer.in_waiting > 0:
            try:
                line = printer.readline().decode('utf-8', errors='ignore').strip()
                if line: 
                    lines.append(line)
            except Exception as e:
                logger.warning(f"Error reading printer response: {e}")
                break
    return lines

# --- API Endpoints ---
@app.route('/api/connect', methods=['POST'])
def connect_printer():
    global printer
    if printer and printer.is_open: 
        return jsonify(status='success', message='Already connected.')
    try:
        data = request.get_json()
        port = data.get('port') if data else 'COM3'
        baud_rate = data.get('baud_rate') if data else 250000
        
        logger.info(f"Attempting to connect to printer on {port} at {baud_rate} baud")
        printer = serial.Serial(port, baud_rate, timeout=2)
        time.sleep(3)  # Give printer time to initialize
        get_printer_response()  # Clear buffer
        
        logger.info(f"Successfully connected to printer on {port}")
        return jsonify(status='success', message=f'Connected to printer on {port}')
    except serial.SerialException as e:
        logger.error(f"Failed to connect to printer: {str(e)}")
        return jsonify(status='error', message=f'Connection failed: {str(e)}'), 400
    except Exception as e:
        logger.error(f"Unexpected error during connection: {str(e)}")
        return jsonify(status='error', message=f'Unexpected error: {str(e)}'), 500

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
        return jsonify(status='not_connected', error=PRINT_ERROR)

    try:
        printer.write(b'M105\n')
        time.sleep(0.1)  # Wait for response
        response_lines = get_printer_response()

        temps = { 'hotend_actual': 0, 'hotend_target': 0, 'bed_actual': 0, 'bed_target': 0 }
        for line in response_lines:
            if 'T:' in line:
                # Parse temperature response: T:25.0 /0.0 B:25.0 /0.0
                temp_match = re.search(r'T:(\d+\.?\d*)\s*/(\d+\.?\d*).*B:(\d+\.?\d*)\s*/(\d+\.?\d*)', line)
                if temp_match:
                    temps.update({
                        'hotend_actual': float(temp_match.group(1)),
                        'hotend_target': float(temp_match.group(2)),
                        'bed_actual': float(temp_match.group(3)),
                        'bed_target': float(temp_match.group(4))
                    })
                break

        base_status = {
            'temperatures': temps,
            'is_paused': IS_PAUSED,
            'error': PRINT_ERROR
        }

        if IS_PRINTING:
            progress = (PRINT_PROGRESS / TOTAL_LINES) * 100 if TOTAL_LINES > 0 else 0
            print_status = 'paused' if IS_PAUSED else 'printing'
            base_status.update({
                'status': print_status,
                'progress': round(progress, 2),
                'filename': CURRENT_FILE,
                'current_line': PRINT_PROGRESS,
                'total_lines': TOTAL_LINES,
            })
        elif PRINT_ERROR:
            base_status.update({
                'status': 'error',
                'progress': (PRINT_PROGRESS / TOTAL_LINES) * 100 if TOTAL_LINES > 0 else 0,
                'filename': CURRENT_FILE,
                'current_line': PRINT_PROGRESS,
                'total_lines': TOTAL_LINES,
            })
        else:
            base_status.update({
                'status': 'connected',
                'progress': 0,
                'filename': "",
                'current_line': 0,
                'total_lines': 0,
            })
        
        return jsonify(base_status)
    
    except Exception as e:
        logger.error(f"Error getting status: {str(e)}")
        return jsonify(status='error', message=f'Status check failed: {str(e)}'), 500

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
    global IS_PRINTING, IS_PAUSED, PRINT_PROGRESS, TOTAL_LINES, PRINT_ERROR
    try:
        logger.info(f"Starting print job: {filepath}")
        PRINT_ERROR = None
        
        # Read G-code file
        with open(filepath, 'r') as f:
            gcode_lines = []
            for line in f:
                line = line.strip()
                if line and not line.startswith(';'):  # Skip empty lines and comments
                    gcode_lines.append(line)
            
            TOTAL_LINES = len(gcode_lines)
            logger.info(f"Total G-code lines: {TOTAL_LINES}")

        IS_PRINTING = True
        IS_PAUSED = False
        PRINT_PROGRESS = 0

        # Send initial setup commands
        if printer and printer.is_open:
            setup_commands = ['G21', 'G90', 'M83']  # mm units, absolute positioning, relative extruder
            for cmd in setup_commands:
                printer.write(f'{cmd}\n'.encode())
                time.sleep(0.1)
                get_printer_response()  # Clear responses

        for i, line in enumerate(gcode_lines):
            # Check if print is cancelled
            if not IS_PRINTING:
                logger.info("Print cancelled by user")
                if printer and printer.is_open:
                    printer.write(b'M104 S0\n')  # Turn off hotend
                    time.sleep(0.1)
                    printer.write(b'M140 S0\n')  # Turn off bed
                    time.sleep(0.1)
                    printer.write(b'M84\n')     # Disable motors
                break

            # Handle pause
            while IS_PAUSED and IS_PRINTING:
                logger.info("Print paused, waiting...")
                time.sleep(0.5)
            
            if not IS_PRINTING:  # Check again after pause
                break

            if printer and printer.is_open:
                try:
                    logger.debug(f"Sending G-code line {i+1}/{TOTAL_LINES}: {line}")
                    printer.write(line.encode() + b'\n')
                    
                    # Wait for acknowledgment with appropriate timeout
                    timeout_seconds = 10  # Default timeout
                    if line.startswith('M190'):  # Bed heating
                        timeout_seconds = 300  # 5 minutes
                    elif line.startswith('M109'):  # Hotend heating
                        timeout_seconds = 180  # 3 minutes
                    elif line.startswith('G28'):  # Homing
                        timeout_seconds = 60   # 1 minute
                    elif line.startswith('G29'):  # Auto bed leveling
                        timeout_seconds = 120  # 2 minutes
                    
                    timeout_count = 0
                    max_timeout = timeout_seconds * 10  # 0.1 second intervals
                    response_received = False
                    
                    while timeout_count < max_timeout and not response_received:
                        if not IS_PRINTING:  # Check if cancelled during wait
                            break
                            
                        if printer.in_waiting > 0:
                            response = printer.readline().decode('utf-8', errors='ignore').strip()
                            if response:
                                logger.debug(f"Printer response: {response}")
                                if 'ok' in response.lower():
                                    response_received = True
                                    break
                                elif 'error' in response.lower():
                                    logger.error(f"Printer error on line {i+1}: {response}")
                                    PRINT_ERROR = f"Printer error on line {i+1}: {response}"
                                    IS_PRINTING = False
                                    return
                        
                        time.sleep(0.1)
                        timeout_count += 1
                    
                    if not response_received and IS_PRINTING:
                        logger.warning(f"Timeout waiting for response on line {i+1}: {line}")
                        # Continue anyway for non-critical commands
                        if line.startswith(('M190', 'M109', 'G28', 'G29')):
                            logger.error(f"Critical command timeout on line {i+1}")
                            PRINT_ERROR = f"Timeout on critical command: {line}"
                            IS_PRINTING = False
                            return
                        
                except Exception as e:
                    logger.error(f"Error sending line {i+1}: {str(e)}")
                    PRINT_ERROR = f"Error on line {i+1}: {str(e)}"
                    IS_PRINTING = False
                    return
                
            PRINT_PROGRESS = i + 1
            
            # Variable delay based on command type
            if line.startswith(('M190', 'M109')):
                time.sleep(0.5)  # Longer delay for heating commands
            elif line.startswith(('G0', 'G1')):
                time.sleep(0.02)  # Short delay for movement
            else:
                time.sleep(0.1)   # Standard delay
            
        if IS_PRINTING:
            logger.info("Print job completed successfully")
        
    except Exception as e:
        logger.error(f"Print job error: {str(e)}")
        PRINT_ERROR = f"Print job failed: {str(e)}"
    finally:
        IS_PRINTING = False
        IS_PAUSED = False
        logger.info("Print job thread finished")

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
    global IS_PRINTING, IS_PAUSED
    if not IS_PRINTING: 
        return jsonify(status='error', message='No active print job'), 400
        
    try:
        logger.info("Cancelling print job")
        IS_PRINTING = False  # Signal the thread to stop
        IS_PAUSED = False    # Reset pause state
        return jsonify(status='success', message='Print job cancelled')
    except Exception as e:
        logger.error(f"Error cancelling print: {str(e)}")
        return jsonify(status='error', message=f'Cancel failed: {str(e)}'), 500

@app.route('/api/print/pause', methods=['POST'])
def pause_print():
    global IS_PAUSED
    if not IS_PRINTING:
        return jsonify(status='error', message='No active print job'), 400
    
    try:
        IS_PAUSED = True
        logger.info("Print job paused")
        return jsonify(status='success', message='Print job paused')
    except Exception as e:
        logger.error(f"Error pausing print: {str(e)}")
        return jsonify(status='error', message=f'Pause failed: {str(e)}'), 500

@app.route('/api/print/resume', methods=['POST'])
def resume_print():
    global IS_PAUSED
    if not IS_PRINTING:
        return jsonify(status='error', message='No active print job'), 400
    
    if not IS_PAUSED:
        return jsonify(status='error', message='Print job is not paused'), 400
    
    try:
        IS_PAUSED = False
        logger.info("Print job resumed")
        return jsonify(status='success', message='Print job resumed')
    except Exception as e:
        logger.error(f"Error resuming print: {str(e)}")
        return jsonify(status='error', message=f'Resume failed: {str(e)}'), 500

@app.route('/api/print/status', methods=['GET'])
def get_print_status():
    """Returns the current print status and progress"""
    if IS_PRINTING:
        progress = (PRINT_PROGRESS / TOTAL_LINES) * 100 if TOTAL_LINES > 0 else 0
        return jsonify(status='printing', progress=round(progress, 2), filename=CURRENT_FILE)
    else:
        return jsonify(status='idle', progress=0, filename='')

@app.route('/api/ports', methods=['GET'])
def list_available_ports():
    """List all available serial ports"""
    try:
        ports = serial.tools.list_ports.comports()
        available_ports = []
        
        for port in ports:
            port_info = {
                'port': port.device,
                'description': port.description,
                'manufacturer': getattr(port, 'manufacturer', 'Unknown'),
                'product': getattr(port, 'product', 'Unknown'),
                'is_printer': any(keyword in port.description.lower() 
                                for keyword in ['arduino', 'ch340', 'cp210', 'ftdi', 'usb serial'])
            }
            available_ports.append(port_info)
        
        logger.info(f"Found {len(available_ports)} available ports")
        return jsonify(status='success', ports=available_ports)
        
    except Exception as e:
        logger.error(f"Error listing ports: {str(e)}")
        return jsonify(status='error', message=f'Failed to list ports: {str(e)}'), 500

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000)
