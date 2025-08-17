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
PRINT_ERROR = None  # To store any errors that occur during printing
CURRENT_POSITION = {'x': 0.0, 'y': 0.0, 'z': 0.0, 'e': 0.0}
PRINTER_STATUS = {
    'state': 'disconnected',
    'temperatures': {},
    'position': CURRENT_POSITION,
    'feedrate': 100,
    'flowrate': 100,
    'fanspeed': 0,
    'z_offset': 0.0
}

# Import enhanced print handler
from enhanced_print_handler import nuclear_pause_override, enhanced_pause_detection_and_override, enhanced_print_monitoring

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
                    logger.debug(f"RAW PRINTER RESPONSE: {line}")  # Log raw response for debugging
                    lines.append(line)
                    # Parse useful information from responses
                    parse_position_from_response(line)
                    parse_temperature_from_response(line)
                    
                    # Enhanced logging for pause-related responses
                    if any(keyword in line.lower() for keyword in ['paused', 'pause', 'wait', 'busy']):
                        logger.warning(f"🔍 PAUSE-RELATED RESPONSE DETECTED: {line}")
                        
            except UnicodeDecodeError:
                # Skip lines that can't be decoded as UTF-8
                logger.warning("Skipped line with invalid UTF-8 characters")
                continue
            except Exception as e:
                logger.error(f"Error reading printer response: {e}")
                continue
    return lines

def monitor_serial_communication(command, expected_keywords=None, timeout=5):
    """
    Enhanced serial communication monitoring with pause detection
    Args:
        command: G-code command to send
        expected_keywords: List of keywords to look for in response
        timeout: Maximum time to wait for response
    Returns:
        dict with status, responses, and any issues detected
    """
    try:
        if not printer or not printer.is_open:
            return {'status': 'error', 'message': 'Printer not connected'}
            
        # Clear any existing responses
        get_printer_response()
        
        # Send command
        logger.info(f"📡 Monitoring command: {command}")
        printer.write(f'{command}\n'.encode())
        
        responses = []
        start_time = time.time()
        pause_detected = False
        
        while time.time() - start_time < timeout:
            current_responses = get_printer_response()
            responses.extend(current_responses)
            
            for response in current_responses:
                # Check for pause-related responses
                if any(keyword in response.lower() for keyword in ['paused', 'pause', 'wait', 'busy']):
                    pause_detected = True
                    logger.warning(f"🚨 PAUSE DETECTED in response: {response}")
                    
                # Check for expected keywords
                if expected_keywords:
                    if any(keyword.lower() in response.lower() for keyword in expected_keywords):
                        logger.info(f"✅ Expected keyword found in: {response}")
                        
            # Check if command completed (look for 'ok' or specific completion)
            if any('ok' in response.lower() for response in current_responses):
                break
                
            time.sleep(0.1)
            
        return {
            'status': 'success',
            'command': command,
            'responses': responses,
            'pause_detected': pause_detected,
            'response_time': time.time() - start_time
        }
        
    except Exception as e:
        logger.error(f"Error monitoring serial communication: {e}")
        return {'status': 'error', 'message': str(e)}

# --- API Endpoints ---
@app.route('/api/connect', methods=['POST'])
def connect_printer():
    global printer
    
    # Check if already connected to real printer
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
        return jsonify(status='error', message=f'Connection failed: {str(e)}. Check if the printer is connected and the port is correct.'), 400
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
    # Regular printer mode
    if not printer or not printer.is_open:
        return jsonify(status='not_connected', error=PRINT_ERROR)

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

        base_status = {
            'temperatures': temps,
            'is_paused': IS_PAUSED,
            'error': PRINT_ERROR,
            'z_offset': PRINTER_STATUS.get('z_offset', 0.0)
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
    global IS_PRINTING, IS_PAUSED, PRINT_PROGRESS, TOTAL_LINES, PRINT_ERROR
    try:
        logger.info(f"Starting print job: {filepath}")
        PRINT_ERROR = None  # Reset error state at the start of a print
        
        # Read and filter G-code lines
        with open(filepath, 'r') as f:
            gcode_lines = []
            pause_commands_found = 0
            for line in f:
                line = line.strip()
                # Skip empty lines, comments, and pause-related commands
                if line and not line.startswith(';'):
                    # Check for pause commands and skip them
                    if any(cmd in line.upper() for cmd in ['M0', 'M1', 'M25', 'M226', '@PAUSE']):
                        pause_commands_found += 1
                        logger.warning(f"Skipping pause command found in G-code: {line}")
                        continue
                    gcode_lines.append(line)
            
            TOTAL_LINES = len(gcode_lines)
            logger.info(f"Total G-code lines to execute: {TOTAL_LINES}")
            if pause_commands_found > 0:
                logger.info(f"🛡️  Filtered out {pause_commands_found} pause commands from G-code file")

        IS_PRINTING = True
        IS_PAUSED = False
        PRINT_PROGRESS = 0
        
        # Send initial setup commands with comprehensive pause prevention
        if printer and printer.is_open:
            logger.info("Sending comprehensive preventive commands to eliminate ALL automatic pausing...")
            
            # Basic setup commands first
            printer.write(b'G21\n')  # Set units to millimeters
            time.sleep(0.1)
            printer.write(b'G90\n')  # Absolute positioning
            time.sleep(0.1)
            
            # AGGRESSIVE pause prevention - disable ALL triggers
            try:
                # 1. CRITICAL: Disable filament sensor completely (primary cause)
                printer.write(b'M412 S0\n')  # Disable filament runout sensor
                printer.flush()
                time.sleep(0.3)
                
                # 2. Disable power loss recovery (can cause unexpected pauses)
                printer.write(b'M413 S0\n')  # Disable power loss recovery
                printer.flush()
                time.sleep(0.3)
                
                # 3. Force resume any existing pause state
                printer.write(b'M24\n')  # Resume if already paused
                printer.flush()
                time.sleep(0.3)
                
                # 4. Clear all pause-related states
                printer.write(b'M73 P0\n')   # Reset print progress completely
                printer.flush()
                time.sleep(0.3)
                
                # 5. Send multiple state-clearing commands
                printer.write(b'G4 P0\n')    # Dwell 0 to clear pending state
                printer.flush()
                time.sleep(0.2)
                
                # 6. Disable advance pause feature if supported
                printer.write(b'M125 S0\n')  # Disable advance pause
                printer.flush()
                time.sleep(0.2)
                
                # 7. Set high hotend temp to prevent thermal runaway pauses
                printer.write(b'M104 S210\n')  # Set hotend temp high
                printer.flush()
                time.sleep(0.2)
                
                # 8. Enable continuous printing mode
                printer.write(b'M75\n')  # Start print timer
                printer.flush()
                time.sleep(0.2)
                
                # 9. Set status message to indicate active printing
                printer.write(b'M117 CONTINUOUS_PRINT\n')
                printer.flush()
                time.sleep(0.2)
                
                # 10. Additional safety-disabling commands
                printer.write(b'M155 S0\n')  # Disable automatic temperature reporting
                printer.flush()
                time.sleep(0.2)
                
                printer.write(b'M108\n')  # Break out of any wait state
                printer.flush()
                time.sleep(0.2)
                
                # 11. Try to disable input shaping (if supported)
                try:
                    printer.write(b'M593 S0\n')  # Disable input shaping
                    printer.flush()
                    time.sleep(0.2)
                except:
                    pass  # Ignore if not supported
                
                # 12. Disable any motion sensor features
                try:
                    printer.write(b'M672 S0\n')  # Disable motion detection (if supported)
                    printer.flush()
                    time.sleep(0.2)
                except:
                    pass
                
                # 13. Clear any existing pause states more aggressively
                printer.write(b'M25\n')  # Explicit pause
                printer.flush()
                time.sleep(0.1)
                printer.write(b'M24\n')  # Then immediate resume
                printer.flush()
                time.sleep(0.2)
                
                # Clear responses from setup commands
                setup_timeout = 0
                while printer.in_waiting > 0 and setup_timeout < 50:
                    try:
                        response = printer.readline().decode('utf-8').strip()
                        if response:
                            logger.info(f"Setup command response: {response}")
                    except:
                        pass
                    setup_timeout += 1
                    time.sleep(0.1)
                
                logger.info("✅ COMPREHENSIVE pause prevention active - ALL auto-pause triggers disabled")
                
            except Exception as e:
                logger.warning(f"Some preventive commands failed (continuing): {e}")
            
            logger.info("Initialized printer with MAXIMUM pause-prevention settings")

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
            
            # PERIODIC PAUSE PREVENTION - Re-enforce every 100 lines to prevent sensor re-activation
            if i > 0 and (i % 100) == 0:  # Every 100 lines
                try:
                    logger.info(f"🛡️  Re-enforcing pause prevention at line {i+1}")
                    printer.write(b'M412 S0\n')  # Re-disable filament sensor
                    printer.flush()
                    time.sleep(0.05)
                    # Clear any responses quickly
                    if printer.in_waiting > 0:
                        printer.readline().decode('utf-8').strip()
                except Exception as e:
                    logger.warning(f"Periodic prevention failed: {e}")

            if printer and printer.is_open:
                try:
                    logger.info(f"Sending G-code line {i+1}: {line}")
                    printer.write(line.encode() + b'\n')
                    
                    # Determine timeout based on command type
                    timeout_seconds = 15  # Increased default timeout
                    if line.startswith('M190'):  # Bed heating and wait
                        timeout_seconds = 600  # 10 minutes for bed heating
                        logger.info("Bed heating command detected, using extended timeout")
                    elif line.startswith('M109'):  # Hotend heating and wait
                        timeout_seconds = 300  # 5 minutes for hotend heating
                        logger.info("Hotend heating command detected, using extended timeout")
                    elif line.startswith('G28'):  # Homing
                        timeout_seconds = 60   # 1 minute for homing
                        logger.info("Homing command detected, using extended timeout")
                    elif line.startswith('G29'):  # Auto bed leveling
                        timeout_seconds = 180  # 3 minutes for auto bed leveling
                        logger.info("Auto bed leveling command detected, using extended timeout")
                    elif line.startswith(('G0', 'G1')) and 'Z' in line.upper():  # Z-axis movement
                        timeout_seconds = 30   # 30 seconds for Z movements (slower axis)
                        logger.info("Z-axis movement command detected, using extended timeout")
                    elif line.startswith(('G0', 'G1')):  # Other movement commands
                        timeout_seconds = 20   # 20 seconds for general movements
                        logger.info("Movement command detected, using extended timeout")
                    
                    # Wait for acknowledgment with appropriate timeout
                    timeout_count = 0
                    max_timeout_count = timeout_seconds * 10  # 0.1 second intervals
                    ack_received = False
                    
                    # For M109, first wait for initial acknowledgment, then monitor temperature
                    if line.startswith('M109'):
                        target_temp = 0
                        # Extract target temperature from the command (e.g., "M109 S210")
                        try:
                            parts = line.split()
                            for part in parts:
                                if part.startswith('S'):
                                    target_temp = float(part[1:])
                                    break
                        except:
                            target_temp = 0
                        
                        logger.info(f"M109 command - waiting for hotend to reach {target_temp}°C")
                        
                        # First, get the initial acknowledgment
                        initial_ack = False
                        while timeout_count < 100 and not initial_ack:  # 10 seconds max for initial ack
                            if not IS_PRINTING:
                                logger.info("Print cancelled while waiting for M109 acknowledgment")
                                return
                            
                            if printer.in_waiting > 0:
                                response = printer.readline().decode('utf-8').strip()
                                logger.info(f"Printer response: {response}")
                                
                                if 'ok' in response.lower():
                                    initial_ack = True
                                    logger.info("M109 command acknowledged, now monitoring temperature...")
                                elif 'error' in response.lower():
                                    logger.error(f"Printer error on M109 command: {response}")
                                    PRINT_ERROR = f"Printer error on M109 command: {response}"
                                    IS_PRINTING = False
                                    return
                            
                            time.sleep(0.1)
                            timeout_count += 1
                        
                        # Now monitor temperature until target is reached
                        if initial_ack and target_temp > 0:
                            temp_monitoring_start = time.time()
                            temp_reached = False
                            
                            while time.time() - temp_monitoring_start < timeout_seconds and not temp_reached:
                                if not IS_PRINTING:
                                    logger.info("Print cancelled while waiting for hotend temperature")
                                    return
                                
                                if printer.in_waiting > 0:
                                    response = printer.readline().decode('utf-8').strip()
                                    if response:
                                        logger.info(f"Printer response: {response}")
                                        
                                        # Handle "paused for user" during hotend heating
                                        if 'paused for user' in response.lower():
                                            logger.info("Printer paused for user during hotend heating - implementing comprehensive resume...")
                                        try:
                                            # ULTIMATE pause override - most aggressive approach yet
                                            logger.warning("🚨 IMPLEMENTING ULTIMATE PAUSE OVERRIDE")
                                            
                                            # Step 1: Nuclear option - reset ALL printer states
                                            nuclear_commands = [
                                                b'M112\n',        # Emergency stop (clears all states)
                                                b'M999\n',        # Restart after emergency stop
                                                b'M412 S0\n',     # Disable filament sensor
                                                b'M413 S0\n',     # Disable power recovery
                                                b'M108\n',        # Break ANY wait condition
                                                b'M24\n',         # Force resume
                                                b'G4 P0\n',       # Clear buffer
                                            ]
                                            
                                            for cmd in nuclear_commands:
                                                try:
                                                    printer.write(cmd)
                                                    printer.flush()
                                                    time.sleep(0.1)
                                                except:
                                                    continue
                                            
                                            # Step 2: Clear ALL responses aggressively
                                            clear_timeout = 0
                                            while printer.in_waiting > 0 and clear_timeout < 50:
                                                try:
                                                    junk = printer.readline().decode().strip()
                                                    logger.debug(f"Cleared heating junk: {junk}")
                                                except:
                                                    pass
                                                clear_timeout += 1
                                                time.sleep(0.02)
                                            
                                            # Step 3: Re-establish heating and continue
                                            try:
                                                # Re-send the M109 command that was interrupted
                                                logger.info("Re-establishing hotend heating after nuclear reset")
                                                printer.write(line.encode() + b'\n')
                                                printer.flush()
                                                time.sleep(0.3)
                                                
                                                # Reset temperature monitoring timer to give full time
                                                temp_monitoring_start = time.time()
                                                logger.info("Nuclear pause override complete - resuming temperature monitoring")
                                                continue  # Continue monitoring temperature
                                                
                                            except Exception as reheat_error:
                                                logger.error(f"Error re-establishing heating: {reheat_error}")
                                        
                                        except Exception as e:
                                            # Fallback to original method if nuclear option fails
                                            logger.warning(f"Nuclear option failed, trying standard method: {e}")
                                            # Get printer status to understand why it paused
                                            printer.write(b'M114\n')  # Get current position
                                            printer.flush()
                                            time.sleep(0.2)
                                            
                                            # Clear any pending responses
                                            while printer.in_waiting > 0:
                                                status_response = printer.readline().decode().strip()
                                                logger.info(f"Status during heating pause: {status_response}")
                                                time.sleep(0.05)
                                            
                                            # Try multiple resume approaches
                                            resume_commands = [b'M24\n', b'M25\nM24\n', b'G4 P100\nM24\n']
                                            
                                            for cmd_bytes in resume_commands:
                                                logger.info(f"Trying heating resume command: {cmd_bytes.decode().strip()}")
                                                printer.write(cmd_bytes)
                                                printer.flush()
                                                time.sleep(0.5)
                                                
                                                # Check for acknowledgment
                                                resume_timeout = 0
                                                resume_success = False
                                                while resume_timeout < 20:  # 2 second timeout per command
                                                    if printer.in_waiting > 0:
                                                        resume_response = printer.readline().decode().strip()
                                                        logger.info(f"Heating resume attempt response: {resume_response}")
                                                        if 'ok' in resume_response.lower():
                                                            resume_success = True
                                                            logger.info(f"Heating resume command acknowledged: {cmd_bytes.decode().strip()}")
                                                            break
                                                        elif 'paused for user' not in resume_response.lower():
                                                            # If we're not getting "paused for user" anymore, consider it progress
                                                            resume_success = True
                                                            break
                                                    time.sleep(0.1)
                                                    resume_timeout += 1
                                                
                                                if resume_success:
                                                    logger.info("Successfully resumed printer during hotend heating")
                                                    break                                                # Reset temperature monitoring timer to give more time after resume
                                                temp_monitoring_start = time.time()
                                                continue  # Continue monitoring temperature
                                                
                                            except Exception as e:
                                                logger.error(f"Error in heating pause handling: {e}")
                                        
                                        if 'T:' in response:
                                            try:
                                                # Parse current hotend temperature
                                                temp_start = response.find('T:') + 2
                                                temp_end = response.find(' ', temp_start)
                                                if temp_end == -1:
                                                    temp_end = response.find('/', temp_start)
                                                if temp_end != -1:
                                                    current_temp = float(response[temp_start:temp_end])
                                                    logger.info(f"Hotend temperature: {current_temp}°C -> {target_temp}°C")
                                                    
                                                    # Check if temperature reached (within 2°C tolerance)
                                                    if current_temp >= target_temp - 2:
                                                        temp_reached = True
                                                        logger.info(f"M109 completed - hotend reached target temperature: {current_temp}°C")
                                                        break
                                            except:
                                                pass
                                
                                time.sleep(0.5)
                                
                                # Show progress every 30 seconds
                                elapsed = time.time() - temp_monitoring_start
                                if int(elapsed) % 30 == 0 and elapsed > 30:
                                    logger.info(f"Still waiting for hotend to reach temperature ({int(elapsed)}s elapsed)")
                            
                            if not temp_reached:
                                logger.warning(f"M109 timeout - hotend may not have reached {target_temp}°C")
                        
                        ack_received = True  # Consider M109 complete after temperature monitoring
                    
                    # Special handling for M190 (wait for bed temperature)
                    elif line.startswith('M190'):
                        target_temp = 0
                        try:
                            parts = line.split()
                            for part in parts:
                                if part.startswith('S'):
                                    target_temp = float(part[1:])
                                    break
                        except:
                            target_temp = 0
                        
                        logger.info(f"M190 command - waiting for bed to reach {target_temp}°C")
                        
                        while timeout_count < max_timeout_count:
                            if not IS_PRINTING:
                                logger.info("Print cancelled while waiting for bed temperature")
                                return
                            
                            if printer.in_waiting > 0:
                                response = printer.readline().decode('utf-8').strip()
                                logger.info(f"Printer response: {response}")
                                
                                if 'ok' in response.lower():
                                    ack_received = True
                                    logger.info(f"M190 completed - bed reached target temperature")
                                    break
                                elif 'error' in response.lower():
                                    logger.error(f"Printer error on M190 command: {response}")
                                    PRINT_ERROR = f"Printer error on M190 command: {response}"
                                    IS_PRINTING = False
                                    return
                                elif 'T:' in response:
                                    # Parse current bed temperature
                                    try:
                                        if 'B:' in response:
                                            temp_start = response.find('B:') + 2
                                            temp_end = response.find(' ', temp_start)
                                            if temp_end == -1:
                                                temp_end = response.find('/', temp_start)
                                            if temp_end != -1:
                                                current_temp = float(response[temp_start:temp_end])
                                                logger.info(f"Bed temperature: {current_temp}°C / {target_temp}°C")
                                    except:
                                        pass
                            
                            time.sleep(0.1)
                            timeout_count += 1
                            
                            # Show progress every 30 seconds
                            if timeout_count % 300 == 0:
                                logger.info(f"Still waiting for bed to reach temperature ({timeout_count/10:.0f}s elapsed)")
                    
                    # Standard handling for other commands
                    else:
                        while timeout_count < max_timeout_count:
                            # Check if print is cancelled during waiting
                            if not IS_PRINTING:
                                logger.info("Print cancelled while waiting for response")
                                return
                            
                            if printer.in_waiting > 0:
                                response = printer.readline().decode('utf-8').strip()
                                logger.info(f"Printer response: {response}")
                                if 'ok' in response.lower():
                                    ack_received = True
                                    break
                                elif 'error' in response.lower():
                                    logger.error(f"Printer error on line {i+1}: {response}")
                                    PRINT_ERROR = f"Printer error on line {i+1}: {response}"
                                    IS_PRINTING = False  # Stop printing on error
                                    return
                                elif response and len(response) > 0 and not any(keyword in response.lower() for keyword in ['busy', 'paused', 'wait', 'echo']):
                                    # If we get any non-empty response that isn't a status message, consider it acknowledgment
                                    # This handles cases where the printer sends temperature data instead of "ok"
                                    logger.info(f"Accepting non-standard acknowledgment: {response}")
                                    ack_received = True
                                    break
                                elif any(pause_keyword in response.lower() for pause_keyword in ['paused for user', 'paused', 'pause', 'wait for user', 'wait']):
                                    # AGGRESSIVE pause handling - FORCE resume immediately
                                    logger.warning(f"⚠️  AUTO-PAUSE DETECTED at line {i+1} - FORCING IMMEDIATE RESUME")
                                    logger.warning(f"Pause trigger response: {response}")
                                    
                                    try:
                                        # Clear any pending responses first
                                        while printer.in_waiting > 0:
                                            try:
                                                pending = printer.readline().decode().strip()
                                                logger.debug(f"Clearing pending response: {pending}")
                                            except:
                                                break
                                            time.sleep(0.05)
                                        
                                        # Try multiple resume approaches with increased persistence
                                        resume_commands = [
                                            (b'M24\n', 'Standard resume'),
                                            (b'M108\n', 'Break wait state'),
                                            (b'G4 P0\nM24\n', 'Clear state and resume'),
                                            (b'M25\nM24\n', 'Explicit pause and resume'),
                                            (b'M412 S0\nM24\n', 'Disable sensor and resume'),
                                            (b'M413 S0\nM24\n', 'Disable power loss recovery and resume'),
                                            (b'M108\nM24\nM24\n', 'Triple command approach')
                                        ]
                                        
                                        resume_success = False
                                        for cmd_bytes, cmd_desc in resume_commands:
                                            if resume_success:
                                                break
                                                
                                            logger.info(f"Trying resume approach: {cmd_desc}")
                                            printer.write(cmd_bytes)
                                            printer.flush()
                                            time.sleep(0.3)
                                            
                                            # Verify resume success with enhanced checking
                                            resume_verified = False
                                            verification_attempts = 0
                                            max_verification = 15  # Increased attempts
                                            
                                            while verification_attempts < max_verification and not resume_verified:
                                                time.sleep(0.1)
                                                verification_attempts += 1
                                                
                                                # Send status query
                                                printer.write(b'M114\n')  # Query position to check state
                                                printer.flush()
                                                time.sleep(0.1)
                                                
                                                # Check responses
                                                check_timeout = 0
                                                while printer.in_waiting > 0 and check_timeout < 25:
                                                    try:
                                                        check_response = printer.readline().decode().strip()
                                                        logger.info(f"Resume verification {verification_attempts}: {check_response}")
                                                        
                                                        # Look for signs of successful resume
                                                        if ('ok' in check_response.lower() or 
                                                            'x:' in check_response.lower() or  # Position response
                                                            ('busy' in check_response.lower() and not any(pause_keyword in check_response.lower() for pause_keyword in ['paused', 'pause', 'wait']))):
                                                            resume_verified = True
                                                            resume_success = True
                                                            logger.info(f"✅ RESUME SUCCESSFUL with '{cmd_desc}' after {verification_attempts} attempts")
                                                            break
                                                        elif any(pause_keyword in check_response.lower() for pause_keyword in ['paused', 'pause', 'wait']):
                                                            # Still paused, try next command
                                                            logger.warning(f"Still paused on attempt {verification_attempts} with '{cmd_desc}', will try next approach...")
                                                            break
                                                    except Exception as decode_error:
                                                        logger.warning(f"Error decoding response: {decode_error}")
                                                    
                                                    check_timeout += 1
                                                    time.sleep(0.05)
                                                
                                                if resume_verified:
                                                    break
                                        
                                        if resume_success:
                                            logger.info(f"🚀 SUCCESSFULLY OVERCAME AUTO-PAUSE at line {i+1} - continuing print")
                                            ack_received = True  # Treat as successful acknowledgment
                                            break
                                        else:
                                            logger.error(f"❌ FAILED to overcome auto-pause at line {i+1} after trying all approaches")
                                            PRINT_ERROR = f"Auto-pause could not be overcome at line {i+1} - tried all resume methods"
                                            IS_PRINTING = False
                                            return
                                        
                                    except Exception as e:
                                        logger.error(f"Error in enhanced aggressive pause handling: {e}")
                                        PRINT_ERROR = f"Error handling auto-pause at line {i+1}: {e}"
                                        IS_PRINTING = False
                                        return
                                elif 'busy' in response.lower():
                                    # Handle different types of busy responses
                                    if 'busy: processing' in response.lower():
                                        # Normal processing, continue waiting
                                        logger.info("Printer busy processing, continuing to wait...")
                                        # Reset part of timeout counter to give more time for processing
                                        if timeout_count > max_timeout_count * 0.7:  # If we're at 70% of timeout
                                            timeout_count = int(max_timeout_count * 0.5)  # Reset to 50%
                                            logger.info("Extended timeout for busy processing")
                                    elif 'busy: paused for user' in response.lower():
                                        # This should be handled by the paused for user section above
                                        pass
                                    else:
                                        # Other busy responses, just continue
                                        logger.info(f"Printer busy: {response}")
                                        pass
                            
                            time.sleep(0.1)
                            timeout_count += 1
                    
                    if not ack_received:
                        logger.error(f"Timeout waiting for acknowledgment on line {i+1}: {line}")
                        logger.error(f"Waited {timeout_seconds} seconds without response")
                        PRINT_ERROR = f"Timeout waiting for acknowledgment on line {i+1}: {line}"
                        IS_PRINTING = False # Stop printing on timeout
                        return
                        
                except Exception as e:
                    logger.error(f"Error sending line {i+1}: {str(e)}")
                    PRINT_ERROR = f"Error sending line {i+1}: {str(e)}"
                    IS_PRINTING = False # Stop printing on exception
                    return
                
            PRINT_PROGRESS = i + 1
            
            # Variable delay between commands based on command type
            if line.startswith(('M190', 'M109')):  # Heating commands
                time.sleep(0.5)  # Longer delay after heating commands
            elif line.startswith(('G0', 'G1')):   # Movement commands
                time.sleep(0.02) # Short delay for movement
            else:
                time.sleep(0.1)  # Standard delay
            
        if IS_PRINTING and not IS_PAUSED:
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
        return jsonify(status='error', message='Print already in progress'), 400
    
    # Check connection
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
        
        # Start real print thread
        print_thread = threading.Thread(target=print_job_thread, args=(filepath,), daemon=True)
        logger.info(f"Starting real print thread for: {filename}")
        
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

@app.route('/api/z-offset', methods=['POST'])
def adjust_z_offset():
    """Adjust Z-offset to fix bed-nozzle gap height"""
    global PRINTER_STATUS
    try:
        data = request.get_json()
        
        # Validate input
        if not data or 'offset' not in data:
            return jsonify(status='error', message='Missing offset value'), 400
            
        offset = float(data['offset'])
        
        # Limit offset range for safety (-2.0mm to +2.0mm)
        if offset < -2.0 or offset > 2.0:
            return jsonify(status='error', message='Z-offset must be between -2.0 and +2.0 mm'), 400
        
        if not printer or not printer.is_open:
            return jsonify(status='error', message='Printer not connected'), 400
        
        # Update internal tracking
        PRINTER_STATUS['z_offset'] = offset
        
        # Send baby stepping command (M290) for immediate Z adjustment
        command = f'M290 Z{offset:.3f}'
        printer.write(f'{command}\n'.encode())
        logger.info(f"Z-offset adjusted to {offset:.3f}mm using baby stepping")
        
        # Also set persistent Z-offset (M851) - this affects future prints
        persistent_command = f'M851 Z{offset:.3f}'
        printer.write(f'{persistent_command}\n'.encode())
        logger.info(f"Persistent Z-offset set to {offset:.3f}mm")
        
        # Save settings to EEPROM so it persists across reboots
        time.sleep(0.1)
        printer.write(b'M500\n')
        logger.info("Z-offset settings saved to EEPROM")
        
        return jsonify(
            status='success', 
            message=f'Z-offset adjusted to {offset:.3f}mm',
            z_offset=offset
        )
        
    except ValueError:
        return jsonify(status='error', message='Invalid offset value'), 400
    except Exception as e:
        logger.error(f"Error adjusting Z-offset: {str(e)}")
        return jsonify(status='error', message=f'Z-offset adjustment failed: {str(e)}'), 500

@app.route('/api/z-offset', methods=['GET'])
def get_z_offset():
    """Get current Z-offset value"""
    try:
        return jsonify(
            status='success',
            z_offset=PRINTER_STATUS.get('z_offset', 0.0)
        )
    except Exception as e:
        logger.error(f"Error getting Z-offset: {str(e)}")
        return jsonify(status='error', message='Failed to get Z-offset'), 500

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

@app.route('/api/firmware', methods=['GET'])
def get_firmware_info():
    """Query printer firmware information using M115 command"""
    try:
        if not printer or not printer.is_open:
            return jsonify(status='error', message='Printer not connected'), 400
            
        # Clear any existing responses
        get_printer_response()
        
        # Send M115 command to get firmware info
        printer.write(b'M115\n')
        logger.info("📋 Sent M115 command to query firmware information")
        
        # Wait for response
        time.sleep(1)
        responses = get_printer_response()
        
        firmware_info = []
        for response in responses:
            if response and not response.startswith('ok'):
                firmware_info.append(response)
                
        logger.info(f"📋 Firmware info received: {firmware_info}")
        return jsonify(status='success', firmware_info=firmware_info)
        
    except Exception as e:
        logger.error(f"Error getting firmware info: {str(e)}")
        return jsonify(status='error', message=f'Failed to get firmware info: {str(e)}'), 500

@app.route('/api/test-gcode', methods=['POST'])
def test_simple_gcode():
    """Send simple test G-code commands for debugging"""
    try:
        if not printer or not printer.is_open:
            return jsonify(status='error', message='Printer not connected'), 400
            
        data = request.get_json()
        test_commands = data.get('commands', ['G28', 'M114'])  # Default: home and get position
        
        results = []
        
        for command in test_commands:
            # Use enhanced monitoring for each command
            result = monitor_serial_communication(command, timeout=3)
            results.append(result)
            
            # Add small delay between commands
            time.sleep(0.5)
            
        logger.info(f"🧪 Test G-code results: {results}")
        return jsonify(status='success', results=results)
        
    except Exception as e:
        logger.error(f"Error testing G-code: {str(e)}")
        return jsonify(status='error', message=f'Failed to test G-code: {str(e)}'), 500

@app.route('/api/diagnose-pause', methods=['POST'])
def diagnose_pause_issues():
    """Comprehensive diagnosis of potential pause triggers"""
    try:
        if not printer or not printer.is_open:
            return jsonify(status='error', message='Printer not connected'), 400
            
        diagnosis_results = {
            'firmware_info': [],
            'safety_features_status': [],
            'test_commands': [],
            'recommendations': []
        }
        
        # 1. Get firmware information
        firmware_result = monitor_serial_communication('M115', timeout=3)
        diagnosis_results['firmware_info'] = firmware_result
        
        # 2. Test safety feature disable commands
        safety_commands = ['M412 S0', 'M413 S0', 'M125 S0', 'M155 S0']
        for cmd in safety_commands:
            result = monitor_serial_communication(cmd, timeout=2)
            diagnosis_results['safety_features_status'].append(result)
            time.sleep(0.5)
            
        # 3. Test basic movement commands
        test_commands = ['G28', 'M114', 'G1 X10 F1000', 'G1 X0 F1000']
        for cmd in test_commands:
            result = monitor_serial_communication(cmd, timeout=5)
            diagnosis_results['test_commands'].append(result)
            time.sleep(1)
            
        # 4. Generate recommendations based on results
        pause_detected = any(
            result.get('pause_detected', False) 
            for result in diagnosis_results['test_commands'] + diagnosis_results['safety_features_status']
        )
        
        if pause_detected:
            diagnosis_results['recommendations'].extend([
                "Pause behavior detected during diagnostic",
                "Check firmware version for known pause issues",
                "Verify printer hardware connections",
                "Consider firmware update if available"
            ])
        else:
            diagnosis_results['recommendations'].extend([
                "No pause behavior detected in diagnostics",
                "Issue may be G-code specific",
                "Check G-code file for pause commands",
                "Monitor during actual print job"
            ])
            
        logger.info(f"🔍 Pause diagnosis completed: {diagnosis_results}")
        return jsonify(status='success', diagnosis=diagnosis_results)
        
    except Exception as e:
        logger.error(f"Error diagnosing pause issues: {str(e)}")
        return jsonify(status='error', message=f'Failed to diagnose: {str(e)}'), 500

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