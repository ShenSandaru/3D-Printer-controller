#!/usr/bin/env python3
"""
Garbage Value Diagnostic Tool
Identifies potential sources of garbage data being sent to the printer
"""

import serial
import serial.tools.list_ports
import time
import logging
import re
import sys
import os
from datetime import datetime

# Configure logging
logging.basicConfig(
    level=logging.DEBUG,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler(f'garbage_diagnostic_{datetime.now().strftime("%Y%m%d_%H%M%S")}.log'),
        logging.StreamHandler(sys.stdout)
    ]
)
logger = logging.getLogger(__name__)

class GarbageValueDiagnostics:
    def __init__(self):
        self.printer = None
        self.port = 'COM3'
        self.baud_rate = 250000
        self.test_commands = [
            'M105',  # Temperature request
            'M114',  # Position request
            'G28 X', # Home X axis
            'M115',  # Firmware info
        ]
        
    def connect_printer(self):
        """Connect to printer with enhanced error checking"""
        try:
            logger.info(f"🔌 Attempting to connect to {self.port} at {self.baud_rate} baud")
            
            # Check if port exists
            available_ports = [port.device for port in serial.tools.list_ports.comports()]
            if self.port not in available_ports:
                logger.error(f"❌ Port {self.port} not found. Available: {available_ports}")
                return False
            
            self.printer = serial.Serial(
                port=self.port,
                baudrate=self.baud_rate,
                timeout=2,
                write_timeout=2,
                bytesize=serial.EIGHTBITS,
                parity=serial.PARITY_NONE,
                stopbits=serial.STOPBITS_ONE,
                xonxoff=False,
                rtscts=False,
                dsrdtr=False
            )
            
            # Wait for printer initialization
            time.sleep(3)
            
            # Clear any initial garbage
            self.clear_buffer()
            
            logger.info("✅ Successfully connected to printer")
            return True
            
        except Exception as e:
            logger.error(f"❌ Connection failed: {e}")
            return False
    
    def clear_buffer(self):
        """Clear input buffer and log any garbage data"""
        garbage_data = []
        while self.printer.in_waiting > 0:
            try:
                data = self.printer.read(self.printer.in_waiting)
                garbage_data.append(data)
                time.sleep(0.1)
            except Exception as e:
                logger.warning(f"Error clearing buffer: {e}")
                break
        
        if garbage_data:
            logger.warning(f"🗑️ Cleared {len(garbage_data)} garbage data chunks from buffer")
            for i, chunk in enumerate(garbage_data):
                logger.debug(f"Garbage chunk {i}: {chunk}")
    
    def send_command_with_analysis(self, command):
        """Send command and analyze the complete communication cycle"""
        logger.info(f"📤 Testing command: '{command}'")
        
        # Pre-send analysis
        pre_buffer_data = self.check_buffer_state()
        
        try:
            # Encode command
            encoded_command = command.encode('utf-8') + b'\n'
            logger.debug(f"Encoded command: {encoded_command}")
            
            # Check for encoding issues
            decoded_check = encoded_command.decode('utf-8').strip()
            if decoded_check != command:
                logger.warning(f"⚠️ Encoding mismatch! Original: '{command}', Decoded: '{decoded_check}'")
            
            # Send command
            bytes_written = self.printer.write(encoded_command)
            self.printer.flush()
            
            logger.debug(f"Bytes written: {bytes_written}, Expected: {len(encoded_command)}")
            
            if bytes_written != len(encoded_command):
                logger.error(f"❌ Write mismatch! Wrote {bytes_written}, expected {len(encoded_command)}")
                return False
            
            # Wait for response with timeout
            timeout = 5.0
            start_time = time.time()
            responses = []
            raw_responses = []
            
            while (time.time() - start_time) < timeout:
                if self.printer.in_waiting > 0:
                    try:
                        # Read raw bytes first
                        raw_data = self.printer.readline()
                        raw_responses.append(raw_data)
                        
                        # Decode with error handling
                        try:
                            decoded_response = raw_data.decode('utf-8', errors='replace').strip()
                            if decoded_response:
                                responses.append(decoded_response)
                                logger.debug(f"📥 Response: '{decoded_response}'")
                                
                                # Check for 'ok' acknowledgment
                                if 'ok' in decoded_response.lower():
                                    break
                                    
                        except UnicodeDecodeError as e:
                            logger.error(f"❌ Decode error: {e}, Raw data: {raw_data}")
                            
                    except Exception as e:
                        logger.error(f"❌ Read error: {e}")
                        break
                
                time.sleep(0.1)
            
            # Post-send analysis
            post_buffer_data = self.check_buffer_state()
            
            # Analyze results
            self.analyze_communication_results(command, responses, raw_responses, pre_buffer_data, post_buffer_data)
            
            return len(responses) > 0
            
        except Exception as e:
            logger.error(f"❌ Command failed: {e}")
            return False
    
    def check_buffer_state(self):
        """Check current state of input buffer"""
        waiting = self.printer.in_waiting
        if waiting > 0:
            logger.warning(f"⚠️ Buffer has {waiting} bytes waiting")
        return waiting
    
    def analyze_communication_results(self, command, responses, raw_responses, pre_buffer, post_buffer):
        """Analyze the communication for potential issues"""
        logger.info(f"🔍 Analysis for command '{command}':")
        logger.info(f"  - Pre-buffer: {pre_buffer} bytes")
        logger.info(f"  - Post-buffer: {post_buffer} bytes")
        logger.info(f"  - Responses received: {len(responses)}")
        
        # Check for garbage in responses
        for i, (response, raw) in enumerate(zip(responses, raw_responses)):
            logger.debug(f"  Response {i+1}: '{response}' (Raw: {raw})")
            
            # Check for control characters or garbage
            if any(ord(c) < 32 and c not in '\r\n\t' for c in response):
                logger.warning(f"⚠️ Response {i+1} contains control characters: {response}")
            
            # Check for incomplete responses
            if not response.endswith('ok') and 'ok' not in response and command in ['M105', 'M114']:
                logger.warning(f"⚠️ Response {i+1} may be incomplete: '{response}'")
        
        # Check for missing responses
        if not responses:
            logger.error(f"❌ No responses received for command '{command}'")
        elif 'ok' not in ' '.join(responses).lower():
            logger.warning(f"⚠️ No 'ok' acknowledgment received for '{command}'")
    
    def test_gcode_file_parsing(self, filename="sample.gcode"):
        """Test G-code file for potential garbage data sources"""
        logger.info(f"📄 Testing G-code file: {filename}")
        
        filepath = os.path.join(".", filename)
        if not os.path.exists(filepath):
            filepath = os.path.join("uploads", filename)
        
        if not os.path.exists(filepath):
            logger.warning(f"⚠️ File not found: {filename}")
            return
        
        try:
            with open(filepath, 'r', encoding='utf-8', errors='replace') as f:
                lines = f.readlines()
            
            logger.info(f"📊 File analysis for {filename}:")
            logger.info(f"  - Total lines: {len(lines)}")
            
            problematic_lines = []
            for i, line in enumerate(lines):
                original_line = line
                line = line.strip()
                
                # Skip comments and empty lines
                if not line or line.startswith(';'):
                    continue
                
                # Check for encoding issues
                try:
                    encoded = line.encode('utf-8')
                    decoded = encoded.decode('utf-8')
                    if decoded != line:
                        problematic_lines.append((i+1, 'encoding', original_line))
                except UnicodeEncodeError:
                    problematic_lines.append((i+1, 'unicode_encode', original_line))
                except UnicodeDecodeError:
                    problematic_lines.append((i+1, 'unicode_decode', original_line))
                
                # Check for unusual characters
                if any(ord(c) > 127 for c in line):
                    problematic_lines.append((i+1, 'non_ascii', original_line))
                
                # Check for control characters
                if any(ord(c) < 32 and c not in '\r\n\t' for c in line):
                    problematic_lines.append((i+1, 'control_chars', original_line))
            
            if problematic_lines:
                logger.warning(f"⚠️ Found {len(problematic_lines)} potentially problematic lines:")
                for line_num, issue, content in problematic_lines[:10]:  # Show first 10
                    logger.warning(f"  Line {line_num} ({issue}): {repr(content)}")
                if len(problematic_lines) > 10:
                    logger.warning(f"  ... and {len(problematic_lines) - 10} more")
            else:
                logger.info("✅ No obvious encoding issues found in G-code file")
                
        except Exception as e:
            logger.error(f"❌ Error analyzing file: {e}")
    
    def run_comprehensive_diagnosis(self):
        """Run complete garbage value diagnosis"""
        logger.info("🚀 Starting comprehensive garbage value diagnosis")
        
        if not self.connect_printer():
            return
        
        try:
            # Test 1: Basic communication
            logger.info("\n=== TEST 1: Basic Communication ===")
            for command in self.test_commands:
                self.send_command_with_analysis(command)
                time.sleep(1)
            
            # Test 2: Rapid fire commands (stress test)
            logger.info("\n=== TEST 2: Rapid Fire Commands ===")
            for i in range(5):
                self.send_command_with_analysis('M105')
                time.sleep(0.1)  # Very short delay
            
            # Test 3: Buffer overflow test
            logger.info("\n=== TEST 3: Buffer Overflow Test ===")
            # Send multiple commands without waiting
            for i in range(3):
                try:
                    self.printer.write(b'M105\n')
                except Exception as e:
                    logger.error(f"Buffer overflow on command {i}: {e}")
            time.sleep(2)  # Wait for all responses
            self.clear_buffer()
            
            # Test 4: G-code file analysis
            logger.info("\n=== TEST 4: G-code File Analysis ===")
            self.test_gcode_file_parsing()
            
            # Test 5: Serial port characteristics
            logger.info("\n=== TEST 5: Serial Port Characteristics ===")
            logger.info(f"  - Port: {self.printer.port}")
            logger.info(f"  - Baudrate: {self.printer.baudrate}")
            logger.info(f"  - Timeout: {self.printer.timeout}")
            logger.info(f"  - Write timeout: {self.printer.write_timeout}")
            logger.info(f"  - Bytesize: {self.printer.bytesize}")
            logger.info(f"  - Parity: {self.printer.parity}")
            logger.info(f"  - Stopbits: {self.printer.stopbits}")
            logger.info(f"  - Flow control: XON/XOFF={self.printer.xonxoff}, RTS/CTS={self.printer.rtscts}")
            
        finally:
            if self.printer:
                self.printer.close()
                logger.info("🔌 Disconnected from printer")
        
        logger.info("✅ Comprehensive diagnosis completed")

def main():
    """Main function"""
    print("🔍 3D Printer Garbage Value Diagnostics Tool")
    print("=" * 50)
    
    diagnostics = GarbageValueDiagnostics()
    diagnostics.run_comprehensive_diagnosis()
    
    print("\n📋 Check the log file for detailed analysis results")

if __name__ == "__main__":
    main()
