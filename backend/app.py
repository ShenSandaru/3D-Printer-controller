# backend/app.py - PRODUCTION VERSION
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

# Configure logging for production
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
CURRENT_POSITION = {'x': 0.0, 'y': 0.0, 'z': 0.0, 'e': 0.0}
PRINTER_STATUS = {
    'state': 'disconnected',
    'temperatures': {},
    'position': CURRENT_POSITION,
    'feedrate': 100,
    'flowrate': 100,
    'fanspeed': 0
}

# --- Helper Functions ---
def parse_position_from_response(response_line):
    """Parse position information from M114 response"""
    global CURRENT_POSITION
    try:
        if 'X:' in response_line and 'Y:' in response_line:
            parts = response_line.split()
            for part in parts:
                if part.startswith('X:'):
                    CURRENT_POSITION['x'] = float(part[2:])
                elif part.startswith('Y:'):
                    CURRENT_POSITION['y'] = float(part[2:])
                elif part.startswith('Z:'):
                    CURRENT_POSITION['z'] = float(part[2:])
                elif part.startswith('E:'):
                    CURRENT_POSITION['e'] = float(part[2:])
    except ValueError:
        pass  # Ignore parsing errors

def parse_temperature_from_response(response_line):
    """Parse temperature information from M105 response"""
    global PRINTER_STATUS
    try:
        if 'T:' in response_line:
            # Example: T:210.2 /210.0 B:60.1 /60.0
            parts = response_line.split()
            for part in parts:
                if part.startswith('T:'):
                    temp_data = part[2:].split('/')
                    PRINTER_STATUS['temperatures']['extruder'] = {
                        'current': float(temp_data[0]),
                        'target': float(temp_data[1]) if len(temp_data) > 1 else 0
                    }
                elif part.startswith('B:'):
                    temp_data = part[2:].split('/')
                    PRINTER_STATUS['temperatures']['bed'] = {
                        'current': float(temp_data[0]),
                        'target': float(temp_data[1]) if len(temp_data) > 1 else 0
                    }
    except (ValueError, IndexError):
        pass  # Ignore parsing errors

def get_printer_response():
    lines = []
    if printer and printer.is_open:
        while printer.in_waiting > 0:
            try:
                line = printer.readline().decode('utf-8', errors='ignore').strip()
                if line: 
                    lines.append(line)
                    # Parse useful information from responses
                    parse_position_from_response(line)
                    parse_temperature_from_response(line)
            except UnicodeDecodeError:
                # Skip lines that can't be decoded as UTF-8
                logger.warning("Skipped line with invalid UTF-8 characters")
                continue
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
        # Initialize printer status
        PRINTER_STATUS['state'] = 'connected'
        # Request initial position and temperature
        if printer.is_open:
            printer.write(b'M114\n')  # Get position
            time.sleep(0.1)
            printer.write(b'M105\n')  # Get temperature
            get_printer_response()
        
        return jsonify(status='success', message=f'Connected to printer on {port}')
    except serial.SerialException as e:
        logger.error(f"Failed to connect to printer: {str(e)}")
        return jsonify(status='error', message=f'Connection failed: {str(e)}'), 500
    except Exception as e:
        logger.error(f"Unexpected error during connection: {str(e)}")
        return jsonify(status='error', message=f'Unexpected error: {str(e)}'), 500

@app.route('/api/disconnect', methods=['POST'])
def disconnect_printer():
    global printer, IS_PRINTING, IS_PAUSED, PRINTER_STATUS
    try:
        if IS_PRINTING:
            logger.info("Stopping active print job before disconnecting")
            IS_PRINTING = False  # Stop any ongoing print
            IS_PAUSED = False    # Reset pause state
            time.sleep(1)  # Give print thread time to stop
            
        if printer and printer.is_open: 
            logger.info("Disconnecting from printer")
            printer.close()
        printer = None
        PRINTER_STATUS['state'] = 'disconnected'
        return jsonify(status='success', message='Disconnected successfully.')
    except Exception as e:
        logger.error(f"Error during disconnection: {str(e)}")
        return jsonify(status='error', message=f'Disconnection error: {str(e)}'), 500

@app.route('/api/command', methods=['POST'])
def send_command():
    if not printer or not printer.is_open:
        return jsonify(status='error', message='Printer not connected.'), 400
    
    try:
        data = request.get_json()
        command = data.get('command') if data else None
        
        if not command:
            return jsonify(status='error', message='No command provided.'), 400
        
        logger.info(f"Sending command: {command}")
        printer.write(command.encode() + b'\n')
        time.sleep(0.2)  # Wait for response
        response = get_printer_response()
        
        return jsonify(status='success', command=command, response=response)
    except Exception as e:
        logger.error(f"Error sending command: {str(e)}")
        return jsonify(status='error', message=f'Command failed: {str(e)}'), 500

@app.route('/api/status', methods=['GET'])
def get_status():
    if not printer or not printer.is_open:
        return jsonify(status='not_connected')

    try:
        printer.write(b'M105\n')
        time.sleep(0.2)  # Wait for response
        response_lines = get_printer_response()

        temps = {'hotend_actual': 0, 'hotend_target': 0, 'bed_actual': 0, 'bed_target': 0}
        
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

        if IS_PRINTING:
            progress = (PRINT_PROGRESS / TOTAL_LINES) * 100 if TOTAL_LINES > 0 else 0
            print_status = 'paused' if IS_PAUSED else 'printing'
            return jsonify(
                status=print_status, 
                progress=round(progress, 2), 
                filename=CURRENT_FILE, 
                temperatures=temps,
                current_line=PRINT_PROGRESS,
                total_lines=TOTAL_LINES,
                is_paused=IS_PAUSED
            )
        else:
            return jsonify(
                status='connected', 
                progress=0, 
                filename="", 
                temperatures=temps,
                is_paused=False
            )
            
    except Exception as e:
        logger.error(f"Error getting status: {str(e)}")
        return jsonify(status='error', message=f'Status check failed: {str(e)}'), 500

# --- Enhanced API Endpoints ---
@app.route('/api/position', methods=['GET'])
def get_position():
    """Get current printer position"""
    if not printer or not printer.is_open:
        return jsonify(status='error', message='Printer not connected.'), 400
    
    try:
        printer.write(b'M114\n')  # Get current position
        time.sleep(0.2)
        get_printer_response()  # This will update CURRENT_POSITION
        
        return jsonify(
            status='success',
            position=CURRENT_POSITION
        )
    except Exception as e:
        logger.error(f"Error getting position: {str(e)}")
        return jsonify(status='error', message=f'Position check failed: {str(e)}'), 500

@app.route('/api/move', methods=['POST'])
def move_axis():
    """Move printer axis with specified parameters"""
    if not printer or not printer.is_open:
        return jsonify(status='error', message='Printer not connected.'), 400
    
    try:
        data = request.get_json()
        axis = data.get('axis', '').upper()
        distance = data.get('distance', 0)
        feedrate = data.get('feedrate', 3000)
        relative = data.get('relative', True)
        
        if axis not in ['X', 'Y', 'Z', 'E']:
            return jsonify(status='error', message='Invalid axis. Use X, Y, Z, or E.'), 400
        
        # Build G-code command
        if relative:
            command = f"G91 G1 {axis}{distance} F{feedrate} G90"
        else:
            command = f"G90 G1 {axis}{distance} F{feedrate}"
        
        logger.info(f"Moving {axis} axis: {command}")
        printer.write(command.encode() + b'\n')
        time.sleep(0.1)
        response = get_printer_response()
        
        return jsonify(status='success', command=command, response=response)
    except Exception as e:
        logger.error(f"Error moving axis: {str(e)}")
        return jsonify(status='error', message=f'Move failed: {str(e)}'), 500

@app.route('/api/home', methods=['POST'])
def home_axes():
    """Home specified axes"""
    if not printer or not printer.is_open:
        return jsonify(status='error', message='Printer not connected.'), 400
    
    try:
        data = request.get_json()
        axes = data.get('axes', 'XYZ').upper()
        
        # Validate axes
        valid_axes = set('XYZE')
        if not all(axis in valid_axes for axis in axes):
            return jsonify(status='error', message='Invalid axes. Use combination of X, Y, Z, E.'), 400
        
        command = f"G28 {' '.join(axes)}"
        logger.info(f"Homing axes: {command}")
        printer.write(command.encode() + b'\n')
        time.sleep(2)  # Homing takes longer
        response = get_printer_response()
        
        return jsonify(status='success', command=command, response=response)
    except Exception as e:
        logger.error(f"Error homing axes: {str(e)}")
        return jsonify(status='error', message=f'Homing failed: {str(e)}'), 500

@app.route('/api/extruder', methods=['POST'])
def control_extruder():
    """Control extruder extrusion/retraction"""
    if not printer or not printer.is_open:
        return jsonify(status='error', message='Printer not connected.'), 400
    
    try:
        data = request.get_json()
        action = data.get('action', 'extrude').lower()
        distance = abs(float(data.get('distance', 5)))
        feedrate = data.get('feedrate', 300)
        temperature = data.get('temperature', 0)
        extruder = data.get('extruder', 0)
        
        commands = []
        
        # Set extruder temperature if specified
        if temperature > 0:
            commands.append(f"M104 T{extruder} S{temperature}")
        
        # Select extruder if multi-extruder
        if extruder > 0:
            commands.append(f"T{extruder}")
        
        # Perform extrusion/retraction
        if action == 'retract':
            distance = -distance
        
        commands.append(f"G91 G1 E{distance} F{feedrate} G90")
        
        # Send commands
        for command in commands:
            logger.info(f"Extruder command: {command}")
            printer.write(command.encode() + b'\n')
            time.sleep(0.1)
        
        response = get_printer_response()
        return jsonify(status='success', commands=commands, response=response)
    except Exception as e:
        logger.error(f"Error controlling extruder: {str(e)}")
        return jsonify(status='error', message=f'Extruder control failed: {str(e)}'), 500

@app.route('/api/temperature', methods=['POST'])
def set_temperature():
    """Set extruder or bed temperature"""
    if not printer or not printer.is_open:
        return jsonify(status='error', message='Printer not connected.'), 400
    
    try:
        data = request.get_json()
        target = data.get('target', 'extruder').lower()
        temperature = data.get('temperature', 0)
        extruder = data.get('extruder', 0)
        
        if target == 'extruder' or target == 'hotend':
            command = f"M104 T{extruder} S{temperature}"
        elif target == 'bed':
            command = f"M140 S{temperature}"
        else:
            return jsonify(status='error', message='Invalid target. Use "extruder" or "bed".'), 400
        
        logger.info(f"Setting temperature: {command}")
        printer.write(command.encode() + b'\n')
        time.sleep(0.1)
        response = get_printer_response()
        
        return jsonify(status='success', command=command, response=response)
    except Exception as e:
        logger.error(f"Error setting temperature: {str(e)}")
        return jsonify(status='error', message=f'Temperature setting failed: {str(e)}'), 500

@app.route('/api/fan', methods=['POST'])
def control_fan():
    """Control printer fan speed"""
    if not printer or not printer.is_open:
        return jsonify(status='error', message='Printer not connected.'), 400
    
    try:
        data = request.get_json()
        speed = data.get('speed', 0)  # 0-100%
        fan_index = data.get('fan', 0)
        
        # Convert percentage to PWM value (0-255)
        pwm_value = int((speed / 100) * 255)
        pwm_value = max(0, min(255, pwm_value))
        
        if speed == 0:
            command = f"M107 P{fan_index}"  # Turn off fan
        else:
            command = f"M106 P{fan_index} S{pwm_value}"  # Set fan speed
        
        logger.info(f"Fan control: {command}")
        printer.write(command.encode() + b'\n')
        time.sleep(0.1)
        response = get_printer_response()
        
        PRINTER_STATUS['fanspeed'] = speed
        return jsonify(status='success', command=command, response=response)
    except Exception as e:
        logger.error(f"Error controlling fan: {str(e)}")
        return jsonify(status='error', message=f'Fan control failed: {str(e)}'), 500

@app.route('/api/feedrate', methods=['POST'])
def set_feedrate():
    """Set print feed rate multiplier"""
    if not printer or not printer.is_open:
        return jsonify(status='error', message='Printer not connected.'), 400
    
    try:
        data = request.get_json()
        rate = data.get('rate', 100)  # Percentage
        
        command = f"M220 S{rate}"
        logger.info(f"Setting feed rate: {command}")
        printer.write(command.encode() + b'\n')
        time.sleep(0.1)
        response = get_printer_response()
        
        PRINTER_STATUS['feedrate'] = rate
        return jsonify(status='success', command=command, response=response)
    except Exception as e:
        logger.error(f"Error setting feed rate: {str(e)}")
        return jsonify(status='error', message=f'Feed rate setting failed: {str(e)}'), 500

@app.route('/api/flowrate', methods=['POST'])
def set_flowrate():
    """Set extrusion flow rate multiplier"""
    if not printer or not printer.is_open:
        return jsonify(status='error', message='Printer not connected.'), 400
    
    try:
        data = request.get_json()
        rate = data.get('rate', 100)  # Percentage
        extruder = data.get('extruder', 0)
        
        command = f"M221 T{extruder} S{rate}"
        logger.info(f"Setting flow rate: {command}")
        printer.write(command.encode() + b'\n')
        time.sleep(0.1)
        response = get_printer_response()
        
        PRINTER_STATUS['flowrate'] = rate
        return jsonify(status='success', command=command, response=response)
    except Exception as e:
        logger.error(f"Error setting flow rate: {str(e)}")
        return jsonify(status='error', message=f'Flow rate setting failed: {str(e)}'), 500

@app.route('/api/probe', methods=['POST'])
def probe_bed():
    """Perform bed probing operations"""
    if not printer or not printer.is_open:
        return jsonify(status='error', message='Printer not connected.'), 400
    
    try:
        data = request.get_json()
        operation = data.get('operation', 'simple').lower()
        
        if operation == 'simple':
            command = "G30"  # Single probe
        elif operation == 'auto_level':
            command = "G29"  # Auto bed leveling
        elif operation == 'z_probe':
            max_travel = data.get('max_travel', 40)
            feedrate = data.get('feedrate', 100)
            command = f"G38.2 Z-{max_travel} F{feedrate}"
        else:
            return jsonify(status='error', message='Invalid probe operation.'), 400
        
        logger.info(f"Probe operation: {command}")
        printer.write(command.encode() + b'\n')
        time.sleep(2)  # Probing takes time
        response = get_printer_response()
        
        return jsonify(status='success', command=command, response=response)
    except Exception as e:
        logger.error(f"Error during probe operation: {str(e)}")
        return jsonify(status='error', message=f'Probe operation failed: {str(e)}'), 500

# --- File Management API ---
@app.route('/api/files', methods=['GET'])
def list_files():
    files = [f for f in os.listdir(UPLOADS_DIR) if f.endswith(('.gcode', '.gco'))]
    return jsonify(files=files)

@app.route('/api/upload', methods=['POST'])
def upload_file():
    try:
        if 'file' not in request.files: 
            return jsonify(status='error', message='No file selected'), 400
            
        file = request.files['file']
        if not file or not file.filename:
            return jsonify(status='error', message='No file selected'), 400
            
        if not file.filename.lower().endswith(('.gcode', '.gco')):
            return jsonify(status='error', message='Only G-code files (.gcode, .gco) are allowed'), 400
        
        # Sanitize filename
        filename = file.filename.replace('..', '').replace('/', '').replace('\\', '')
        filepath = os.path.join(UPLOADS_DIR, filename)
        
        # Check if file already exists
        if os.path.exists(filepath):
            return jsonify(status='error', message=f'File {filename} already exists'), 409
            
        file.save(filepath)
        file_size = os.path.getsize(filepath)
        
        logger.info(f"File uploaded: {filename} ({file_size} bytes)")
        return jsonify(
            status='success', 
            message=f'File {filename} uploaded successfully',
            filename=filename,
            size=file_size
        )
        
    except Exception as e:
        logger.error(f"Error uploading file: {str(e)}")
        return jsonify(status='error', message=f'Upload failed: {str(e)}'), 500

# --- Legacy G-code serving for 3D viewer ---
@app.route('/api/gcode/<filename>', methods=['GET'])
def get_gcode(filename):
    """Serves a G-code file from uploads directory."""
    try:
        # Sanitize filename
        filename = filename.replace('..', '').replace('/', '').replace('\\', '')
        filepath = os.path.join(UPLOADS_DIR, filename)
        
        if not os.path.exists(filepath):
            return jsonify(status='error', message='File not found'), 404
            
        return send_from_directory(UPLOADS_DIR, filename)
    except Exception as e:
        logger.error(f"Error serving G-code file {filename}: {str(e)}")
        return jsonify(status='error', message='File access error'), 500

# --- Print Streaming Logic ---
def print_job_thread(filepath):
    global IS_PRINTING, IS_PAUSED, PRINT_PROGRESS, TOTAL_LINES
    try:
        logger.info(f"Starting print job: {filepath}")
        
        # Read and filter G-code lines
        with open(filepath, 'r') as f:
            gcode_lines = []
            for line in f:
                line = line.strip()
                if line and not line.startswith(';'):  # Skip empty lines and comments
                    gcode_lines.append(line)
            
            TOTAL_LINES = len(gcode_lines)
            logger.info(f"Total G-code lines to execute: {TOTAL_LINES}")

        IS_PRINTING = True
        IS_PAUSED = False
        PRINT_PROGRESS = 0
        
        # Send initial setup commands
        if printer and printer.is_open:
            printer.write(b'G21\n')  # Set units to millimeters
            time.sleep(0.1)
            printer.write(b'G90\n')  # Absolute positioning
            time.sleep(0.1)

        for i, line in enumerate(gcode_lines):
            # Check if print is cancelled
            if not IS_PRINTING:
                logger.info("Print cancelled by user")
                # Send emergency stop commands
                if printer and printer.is_open:
                    printer.write(b'M104 S0\n')  # Turn off hotend
                    time.sleep(0.1)
                    printer.write(b'M140 S0\n')  # Turn off bed
                    time.sleep(0.1)
                    printer.write(b'M84\n')     # Disable motors
                    time.sleep(0.1)
                break
            
            # Handle pause functionality
            while IS_PAUSED and IS_PRINTING:
                logger.info("Print paused, waiting...")
                time.sleep(0.5)  # Check every 500ms if still paused
            
            # If cancelled while paused, break
            if not IS_PRINTING:
                break

            if printer and printer.is_open:
                try:
                    printer.write(line.encode() + b'\n')
                    
                    # Wait for acknowledgment with timeout
                    timeout_count = 0
                    ack_received = False
                    
                    while timeout_count < 100:  # 10 second timeout
                        if printer.in_waiting > 0:
                            response = printer.readline().decode('utf-8').strip()
                            if 'ok' in response.lower() or 'done' in response.lower():
                                ack_received = True
                                break
                            elif 'error' in response.lower():
                                logger.error(f"Printer error on line {i+1}: {response}")
                                break
                        time.sleep(0.1)
                        timeout_count += 1
                    
                    if not ack_received:
                        logger.warning(f"Timeout waiting for acknowledgment on line {i+1}")
                        
                except Exception as e:
                    logger.error(f"Error sending line {i+1}: {str(e)}")
                    continue
                
            PRINT_PROGRESS = i + 1
            
            # Small delay between commands for printer stability
            time.sleep(0.02)
            
        if IS_PRINTING and not IS_PAUSED:
            logger.info("Print job completed successfully")
        
    except Exception as e:
        logger.error(f"Print job error: {str(e)}")
    finally:
        IS_PRINTING = False
        IS_PAUSED = False
        logger.info("Print job thread finished")

@app.route('/api/print/start', methods=['POST'])
def start_print():
    global print_thread, CURRENT_FILE
    
    if IS_PRINTING: 
        return jsonify(status='error', message='Print already in progress'), 400
    
    if not printer or not printer.is_open:
        return jsonify(status='error', message='Printer not connected'), 400

    try:
        data = request.get_json()
        filename = data.get('filename') if data else None
        
        if not filename:
            return jsonify(status='error', message='No filename provided'), 400
            
        filepath = os.path.join(UPLOADS_DIR, filename)
        if not os.path.exists(filepath): 
            return jsonify(status='error', message='File not found'), 404

        # Validate file size (optional safety check)
        file_size = os.path.getsize(filepath)
        if file_size > 50 * 1024 * 1024:  # 50MB limit
            return jsonify(status='error', message='File too large (max 50MB)'), 413

        CURRENT_FILE = filename
        print_thread = threading.Thread(target=print_job_thread, args=(filepath,), daemon=True)
        print_thread.start()

        logger.info(f"Started printing: {filename}")
        return jsonify(status='success', message=f'Started printing {filename}')
        
    except Exception as e:
        logger.error(f"Error starting print: {str(e)}")
        return jsonify(status='error', message=f'Failed to start print: {str(e)}'), 500

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

@app.route('/api/emergency-stop', methods=['POST'])
def emergency_stop():
    global IS_PRINTING, IS_PAUSED
    try:
        logger.info("EMERGENCY STOP activated")
        
        # Stop any active print immediately
        if IS_PRINTING:
            IS_PRINTING = False
            IS_PAUSED = False
        
        # Send emergency stop commands to printer
        if printer and printer.is_open:
            printer.write(b'M112\n')    # Emergency stop (if supported)
            time.sleep(0.1)
            printer.write(b'M104 S0\n') # Turn off hotend immediately
            time.sleep(0.1)
            printer.write(b'M140 S0\n') # Turn off bed immediately
            time.sleep(0.1)
            printer.write(b'M84\n')     # Disable all motors immediately
            time.sleep(0.1)
            
        return jsonify(status='success', message='Emergency stop executed')
    except Exception as e:
        logger.error(f"Error during emergency stop: {str(e)}")
        return jsonify(status='error', message=f'Emergency stop failed: {str(e)}'), 500

@app.route('/api/print/status', methods=['GET'])
def get_print_status():
    """Returns the current print status and detailed progress"""
    try:
        if IS_PRINTING:
            progress = (PRINT_PROGRESS / TOTAL_LINES) * 100 if TOTAL_LINES > 0 else 0
            return jsonify(
                status='printing', 
                progress=round(progress, 2), 
                filename=CURRENT_FILE,
                current_line=PRINT_PROGRESS,
                total_lines=TOTAL_LINES
            )
        else:
            return jsonify(
                status='idle', 
                progress=0, 
                filename='',
                current_line=0,
                total_lines=0
            )
    except Exception as e:
        logger.error(f"Error getting print status: {str(e)}")
        return jsonify(status='error', message='Status check failed'), 500

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

# --- Health Check Endpoint ---
@app.route('/api/health', methods=['GET'])
def health_check():
    """Health check endpoint for monitoring"""
    return jsonify(
        status='healthy',
        printer_connected=printer is not None and printer.is_open if printer else False,
        is_printing=IS_PRINTING,
        uptime=time.time()
    )

if __name__ == '__main__':
    logger.info("Starting 3D Printer Controller Server")
    app.run(host='0.0.0.0', port=5000, debug=False)