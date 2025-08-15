# backend/app.py - ENHANCED PRODUCTION VERSION WITH NUCLEAR PAUSE OVERRIDE
from flask import Flask, jsonify, request, send_from_directory
from flask_cors import CORS
import serial
import time
import os
import threading
import re
import logging
import serial.tools.list_ports

# Import enhanced print handler and diagnostics
from enhanced_print_handler import nuclear_pause_override, enhanced_pause_detection_and_override, enhanced_print_monitoring
from pause_diagnostics import run_pause_diagnostics

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

# --- Enhanced Print Streaming Logic with Nuclear Pause Override ---
def print_job_thread(filepath):
    global IS_PRINTING, IS_PAUSED, PRINT_PROGRESS, TOTAL_LINES, PRINT_ERROR
    try:
        logger.info(f"Starting ENHANCED print job with nuclear pause override: {filepath}")
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
        
        # Send initial setup commands with NUCLEAR pause prevention
        if printer and printer.is_open:
            logger.info("🚀 Sending NUCLEAR preventive commands to eliminate ALL automatic pausing...")
            
            # Nuclear setup commands
            nuclear_setup_commands = [
                ('G21', 'Set units to millimeters'),
                ('G90', 'Absolute positioning'),
                ('M412 S0', '🔥 CRITICAL: Disable filament runout sensor'),
                ('M413 S0', '🔥 Disable power loss recovery'),
                ('M24', '🔥 Force resume any existing pause'),
                ('M73 P0', '🔥 Reset print progress'),
                ('G4 P0', '🔥 Clear pending state'),
                ('M125 S0', '🔥 Disable advance pause'),
                ('M75', '🔥 Start print timer'),
                ('M117 NUCLEAR_PRINT_MODE', '🔥 Set nuclear status message'),
                ('M155 S0', '🔥 Disable automatic temperature reporting'),
                ('M108', '🔥 Break out of any wait state'),
                ('M592 S0', '🔥 Disable input shaping (if supported)'),
                ('M672 S0', '🔥 Disable motion detection (if supported)'),
            ]
            
            for cmd, desc in nuclear_setup_commands:
                try:
                    result = enhanced_print_monitoring(printer, cmd, timeout=3)
                    if result['status'] != 'success':
                        logger.warning(f"Nuclear setup warning ({desc}): {result['message']}")
                    else:
                        logger.info(f"✅ Nuclear setup successful: {desc}")
                    time.sleep(0.1)
                except Exception as setup_error:
                    logger.warning(f"Nuclear setup failed ({desc}): {setup_error}")
                    continue
            
            logger.info("🚀 NUCLEAR PAUSE PREVENTION ACTIVE - ALL auto-pause triggers DESTROYED")

        # Set current line for enhanced monitoring
        enhanced_print_monitoring.current_line = 0
        
        for i, line in enumerate(gcode_lines):
            # Update current line for monitoring
            enhanced_print_monitoring.current_line = i + 1
            
            # Check if print is cancelled
            if not IS_PRINTING:
                logger.info("Print cancelled by user")
                # Send emergency stop commands
                if printer and printer.is_open:
                    emergency_commands = ['M104 S0', 'M140 S0', 'M84']
                    for cmd in emergency_commands:
                        try:
                            enhanced_print_monitoring(printer, cmd, timeout=2)
                            time.sleep(0.1)
                        except:
                            pass
                break
            
            # Handle user-initiated pause functionality
            while IS_PAUSED and IS_PRINTING:
                logger.info("Print paused by user, waiting...")
                time.sleep(0.5)  # Check every 500ms if still paused
            
            # If cancelled while paused, break
            if not IS_PRINTING:
                break
            
            # NUCLEAR PERIODIC PREVENTION - Re-enforce every 25 lines for maximum security
            if i > 0 and (i % 25) == 0:  # Every 25 lines
                try:
                    logger.info(f"🔥 NUCLEAR re-enforcement at line {i+1}")
                    nuclear_success = nuclear_pause_override(printer)
                    if not nuclear_success:
                        logger.warning("Nuclear re-enforcement had issues, but continuing...")
                except Exception as e:
                    logger.warning(f"Nuclear periodic prevention failed: {e}")

            if printer and printer.is_open:
                try:
                    logger.info(f"📡 Sending NUCLEAR-PROTECTED G-code line {i+1}: {line}")
                    
                    # Determine appropriate timeout based on command type
                    timeout_seconds = 15  # Default timeout
                    if line.startswith('M190'):  # Bed heating
                        timeout_seconds = 600  # 10 minutes
                        logger.info("🌡️ Bed heating command detected, using extended timeout")
                    elif line.startswith('M109'):  # Hotend heating
                        timeout_seconds = 300  # 5 minutes
                        logger.info("🌡️ Hotend heating command detected, using extended timeout")
                    elif line.startswith('G28'):  # Homing
                        timeout_seconds = 60   # 1 minute
                        logger.info("🏠 Homing command detected, using extended timeout")
                    elif line.startswith('G29'):  # Auto bed leveling
                        timeout_seconds = 180  # 3 minutes
                        logger.info("📐 Auto bed leveling command detected, using extended timeout")
                    elif line.startswith(('G0', 'G1')) and 'Z' in line.upper():  # Z movement
                        timeout_seconds = 30   # 30 seconds
                        logger.info("⬆️ Z-axis movement detected, using extended timeout")
                    elif line.startswith(('G0', 'G1')):  # Other movement
                        timeout_seconds = 20   # 20 seconds
                        logger.info("➡️ Movement command detected, using extended timeout")
                    
                    # Use enhanced monitoring with integrated NUCLEAR pause detection and override
                    result = enhanced_print_monitoring(printer, line, timeout=timeout_seconds)
                    
                    if result['status'] == 'error':
                        logger.error(f"❌ NUCLEAR monitoring error on line {i+1}: {result['message']}")
                        PRINT_ERROR = f"Nuclear monitoring error on line {i+1}: {result['message']}"
                        IS_PRINTING = False
                        return
                    elif result['status'] == 'timeout':
                        logger.error(f"⏰ NUCLEAR monitoring timeout on line {i+1}: {result['message']}")
                        PRINT_ERROR = f"Nuclear monitoring timeout on line {i+1}: {result['message']}"
                        IS_PRINTING = False
                        return
                    else:
                        logger.info(f"✅ NUCLEAR monitoring successful for line {i+1}")
                        
                except Exception as e:
                    logger.error(f"💥 Error in nuclear processing line {i+1}: {str(e)}")
                    PRINT_ERROR = f"Error in nuclear processing line {i+1}: {str(e)}"
                    IS_PRINTING = False
                    return
                
            PRINT_PROGRESS = i + 1
            
            # Optimized delays between commands
            if line.startswith(('M190', 'M109')):  # Heating commands
                time.sleep(0.5)
            elif line.startswith(('G0', 'G1')):   # Movement commands
                time.sleep(0.02)
            else:
                time.sleep(0.1)
            
        if IS_PRINTING and not IS_PAUSED:
            logger.info("🎉 NUCLEAR-PROTECTED print job completed successfully!")
        
    except Exception as e:
        logger.error(f"💥 Nuclear print job error: {str(e)}")
        PRINT_ERROR = f"Nuclear print job failed: {str(e)}"
    finally:
        IS_PRINTING = False
        IS_PAUSED = False
        logger.info("🏁 Nuclear print job thread finished")

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
        
        # Start NUCLEAR print thread
        print_thread = threading.Thread(target=print_job_thread, args=(filepath,), daemon=True)
        logger.info(f"🚀 Starting NUCLEAR print thread for: {filename}")
        
        print_thread.start()

        logger.info(f"🚀 Started NUCLEAR printing: {filename}")
        return jsonify(status='success', message=f'Started NUCLEAR printing {filename}')
        
    except Exception as e:
        logger.error(f"Error starting nuclear print: {str(e)}")
        return jsonify(status='error', message=f'Failed to start nuclear print: {str(e)}'), 500

@app.route('/api/print/cancel', methods=['POST'])
def cancel_print():
    global IS_PRINTING, IS_PAUSED
    if not IS_PRINTING: 
        return jsonify(status='error', message='No active print job'), 400
        
    try:
        logger.info("🛑 Cancelling nuclear print job")
        IS_PRINTING = False  # Signal the thread to stop
        IS_PAUSED = False    # Reset pause state
        return jsonify(status='success', message='Nuclear print job cancelled')
    except Exception as e:
        logger.error(f"Error cancelling nuclear print: {str(e)}")
        return jsonify(status='error', message=f'Cancel failed: {str(e)}'), 500

@app.route('/api/print/pause', methods=['POST'])
def pause_print():
    global IS_PAUSED
    if not IS_PRINTING:
        return jsonify(status='error', message='No active print job'), 400
    
    try:
        IS_PAUSED = True
        logger.info("⏸️ Nuclear print job paused by user")
        return jsonify(status='success', message='Nuclear print job paused')
    except Exception as e:
        logger.error(f"Error pausing nuclear print: {str(e)}")
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
        logger.info("▶️ Nuclear print job resumed by user")
        return jsonify(status='success', message='Nuclear print job resumed')
    except Exception as e:
        logger.error(f"Error resuming nuclear print: {str(e)}")
        return jsonify(status='error', message=f'Resume failed: {str(e)}'), 500

@app.route('/api/emergency-stop', methods=['POST'])
def emergency_stop():
    global IS_PRINTING, IS_PAUSED
    try:
        logger.info("🚨 NUCLEAR EMERGENCY STOP activated")
        
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
            
        return jsonify(status='success', message='Nuclear emergency stop executed')
    except Exception as e:
        logger.error(f"Error during nuclear emergency stop: {str(e)}")
        return jsonify(status='error', message=f'Emergency stop failed: {str(e)}'), 500

# --- Advanced Diagnostic Endpoints ---
@app.route('/api/diagnose-pause-comprehensive', methods=['POST'])
def diagnose_pause_comprehensive():
    """Run comprehensive pause diagnostic analysis"""
    try:
        logger.info("🔍 Starting comprehensive pause diagnostics...")
        results = run_pause_diagnostics(printer)
        
        logger.info(f"📊 Diagnostic completed - Found {results.get('summary', {}).get('total_triggers', 0)} pause triggers")
        return jsonify(results)
        
    except Exception as e:
        logger.error(f"Error running comprehensive diagnostics: {str(e)}")
        return jsonify(status='error', message=f'Diagnostic failed: {str(e)}'), 500

@app.route('/api/nuclear-test', methods=['POST'])
def nuclear_test():
    """Test nuclear pause override system"""
    try:
        if not printer or not printer.is_open:
            return jsonify(status='error', message='Printer not connected'), 400
        
        logger.info("🚀 Testing nuclear pause override system...")
        
        # Test nuclear override
        nuclear_success = nuclear_pause_override(printer)
        
        if nuclear_success:
            return jsonify(
                status='success', 
                message='Nuclear pause override test successful',
                nuclear_ready=True
            )
        else:
            return jsonify(
                status='warning',
                message='Nuclear pause override had issues but may still work during print',
                nuclear_ready=False
            )
        
    except Exception as e:
        logger.error(f"Nuclear test failed: {str(e)}")
        return jsonify(status='error', message=f'Nuclear test failed: {str(e)}'), 500

# --- Health Check Endpoint ---
@app.route('/api/health', methods=['GET'])
def health_check():
    """Health check endpoint for monitoring"""
    return jsonify(
        status='nuclear_healthy',
        printer_connected=printer is not None and printer.is_open if printer else False,
        is_printing=IS_PRINTING,
        nuclear_mode=True,
        uptime=time.time()
    )

if __name__ == '__main__':
    logger.info("🚀 Starting 3D Printer Controller Server with NUCLEAR PAUSE OVERRIDE")
    app.run(host='0.0.0.0', port=5000, debug=False)
