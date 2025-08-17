// frontend/src/components/Connection.jsx - Enhanced User-Friendly Version
import React, { useState, useCallback } from 'react';

export default function Connection({ port, setPort, isConnected, onConnect, onDisconnect }) {
    const [isConnecting, setIsConnecting] = useState(false);
    const [connectionError, setConnectionError] = useState('');
    const [availablePorts, setAvailablePorts] = useState([]);
    const [isDetectingPorts, setIsDetectingPorts] = useState(false);
    const [baudRate, setBaudRate] = useState('115200');

    // Detect available ports
    const detectPorts = useCallback(async () => {
        setIsDetectingPorts(true);
        try {
            const response = await fetch('http://127.0.0.1:5000/api/ports');
            const data = await response.json();
            if (data.status === 'success') {
                setAvailablePorts(data.ports);
                // Auto-select the first likely printer port
                const printerPort = data.ports.find(p => p.is_printer);
                if (printerPort && !port) {
                    setPort(printerPort.port);
                }
            }
        } catch (error) {
            console.error('Failed to detect ports:', error);
        } finally {
            setIsDetectingPorts(false);
        }
    }, [port, setPort]);

    // Auto-detect ports on component mount
    React.useEffect(() => {
        if (!isConnected) {
            detectPorts();
        }
    }, [isConnected, detectPorts]);

    const handleConnect = async () => {
        if (!port || !port.trim()) {
            setConnectionError('Please select a valid port.');
            return;
        }
        
        setIsConnecting(true);
        setConnectionError('');
        
        try {
            await onConnect(port.trim(), baudRate);
        } catch (error) {
            setConnectionError(error.message || 'Failed to connect. Please check the port and baud rate.');
        } finally {
            setIsConnecting(false);
        }
    };

    const handleDisconnect = async () => {
        setConnectionError('');
        await onDisconnect();
    };

    const handlePortChange = (e) => {
        setConnectionError('');
        setPort(e.target.value);
    };
    
    const handleBaudRateChange = (e) => {
        setBaudRate(e.target.value);
    };

    return (
        <div className="p-3 connection-container">
            <div className="row g-2 align-items-center">
                {/* Port and Baud Rate Selection Column */}
                <div className="col-12 col-md-7">
                    {/* Port Selection */}
                    <div className="mb-2">
                        <label htmlFor="comPort" className="form-label fw-semibold text-muted mb-1 small">
                            <i className="bi bi-usb-symbol me-1"></i>Printer Port
                        </label>
                        <div className="input-group shadow-sm">
                            <span className="input-group-text bg-primary text-white border-0"><i className="bi bi-hdd-stack"></i></span>
                            <select
                                id="comPort"
                                className={`form-select border-0 ${connectionError && !port ? 'is-invalid' : ''}`}
                                value={port}
                                onChange={handlePortChange}
                                disabled={isConnected || isConnecting}
                                style={{ backgroundColor: isConnected ? '#e9f5e9' : 'white', fontWeight: '500' }}
                            >
                                <option value="">{isDetectingPorts ? 'Scanning...' : 'Select Port'}</option>
                                {availablePorts.map(p => (
                                    <option key={p.port} value={p.port}>
                                        {p.port} {p.is_printer ? `(${p.description})` : ''}
                                    </option>
                                ))}
                            </select>
                            <button
                                className="btn btn-light border-0"
                                onClick={detectPorts}
                                disabled={isDetectingPorts || isConnected}
                                title="Refresh Ports"
                            >
                                {isDetectingPorts ? <span className="spinner-border spinner-border-sm"></span> : <i className="bi bi-arrow-clockwise"></i>}
                            </button>
                        </div>
                    </div>

                    {/* Baud Rate Selection */}
                    <div>
                        <label htmlFor="baudRate" className="form-label fw-semibold text-muted mb-1 small">
                            <i className="bi bi-speedometer2 me-1"></i>Baud Rate
                        </label>
                        <div className="input-group shadow-sm">
                            <span className="input-group-text bg-info text-white border-0"><i className="bi bi-lightning"></i></span>
                            <select
                                id="baudRate"
                                className="form-select border-0"
                                value={baudRate}
                                onChange={handleBaudRateChange}
                                disabled={isConnected || isConnecting}
                                style={{ backgroundColor: isConnected ? '#e9f5e9' : 'white', fontWeight: '500' }}
                            >
                                <option value="115200">115200 (Recommended)</option>
                                <option value="250000">250000 (Fast)</option>
                                <option value="57600">57600</option>
                                <option value="38400">38400</option>
                                <option value="19200">19200</option>
                                <option value="9600">9600</option>
                            </select>
                        </div>
                    </div>
                </div>
                
                {/* Connection Button Column */}
                <div className="col-12 col-md-5">
                    <div className="d-grid pt-3">
                        {!isConnected ? (
                            <button
                                className="btn btn-success btn-lg shadow"
                                onClick={handleConnect}
                                disabled={isConnecting || !port?.trim()}
                            >
                                {isConnecting ? (
                                    <><span className="spinner-border spinner-border-sm me-2"></span>Connecting</>
                                ) : (
                                    <><i className="bi bi-play-circle-fill me-2"></i>Connect</>
                                )}
                            </button>
                        ) : (
                            <button
                                className="btn btn-danger btn-lg shadow"
                                onClick={handleDisconnect}
                            >
                                <i className="bi bi-stop-circle-fill me-2"></i>Disconnect
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {/* Status Banners */}
            <div className="mt-3">
                {isConnected && (
                    <div className="alert alert-success d-flex align-items-center shadow-sm" role="alert" style={{ borderRadius: '12px' }}>
                        <i className="bi bi-check-circle-fill me-2" style={{ fontSize: '1.2rem' }}></i>
                        <div>
                            <strong>Connected!</strong> Active on port: <strong>{port}</strong> at <strong>{baudRate}</strong> baud.
                        </div>
                    </div>
                )}
                
                {connectionError && (
                    <div className="alert alert-danger d-flex align-items-center shadow-sm" role="alert" style={{ borderRadius: '12px' }}>
                        <i className="bi bi-exclamation-triangle-fill me-2" style={{ fontSize: '1.2rem' }}></i>
                        <div>
                            <strong>Connection Failed:</strong> {connectionError}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}