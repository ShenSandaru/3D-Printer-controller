# 3D Printer Web Controller

A modern, full-stack web application for monitoring and controlling a Marlin-based 3D printer.

## Features

- **Real-time Connection**: Connect to your 3D printer via USB serial port
- **Manual Control**: Send G-code commands directly to the printer
- **Live Monitoring**: Real-time log of printer communication
- **Responsive UI**: Clean, Bootstrap-based interface that works on all devices

## Technology Stack

### Backend
- **Python 3** with **Flask** framework
- **pyserial** for USB serial communication
- **Flask-CORS** for cross-origin requests

### Frontend
- **React** with **Vite** build tool
- **Bootstrap 5** for responsive UI
- Modern JavaScript (ES6+)

## Quick Start

### Prerequisites
- Python 3.7+
- Node.js 16+
- A Marlin-based 3D printer

### Backend Setup
1. Navigate to the backend directory:
   ```bash
   cd backend
   ```

2. Install Python dependencies:
   ```bash
   pip install -r requirements.txt
   ```

3. Start the Flask server:
   ```bash
   python app.py
   ```

The backend will run on `http://localhost:5000`

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
   npm run dev
   ```

The frontend will run on `http://localhost:5173`

## Usage

1. **Connect to Printer**: Enter your printer's COM port (e.g., COM6) and click "Connect"
2. **Send Commands**: Use the manual command interface to send G-code commands like:
   - `M115` - Get firmware info
   - `M105` - Get temperature readings
   - `G28` - Home all axes
   - `M104 S200` - Set hotend temperature to 200°C

3. **Monitor Activity**: All communication is logged in real-time in the log window

## Project Structure

```
3D-Printer-controller/
├── backend/
│   ├── app.py              # Flask API server
│   └── requirements.txt    # Python dependencies
├── frontend/
│   ├── src/
│   │   ├── App.jsx        # Main React component
│   │   └── main.jsx       # React entry point
│   ├── package.json       # Node.js dependencies
│   └── vite.config.js     # Vite configuration
└── README.md              # This file
```

## API Endpoints

- `POST /api/connect` - Connect to printer
- `POST /api/disconnect` - Disconnect from printer  
- `POST /api/command` - Send G-code command

## Future Enhancements

This foundation supports expanding into:
- **Temperature Monitoring**: Real-time temperature graphs
- **File Management**: Upload and print G-code files
- **Print Job Control**: Start, pause, resume, cancel prints
- **Camera Integration**: Live print monitoring
- **Component UI**: Modular, reusable interface components

## Safety Notes

- Always ensure your printer is properly configured
- Test commands on a safe printer setup first
- Monitor your printer during operation
- Disconnect when not in use

## License

This project is open source and available under the MIT License.
