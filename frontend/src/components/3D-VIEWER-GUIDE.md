# 3D G-code Viewer Guide

## 🎯 Overview
The 3D G-code Viewer provides interactive visualization of 3D printing toolpaths with real-time print simulation capabilities.

## 🚀 Features

### Interactive 3D Visualization
- **Zoom**: Mouse wheel or pinch gesture
- **Rotate**: Left-click and drag
- **Pan**: Right-click and drag (or Shift + left-click)
- **Grid**: 100mm x 100mm reference grid

### G-code Processing
- Parses G0/G1 movement commands
- Extracts X, Y, Z coordinates
- Identifies extrusion moves (E parameter)
- Converts to 3D line segments

### Print Simulation
- **Full Toolpath**: Gray lines show complete print path
- **Print Progress**: Blue lines show simulated printing progress
- **Real-time Updates**: Progress updates every second
- **Automatic Completion**: Simulation stops when print is "finished"

## 🛠️ How to Use

### Step 1: Start the Application
1. Ensure both backend and frontend servers are running
2. Open the web interface at `http://localhost:5173`

### Step 2: Load G-code File
1. Click "Load & Simulate Print" button in the 3D Viewer panel
2. The system loads `sample.gcode` from the backend
3. Full toolpath appears in gray lines

### Step 3: Watch the Simulation
1. Print simulation starts automatically after loading
2. Blue lines progressively draw over gray toolpath
3. Simulation continues until complete

### Step 4: Interact with the 3D View
- **Zoom**: Get closer to see details or zoom out for overview
- **Rotate**: View the print from any angle
- **Pan**: Move around to see different areas

## 📁 Sample G-code
The included `sample.gcode` creates a simple test cube:
- **Dimensions**: 20mm x 20mm x 2mm
- **10 Layers**: 0.2mm layer height
- **Square Perimeters**: Simple outline for each layer
- **Infill Pattern**: Diagonal lines on one layer

## 🔧 Technical Details

### G-code Parsing Logic
```javascript
function parseGcode(gcode) {
    // Splits G-code into lines
    // Filters movement commands (G0/G1)
    // Extracts coordinates (X, Y, Z)
    // Identifies extrusion moves (E > 0)
    // Returns Float32Array of line segments
}
```

### Backend Endpoints
- **`GET /api/gcode/sample.gcode`** - Downloads G-code file
- **`POST /api/print/start`** - Starts simulation
- **`GET /api/print/status`** - Returns progress (line count)

### Frontend Components
- **Canvas**: React Three Fiber 3D canvas
- **OrbitControls**: Mouse/touch interaction
- **Line**: Three.js line rendering
- **Grid**: Reference coordinate system

## 🎨 Customization

### Colors
- **Toolpath**: `lightgray` (#d3d3d3)
- **Progress**: `#0d6efd` (Bootstrap primary blue)
- **Background**: `#f8f9fa` (Bootstrap light)
- **Grid**: `#dee2e6` and `#e9ecef` (Bootstrap grays)

### Camera Settings
- **Position**: [50, 50, 50] (isometric view)
- **FOV**: 50 degrees
- **Auto-focus**: Centers on print area

### Simulation Speed
- **Update Interval**: 1000ms (1 second)
- **Progress Step**: 50 lines per update
- **Total Duration**: ~30 seconds for sample file

## 🐛 Troubleshooting

### 3D Viewer Not Loading
- Check browser console for errors
- Ensure Three.js libraries are installed
- Verify WebGL support in browser

### G-code Not Displaying
- Check backend server is running
- Verify `sample.gcode` exists in backend folder
- Check network requests in browser dev tools

### Simulation Not Starting
- Ensure "Connect" button was clicked first
- Check backend console for errors
- Verify `/api/print/start` endpoint is working

## 🔮 Future Enhancements
- File upload capability
- Multiple G-code file support
- Print job controls (pause/resume/cancel)
- Temperature visualization overlay
- Print time estimation
- Layer-by-layer viewing
- Custom color schemes
