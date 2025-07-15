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
            setConnectionError('Please enter a valid COM port (e.g., COM3, COM6)');
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
    return (
        <div className="p-3 connection-container">
            <div className="row g-3">
                {/* Port Selection Column */}
                <div className="col-12 col-md-6 col-lg-4">
                    <div className="mb-3">
                        <label htmlFor="comPort" className="form-label fw-semibold text-muted mb-2">
                            <i className="bi bi-usb-symbol me-2"></i>
                            Printer Port
                        </label>
                        <div className="input-group shadow-sm">
                            <span className="input-group-text bg-primary text-white border-0">
                                <i className="bi bi-hdd-stack"></i>
                            </span>
                            <input 
                                id="comPort" 
                                type="text" 
                                className={`form-control border-0 ${connectionError ? 'is-invalid' : ''}`}
                                placeholder="COM3, COM6, /dev/ttyUSB0..."
                                value={port} 
                                onChange={handlePortChange}
                                disabled={isConnected || isConnecting}
                                style={{ 
                                    backgroundColor: isConnected ? '#e8f5e8' : 'white',
                                    fontSize: '1rem',
                                    fontWeight: '500'
                                }}
                            />
                        </div>
                        {connectionError && (
                            <div className="invalid-feedback d-block mt-1">
                                <i className="bi bi-exclamation-triangle me-1"></i>
                                {connectionError}
                            </div>
                        )}
                        <div className="mt-2">
                            <small className="text-muted d-block">
                                <i className="bi bi-info-circle me-1"></i>
                                Common: COM3, COM6 (Windows)
                            </small>
                            <button 
                                className="btn btn-link btn-sm p-0 text-decoration-none mt-1"
                                onClick={detectPorts}
                                disabled={isDetectingPorts || isConnected}
                                style={{ fontSize: '0.75rem' }}
                            >
                                {isDetectingPorts ? (
                                    <>
                                        <span className="spinner-border spinner-border-sm me-1" style={{ width: '0.75rem', height: '0.75rem' }}></span>
                                        Detecting...
                                    </>
                                ) : (
                                    <>
                                        <i className="bi bi-arrow-clockwise me-1"></i>
                                        Refresh Ports
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
                
                {/* Baud Rate Selection Column */}
                <div className="col-12 col-md-6 col-lg-3">
                    <div className="mb-3">
                        <label htmlFor="baudRate" className="form-label fw-semibold text-muted mb-2">
                            <i className="bi bi-speedometer2 me-2"></i>
                            Baud Rate
                        </label>
                        <div className="input-group shadow-sm">
                            <span className="input-group-text bg-info text-white border-0">
                                <i className="bi bi-lightning"></i>
                            </span>
                            <select 
                                id="baudRate"
                                className="form-select border-0"
                                value={baudRate}
                                onChange={(e) => setBaudRate(e.target.value)}
                                disabled={isConnected || isConnecting}
                                style={{ 
                                    backgroundColor: isConnected ? '#e8f5e8' : 'white',
                                    fontSize: '1rem',
                                    fontWeight: '500'
                                }}
                            >
                                <option value="115200">115200 (Common)</option>
                                <option value="250000">250000 (Fast)</option>
                                <option value="57600">57600</option>
                                <option value="38400">38400</option>
                                <option value="19200">19200</option>
                                <option value="9600">9600</option>
                            </select>
                        </div>
                        <div className="mt-2">
                            <small className="text-muted d-block">
                                <i className="bi bi-info-circle me-1"></i>
                                115200 for most printers
                            </small>
                        </div>
                    </div>
                </div>
                
                {/* Connection Button Column */}
                <div className="col-12 col-lg-5">
                    <div className="mb-3">
                        <label className="form-label fw-semibold text-muted mb-2">
                            <i className="bi bi-lightning-charge me-2"></i>
                            Connection Status
                        </label>
                        <div className="d-grid">
                            {!isConnected ? (
                                <button 
                                    className="btn btn-success btn-lg shadow-lg position-relative" 
                                    onClick={handleConnect}
                                    disabled={isConnecting || !port?.trim()}
                                    style={{ 
                                        borderRadius: '12px',
                                        padding: '10px 20px',
                                        fontSize: '1.1rem',
                                        fontWeight: '600',
                                        background: isConnecting 
                                            ? 'linear-gradient(45deg, #28a745, #20c997)' 
                                            : 'linear-gradient(45deg, #28a745, #34ce57)',
                                        border: 'none',
                                        transform: isConnecting ? 'scale(0.98)' : 'scale(1)',
                                        transition: 'all 0.2s ease'
                                    }}
                                >
                                    {isConnecting ? (
                                        <>
                                            <span className="spinner-border spinner-border-sm me-2" role="status"></span>
                                            Connecting...
                                        </>
                                    ) : (
                                        <>
                                            <i className="bi bi-play-circle-fill me-2"></i>
                                            Connect Printer
                                        </>
                                    )}
                                </button>
                            ) : (
                                <button 
                                    className="btn btn-danger btn-lg shadow-lg" 
                                    onClick={handleDisconnect}
                                    style={{ 
                                        borderRadius: '12px',
                                        padding: '10px 20px',
                                        fontSize: '1.1rem',
                                        fontWeight: '600',
                                        background: 'linear-gradient(45deg, #dc3545, #fd7e14)',
                                        border: 'none',
                                        transition: 'all 0.2s ease'
                                    }}
                                >
                                    <i className="bi bi-stop-circle-fill me-2"></i>
                                    Disconnect
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            </div>
            
            {/* Quick Port Suggestions Row */}
            {!isConnected && !isConnecting && (
                <div className="row">
                    <div className="col-12">
                        <div className="mt-2">
                            <small className="text-muted d-block mb-2">
                                {availablePorts.length > 0 ? 'Detected ports:' : 'Quick select:'}
                            </small>
                            <div className="d-flex gap-2 flex-wrap">
                                {availablePorts.length > 0 ? (
                                    availablePorts.slice(0, 6).map(portInfo => (
                                        <button 
                                            key={portInfo.port}
                                            className={`btn btn-sm ${portInfo.is_printer ? 'btn-primary' : 'btn-outline-secondary'}`}
                                            onClick={() => setPort(portInfo.port)}
                                            title={`${portInfo.description} - ${portInfo.manufacturer}`}
                                            style={{ 
                                                fontSize: '0.8rem', 
                                                borderRadius: '8px',
                                                minWidth: '60px'
                                            }}
                                        >
                                            {portInfo.port}
                                            {portInfo.is_printer && (
                                                <i className="bi bi-printer-fill ms-1" style={{ fontSize: '0.6rem' }}></i>
                                            )}
                                        </button>
                                    ))
                                ) : (
                                    ['COM3', 'COM6', 'COM7'].map(quickPort => (
                                        <button 
                                            key={quickPort}
                                            className="btn btn-outline-secondary btn-sm"
                                            onClick={() => setPort(quickPort)}
                                            style={{ fontSize: '0.8rem', borderRadius: '8px', minWidth: '60px' }}
                                        >
                                            {quickPort}
                                        </button>
                                    ))
                                )}
                            </div>
                            {availablePorts.length > 0 && (
                                <div className="mt-2">
                                    <small className="text-success">
                                        <i className="bi bi-check-circle me-1"></i>
                                        Found {availablePorts.length} port(s) 
                                        {availablePorts.some(p => p.is_printer) && ' (printer detected)'}
                                    </small>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
            
            {/* Enhanced Connection Status Banners */}
            {isConnected && (
                <div className="alert alert-success border-0 shadow-lg mt-3 mb-0 position-relative overflow-hidden connection-success" 
                     role="alert" 
                     style={{ 
                         borderRadius: '15px',
                         background: 'linear-gradient(135deg, #d4edda 0%, #c3e6cb 100%)',
                         border: '2px solid #28a745'
                     }}>
                    <div className="d-flex align-items-center">
                        <div className="me-3">
                            <i className="bi bi-check-circle-fill text-success" style={{ fontSize: '2rem' }}></i>
                        </div>
                        <div className="flex-grow-1">
                            <h6 className="alert-heading mb-1 text-success fw-bold">
                                <i className="bi bi-wifi me-2"></i>
                                Connected Successfully!
                            </h6>
                            <div className="mb-1">
                                <small className="text-success-emphasis">
                                    <i className="bi bi-hdd-stack me-1"></i>
                                    Active on port: <strong>{port}</strong>
                                </small>
                            </div>
                            <div className="d-flex align-items-center">
                                <div className="badge bg-success me-2 pulse">
                                    <i className="bi bi-circle-fill me-1"></i>
                                    Online
                                </div>
                                <small className="text-muted">Ready to receive commands</small>
                            </div>
                        </div>
                    </div>
                    
                    {/* Animated connection indicator */}
                    <div className="position-absolute top-0 end-0 m-2">
                        <div className="spinner-grow spinner-grow-sm text-success" role="status" style={{ animationDuration: '2s' }}>
                            <span className="visually-hidden">Connected</span>
                        </div>
                    </div>
                </div>
            )}
            
            {connectionError && (
                <div className="alert alert-danger border-0 shadow-sm mt-3 mb-0" 
                     role="alert" 
                     style={{ borderRadius: '15px' }}>
                    <div className="d-flex align-items-center">
                        <i className="bi bi-exclamation-triangle-fill text-danger me-3" style={{ fontSize: '1.5rem' }}></i>
                        <div>
                            <strong>Connection Failed</strong>
                            <div className="small mt-1">{connectionError}</div>
                            <small className="text-muted">
                                💡 Try checking: Port availability • Cable connection • Printer power
                            </small>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
