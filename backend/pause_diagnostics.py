# Enhanced Pause Diagnostic Tool
# This tool provides comprehensive analysis of pause-related issues and solutions

import logging
import time
import re

logger = logging.getLogger(__name__)

class PauseDiagnosticTool:
    def __init__(self, printer):
        self.printer = printer
        self.diagnosis_results = {
            'firmware_info': [],
            'sensor_status': {},
            'pause_triggers': [],
            'hardware_issues': [],
            'recommendations': []
        }
    
    def run_comprehensive_diagnosis(self):
        """Run a complete diagnostic check for pause-related issues"""
        logger.info("🔍 Starting comprehensive pause diagnostic...")
        
        try:
            # 1. Check firmware information
            self._check_firmware_info()
            
            # 2. Test sensor states
            self._test_sensor_states()
            
            # 3. Analyze pause triggers
            self._analyze_pause_triggers()
            
            # 4. Test movement commands
            self._test_movement_commands()
            
            # 5. Check hardware connections
            self._check_hardware_status()
            
            # 6. Generate recommendations
            self._generate_recommendations()
            
            logger.info("✅ Comprehensive pause diagnostic completed")
            return self.diagnosis_results
            
        except Exception as e:
            logger.error(f"Error during diagnostic: {e}")
            self.diagnosis_results['error'] = str(e)
            return self.diagnosis_results
    
    def _check_firmware_info(self):
        """Check printer firmware information"""
        try:
            logger.info("📋 Checking firmware information...")
            
            # Get firmware info
            self.printer.write(b'M115\n')
            time.sleep(1)
            responses = self._get_responses()
            
            firmware_info = []
            for response in responses:
                if response and not response.lower().startswith('ok'):
                    firmware_info.append(response)
                    
                    # Check for known problematic firmware versions
                    if any(issue in response.lower() for issue in ['marlin 2.0.0', 'bugfix', 'beta']):
                        self.diagnosis_results['pause_triggers'].append(f"Potentially problematic firmware: {response}")
            
            self.diagnosis_results['firmware_info'] = firmware_info
            logger.info(f"Firmware info collected: {len(firmware_info)} lines")
            
        except Exception as e:
            logger.warning(f"Firmware check failed: {e}")
    
    def _test_sensor_states(self):
        """Test and analyze sensor states"""
        try:
            logger.info("🔧 Testing sensor states...")
            
            sensor_tests = [
                ('M412', 'Filament runout sensor'),
                ('M413', 'Power loss recovery'),
                ('M125', 'Advanced pause feature'),
                ('M155', 'Temperature reporting'),
                ('M592', 'Input shaping'),
                ('M672', 'Motion detection')
            ]
            
            sensor_status = {}
            
            for command, description in sensor_tests:
                try:
                    # Query sensor status
                    self.printer.write(f'{command}\n'.encode())
                    time.sleep(0.5)
                    responses = self._get_responses()
                    
                    sensor_enabled = False
                    for response in responses:
                        if any(enabled in response.lower() for enabled in ['enabled', 'on', 'active', 'true', '1']):
                            sensor_enabled = True
                            self.diagnosis_results['pause_triggers'].append(f"{description} is ENABLED - potential pause trigger")
                        elif any(disabled in response.lower() for disabled in ['disabled', 'off', 'inactive', 'false', '0']):
                            sensor_enabled = False
                    
                    sensor_status[description] = {
                        'enabled': sensor_enabled,
                        'command': command,
                        'responses': responses
                    }
                    
                    logger.info(f"Sensor {description}: {'ENABLED' if sensor_enabled else 'DISABLED'}")
                    
                except Exception as sensor_error:
                    logger.warning(f"Failed to test {description}: {sensor_error}")
                    sensor_status[description] = {'error': str(sensor_error)}
            
            self.diagnosis_results['sensor_status'] = sensor_status
            
        except Exception as e:
            logger.warning(f"Sensor testing failed: {e}")
    
    def _analyze_pause_triggers(self):
        """Analyze potential pause triggers in the system"""
        try:
            logger.info("🔍 Analyzing pause triggers...")
            
            # Test for common pause-inducing commands
            test_commands = [
                ('G28 X', 'Home X axis'),
                ('M104 S200', 'Set hotend temperature'),
                ('M105', 'Get temperature'),
                ('G1 X10 F1000', 'Simple movement'),
                ('M114', 'Get position')
            ]
            
            pause_detected_commands = []
            
            for command, description in test_commands:
                try:
                    logger.info(f"Testing command: {command} ({description})")
                    
                    # Clear any existing responses
                    self._get_responses()
                    
                    # Send test command
                    self.printer.write(f'{command}\n'.encode())
                    time.sleep(2)  # Wait for response
                    
                    responses = self._get_responses()
                    
                    # Check for pause-related responses
                    for response in responses:
                        if any(pause_word in response.lower() for pause_word in ['paused', 'pause', 'wait for user', 'waiting']):
                            pause_detected_commands.append({
                                'command': command,
                                'description': description,
                                'response': response
                            })
                            logger.warning(f"PAUSE DETECTED for {command}: {response}")
                            break
                    else:
                        logger.info(f"✅ No pause detected for {command}")
                        
                except Exception as cmd_error:
                    logger.warning(f"Failed to test command {command}: {cmd_error}")
            
            if pause_detected_commands:
                self.diagnosis_results['pause_triggers'].extend([
                    f"Command '{cmd['command']}' triggers pause: {cmd['response']}" 
                    for cmd in pause_detected_commands
                ])
            
        except Exception as e:
            logger.warning(f"Pause trigger analysis failed: {e}")
    
    def _test_movement_commands(self):
        """Test movement commands for pause issues"""
        try:
            logger.info("➡️ Testing movement commands...")
            
            # Home first to ensure known state
            self.printer.write(b'G28\n')
            time.sleep(10)  # Allow time for homing
            self._get_responses()  # Clear responses
            
            movement_tests = [
                ('G91 G1 X1 F1000 G90', 'Relative X movement'),
                ('G91 G1 Y1 F1000 G90', 'Relative Y movement'),
                ('G91 G1 Z0.1 F300 G90', 'Relative Z movement'),
                ('G91 G1 E1 F300 G90', 'Extrude 1mm'),
            ]
            
            movement_issues = []
            
            for command, description in movement_tests:
                try:
                    logger.info(f"Testing movement: {description}")
                    
                    # Send movement command
                    self.printer.write(f'{command}\n'.encode())
                    time.sleep(3)  # Wait for movement completion
                    
                    responses = self._get_responses()
                    
                    # Check for issues
                    for response in responses:
                        if any(issue in response.lower() for issue in ['paused', 'error', 'failed', 'stall']):
                            movement_issues.append({
                                'command': command,
                                'description': description,
                                'issue': response
                            })
                            logger.warning(f"Movement issue detected for {description}: {response}")
                            break
                    else:
                        logger.info(f"✅ Movement successful: {description}")
                        
                except Exception as move_error:
                    logger.warning(f"Movement test failed for {description}: {move_error}")
                    movement_issues.append({
                        'command': command,
                        'description': description,
                        'error': str(move_error)
                    })
            
            if movement_issues:
                self.diagnosis_results['hardware_issues'].extend([
                    f"Movement issue - {issue['description']}: {issue.get('issue', issue.get('error', 'Unknown'))}"
                    for issue in movement_issues
                ])
                
        except Exception as e:
            logger.warning(f"Movement testing failed: {e}")
    
    def _check_hardware_status(self):
        """Check hardware-related status"""
        try:
            logger.info("🔧 Checking hardware status...")
            
            # Check stepper motor status
            self.printer.write(b'M122\n')  # Get stepper driver status (if supported)
            time.sleep(1)
            responses = self._get_responses()
            
            hardware_warnings = []
            
            for response in responses:
                if any(warning in response.lower() for warning in ['warning', 'error', 'fault', 'overtemp', 'undervolt']):
                    hardware_warnings.append(response)
                    logger.warning(f"Hardware warning detected: {response}")
            
            if hardware_warnings:
                self.diagnosis_results['hardware_issues'].extend(hardware_warnings)
            else:
                logger.info("✅ No obvious hardware issues detected")
                
        except Exception as e:
            logger.warning(f"Hardware status check failed: {e}")
    
    def _generate_recommendations(self):
        """Generate recommendations based on diagnostic results"""
        try:
            logger.info("💡 Generating recommendations...")
            
            recommendations = []
            
            # Sensor-based recommendations
            enabled_sensors = [
                name for name, status in self.diagnosis_results.get('sensor_status', {}).items()
                if status.get('enabled', False)
            ]
            
            if enabled_sensors:
                recommendations.append(f"🔧 Disable these pause-triggering sensors: {', '.join(enabled_sensors)}")
                recommendations.append("🔧 Use nuclear pause override mode for maximum protection")
            
            # Firmware recommendations
            if any('marlin 2.0.0' in info.lower() for info in self.diagnosis_results.get('firmware_info', [])):
                recommendations.append("🔄 Consider updating firmware - Marlin 2.0.0 has known pause issues")
            
            # Hardware recommendations
            if self.diagnosis_results.get('hardware_issues'):
                recommendations.append("🔧 Check hardware connections - issues detected during movement tests")
                recommendations.append("🔧 Verify stepper driver settings and wiring")
            
            # Pause trigger recommendations
            if self.diagnosis_results.get('pause_triggers'):
                recommendations.append("🛡️ Enable nuclear pause override for all prints")
                recommendations.append("🛡️ Use enhanced monitoring with automatic pause detection")
                recommendations.append("🛡️ Consider G-code preprocessing to remove pause commands")
            
            # General recommendations
            recommendations.extend([
                "🔍 Monitor print logs for recurring pause patterns",
                "🔧 Test with simple G-code first to isolate issues",
                "📊 Use diagnostic mode before important prints",
                "🚀 Keep nuclear pause override updated"
            ])
            
            self.diagnosis_results['recommendations'] = recommendations
            
            logger.info(f"Generated {len(recommendations)} recommendations")
            
        except Exception as e:
            logger.warning(f"Recommendation generation failed: {e}")
    
    def _get_responses(self):
        """Get printer responses with timeout"""
        responses = []
        timeout = 0
        
        while self.printer.in_waiting > 0 and timeout < 100:  # 10 second max
            try:
                response = self.printer.readline().decode('utf-8', errors='ignore').strip()
                if response:
                    responses.append(response)
            except Exception as e:
                logger.warning(f"Error reading response: {e}")
                break
            
            timeout += 1
            time.sleep(0.1)
        
        return responses

# API endpoint for running diagnostics
def run_pause_diagnostics(printer):
    """Run comprehensive pause diagnostics and return results"""
    try:
        if not printer or not printer.is_open:
            return {
                'status': 'error',
                'message': 'Printer not connected',
                'recommendations': [
                    '🔌 Connect printer before running diagnostics',
                    '🔧 Check USB/serial connection',
                    '🔌 Verify correct COM port selection'
                ]
            }
        
        diagnostic_tool = PauseDiagnosticTool(printer)
        results = diagnostic_tool.run_comprehensive_diagnosis()
        
        # Add summary
        results['summary'] = {
            'total_triggers': len(results.get('pause_triggers', [])),
            'hardware_issues': len(results.get('hardware_issues', [])),
            'enabled_sensors': len([
                status for status in results.get('sensor_status', {}).values()
                if status.get('enabled', False)
            ]),
            'recommendations': len(results.get('recommendations', []))
        }
        
        results['status'] = 'success'
        
        return results
        
    except Exception as e:
        logger.error(f"Diagnostic run failed: {e}")
        return {
            'status': 'error',
            'message': str(e),
            'recommendations': [
                '🔧 Check printer connection and try again',
                '🚀 Use nuclear pause override as fallback',
                '📞 Contact support if issues persist'
            ]
        }
