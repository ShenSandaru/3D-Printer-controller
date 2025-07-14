# Component Architecture Overview

## 📁 Component Structure
```
frontend/src/components/
├── Connection.jsx        # Connection management & status
├── TemperatureDisplay.jsx # Live temperature monitoring  
├── ManualControl.jsx     # G-code commands & quick actions
└── Log.jsx              # Communication log viewer
```

## 🔄 Data Flow
```
App.jsx (Parent)
├── Manages global state (port, isConnected, log, temperatures)
├── Handles API communication
├── Provides callbacks to child components
└── Auto-polls temperature data every 3 seconds
```

## 🎯 Component Responsibilities

### Connection.jsx
- **Props**: `port`, `setPort`, `isConnected`, `onConnect`, `onDisconnect`
- **Features**: COM port input, connect/disconnect buttons, status badge
- **Styling**: Bootstrap cards with responsive layout

### TemperatureDisplay.jsx  
- **Props**: `temperatures`, `isConnected`
- **Features**: Live hotend/bed temps, target temps, progress bars
- **Styling**: Cards with temperature indicators and progress visualization

### ManualControl.jsx
- **Props**: `isConnected`, `onSendCommand`
- **Features**: Manual G-code input, quick command buttons (M115, M105, G28, G29)
- **Styling**: Input groups with action buttons

### Log.jsx
- **Props**: `log`
- **Features**: Scrollable communication log, entry counter, auto-scroll
- **Styling**: Monospace font with clean formatting

## 🔧 API Integration

### Backend Endpoints Used:
- `POST /api/connect` - Establish printer connection
- `POST /api/disconnect` - Close printer connection  
- `POST /api/command` - Send G-code commands
- `GET /api/status` - **NEW**: Get live temperature data

### Live Polling Logic:
```javascript
useEffect(() => {
    if (isConnected) {
        const interval = setInterval(async () => {
            const data = await handleApiCall('/api/status');
            if (data && data.status === 'success') {
                setTemperatures(data.temperatures);
            }
        }, 3000);
        return () => clearInterval(interval);
    } else {
        setTemperatures(null);
    }
}, [isConnected]);
```

## 🎨 UI Improvements Made
- **Enhanced Layout**: Better responsive design with Bootstrap utilities
- **Visual Indicators**: Progress bars for temperature targets
- **Status Badges**: Live connection and temperature status
- **Quick Actions**: One-click common G-code commands
- **Better Typography**: Improved readability and spacing

## 🚀 Next Steps (Phase 4)
- Temperature history graphs
- Temperature control (set targets)
- Print job management
- File upload interface
