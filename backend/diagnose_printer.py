# 3D Printer Connection Diagnostic Script
import serial
import serial.tools.list_ports
import time

def test_printer_connection():
    print("=== 3D Printer Connection Diagnostic ===\n")
    
    # 1. List all available ports
    print("1. Scanning for available serial ports...")
    ports = serial.tools.list_ports.comports()
    
    if not ports:
        print("   ❌ No serial ports found!")
        print("   💡 Make sure your printer is connected via USB")
        return
    
    print(f"   ✅ Found {len(ports)} port(s):")
    for port in ports:
        print(f"      • {port.device} - {port.description}")
        if hasattr(port, 'manufacturer'):
            print(f"        Manufacturer: {port.manufacturer}")
    
    # 2. Test connection to each port
    print("\n2. Testing connections...")
    
    # Common baud rates for 3D printers
    baud_rates = [115200, 250000, 57600, 38400, 19200, 9600]
    
    for port_info in ports:
        port_name = port_info.device
        print(f"\n   Testing {port_name}...")
        
        for baud_rate in baud_rates:
            try:
                print(f"      Trying {baud_rate} baud...", end=" ")
                
                # Attempt connection
                ser = serial.Serial(port_name, baud_rate, timeout=2)
                time.sleep(1)  # Give time to initialize
                
                # Send a simple command
                ser.write(b'M115\n')  # Request firmware info
                time.sleep(1)
                
                # Check for response
                response = ""
                while ser.in_waiting > 0:
                    response += ser.readline().decode('utf-8', errors='ignore').strip()
                
                ser.close()
                
                if response:
                    print(f"✅ SUCCESS! Response: {response[:50]}...")
                    print(f"   🎯 RECOMMENDED: Use {port_name} at {baud_rate} baud")
                    return port_name, baud_rate
                else:
                    print("⚠️ Connected but no response")
                    
            except serial.SerialException as e:
                print(f"❌ Failed: {str(e)}")
            except Exception as e:
                print(f"❌ Error: {str(e)}")
    
    print("\n3. Summary:")
    print("   ❌ Could not establish communication with any device")
    print("   💡 Troubleshooting tips:")
    print("      • Check USB cable connection")
    print("      • Ensure printer is powered on")
    print("      • Try different USB ports")
    print("      • Check Windows Device Manager for driver issues")
    print("      • Make sure no other software is using the port")

if __name__ == "__main__":
    try:
        test_printer_connection()
    except Exception as e:
        print(f"❌ Diagnostic failed: {str(e)}")
    
    input("\nPress Enter to exit...")
