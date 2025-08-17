# Enhanced Print Handler with Nuclear Pause Override
# This module contains the improved print handling logic with aggressive pause prevention

import time
import logging

logger = logging.getLogger(__name__)

def nuclear_pause_override(printer):
    """
    Nuclear option for overcoming persistent pause states
    This is the most aggressive approach to clearing ALL printer states
    """
    try:
        logger.warning("🚨 IMPLEMENTING NUCLEAR PAUSE OVERRIDE")
        
        # Step 1: Nuclear commands - reset ALL printer states
        nuclear_commands = [
            (b'M112\n', 'Emergency stop (clears all states)'),
            (b'M999\n', 'Restart after emergency stop'),
            (b'M412 S0\n', 'Disable filament sensor'),
            (b'M413 S0\n', 'Disable power recovery'),
            (b'M108\n', 'Break ANY wait condition'),
            (b'M24\n', 'Force resume'),
            (b'G4 P0\n', 'Clear buffer'),
            (b'M117 NUCLEAR_OVERRIDE\n', 'Set override status'),
        ]
        
        for cmd, desc in nuclear_commands:
            try:
                logger.info(f"Nuclear command: {desc}")
                printer.write(cmd)
                printer.flush()
                time.sleep(0.15)
            except Exception as cmd_error:
                logger.warning(f"Nuclear command failed ({desc}): {cmd_error}")
                continue
        
        # Step 2: Clear ALL responses aggressively
        clear_timeout = 0
        while printer.in_waiting > 0 and clear_timeout < 100:
            try:
                junk = printer.readline().decode().strip()
                logger.debug(f"Cleared nuclear response: {junk}")
            except:
                pass
            clear_timeout += 1
            time.sleep(0.02)
        
        # Step 3: Verify override success
        verification_attempts = 0
        override_success = False
        
        while verification_attempts < 10 and not override_success:
            verification_attempts += 1
            
            # Send status query
            printer.write(b'M114\n')
            printer.flush()
            time.sleep(0.2)
            
            # Check responses for success indicators
            while printer.in_waiting > 0:
                response = printer.readline().decode().strip()
                logger.info(f"Nuclear verification {verification_attempts}: {response}")
                
                # Success indicators
                if ('x:' in response.lower() or 
                    'ok' in response.lower() or
                    ('busy' in response.lower() and 'paused' not in response.lower())):
                    override_success = True
                    logger.info(f"✅ NUCLEAR OVERRIDE SUCCESSFUL after {verification_attempts} attempts")
                    break
                elif 'paused' in response.lower():
                    logger.warning(f"Still detecting pause after nuclear attempt {verification_attempts}")
                    break
            
            if override_success:
                break
            
            time.sleep(0.5)
        
        return override_success
        
    except Exception as nuclear_error:
        logger.error(f"Nuclear override failed catastrophically: {nuclear_error}")
        return False

def enhanced_pause_detection_and_override(printer, response, line_number, current_command):
    """
    Enhanced pause detection with multiple override strategies
    Returns True if pause was successfully handled, False if print should stop
    """
    if not any(pause_keyword in response.lower() for pause_keyword in ['paused for user', 'paused', 'pause', 'wait for user']):
        return True  # No pause detected, continue normally
    
    logger.warning(f"⚠️  ENHANCED AUTO-PAUSE DETECTED at line {line_number} - IMPLEMENTING COMPREHENSIVE OVERRIDE")
    logger.warning(f"Pause trigger response: {response}")
    logger.warning(f"Command that triggered pause: {current_command}")
    
    try:
        # Strategy 1: Standard resume approaches (quick attempt)
        standard_commands = [
            (b'M24\n', 'Standard resume'),
            (b'M108\n', 'Break wait state'),
            (b'G4 P0\nM24\n', 'Clear state and resume'),
        ]
        
        for cmd_bytes, cmd_desc in standard_commands:
            logger.info(f"Trying standard approach: {cmd_desc}")
            printer.write(cmd_bytes)
            printer.flush()
            time.sleep(0.3)
            
            # Quick verification
            verification_success = False
            for _ in range(10):
                if printer.in_waiting > 0:
                    check_response = printer.readline().decode().strip()
                    logger.info(f"Standard verification: {check_response}")
                    
                    if ('ok' in check_response.lower() or 
                        ('x:' in check_response.lower()) or
                        ('busy' in check_response.lower() and 'paused' not in check_response.lower())):
                        verification_success = True
                        logger.info(f"✅ Standard approach successful: {cmd_desc}")
                        return True
                    elif 'paused' in check_response.lower():
                        break  # Still paused, try next approach
                time.sleep(0.1)
            
            if verification_success:
                return True
        
        # Strategy 2: Aggressive hardware override
        logger.warning("Standard approaches failed, trying aggressive hardware override")
        aggressive_commands = [
            (b'M25\nM24\n', 'Explicit pause and resume'),
            (b'M412 S0\nM24\n', 'Disable sensor and resume'),
            (b'M413 S0\nM24\n', 'Disable power loss recovery and resume'),
            (b'M108\nM24\nM24\n', 'Triple command approach'),
            (b'M155 S0\nM108\nM24\n', 'Disable reporting and resume'),
        ]
        
        for cmd_bytes, cmd_desc in aggressive_commands:
            logger.info(f"Trying aggressive approach: {cmd_desc}")
            printer.write(cmd_bytes)
            printer.flush()
            time.sleep(0.5)
            
            # Enhanced verification
            verification_attempts = 0
            verification_success = False
            
            while verification_attempts < 15 and not verification_success:
                verification_attempts += 1
                
                # Send status query
                printer.write(b'M114\n')
                printer.flush()
                time.sleep(0.1)
                
                # Check responses
                response_timeout = 0
                while printer.in_waiting > 0 and response_timeout < 25:
                    try:
                        check_response = printer.readline().decode().strip()
                        logger.info(f"Aggressive verification {verification_attempts}: {check_response}")
                        
                        if ('ok' in check_response.lower() or 
                            'x:' in check_response.lower() or
                            ('busy' in check_response.lower() and 'paused' not in check_response.lower())):
                            verification_success = True
                            logger.info(f"✅ Aggressive approach successful: {cmd_desc}")
                            return True
                        elif 'paused' in check_response.lower():
                            logger.warning(f"Still paused on aggressive attempt {verification_attempts}")
                            break
                    except:
                        pass
                    
                    response_timeout += 1
                    time.sleep(0.05)
                
                if verification_success:
                    return True
                
                time.sleep(0.2)
        
        # Strategy 3: Nuclear Option (last resort)
        logger.error("All standard and aggressive approaches failed, deploying nuclear option")
        nuclear_success = nuclear_pause_override(printer)
        
        if nuclear_success:
            logger.info("🚀 NUCLEAR OVERRIDE SUCCESSFUL - print can continue")
            return True
        else:
            logger.error("❌ ALL OVERRIDE STRATEGIES FAILED - print must stop")
            return False
        
    except Exception as override_error:
        logger.error(f"Error in enhanced pause override: {override_error}")
        return False

def enhanced_print_monitoring(printer, command, timeout=15):
    """
    Enhanced command monitoring with integrated pause detection and override
    """
    try:
        if not printer or not printer.is_open:
            return {'status': 'error', 'message': 'Printer not connected'}
        
        # Send command
        logger.info(f"📡 Enhanced monitoring command: {command}")
        printer.write(f'{command}\n'.encode())
        printer.flush()
        
        start_time = time.time()
        responses = []
        ack_received = False
        
        while time.time() - start_time < timeout and not ack_received:
            if printer.in_waiting > 0:
                response = printer.readline().decode('utf-8', errors='ignore').strip()
                if response:
                    responses.append(response)
                    logger.debug(f"Monitoring response: {response}")
                    
                    # Check for pause and handle it
                    if any(pause_keyword in response.lower() for pause_keyword in ['paused for user', 'paused', 'pause', 'wait for user']):
                        # Extract line number if available (assuming global line counter)
                        current_line = getattr(enhanced_print_monitoring, 'current_line', 0)
                        
                        override_success = enhanced_pause_detection_and_override(
                            printer, response, current_line, command
                        )
                        
                        if override_success:
                            # Continue monitoring after successful override
                            continue
                        else:
                            # Override failed, return error
                            return {
                                'status': 'error',
                                'message': 'Pause override failed',
                                'responses': responses,
                                'command': command
                            }
                    
                    # Check for successful acknowledgment
                    elif 'ok' in response.lower():
                        ack_received = True
                        break
                    elif 'error' in response.lower():
                        return {
                            'status': 'error',
                            'message': f'Printer error: {response}',
                            'responses': responses,
                            'command': command
                        }
            
            time.sleep(0.1)
        
        if not ack_received:
            return {
                'status': 'timeout',
                'message': f'Command timeout after {timeout}s',
                'responses': responses,
                'command': command
            }
        
        return {
            'status': 'success',
            'command': command,
            'responses': responses,
            'response_time': time.time() - start_time
        }
        
    except Exception as e:
        return {
            'status': 'error',
            'message': str(e),
            'command': command
        }
