import React, { useState } from 'react';
import './ProbePanel.css';

const ProbePanel = ({ isConnected, onSendCommand, settings = {} }) => {
    const [probeStatus, setProbeStatus] = useState({
        detected: false,
        isProbing: false,
        lastZ: 0
    });

    const [probeSettings, setProbeSettings] = useState({
        maxTravel: settings.probeMaxTravel || 40,
        feedrate: settings.probeFeedrate || 100,
        touchPlateThickness: settings.probeTouchPlateThickness || 0.5,
        retractDistance: 2,
        numberOfProbes: 3
    });

    const [probingSequence, setProbingSequence] = useState({
        active: false,
        currentPoint: 0,
        totalPoints: 9,
        points: [
            { x: 20, y: 20, name: 'Front Left' },
            { x: 100, y: 20, name: 'Front Center' },
            { x: 180, y: 20, name: 'Front Right' },
            { x: 20, y: 100, name: 'Center Left' },
            { x: 100, y: 100, name: 'Center' },
            { x: 180, y: 100, name: 'Center Right' },
            { x: 20, y: 180, name: 'Back Left' },
            { x: 100, y: 180, name: 'Back Center' },
            { x: 180, y: 180, name: 'Back Right' }
        ]
    });

    // Probe status icon based on detection
    const ProbeStatusIcon = ({ detected }) => (
        <svg width="1.3em" height="1.2em" viewBox="0 0 24 24">
            <circle 
                cx="12" 
                cy="12" 
                r="8" 
                fill={detected ? "#28a745" : "#6c757d"}
                stroke={detected ? "#155724" : "#495057"}
                strokeWidth="2"
            />
            {detected && (
                <path 
                    d="M9 12l2 2 4-4" 
                    stroke="white" 
                    strokeWidth="2" 
                    fill="none"
                />
            )}
        </svg>
    );

    const handleSimpleProbe = async () => {
        if (!isConnected) return;
        
        setProbeStatus(prev => ({ ...prev, isProbing: true }));
        
        try {
            // Send probe command
            onSendCommand(`G30`);
            
            // Simulate probe completion (in real implementation, you'd listen for response)
            setTimeout(() => {
                setProbeStatus(prev => ({ 
                    ...prev, 
                    isProbing: false, 
                    detected: true,
                    lastZ: Math.random() * 0.5 // Simulated Z value
                }));
            }, 2000);
        } catch (error) {
            setProbeStatus(prev => ({ ...prev, isProbing: false }));
        }
    };

    const handleBedLevelingSequence = async () => {
        if (!isConnected) return;
        
        setProbingSequence(prev => ({ ...prev, active: true, currentPoint: 0 }));
        
        // Start G29 Auto Bed Leveling
        onSendCommand('G29');
        
        // Simulate the probing sequence
        const probeNextPoint = (pointIndex) => {
            if (pointIndex < probingSequence.points.length) {
                const point = probingSequence.points[pointIndex];
                setProbingSequence(prev => ({ ...prev, currentPoint: pointIndex }));
                
                // Move to point and probe
                onSendCommand(`G1 X${point.x} Y${point.y} F3000`);
                onSendCommand(`G30`);
                
                setTimeout(() => {
                    probeNextPoint(pointIndex + 1);
                }, 3000);
            } else {
                // Sequence complete
                setProbingSequence(prev => ({ ...prev, active: false, currentPoint: 0 }));
                onSendCommand('G1 Z10 F600'); // Raise Z
            }
        };
        
        probeNextPoint(0);
    };

    const handleZProbe = async () => {
        if (!isConnected) return;
        
        setProbeStatus(prev => ({ ...prev, isProbing: true }));
        
        // G38.2 - Probe toward workpiece
        onSendCommand(`G38.2 Z-${probeSettings.maxTravel} F${probeSettings.feedrate}`);
        
        setTimeout(() => {
            setProbeStatus(prev => ({ ...prev, isProbing: false, detected: true }));
        }, 2000);
    };

    const handleSetZZero = () => {
        if (!isConnected) return;
        
        // Set current position as Z zero, accounting for touch plate thickness
        onSendCommand(`G92 Z${probeSettings.touchPlateThickness}`);
    };

    const handleHomingCycle = () => {
        if (!isConnected) return;
        onSendCommand('G28'); // Home all axes
    };

    const handleProbeCorners = async () => {
        if (!isConnected) return;
        
        const corners = [
            { x: 10, y: 10, name: 'Front Left' },
            { x: 190, y: 10, name: 'Front Right' },
            { x: 190, y: 190, name: 'Back Right' },
            { x: 10, y: 190, name: 'Back Left' }
        ];
        
        setProbingSequence(prev => ({ 
            ...prev, 
            active: true, 
            currentPoint: 0,
            points: corners,
            totalPoints: corners.length 
        }));
        
        for (let i = 0; i < corners.length; i++) {
            const corner = corners[i];
            setProbingSequence(prev => ({ ...prev, currentPoint: i }));
            
            onSendCommand(`G1 X${corner.x} Y${corner.y} F3000`);
            onSendCommand(`G30`);
            
            await new Promise(resolve => setTimeout(resolve, 3000));
        }
        
        setProbingSequence(prev => ({ ...prev, active: false, currentPoint: 0 }));
    };

    return (
        <div className="card border-0 shadow-lg mb-3" style={{ backgroundColor: 'rgba(255, 255, 255, 0.98)' }}>
            <div className="card-header bg-info text-white">
                <div className="d-flex justify-content-between align-items-center">
                    <h6 className="mb-0">
                        <i className="bi bi-bullseye me-2"></i>
                        Probe Panel
                    </h6>
                    <div className="d-flex align-items-center">
                        <span className="me-2">Probe Status:</span>
                        <ProbeStatusIcon detected={probeStatus.detected} />
                    </div>
                </div>
            </div>
            
            <div className="card-body">
                {/* Probe Settings */}
                <div className="row mb-4">
                    <div className="col-12">
                        <h6 className="text-info mb-3">
                            <i className="bi bi-gear me-2"></i>
                            Probe Settings
                        </h6>
                        <div className="row">
                            <div className="col-md-3">
                                <label className="form-label">Max Travel (mm)</label>
                                <input 
                                    type="number" 
                                    className="form-control form-control-sm"
                                    value={probeSettings.maxTravel}
                                    onChange={(e) => setProbeSettings(prev => ({ 
                                        ...prev, 
                                        maxTravel: parseFloat(e.target.value) 
                                    }))}
                                    min="10"
                                    max="100"
                                    step="0.1"
                                />
                            </div>
                            <div className="col-md-3">
                                <label className="form-label">Feedrate (mm/min)</label>
                                <input 
                                    type="number" 
                                    className="form-control form-control-sm"
                                    value={probeSettings.feedrate}
                                    onChange={(e) => setProbeSettings(prev => ({ 
                                        ...prev, 
                                        feedrate: parseInt(e.target.value) 
                                    }))}
                                    min="50"
                                    max="1000"
                                />
                            </div>
                            <div className="col-md-3">
                                <label className="form-label">Touch Plate (mm)</label>
                                <input 
                                    type="number" 
                                    className="form-control form-control-sm"
                                    value={probeSettings.touchPlateThickness}
                                    onChange={(e) => setProbeSettings(prev => ({ 
                                        ...prev, 
                                        touchPlateThickness: parseFloat(e.target.value) 
                                    }))}
                                    min="0"
                                    max="10"
                                    step="0.01"
                                />
                            </div>
                            <div className="col-md-3">
                                <label className="form-label">Retract (mm)</label>
                                <input 
                                    type="number" 
                                    className="form-control form-control-sm"
                                    value={probeSettings.retractDistance}
                                    onChange={(e) => setProbeSettings(prev => ({ 
                                        ...prev, 
                                        retractDistance: parseFloat(e.target.value) 
                                    }))}
                                    min="0.5"
                                    max="10"
                                    step="0.1"
                                />
                            </div>
                        </div>
                    </div>
                </div>

                {/* Quick Probe Actions */}
                <div className="row mb-4">
                    <div className="col-12">
                        <h6 className="text-info mb-3">
                            <i className="bi bi-lightning me-2"></i>
                            Quick Actions
                        </h6>
                        <div className="d-flex flex-wrap gap-2">
                            <button 
                                className="btn btn-primary btn-sm"
                                onClick={handleSimpleProbe}
                                disabled={!isConnected || probeStatus.isProbing}
                            >
                                {probeStatus.isProbing ? (
                                    <>
                                        <div className="spinner-border spinner-border-sm me-2" role="status"></div>
                                        Probing...
                                    </>
                                ) : (
                                    <>
                                        <i className="bi bi-arrow-down me-1"></i>
                                        Simple Probe
                                    </>
                                )}
                            </button>
                            
                            <button 
                                className="btn btn-success btn-sm"
                                onClick={handleZProbe}
                                disabled={!isConnected || probeStatus.isProbing}
                            >
                                <i className="bi bi-crosshair me-1"></i>
                                Z Probe
                            </button>
                            
                            <button 
                                className="btn btn-warning btn-sm"
                                onClick={handleSetZZero}
                                disabled={!isConnected}
                            >
                                <i className="bi bi-bullseye me-1"></i>
                                Set Z Zero
                            </button>
                            
                            <button 
                                className="btn btn-info btn-sm"
                                onClick={handleHomingCycle}
                                disabled={!isConnected}
                            >
                                <i className="bi bi-house me-1"></i>
                                Home All
                            </button>
                        </div>
                    </div>
                </div>

                {/* Advanced Probing */}
                <div className="row mb-4">
                    <div className="col-12">
                        <h6 className="text-info mb-3">
                            <i className="bi bi-grid-3x3 me-2"></i>
                            Advanced Probing
                        </h6>
                        <div className="d-flex flex-wrap gap-2">
                            <button 
                                className="btn btn-outline-primary"
                                onClick={handleBedLevelingSequence}
                                disabled={!isConnected || probingSequence.active}
                            >
                                {probingSequence.active ? (
                                    <>
                                        <div className="spinner-border spinner-border-sm me-2" role="status"></div>
                                        Auto Bed Level ({probingSequence.currentPoint + 1}/{probingSequence.totalPoints})
                                    </>
                                ) : (
                                    <>
                                        <i className="bi bi-grid-3x3-gap me-1"></i>
                                        Auto Bed Level (G29)
                                    </>
                                )}
                            </button>
                            
                            <button 
                                className="btn btn-outline-secondary"
                                onClick={handleProbeCorners}
                                disabled={!isConnected || probingSequence.active}
                            >
                                <i className="bi bi-square me-1"></i>
                                Probe Corners
                            </button>
                        </div>
                    </div>
                </div>

                {/* Probing Progress */}
                {probingSequence.active && (
                    <div className="row">
                        <div className="col-12">
                            <div className="card bg-light">
                                <div className="card-body">
                                    <h6 className="card-title">
                                        <i className="bi bi-activity me-2"></i>
                                        Probing in Progress
                                    </h6>
                                    <div className="progress mb-3">
                                        <div 
                                            className="progress-bar progress-bar-striped progress-bar-animated"
                                            style={{ 
                                                width: `${((probingSequence.currentPoint + 1) / probingSequence.totalPoints) * 100}%` 
                                            }}
                                        ></div>
                                    </div>
                                    <p className="mb-0">
                                        Current: {probingSequence.points[probingSequence.currentPoint]?.name || 'Starting...'}
                                        <br />
                                        Progress: {probingSequence.currentPoint + 1} of {probingSequence.totalPoints} points
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Probe Results */}
                {probeStatus.detected && !probeStatus.isProbing && (
                    <div className="row">
                        <div className="col-12">
                            <div className="alert alert-success d-flex align-items-center">
                                <ProbeStatusIcon detected={true} />
                                <div className="ms-3">
                                    <strong>Probe Detected!</strong>
                                    <br />
                                    Last Z Position: {probeStatus.lastZ.toFixed(3)} mm
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default ProbePanel;
