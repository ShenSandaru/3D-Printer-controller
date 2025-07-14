// frontend/src/App.jsx
import { useState, useEffect } from 'react';
import Connection from './components/Connection';
import TemperatureDisplay from './components/TemperatureDisplay';
import ManualControl from './components/ManualControl';
import Log from './components/Log';

function App() {
    const [port, setPort] = useState('COM6');
    const [isConnected, setIsConnected] = useState(false);
    const [log, setLog] = useState([]);
    const [temperatures, setTemperatures] = useState(null);

    // --- Log Helper ---
    const addToLog = (message) => {
        const timestamp = new Date().toLocaleTimeString();
        setLog(prevLog => [...prevLog, `${timestamp} - ${message}`]);
    };

    // --- API Call Helper ---
    const handleApiCall = async (endpoint, options = {}) => {
        try {
            const response = await fetch(`http://127.0.0.1:5000${endpoint}`, options);
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
            }
            return await response.json();
        } catch (error) {
            addToLog(`API Error: ${error.message}`);
            return null;
        }
    };

    // --- Connection Handlers ---
    const handleConnect = async () => {
        addToLog(`Connecting to ${port}...`);
        const data = await handleApiCall('/api/connect', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ port: port })
        });

        if (data && data.status === 'success') {
            setIsConnected(true);
            addToLog(data.message);
            if (data.data) data.data.forEach(line => addToLog(`PRINTER: ${line}`));
        }
    };

    const handleDisconnect = async () => {
        const data = await handleApiCall('/api/disconnect', { method: 'POST' });
        if (data && data.status === 'success') {
            setIsConnected(false);
            addToLog(data.message);
        }
    };

    // --- Command Handler ---
    const handleSendCommand = async (command) => {
        if (!command || !isConnected) return;
        addToLog(`>>> ${command}`);
        const data = await handleApiCall('/api/command', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ command: command })
        });
        if (data && data.response) {
            data.response.forEach(line => addToLog(`<<< ${line}`));
        }
    };

    // --- Live Status Polling ---
    useEffect(() => {
        if (isConnected) {
            // Poll for status every 3 seconds
            const interval = setInterval(async () => {
                const data = await handleApiCall('/api/status');
                if (data && data.status === 'success') {
                    setTemperatures(data.temperatures);
                }
            }, 3000);
            // Cleanup function to stop polling when disconnected
            return () => clearInterval(interval);
        } else {
            setTemperatures(null); // Clear temps on disconnect
        }
    }, [isConnected]); // This effect re-runs whenever isConnected changes

    return (
        <div className="container my-4">
            <h1 className="mb-4">🖨️ 3D Printer Dashboard</h1>
            
            <Connection 
                port={port}
                setPort={setPort}
                isConnected={isConnected}
                onConnect={handleConnect}
                onDisconnect={handleDisconnect}
            />
            
            <TemperatureDisplay 
                temperatures={temperatures} 
                isConnected={isConnected}
            />
            
            <ManualControl 
                isConnected={isConnected}
                onSendCommand={handleSendCommand}
            />
            
            <Log log={log} />
        </div>
    );
}

export default App
