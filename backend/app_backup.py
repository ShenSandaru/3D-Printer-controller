# backend/app.py
from flask import Flask, jsonify, request
from flask_cors import CORS
import serial
import time
import re

app = Flask(__name__)
CORS(app)  # This allows your React app to make requests to this backend

printer = None  # This global variable will hold our serial connection object

def get_printer_response():
    """Reads multiple lines from the printer until it stops sending data."""
    lines = []
    while True:
        line = printer.readline().decode('utf-8').strip()
        if line:
            lines.append(line)
        else:
            break
    return lines

@app.route('/api/connect', methods=['POST'])
def connect_printer():
    global printer
    if printer and printer.is_open:
        return jsonify(status='success', message='Already connected.')

    try:
        port = request.json.get('port', 'COM6') # Default to COM6, get from request
        printer = serial.Serial(port, 250000, timeout=1)
        time.sleep(2)  # Wait for the printer to initialize
        response = get_printer_response() # Clear any startup messages
        return jsonify(status='success', message=f'Connected to {port}', data=response)
    except serial.SerialException as e:
        return jsonify(status='error', message=str(e)), 500

@app.route('/api/disconnect', methods=['POST'])
def disconnect_printer():
    global printer
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
    response = get_printer_response()
    return jsonify(status='success', command=command, response=response)

@app.route('/api/status', methods=['GET'])
def get_status():
    if not printer or not printer.is_open:
        return jsonify(status='error', message='Printer not connected.'), 400

    try:
        printer.write(b'M105\n')  # Request temperatures
        response_lines = get_printer_response()

        # Default values
        temps = {
            'hotend_actual': 0, 'hotend_target': 0,
            'bed_actual': 0, 'bed_target': 0
        }

        # Example M105 response: "ok T:25.1 /0.0 B:26.3 /0.0 @:0 B@:0"
        for line in response_lines:
            if 'T:' in line and 'B:' in line:
                # Use regular expressions to find all numbers in the string
                # T:actual /target B:actual /target
                matches = re.findall(r'(\d+\.\d+)', line)
                if len(matches) >= 2:  # At least hotend and bed actuals
                    temps['hotend_actual'] = float(matches[0])
                    temps['hotend_target'] = float(matches[1]) if len(matches) > 1 else 0
                    temps['bed_actual'] = float(matches[2]) if len(matches) > 2 else 0
                    temps['bed_target'] = float(matches[3]) if len(matches) > 3 else 0
                break

        return jsonify(status='success', temperatures=temps)

    except Exception as e:
        return jsonify(status='error', message=str(e)), 500

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000)
