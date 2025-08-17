# Enhanced 3D Printer Controller - ESP3D-WEBUI Inspired Features

This enhanced version of the 3D Printer Controller includes advanced features inspired by the ESP3D-WEBUI project, providing a professional-grade interface for 3D printer control.

## 🆕 New Features Added

### 1. **Advanced Extruder Control Panel**
- **Multi-extruder support** with T0/T1 selection
- **Feed rate control** (25-150%) with real-time adjustment
- **Flow rate control** (50-300%) for fine-tuning extrusion
- **Fan speed control** (0-100%) with PWM control
- **Precise extrusion/retraction** with customizable distances
- **Professional SVG icons** for enhanced visual appeal

### 2. **Enhanced Manual Control**
- **Real-time position display** showing X, Y, Z, E coordinates
- **Variable step sizes** (0.1mm to 100mm)
- **Configurable feed rates** (300-6000 mm/min)
- **Professional XY control grid** with directional buttons
- **Individual axis homing** and zero position setting
- **Emergency controls** with stop and motor disable
- **Quick command buttons** for common operations

### 3. **Advanced Probe Panel**
- **Simple probing** with G30 command
- **Auto bed leveling** with G29 support
- **Z-probe functionality** with customizable parameters
- **Probe corners** for manual bed leveling
- **Visual progress indicators** during probing sequences
- **Configurable probe settings** (max travel, feedrate, touch plate thickness)
- **Real-time probe status** with visual indicators

### 4. **Comprehensive Settings Panel**
- **Panel visibility controls** - show/hide different UI sections
- **Update interval settings** for temperature, position, and status
- **Feed rate presets** for XY, Z, and E axes
- **Multi-extruder configuration** with mixed extruder support
- **Temperature control settings** for bed, chamber, and probe
- **GRBL and CNC support** options
- **File filter configurations**
- **Probe and surface machining settings**

### 5. **Professional UI Enhancements**
- **Modern gradient backgrounds** and styling
- **Responsive design** for mobile and desktop
- **Enhanced typography** and icon usage
- **Advanced CSS animations** and transitions
- **Professional color schemes** with visual hierarchy
- **Accessibility improvements** with proper contrast

## 🛠 Installation and Setup

### Prerequisites
- Python 3.8+ with Flask
- Node.js 16+ with React
- Serial connection to 3D printer

### Backend Setup
1. Navigate to the backend directory:
   ```bash
   cd backend
   ```

2. Install Python dependencies:
   ```bash
   pip install -r requirements.txt
   ```

3. Run the Flask server:
   ```bash
   python app.py
   ```

### Frontend Setup
1. Navigate to the frontend directory:
   ```bash
   cd frontend
   ```

2. Install Node.js dependencies:
   ```bash
   npm install
   ```

3. Start the development server:
   ```bash
   npm start
   ```

## 🎛 New API Endpoints

### Position Control
- `GET /api/position` - Get current printer position
- `POST /api/move` - Move specific axis with parameters
- `POST /api/home` - Home specified axes

### Extruder Control
- `POST /api/extruder` - Control extrusion/retraction
- `POST /api/temperature` - Set extruder/bed temperature
- `POST /api/fan` - Control fan speed

### Advanced Features
- `POST /api/feedrate` - Set feed rate multiplier
- `POST /api/flowrate` - Set flow rate multiplier
- `POST /api/probe` - Perform probing operations

## 📋 Usage Guide

### Extruder Control
1. **Enable multi-extruder mode** if using multiple extruders
2. **Set temperatures** using the temperature controls
3. **Adjust feed and flow rates** for optimal printing
4. **Control fan speed** based on material requirements
5. **Perform extrusion tests** before printing

### Manual Control
1. **Select step size** appropriate for your task
2. **Choose feed rate** based on operation type
3. **Use XY control grid** for precise positioning
4. **Home axes individually** or all at once
5. **Set zero positions** for workpiece alignment

### Probe Operations
1. **Configure probe settings** in the settings panel
2. **Perform simple probe** to test probe functionality
3. **Run auto bed leveling** for automatic calibration
4. **Use corner probing** for manual bed adjustment
5. **Monitor probe status** through visual indicators

### Advanced Settings
1. **Access settings** via the gear icon in the header
2. **Configure panel visibility** to customize interface
3. **Set update intervals** for optimal performance
4. **Adjust feed rate presets** for different operations
5. **Enable advanced features** like GRBL support

## 🎨 Customization

### Styling
- Modify CSS files in `frontend/src/components/` for visual changes
- Update color schemes in the CSS variables
- Adjust animations and transitions as needed

### Features
- Enable/disable panels through the settings interface
- Customize probe parameters for your printer
- Adjust feed rate and temperature presets
- Configure file filters for different G-code types

## 🔧 Configuration Options

### Printer Settings
```javascript
{
  enableTemperaturePanel: true,
  enableExtruderPanel: true,
  enableFilesPanel: true,
  enableProbePanel: false,
  numberOfExtruders: 1,
  enableBedControls: true,
  enableFanControls: true
}
```

### Probe Settings
```javascript
{
  probeMaxTravel: 40,
  probeFeedrate: 100,
  probeTouchPlateThickness: 0.5,
  probeRetractDistance: 2
}
```

### Feed Rate Presets
```javascript
{
  xyFeedrate: 1000,
  zFeedrate: 100,
  eFeedrate: 400
}
```

## 🐛 Troubleshooting

### Common Issues
1. **Probe not detected**: Check probe wiring and settings
2. **Position not updating**: Verify M114 command support
3. **Temperature control issues**: Check M104/M140 commands
4. **Connection problems**: Verify serial port and baud rate

### Error Messages
- **"Printer not connected"**: Establish connection first
- **"Invalid axis"**: Use X, Y, Z, or E for axis commands
- **"Probe operation failed"**: Check probe configuration

## 📖 API Reference

### Enhanced Commands

#### Move Axis
```http
POST /api/move
Content-Type: application/json

{
  "axis": "X",
  "distance": 10,
  "feedrate": 3000,
  "relative": true
}
```

#### Control Extruder
```http
POST /api/extruder
Content-Type: application/json

{
  "action": "extrude",
  "distance": 5,
  "feedrate": 300,
  "temperature": 210,
  "extruder": 0
}
```

#### Probe Bed
```http
POST /api/probe
Content-Type: application/json

{
  "operation": "auto_level",
  "max_travel": 40,
  "feedrate": 100
}
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Implement your changes
4. Add tests if applicable
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🙏 Acknowledgments

- **ESP3D-WEBUI** for inspiration and feature ideas
- **Bootstrap** for UI components
- **React** for the frontend framework
- **Flask** for the backend API
