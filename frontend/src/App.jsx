import React, { useState, useEffect } from 'react';
import Connection from './components/Connection';
import ManualControl from './components/EnhancedManualControl';
import CircularControlPad from './components/CircularControlPad';
import TemperatureDisplay from './components/TemperatureDisplay';
import FloatingTemperaturePopup from './components/FloatingTemperaturePopup';
import PrintProgress from './components/PrintProgress';
import FileManager from './components/FileManager';
import Log from './components/Log';
import GcodeViewer from './components/GcodeViewer';
import ExtruderControl from './components/ExtruderControl';
import AdvancedSettings from './components/AdvancedSettings';
import ProbePanel from './components/ProbePanel';
import './App.css';

function App() {
    const [isConnected, setIsConnected] = useState(false);
    const [port, setPort] = useState('');
    const [log, setLog] = useState([]);
    const [temperatures, setTemperatures] = useState(null);
    const [printStatus, setPrintStatus] = useState({ status: 'idle' });
    const [gcode, setGcode] = useState('');
    const [currentPosition, setCurrentPosition] = useState({ x: 0, y: 0, z: 0, e: 0 });
    const [settings, setSettings] = useState({
        enableTemperaturePanel: true,
        enableExtruderPanel: true,
        enableFilesPanel: true,
        enableCommandsPanel: true,
        enableProbePanel: false,
        enableGRBLPanel: false,
        useCircularControlPad: true  // New setting for control pad type
    });

    // Resizable layout state
    const [layout, setLayout] = useState(() => {
        const savedLayout = localStorage.getItem('printerControllerLayout');
        return savedLayout ? JSON.parse(savedLayout) : {
            leftPanelWidth: 300,
            rightPanelWidth: 300,
            logPanelHeight: 250,
            gcodeViewerHeight: 400
        };
    });

    // Save layout to localStorage whenever it changes
    useEffect(() => {
        localStorage.setItem('printerControllerLayout', JSON.stringify(layout));
    }, [layout]);

    // Drag state for resizing
    const [isDragging, setIsDragging] = useState(null);
    const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

    // Handle mouse down on resize handles
    const handleResizeStart = (resizeType, e) => {
        e.preventDefault();
        setIsDragging(resizeType);
        setDragStart({ x: e.clientX, y: e.clientY });
    };

    // Handle mouse move during resize
    const handleResizeMove = (e) => {
        if (!isDragging) return;

        const deltaX = e.clientX - dragStart.x;
        const deltaY = e.clientY - dragStart.y;

        setLayout(prev => {
            const newLayout = { ...prev };
            
            switch (isDragging) {
                case 'left':
                    newLayout.leftPanelWidth = Math.max(200, Math.min(500, prev.leftPanelWidth + deltaX));
                    break;
                case 'right':
                    newLayout.rightPanelWidth = Math.max(200, Math.min(500, prev.rightPanelWidth - deltaX));
                    break;
                case 'log':
                    newLayout.logPanelHeight = Math.max(150, Math.min(400, prev.logPanelHeight - deltaY));
                    break;
                case 'gcode':
                    newLayout.gcodeViewerHeight = Math.max(200, Math.min(600, prev.gcodeViewerHeight + deltaY));
                    break;
            }
            
            return newLayout;
        });

        setDragStart({ x: e.clientX, y: e.clientY });
    };

    // Handle mouse up to stop resizing
    const handleResizeEnd = () => {
        setIsDragging(null);
    };

    // Add global event listeners for mouse move and up
    useEffect(() => {
        if (isDragging) {
            document.addEventListener('mousemove', handleResizeMove);
            document.addEventListener('mouseup', handleResizeEnd);
            document.body.style.cursor = isDragging === 'left' || isDragging === 'right' ? 'col-resize' : 'row-resize';
            document.body.style.userSelect = 'none';
            
            return () => {
                document.removeEventListener('mousemove', handleResizeMove);
                document.removeEventListener('mouseup', handleResizeEnd);
                document.body.style.cursor = 'default';
                document.body.style.userSelect = 'auto';
            };
        }
    }, [isDragging, dragStart]);

    // Helper function for API calls
    const handleApiCall = async (endpoint, options = {}) => {
        try {
            const response = await fetch(`http://127.0.0.1:5000${endpoint}`, {
                headers: {
                    'Content-Type': 'application/json',
                    ...options.headers
                },
                ...options
            });
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            return await response.json();
        } catch (error) {
            const timestamp = new Date().toLocaleTimeString();
            setLog(prev => [...prev, `${timestamp} - Error: ${error.message}`]);
            throw error;
        }
    };

    // Auto-poll temperature data when connected
    useEffect(() => {
        if (isConnected) {
            const interval = setInterval(async () => {
                try {
                    const data = await handleApiCall('/api/status');
                    if (data && data.status !== 'not_connected' && data.status !== 'error') {
                        setTemperatures(data.temperatures);
                        
                        // Update print status if printing
                        if (data.status === 'printing' || data.status === 'paused') {
                            setPrintStatus({
                                status: data.status,
                                progress: data.progress,
                                filename: data.filename,
                                current_line: data.current_line,
                                total_lines: data.total_lines,
                                is_paused: data.is_paused
                            });
                        } else if (data.status === 'connected') {
                            setPrintStatus({ status: 'idle' });
                        }
                    }
                } catch {
                    // Silent fail for temperature polling
                }
            }, 3000);
            return () => clearInterval(interval);
        } else {
            setTemperatures(null);
        }
    }, [isConnected]);

    const connectToPrinter = async (selectedPort, baudRate = '115200') => {
        const timestamp = new Date().toLocaleTimeString();
        try {
            const data = await handleApiCall('/api/connect', {
                method: 'POST',
                body: JSON.stringify({ port: selectedPort, baud_rate: parseInt(baudRate) })
            });
            
            if (data.status === 'success') {
                setIsConnected(true);
                setPort(selectedPort);
                setLog(prev => [...prev, `${timestamp} - Connected to ${selectedPort} at ${baudRate} baud`]);
            } else {
                throw new Error(data.message || 'Connection failed');
            }
        } catch (error) {
            setLog(prev => [...prev, `${timestamp} - Connection failed: ${error.message}`]);
            throw error;
        }
    };

    const disconnectFromPrinter = async () => {
        const timestamp = new Date().toLocaleTimeString();
        try {
            await handleApiCall('/api/disconnect', { method: 'POST' });
            setIsConnected(false);
            setPort('');
            setTemperatures(null);
            setPrintStatus({ status: 'idle' });
            setLog(prev => [...prev, `${timestamp} - Disconnected from printer`]);
        } catch (error) {
            setLog(prev => [...prev, `${timestamp} - Disconnect error: ${error.message}`]);
        }
    };

    const sendCommand = async (command) => {
        if (!isConnected) return;
        const timestamp = new Date().toLocaleTimeString();
        
        try {
            setLog(prev => [...prev, `${timestamp} - Sending: ${command}`]);
            const data = await handleApiCall('/api/command', {
                method: 'POST',
                body: JSON.stringify({ command })
            });
            
            if (data.status === 'success') {
                const response = data.response || 'OK';
                setLog(prev => [...prev, `${timestamp} - Response: ${response}`]);
            } else {
                setLog(prev => [...prev, `${timestamp} - Error: ${data.message}`]);
            }
        } catch (error) {
            setLog(prev => [...prev, `${timestamp} - Command failed: ${error.message}`]);
        }
    };

    const handleStartPrint = async (filename) => {
        const timestamp = new Date().toLocaleTimeString();
        try {
            const data = await handleApiCall('/api/print/start', {
                method: 'POST',
                body: JSON.stringify({ filename })
            });
            
            if (data.status === 'success') {
                setPrintStatus({ status: 'printing', filename });
                setLog(prev => [...prev, `${timestamp} - Started printing: ${filename}`]);
            }
        } catch (error) {
            setLog(prev => [...prev, `${timestamp} - Print start failed: ${error.message}`]);
        }
    };

    const handleViewFile = async (filename) => {
        const timestamp = new Date().toLocaleTimeString();
        try {
            const response = await fetch(`http://127.0.0.1:5000/api/gcode/${filename}`);
            if (response.ok) {
                const content = await response.text();
                setGcode(content);
                setLog(prev => [...prev, `${timestamp} - Loaded ${filename} for viewing`]);
            }
        } catch (error) {
            setLog(prev => [...prev, `${timestamp} - Failed to load file: ${error.message}`]);
        }
    };

    const handleCancelPrint = async () => {
        const timestamp = new Date().toLocaleTimeString();
        try {
            await handleApiCall('/api/print/cancel', { method: 'POST' });
            setPrintStatus({ status: 'idle' });
            setLog(prev => [...prev, `${timestamp} - Print cancelled`]);
        } catch (error) {
            setLog(prev => [...prev, `${timestamp} - Cancel failed: ${error.message}`]);
        }
    };

    const handlePausePrint = async () => {
        const timestamp = new Date().toLocaleTimeString();
        try {
            await handleApiCall('/api/print/pause', { method: 'POST' });
            setPrintStatus(prev => ({ ...prev, status: 'paused' }));
            setLog(prev => [...prev, `${timestamp} - Print paused`]);
        } catch (error) {
            setLog(prev => [...prev, `${timestamp} - Pause failed: ${error.message}`]);
        }
    };

    const handleResumePrint = async () => {
        const timestamp = new Date().toLocaleTimeString();
        try {
            await handleApiCall('/api/print/resume', { method: 'POST' });
            setPrintStatus(prev => ({ ...prev, status: 'printing' }));
            setLog(prev => [...prev, `${timestamp} - Print resumed`]);
        } catch (error) {
            setLog(prev => [...prev, `${timestamp} - Resume failed: ${error.message}`]);
        }
    };

    const handleEmergencyStop = async () => {
        const timestamp = new Date().toLocaleTimeString();
        try {
            await handleApiCall('/api/emergency-stop', { method: 'POST' });
            setPrintStatus({ status: 'idle' });
            setLog(prev => [...prev, `${timestamp} - EMERGENCY STOP activated`]);
        } catch (error) {
            setLog(prev => [...prev, `${timestamp} - Emergency stop failed: ${error.message}`]);
        }
    };

    const handleSettingsChange = (newSettings) => {
        setSettings(newSettings);
    };

    return (
        <div className="container-fluid vh-100 d-flex flex-column p-3" style={{ backgroundColor: 'transparent' }}>
            {/* Floating Temperature Popup */}
            <FloatingTemperaturePopup 
                temperatures={temperatures}
                isConnected={isConnected}
            />
            
            <header className="mb-3">
                <div className="text-center">
                    <div className="d-flex justify-content-between align-items-center">
                        <h1 className="display-4 fw-bold text-white mb-2 gradient-text flex-grow-1" 
                            style={{ textShadow: '2px 2px 4px rgba(0,0,0,0.3)' }}>
                            <i className="bi bi-printer me-3"></i>
                            3D Print Hub
                        </h1>
                        <AdvancedSettings 
                            isConnected={isConnected} 
                            onSendCommand={sendCommand}
                            onSettingsChange={handleSettingsChange}
                        />
                    </div>
                    <p className="lead text-white-50 mb-0">Professional 3D Printer Controller</p>
                </div>
            </header>
            
            <main className="flex-grow-1 d-flex flex-column">
                {/* Top Control Section */}
                <div className="row g-3 mb-3">
                    {/* Left Sidebar */}
                    <div className="col-lg-4 d-flex flex-column">
                        <div className="card border-0 shadow-lg mb-3" style={{ backgroundColor: 'rgba(255, 255, 255, 0.98)' }}>
                            <div className="card-body p-0">
                                <Connection 
                                    port={port}
                                    setPort={setPort}
                                    isConnected={isConnected}
                                    onConnect={connectToPrinter}
                                    onDisconnect={disconnectFromPrinter}
                                />
                            </div>
                        </div>
                        
                        <div className="mb-3">
                            {settings.useCircularControlPad ? (
                                <CircularControlPad 
                                    isConnected={isConnected}
                                    onSendCommand={sendCommand}
                                    currentPosition={currentPosition}
                                />
                            ) : (
                                <ManualControl 
                                    isConnected={isConnected}
                                    onSendCommand={sendCommand}
                                    currentPosition={currentPosition}
                                />
                            )}
                        </div>
                        
                        {/* Enhanced Extruder Control */}
                        {settings.enableExtruderPanel && (
                            <div className="mb-3">
                                <ExtruderControl 
                                    isConnected={isConnected}
                                    onSendCommand={sendCommand}
                                    temperatures={temperatures}
                                />
                            </div>
                        )}
                        
                        {/* Probe Panel */}
                        {settings.enableProbePanel && (
                            <div className="mb-3">
                                <ProbePanel 
                                    isConnected={isConnected}
                                    onSendCommand={sendCommand}
                                    settings={settings}
                                />
                            </div>
                        )}
                        
                        <div className="flex-grow-1" style={{ minHeight: '200px' }}>
                            <Log log={log} />
                        </div>
                    </div>
                    
                    {/* Right Content Area */}
                    <div className="col-lg-8 d-flex flex-column">
                        {/* Temperature Display */}
                        {settings.enableTemperaturePanel && (
                            <div className="mb-3">
                                <TemperatureDisplay 
                                    temperatures={temperatures}
                                    isConnected={isConnected}
                                    onSendCommand={sendCommand}
                                />
                            </div>
                        )}
                        
                        {/* Print Progress (only shown when printing) */}
                        {(printStatus.status === 'printing' || printStatus.status === 'paused') && (
                            <div className="mb-3">
                                <PrintProgress 
                                    printStatus={printStatus}
                                    onCancelPrint={handleCancelPrint}
                                    onPausePrint={handlePausePrint}
                                    onResumePrint={handleResumePrint}
                                    onEmergencyStop={handleEmergencyStop}
                                />
                            </div>
                        )}
                        
                        {/* File Manager */}
                        {settings.enableFilesPanel && (
                            <div className="flex-grow-1">
                                <FileManager 
                                    isConnected={isConnected}
                                    onStartPrint={handleStartPrint}
                                    onViewFile={handleViewFile}
                                />
                            </div>
                        )}
                    </div>
                </div>
                
                {/* Bottom G-code Viewer Section - Full Width */}
                <div className="row g-0 gcode-viewer-bottom">
                    <div className="col-12">
                        <div className="card border-0 shadow-lg gcode-viewer-card" style={{ 
                            backgroundColor: 'rgba(255, 255, 255, 0.98)',
                            minHeight: '400px'
                        }}>
                            <GcodeViewer gcode={gcode} />
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
}

export default App;