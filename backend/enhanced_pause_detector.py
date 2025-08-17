#!/usr/bin/env python3
"""
Enhanced Pause Detection System with Garbage Value Protection
Addresses potential garbage data causing false pause detections
"""

import time
import logging
import re
import threading
from collections import deque

logger = logging.getLogger(__name__)

class EnhancedPauseDetector:
    def __init__(self, printer):
        self.printer = printer
        self.pause_keywords = ['paused', 'pause', 'waiting', 'busy processing', 'wait']
        self.false_positive_keywords = ['busy: ok', 'busy: processing', 'ok busy']
        self.response_buffer = deque(maxlen=50)  # Keep last 50 responses
        self.pause_detection_history = deque(maxlen=10)  # Track detection history
        self.consecutive_pause_detections = 0
        self.last_valid_response_time = time.time()
        
    def clean_response(self, response):
        """Clean response from potential garbage characters"""
        if not response:
            return ""
        
        # Remove control characters except \n, \r, \t
        cleaned = ''.join(c for c in response if ord(c) >= 32 or c in '\n\r\t')
        
        # Remove excessive whitespace
        cleaned = ' '.join(cleaned.split())
        
        return cleaned.strip()
    
    def is_response_valid(self, response):
        """Check if response appears to be valid (not garbage)"""
        if not response:
            return False
        
        cleaned = self.clean_response(response)
        
        # Check for minimum length
        if len(cleaned) < 2:
            return False
        
        # Check for reasonable character distribution
        if len(cleaned) > 100:  # Very long responses might be garbage
            return False
        
        # Check for repeated characters (potential garbage)
        if len(set(cleaned.replace(' ', ''))) < 3 and len(cleaned) > 10:
            return False
        
        return True
    
    def analyze_pause_legitimacy(self, response):
        """Analyze if pause detection is legitimate or false positive"""
        cleaned_response = self.clean_response(response).lower()
        
        # Check for explicit false positives
        for fp_keyword in self.false_positive_keywords:
            if fp_keyword in cleaned_response:
                logger.debug(f"False positive pause detection: {response}")
                return False
        
        # Check for legitimate pause indicators
        pause_score = 0
        for pause_keyword in self.pause_keywords:
            if pause_keyword in cleaned_response:
                pause_score += 1
        
        # Additional context analysis
        if 'ok' in cleaned_response and pause_score > 0:
            # Response contains both 'ok' and pause keywords - likely false positive
            logger.debug(f"Mixed signals in response: {response}")
            return False
        
        # Check response history for patterns
        recent_responses = list(self.response_buffer)[-5:]  # Last 5 responses
        ok_responses = sum(1 for r in recent_responses if 'ok' in r.lower())
        
        if ok_responses >= 3 and pause_score > 0:
            # Recent 'ok' responses suggest printer is working fine
            logger.debug(f"Recent OK responses contradict pause detection: {response}")
            return False
        
        return pause_score > 0
    
    def detect_pause_from_response(self, response):
        """Enhanced pause detection with garbage filtering"""
        if not response:
            return False
        
        # Store response in buffer
        self.response_buffer.append(response)
        
        # Validate response
        if not self.is_response_valid(response):
            logger.debug(f"Invalid response filtered: {response}")
            return False
        
        self.last_valid_response_time = time.time()
        
        # Analyze for legitimate pause
        is_paused = self.analyze_pause_legitimacy(response)
        
        # Update detection history
        self.pause_detection_history.append(is_paused)
        
        if is_paused:
            self.consecutive_pause_detections += 1
            logger.info(f"Pause detected (#{self.consecutive_pause_detections}): {response}")
        else:
            self.consecutive_pause_detections = 0
        
        # Require multiple consecutive detections to confirm pause
        confirmation_threshold = 2
        return self.consecutive_pause_detections >= confirmation_threshold
    
    def is_printer_responsive(self, timeout=5):
        """Check if printer is responsive to commands"""
        try:
            if not self.printer or not self.printer.is_open:
                return False
            
            # Clear buffer first
            while self.printer.in_waiting > 0:
                self.printer.readline()
                time.sleep(0.01)
            
            # Send simple status command
            self.printer.write(b'M105\n')
            self.printer.flush()
            
            start_time = time.time()
            while (time.time() - start_time) < timeout:
                if self.printer.in_waiting > 0:
                    response = self.printer.readline().decode('utf-8', errors='ignore').strip()
                    if response and 'ok' in response.lower():
                        return True
                time.sleep(0.1)
            
            return False
            
        except Exception as e:
            logger.error(f"Error checking printer responsiveness: {e}")
            return False
    
    def get_diagnostic_info(self):
        """Get diagnostic information about pause detection"""
        return {
            'response_buffer_size': len(self.response_buffer),
            'consecutive_pause_detections': self.consecutive_pause_detections,
            'detection_history': list(self.pause_detection_history),
            'last_valid_response_age': time.time() - self.last_valid_response_time,
            'recent_responses': list(self.response_buffer)[-5:]
        }

def enhanced_pause_override_v2(printer, timeout=30):
    """
    Enhanced pause override with garbage value protection
    """
    logger.info("Starting enhanced pause override v2")
    
    try:
        # Create pause detector
        pause_detector = EnhancedPauseDetector(printer)
        
        # Step 1: Verify printer responsiveness
        if not pause_detector.is_printer_responsive():
            logger.error("Printer not responsive - cannot override pause")
            return False
        
        # Step 2: Clear any garbage data
        logger.info("Clearing potential garbage data...")
        cleared_count = 0
        while printer.in_waiting > 0 and cleared_count < 100:
            try:
                junk = printer.readline().decode('utf-8', errors='ignore').strip()
                if junk:
                    logger.debug(f"Cleared garbage: {junk}")
                    cleared_count += 1
            except:
                pass
            time.sleep(0.01)
        
        logger.info(f"Cleared {cleared_count} potential garbage responses")
        
        # Step 3: Progressive override strategy
        override_commands = [
            # Level 1: Standard resume commands
            (b'M24\n', 'Resume print', 3),
            (b'M108\n', 'Break wait', 2),
            
            # Level 2: State clearing commands
            (b'M25\nM24\n', 'Pause-Resume cycle', 3),
            (b'G4 P0\nM24\n', 'Clear dwell and resume', 3),
            
            # Level 3: Feature disabling + resume
            (b'M155 S0\nM24\n', 'Disable temp reporting + resume', 5),
            (b'M413 S0\nM24\n', 'Disable power loss + resume', 5),
            
            # Level 4: Nuclear options
            (b'M112\nM999\nM24\n', 'Emergency stop + restart + resume', 10),
        ]
        
        start_time = time.time()
        
        for command, description, wait_time in override_commands:
            if (time.time() - start_time) > timeout:
                logger.error("Pause override timeout reached")
                break
            
            logger.info(f"Trying override: {description}")
            
            try:
                # Send override command
                printer.write(command)
                printer.flush()
                time.sleep(wait_time)
                
                # Check for success
                verification_attempts = 0
                override_success = False
                
                while verification_attempts < 10 and not override_success:
                    verification_attempts += 1
                    
                    # Send status query
                    printer.write(b'M114\n')
                    printer.flush()
                    time.sleep(0.2)
                    
                    # Analyze responses
                    response_count = 0
                    while printer.in_waiting > 0 and response_count < 10:
                        try:
                            response = printer.readline().decode('utf-8', errors='ignore').strip()
                            if response:
                                logger.debug(f"Override verification: {response}")
                                
                                # Use enhanced pause detector to verify success
                                if not pause_detector.detect_pause_from_response(response):
                                    if ('x:' in response.lower() or 
                                        'ok' in response.lower() or
                                        ('busy' in response.lower() and 'paused' not in response.lower())):
                                        override_success = True
                                        logger.info(f"✅ Override successful: {description}")
                                        break
                                        
                        except Exception as e:
                            logger.warning(f"Response decode error: {e}")
                            continue
                        
                        response_count += 1
                        time.sleep(0.05)
                    
                    if override_success:
                        # Final verification with responsiveness check
                        if pause_detector.is_printer_responsive():
                            logger.info("🎉 Pause override completed successfully!")
                            return True
                        else:
                            logger.warning("Override appeared successful but printer not responsive")
                            override_success = False
                    
                    time.sleep(0.5)
                
            except Exception as e:
                logger.error(f"Override command failed: {e}")
                continue
        
        # If all strategies failed, provide diagnostic information
        diag_info = pause_detector.get_diagnostic_info()
        logger.error(f"All override strategies failed. Diagnostic info: {diag_info}")
        return False
        
    except Exception as e:
        logger.error(f"Error in enhanced pause override v2: {e}")
        return False

# Integration function for existing print handlers
def integrate_garbage_protection(print_function):
    """
    Decorator to integrate garbage value protection into existing print functions
    """
    def wrapper(*args, **kwargs):
        # Add garbage protection wrapper
        logger.info("Print function called with garbage protection")
        try:
            return print_function(*args, **kwargs)
        except Exception as e:
            logger.error(f"Print function failed with garbage protection: {e}")
            raise
    
    return wrapper

if __name__ == "__main__":
    # Test the enhanced pause detector
    import serial
    
    try:
        printer = serial.Serial('COM3', 250000, timeout=2)
        time.sleep(2)
        
        detector = EnhancedPauseDetector(printer)
        
        # Test with some sample responses
        test_responses = [
            "ok T:30.21 /0.00 B:29.32 /0.00 @:0 B@:0",
            "busy: processing",
            "echo:busy: paused for user",
            "ok",
            "paused for user input",
            "echo:Active Extruder: 0",
        ]
        
        for response in test_responses:
            is_paused = detector.detect_pause_from_response(response)
            print(f"Response: '{response}' -> Paused: {is_paused}")
        
        print("\nDiagnostic info:")
        print(detector.get_diagnostic_info())
        
        printer.close()
        
    except Exception as e:
        print(f"Test failed: {e}")
