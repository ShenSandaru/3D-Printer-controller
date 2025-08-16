# backend/improved_app.py - Enhanced version with garbage value protection
from flask import Flask, jsonify, request, send_from_directory
from flask_cors import CORS
import serial
import time
import os
import threading
import re
import logging
import serial.tools.list_ports
import hashlib

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

# --- Command verification and cleanup ---
LAST_COMMAND_CHECKSUM = None
BUFFER_CLEANUP_COUNTER = 0

def calculate_command_checksum(command):
    """Calculate checksum for command verification"""
    return hashlib.md5(command.encode('utf-8')).hexdigest()[:8]

def safe_buffer_clear(max_attempts=50):
    """Safely clear serial buffer with garbage detection"""
    global BUFFER_CLEANUP_COUNTER
    BUFFER_CLEANUP_COUNTER += 1
    
    cleared_data = []
    attempts = 0
    
    while printer and printer.is_open and printer.in_waiting > 0 and attempts < max_attempts:
        try:
            data = printer.readline()
            if data:
                decoded = data.decode('utf-8', errors='replace').strip()
                cleared_data.append(decoded)
                logger.debug(f"Buffer cleanup #{BUFFER_CLEANUP_COUNTER}: {decoded}")
            attempts += 1
        except Exception as e:
            logger.warning(f"Buffer clear error: {e}")
            break
        time.sleep(0.01)
    
    if cleared_data:
        logger.info(f"Cleared {len(cleared_data)} items from buffer (cleanup #{BUFFER_CLEANUP_COUNTER})")
    
    return cleared_data

def enhanced_command_send(command, timeout=10, expected_response="ok"):
    """Enhanced command sending with data integrity verification"""
    global LAST_COMMAND_CHECKSUM
    
    if not printer or not printer.is_open:
        return {'success': False, 'error': 'Printer not connected'}
    
    try:
        # Pre-send cleanup
        safe_buffer_clear()
        
        # Command validation
        if not command.strip():
            return {'success': False, 'error': 'Empty command'}
        
        # Calculate checksum for verification
        command_checksum = calculate_command_checksum(command)
        LAST_COMMAND_CHECKSUM = command_checksum
        
        # Prepare command with proper encoding
        encoded_command = command.encode('utf-8', errors='replace') + b'\n'
        
        logger.debug(f"Sending command: '{command}' (checksum: {command_checksum})")
        
        # Send command with error checking
        bytes_written = printer.write(encoded_command)
        if bytes_written != len(encoded_command):
            return {'success': False, 'error': f'Write error: {bytes_written}/{len(encoded_command)} bytes'}
        
        printer.flush()
        
        # Wait for response with enhanced monitoring
        start_time = time.time()
        responses = []
        
        while (time.time() - start_time) < timeout:
            if printer.in_waiting > 0:
                try:
                    raw_response = printer.readline()
                    if raw_response:
                        decoded_response = raw_response.decode('utf-8', errors='replace').strip()
                        if decoded_response:
                            responses.append(decoded_response)
                            logger.debug(f"Response: '{decoded_response}'")
                            
                            # Check for expected acknowledgment
                            if expected_response.lower() in decoded_response.lower():
                                return {
                                    'success': True,
                                    'response': decoded_response,
                                    'all_responses': responses,
                                    'command_checksum': command_checksum
                                }
                            
                            # Check for error responses
                            if 'error' in decoded_response.lower():
                                return {
                                    'success': False,
                                    'error': decoded_response,
                                    'command_checksum': command_checksum
                                }
                except Exception as e:
                    logger.warning(f"Response decode error: {e}")
                    continue
            
            time.sleep(0.05)
        
        # Timeout handling
        return {
            'success': False,
            'error': f'Timeout after {timeout}s',
            'responses': responses,
            'command_checksum': command_checksum
        }
        
    except Exception as e:
        logger.error(f"Command send error: {e}")
        return {'success': False, 'error': str(e)}

# --- Helper Functions ---
def get_printer_response():
    """Legacy function for compatibility - now uses safe buffer handling"""
    if not printer or not printer.is_open:
        return []
    
    responses = safe_buffer_clear(10)  # Limit for quick responses
    return responses

def validate_gcode_line(line):
    """Validate G-code line for potential garbage data"""
    if not line or not line.strip():
        return False
    
    line = line.strip()
    
    # Skip comments
    if line.startswith(';'):
        return False
    
    # Check for basic G-code format
    if not re.match(r'^[GMTFS]\d+', line.upper()):
        # Allow some non-standard but valid commands
        if not any(line.upper().startswith(prefix) for prefix in ['M', 'G', 'T', 'F', 'S']):
            logger.warning(f"Potentially invalid G-code line: '{line}'")
            return False
    
    # Check for suspicious characters
    if any(ord(c) < 32 and c not in '\r\n\t' for c in line):
        logger.warning(f"Control characters detected in line: '{line}'")
        return False
    
    # Check for encoding issues
    try:
        line.encode('ascii')
    except UnicodeEncodeError:
        logger.warning(f"Non-ASCII characters in line: '{line}'")
        # Still allow but log the issue
    
    return True

# --- API Endpoints ---
@app.route('/api/connect', methods=['POST'])
def connect_printer():
    global printer, BUFFER_CLEANUP_COUNTER
    
    if printer and printer.is_open: 
        return jsonify(status='success', message='Already connected.')
    
    try:
        data = request.get_json() or {}
        port = data.get('port', 'COM3')
        baud_rate = data.get('baud_rate', 250000)
        
        logger.info(f"Attempting to connect to printer on {port} at {baud_rate} baud")
        
        printer = serial.Serial(
            port=port,
            baudrate=baud_rate,
            timeout=2,
            write_timeout=2,
            bytesize=serial.EIGHTBITS,
            parity=serial.PARITY_NONE,
            stopbits=serial.STOPBITS_ONE,
            xonxoff=False,
            rtscts=False,
            dsrdtr=False
        )
        
        time.sleep(3)  # Give printer time to initialize
        BUFFER_CLEANUP_COUNTER = 0
        safe_buffer_clear()  # Initial cleanup
        
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
    
    try:
        data = request.get_json()
        command = data.get('command') if data else None
        
        if not command:
            return jsonify(status='error', message='No command provided.'), 400
        
        # Use enhanced command sending
        result = enhanced_command_send(command)
        
        if result['success']:
            return jsonify(
                status='success',
                command=command,
                response=result.get('response', ''),
                all_responses=result.get('all_responses', []),
                checksum=result.get('command_checksum')
            )
        else:
            return jsonify(
                status='error',
                message=result.get('error', 'Command failed'),
                checksum=result.get('command_checksum')
            ), 500
    
    except Exception as e:
        logger.error(f"Error in send_command: {str(e)}")
        return jsonify(status='error', message=f'Command processing failed: {str(e)}'), 500

@app.route('/api/status', methods=['GET'])
def get_status():
    if not printer or not printer.is_open:
        return jsonify(status='not_connected', error=PRINT_ERROR)

    try:
        # Use enhanced command sending for status request
        result = enhanced_command_send('M105', timeout=5)
        
        temps = {'hotend_actual': 0, 'hotend_target': 0, 'bed_actual': 0, 'bed_target': 0}
        
        if result['success'] and result.get('all_responses'):
            for line in result['all_responses']:
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
            'buffer_cleanups': BUFFER_CLEANUP_COUNTER,
            'last_command_checksum': LAST_COMMAND_CHECKSUM
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
        filepath = os.path.join(UPLOADS_DIR, file.filename)
        
        # Save and validate file
        file.save(filepath)
        
        # Quick validation of uploaded file
        validation_issues = []
        try:
            with open(filepath, 'r', encoding='utf-8', errors='replace') as f:
                lines = f.readlines()[:100]  # Check first 100 lines
                
            for i, line in enumerate(lines):
                if not validate_gcode_line(line):
                    validation_issues.append(f"Line {i+1}: {line.strip()[:50]}")
                    
        except Exception as e:
            validation_issues.append(f"File read error: {e}")
        
        status_msg = f'File {file.filename} uploaded.'
        if validation_issues:
            status_msg += f' Warning: {len(validation_issues)} potentially problematic lines detected.'
            logger.warning(f"File validation issues in {file.filename}: {validation_issues[:5]}")
        
        return jsonify(
            status='success',
            message=status_msg,
            validation_issues=len(validation_issues)
        )
    
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

# --- Enhanced Print Logic ---
def print_job_thread(filepath):
    global IS_PRINTING, IS_PAUSED, PRINT_PROGRESS, TOTAL_LINES, PRINT_ERROR
    
    try:
        logger.info(f"Starting enhanced print job: {filepath}")
        PRINT_ERROR = None
        
        # Read and validate G-code file
        with open(filepath, 'r', encoding='utf-8', errors='replace') as f:
            all_lines = f.readlines()
        
        gcode_lines = []
        invalid_lines = []
        
        for i, line in enumerate(all_lines):
            if validate_gcode_line(line):
                gcode_lines.append(line.strip())
            elif line.strip() and not line.strip().startswith(';'):
                invalid_lines.append((i+1, line.strip()[:50]))
        
        if invalid_lines:
            logger.warning(f"Skipped {len(invalid_lines)} invalid lines")
            
        TOTAL_LINES = len(gcode_lines)
        logger.info(f"Total valid G-code lines: {TOTAL_LINES}")

        if TOTAL_LINES == 0:
            PRINT_ERROR = "No valid G-code lines found in file"
            return

        IS_PRINTING = True
        IS_PAUSED = False
        PRINT_PROGRESS = 0

        # Send initial setup commands with enhanced error checking
        setup_commands = ['G21', 'G90', 'M83']  # mm units, absolute positioning, relative extruder
        for cmd in setup_commands:
            if not IS_PRINTING:
                break
                
            result = enhanced_command_send(cmd, timeout=10)
            if not result['success']:
                logger.error(f"Setup command failed: {cmd} - {result.get('error')}")
                PRINT_ERROR = f"Setup failed on command: {cmd}"
                IS_PRINTING = False
                return

        # Main printing loop with enhanced error handling
        for i, line in enumerate(gcode_lines):
            # Check if print is cancelled
            if not IS_PRINTING:
                logger.info("Print cancelled by user")
                # Send shutdown commands
                shutdown_commands = ['M104 S0', 'M140 S0', 'M84']
                for cmd in shutdown_commands:
                    enhanced_command_send(cmd, timeout=5)
                break

            # Handle pause
            while IS_PAUSED and IS_PRINTING:
                logger.debug("Print paused, waiting...")
                time.sleep(0.5)
            
            if not IS_PRINTING:  # Check again after pause
                break

            # Determine appropriate timeout based on command type
            timeout_seconds = 10  # Default timeout
            if line.startswith('M190'):  # Bed heating
                timeout_seconds = 300
            elif line.startswith('M109'):  # Hotend heating  
                timeout_seconds = 180
            elif line.startswith('G28'):  # Homing
                timeout_seconds = 60
            elif line.startswith('G29'):  # Auto bed leveling
                timeout_seconds = 120

            # Send command with enhanced error checking
            try:
                logger.debug(f"Sending line {i+1}/{TOTAL_LINES}: {line}")
                result = enhanced_command_send(line, timeout=timeout_seconds)
                
                if not result['success']:
                    error_msg = result.get('error', 'Unknown error')
                    logger.error(f"Print command failed on line {i+1}: {error_msg}")
                    
                    # Decide whether to continue or stop based on error type
                    if 'timeout' in error_msg.lower():
                        if line.startswith(('M190', 'M109', 'G28', 'G29')):
                            # Critical command timeout
                            PRINT_ERROR = f"Critical timeout on line {i+1}: {line}"
                            IS_PRINTING = False
                            return
                        else:
                            # Non-critical timeout, continue with warning
                            logger.warning(f"Non-critical timeout on line {i+1}, continuing")
                    else:
                        # Other errors
                        PRINT_ERROR = f"Error on line {i+1}: {error_msg}"
                        IS_PRINTING = False
                        return
                        
            except Exception as e:
                logger.error(f"Exception sending line {i+1}: {str(e)}")
                PRINT_ERROR = f"Exception on line {i+1}: {str(e)}"
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
            logger.info("Enhanced print job completed successfully")
        
    except Exception as e:
        logger.error(f"Print job error: {str(e)}")
        PRINT_ERROR = f"Print job failed: {str(e)}"
    finally:
        IS_PRINTING = False
        IS_PAUSED = False
        logger.info("Enhanced print job thread finished")

@app.route('/api/print/start', methods=['POST'])
def start_print():
    global print_thread, CURRENT_FILE
    if IS_PRINTING: 
        return jsonify(status='error', message='Print already in progress.'), 400
    
    if not printer or not printer.is_open:
        return jsonify(status='error', message='Printer not connected.'), 400

    try:
        data = request.get_json()
        filename = data.get('filename') if data else None
        
        if not filename:
            return jsonify(status='error', message='No filename provided.'), 400
            
        filepath = os.path.join(UPLOADS_DIR, filename)
        if not os.path.exists(filepath): 
            return jsonify(status='error', message='File not found.'), 404

        CURRENT_FILE = filename
        print_thread = threading.Thread(target=print_job_thread, args=(filepath,))
        print_thread.start()

        return jsonify(status='success', message=f'Enhanced printing started: {filename}')
        
    except Exception as e:
        logger.error(f"Error starting print: {str(e)}")
        return jsonify(status='error', message=f'Print start failed: {str(e)}'), 500

@app.route('/api/print/cancel', methods=['POST'])
def cancel_print():
    global IS_PRINTING, IS_PAUSED
    if not IS_PRINTING: 
        return jsonify(status='error', message='No active print job'), 400
        
    try:
        logger.info("Cancelling enhanced print job")
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
        logger.info("Enhanced print job paused")
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
        logger.info("Enhanced print job resumed")
        return jsonify(status='success', message='Print job resumed')
    except Exception as e:
        logger.error(f"Error resuming print: {str(e)}")
        return jsonify(status='error', message=f'Resume failed: {str(e)}'), 500

@app.route('/api/print/status', methods=['GET'])
def get_print_status():
    """Returns the current print status and progress"""
    if IS_PRINTING:
        progress = (PRINT_PROGRESS / TOTAL_LINES) * 100 if TOTAL_LINES > 0 else 0
        return jsonify(
            status='printing',
            progress=round(progress, 2),
            filename=CURRENT_FILE,
            buffer_cleanups=BUFFER_CLEANUP_COUNTER
        )
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

# Debug endpoint
@app.route('/api/debug/buffer-status', methods=['GET'])
def get_buffer_status():
    """Get current buffer status for debugging"""
    if not printer or not printer.is_open:
        return jsonify(status='error', message='Printer not connected'), 400
    
    return jsonify(
        status='success',
        in_waiting=printer.in_waiting,
        buffer_cleanups=BUFFER_CLEANUP_COUNTER,
        last_checksum=LAST_COMMAND_CHECKSUM
    )

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000)
