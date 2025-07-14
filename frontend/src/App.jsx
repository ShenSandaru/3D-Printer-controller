// frontend/src/App.jsx - Production Version
import { useState, useEffect } from 'react';
import './styles/custom.css'; // Import custom styles

// Import all components
import Connection from './components/Connection';
import TemperatureDisplay from './components/TemperatureDisplay';
import ManualControl from './components/ManualControl';
import FileManager from './components/FileManager';
import PrintProgress from './components/PrintProgress';
import GcodeViewer from './components/GcodeViewer';
import Log from './components/Log';

function App() {
    // --- Application State ---
    const [port, setPort] = useState('COM3');
    const [isConnected, setIsConnected] = useState(false);
    const [log, setLog] = useState([]);
    const [temperatures, setTemperatures] = useState(null);
    const [printStatus, setPrintStatus] = useState({ 
        status: 'idle', 
        progress: 0, 
        filename: '',
        current_line: 0,
        total_lines: 0
    });
    const [fileToView, setFileToView] = useState(null); // NEW: State for the viewer

    // --- Logging Helper ---
    const addToLog = (message, type = 'info') => {
        const timestamp = new Date().toLocaleTimeString();
        const logEntry = `${timestamp} - ${message}`;
        setLog(prevLog => [logEntry, ...prevLog].slice(0, 100)); // Keep only last 100 entries
    };

    // --- API Call Helper with Error Handling ---
    const handleApiCall = async (endpoint, options = {}) => {
        try {
            const response = await fetch(`http://127.0.0.1:5000${endpoint}`, {
                ...options,
                headers: {
                    'Content-Type': 'application/json',
                    ...options.headers
                }
            });
            
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
            }
            
            return await response.json();
        } catch (error) {
            addToLog(`API Error: ${error.message}`, 'error');
            console.error('API call failed:', error);
            return null;
        }
    };

    // --- Enhanced Connection Handlers ---
    const handleConnect = async () => {
        if (!port.trim()) {
            addToLog("Error: Please enter a valid COM port", 'error');
            throw new Error("Please enter a valid COM port");
        }
        
        addToLog(`🔌 Attempting to connect to ${port}...`);
        addToLog(`📡 Establishing serial communication...`);
        
        const data = await handleApiCall('/api/connect', {
            method: 'POST',
            body: JSON.stringify({ port: port.trim() })
        });

        if (data && data.status === 'success') {
            setIsConnected(true);
            addToLog(`✅ ${data.message}`, 'success');
            addToLog(`🖨️ Printer ready to receive commands on ${port}`, 'success');
        } else {
            throw new Error(data?.message || 'Connection failed');
        }
    };

    const handleDisconnect = async () => {
        addToLog("🔌 Disconnecting from printer...");
        const data = await handleApiCall('/api/disconnect', { method: 'POST' });
        if (data && data.status === 'success') {
            setIsConnected(false);
            setTemperatures(null);
            setPrintStatus({ status: 'idle', progress: 0, filename: '', current_line: 0, total_lines: 0 });
            addToLog(`✅ ${data.message}`, 'success');
            addToLog("🔌 Printer disconnected safely", 'info');
        }
    };

    // --- Command Handler ---
    const handleSendCommand = async (command) => {
        if (!command || !command.trim() || !isConnected) {
            addToLog("Error: Invalid command or not connected", 'error');
            return;
        }
        
        const trimmedCommand = command.trim();
        addToLog(`Sending: ${trimmedCommand}`);
        
        const data = await handleApiCall('/api/command', {
            method: 'POST',
            body: JSON.stringify({ command: trimmedCommand })
        });
        
        if (data && data.response) {
            data.response.forEach(line => addToLog(`Response: ${line}`));
        }
    };

    // --- Print Management Handlers ---
    const handleStartPrint = async (filename) => {
        if (!filename || !filename.trim()) {
            addToLog("Error: No file selected", 'error');
            return;
        }
        
        if (!isConnected) {
            addToLog("Error: Printer not connected", 'error');
            return;
        }
        
        // Also load the file into the viewer when printing starts
        setFileToView(filename);
        addToLog(`Starting print: ${filename}`);
        
        const data = await handleApiCall('/api/print/start', {
            method: 'POST',
            body: JSON.stringify({ filename: filename.trim() })
        });
        
        if (data && data.status === 'success') {
            addToLog(data.message, 'success');
        }
    };

    const handleCancelPrint = async () => {
        addToLog("Cancelling print...");
        const data = await handleApiCall('/api/print/cancel', {
            method: 'POST'
        });
        
        if (data && data.status === 'success') {
            addToLog(data.message, 'success');
        }
    };

    // NEW handler for the view button
    const handleViewFile = (filename) => {
        addToLog(`Loading ${filename} for viewing...`);
        setFileToView(filename);
    };

    // NEW: Pause, Resume, and Emergency Stop Handlers
    const handlePausePrint = async () => {
        addToLog("Pausing print...");
        const data = await handleApiCall('/api/print/pause', {
            method: 'POST'
        });
        
        if (data && data.status === 'success') {
            addToLog(data.message, 'success');
        }
    };

    const handleResumePrint = async () => {
        addToLog("Resuming print...");
        const data = await handleApiCall('/api/print/resume', {
            method: 'POST'
        });
        
        if (data && data.status === 'success') {
            addToLog(data.message, 'success');
        }
    };

    const handleEmergencyStop = async () => {
        // Confirm emergency stop action
        if (window.confirm('EMERGENCY STOP: This will immediately stop all printer operations and turn off heaters. Are you sure?')) {
            addToLog("EMERGENCY STOP ACTIVATED!", 'error');
            const data = await handleApiCall('/api/emergency-stop', {
                method: 'POST'
            });
            
            if (data && data.status === 'success') {
                addToLog(data.message, 'success');
            }
        }
    };

    // --- Status Polling Effect ---
    useEffect(() => {
        if (!isConnected) {
            setTemperatures(null);
            setPrintStatus({ status: 'idle', progress: 0, filename: '', current_line: 0, total_lines: 0 });
            setFileToView(null); // Clear viewer when disconnecting
            return;
        }

        const interval = setInterval(async () => {
            try {
                // Get printer status (includes temperatures and print info)
                const statusData = await handleApiCall('/api/status');
                if (statusData) {
                    if (statusData.temperatures) {
                        setTemperatures(statusData.temperatures);
                    }
                    
                    if (statusData.status === 'printing' || statusData.status === 'paused') {
                        setPrintStatus({
                            status: statusData.status,
                            progress: statusData.progress || 0,
                            filename: statusData.filename || '',
                            current_line: statusData.current_line || 0,
                            total_lines: statusData.total_lines || 0,
                            is_paused: statusData.is_paused || false
                        });
                    } else if (statusData.status === 'connected') {
                        setPrintStatus({
                            status: 'idle',
                            progress: 0,
                            filename: '',
                            current_line: 0,
                            total_lines: 0,
                            is_paused: false
                        });
                    }
                }
            } catch (error) {
                console.error('Status polling error:', error);
            }
        }, 2000); // Poll every 2 seconds

        return () => clearInterval(interval);
    }, [isConnected]);

    return (
        <div className="d-flex flex-column main-layout" style={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' }}>
            {/* Modern Header */}
            <nav className="navbar navbar-expand-lg" style={{ backgroundColor: 'rgba(255, 255, 255, 0.95)', backdropFilter: 'blur(10px)' }}>
                <div className="container-fluid">
                    <div className="navbar-brand d-flex align-items-center">
                        <div className="me-3" style={{ fontSize: '2rem' }}>🖨️</div>
                        <div>
                            <h4 className="mb-0 fw-bold text-primary">3D Print Hub</h4>
                            <small className="text-muted">Professional Controller</small>
                        </div>
                    </div>
                    <div className="d-flex align-items-center">
                        <div className={`badge ${isConnected ? 'bg-success' : 'bg-secondary'} me-3`}>
                            <i className="bi bi-circle-fill me-1"></i>
                            {isConnected ? 'Connected' : 'Disconnected'}
                        </div>
                        {printStatus.status === 'printing' && (
                            <div className="badge bg-warning text-dark">
                                <i className="bi bi-printer me-1"></i>
                                Printing {printStatus.progress?.toFixed(1)}%
                            </div>
                        )}
                    </div>
                </div>
            </nav>

            {/* Main Content */}
            <main className="flex-grow-1 container-fluid p-4" style={{ minHeight: 0, overflowY: 'auto' }}>
                <div className="row g-4" style={{ minHeight: '100%' }}>
                    {/* Left Sidebar: Control Panel */}
                    <div className="col-lg-4 col-xl-3 order-2 order-lg-1">
                        <div className="sidebar-container d-flex flex-column" style={{ height: 'auto', minHeight: '100%' }}>
                            <div className="flex-shrink-0">
                                <div className="card border-0 shadow-sm mb-3" style={{ backgroundColor: 'rgba(255, 255, 255, 0.98)' }}>
                                    <div className="card-header bg-transparent border-bottom-0">
                                        <h6 className="mb-0 fw-bold text-primary">
                                            <i className="bi bi-gear-fill me-2"></i>Control Panel
                                        </h6>
                                    </div>
                                    <div className="card-body p-0">
                                        <Connection 
                                            port={port}
                                            setPort={setPort}
                                            isConnected={isConnected}
                                            onConnect={handleConnect}
                                            onDisconnect={handleDisconnect}
                                        />
                                    </div>
                                </div>
                                
                                <TemperatureDisplay 
                                    temperatures={temperatures} 
                                    isConnected={isConnected}
                                />
                                
                                <FileManager 
                                    onStartPrint={handleStartPrint}
                                    onViewFile={handleViewFile} 
                                    isConnected={isConnected} 
                                />
                                
                                <PrintProgress 
                                    printStatus={printStatus} 
                                    onCancelPrint={handleCancelPrint}
                                    onPausePrint={handlePausePrint}
                                    onResumePrint={handleResumePrint}
                                    onEmergencyStop={handleEmergencyStop}
                                />
                                
                                <ManualControl 
                                    isConnected={isConnected}
                                    onSendCommand={handleSendCommand}
                                />
                            </div>
                            
                            <div className="flex-grow-1 mt-3 log-container" style={{ minHeight: '150px', maxHeight: 'min(300px, 40vh)' }}>
                                <Log log={log} />
                            </div>
                        </div>
                    </div>

                    {/* Main Content: 3D Viewer */}
                    <div className="col-lg-8 col-xl-9 order-1 order-lg-2">
                        <div className="card border-0 shadow viewer-container" style={{ backgroundColor: 'rgba(255, 255, 255, 0.98)', height: 'min(600px, 60vh)', minHeight: '400px' }}>
                            <div className="card-header bg-transparent border-bottom d-flex justify-content-between align-items-center">
                                <div className="d-flex align-items-center">
                                    <i className="bi bi-box me-2 text-primary" style={{ fontSize: '1.2rem' }}></i>
                                    <h5 className="mb-0 fw-bold">3D Visualization</h5>
                                </div>
                                <div className="d-flex align-items-center">
                                    {fileToView && (
                                        <span className="badge bg-info me-2">
                                            <i className="bi bi-file-earmark-code me-1"></i>
                                            {fileToView}
                                        </span>
                                    )}
                                    {printStatus.status === 'printing' && printStatus.filename === fileToView && (
                                        <span className="badge bg-success">
                                            <i className="bi bi-play-fill me-1"></i>
                                            Live Print
                                        </span>
                                    )}
                                </div>
                            </div>
                            <div className="card-body p-0 position-relative">
                                <GcodeViewer 
                                    fileToView={fileToView}
                                    printStatus={printStatus}
                                />
                            </div>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
}

export default App;