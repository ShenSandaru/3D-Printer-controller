// frontend/src/components/ManualControl.jsx
import React, { useState } from 'react';
import './EnhancedManualControl.css';

const ControlButton = ({ command, onSendCommand, children, className = '', style = {}, disabled = false }) => (
    <button 
        onClick={() => onSendCommand(command)} 
        className={`btn ${className}`}
        style={style}
        disabled={disabled}
    >
        {children}
    </button>
);

export default function ManualControl({ isConnected, onSendCommand, currentPosition = {} }) {
    const [command, setCommand] = useState('');
    const [stepSize, setStepSize] = useState(10);
    const [feedRate, setFeedRate] = useState(3000);

    const handleSendCommand = async (e) => {
        e.preventDefault();
        if (!command || !isConnected) return;
        
        await onSendCommand(command);
        setCommand('');
    };

    const moveAxis = (axis, direction, distance = stepSize) => {
        if (!isConnected) return;
        const moveDistance = direction * distance;
        onSendCommand(`G91 G1 ${axis}${moveDistance} F${feedRate} G90`);
    };

    const homeAxis = (axes) => {
        if (!isConnected) return;
        onSendCommand(`G28 ${axes}`);
    };

    const setZeroPosition = (axis) => {
        if (!isConnected) return;
        onSendCommand(`G92 ${axis}0`);
    };

    const emergencyStop = () => {
        if (!isConnected) return;
        onSendCommand('M112'); // Emergency stop
    };

    const motorsOff = () => {
        if (!isConnected) return;
        onSendCommand('M84'); // Disable steppers
    };

    const quickCommands = [
        { label: 'Get Info', command: 'M115', icon: 'info-circle', description: 'Firmware info' },
        { label: 'Get Temp', command: 'M105', icon: 'thermometer', description: 'Temperature status' },
        { label: 'Auto Report', command: 'M155 S3', icon: 'arrow-repeat', description: 'Enable auto-report' },
        { label: 'Bed Level', command: 'G29', icon: 'grid-3x3', description: 'Auto bed leveling' }
    ];

    if (!isConnected) {
        return (
            <div className="card manual-control-card disconnected">
                <div className="card-header bg-secondary text-white">
                    <h6 className="card-title mb-0">
                        <i className="bi bi-joystick me-2"></i>Manual Control
                    </h6>
                </div>
                <div className="card-body">
                    <div className="text-muted text-center">
                        <i className="bi bi-joystick" style={{ fontSize: '3rem' }}></i>
                        <p className="mt-2 mb-0">Connect to printer to enable manual controls</p>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="card manual-control-card">
            <div className="card-header bg-primary text-white">
                <h6 className="card-title mb-0">
                    <i className="bi bi-joystick me-2"></i>Manual Control
                </h6>
            </div>
            <div className="card-body">
                {/* Position Display */}
                <div className="position-display mb-3">
                    <div className="row text-center">
                        <div className="col-3">
                            <div className="position-value">
                                <small className="text-muted">X</small>
                                <div className="fw-bold">{currentPosition.x || '0.00'}</div>
                            </div>
                        </div>
                        <div className="col-3">
                            <div className="position-value">
                                <small className="text-muted">Y</small>
                                <div className="fw-bold">{currentPosition.y || '0.00'}</div>
                            </div>
                        </div>
                        <div className="col-3">
                            <div className="position-value">
                                <small className="text-muted">Z</small>
                                <div className="fw-bold">{currentPosition.z || '0.00'}</div>
                            </div>
                        </div>
                        <div className="col-3">
                            <div className="position-value">
                                <small className="text-muted">E</small>
                                <div className="fw-bold">{currentPosition.e || '0.00'}</div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Control Settings */}
                <div className="control-settings mb-3">
                    <div className="row">
                        <div className="col-6">
                            <label className="form-label small">Step Size (mm)</label>
                            <select 
                                className="form-select form-select-sm"
                                value={stepSize}
                                onChange={(e) => setStepSize(parseFloat(e.target.value))}
                            >
                                <option value={0.1}>0.1mm</option>
                                <option value={1}>1mm</option>
                                <option value={10}>10mm</option>
                                <option value={50}>50mm</option>
                                <option value={100}>100mm</option>
                            </select>
                        </div>
                        <div className="col-6">
                            <label className="form-label small">Feed Rate</label>
                            <select 
                                className="form-select form-select-sm"
                                value={feedRate}
                                onChange={(e) => setFeedRate(parseInt(e.target.value))}
                            >
                                <option value={300}>300 mm/min</option>
                                <option value={1000}>1000 mm/min</option>
                                <option value={3000}>3000 mm/min</option>
                                <option value={6000}>6000 mm/min</option>
                            </select>
                        </div>
                    </div>
                </div>

                {/* XY Movement Control */}
                <div className="movement-control mb-4">
                    <div className="control-section">
                        <h6 className="text-primary mb-2">
                            <i className="bi bi-arrows-move me-1"></i>XY Movement
                        </h6>
                        <div className="xy-control-grid">
                            <div className="control-row">
                                <div></div>
                                <ControlButton 
                                    onSendCommand={() => moveAxis('Y', 1)}
                                    className="btn-outline-primary control-btn"
                                    disabled={!isConnected}
                                >
                                    <i className="bi bi-arrow-up"></i>
                                    <br />Y+
                                </ControlButton>
                                <div></div>
                            </div>
                            <div className="control-row">
                                <ControlButton 
                                    onSendCommand={() => moveAxis('X', -1)}
                                    className="btn-outline-primary control-btn"
                                    disabled={!isConnected}
                                >
                                    <i className="bi bi-arrow-left"></i>
                                    <br />X-
                                </ControlButton>
                                <ControlButton 
                                    onSendCommand={() => homeAxis('X Y')}
                                    className="btn-success control-btn"
                                    disabled={!isConnected}
                                >
                                    <i className="bi bi-house"></i>
                                    <br />HOME
                                </ControlButton>
                                <ControlButton 
                                    onSendCommand={() => moveAxis('X', 1)}
                                    className="btn-outline-primary control-btn"
                                    disabled={!isConnected}
                                >
                                    <i className="bi bi-arrow-right"></i>
                                    <br />X+
                                </ControlButton>
                            </div>
                            <div className="control-row">
                                <div></div>
                                <ControlButton 
                                    onSendCommand={() => moveAxis('Y', -1)}
                                    className="btn-outline-primary control-btn"
                                    disabled={!isConnected}
                                >
                                    <i className="bi bi-arrow-down"></i>
                                    <br />Y-
                                </ControlButton>
                                <div></div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Z Movement Control */}
                <div className="z-control mb-4">
                    <h6 className="text-primary mb-2">
                        <i className="bi bi-arrow-up-down me-1"></i>Z Movement
                    </h6>
                    <div className="d-flex justify-content-center gap-2">
                        <ControlButton 
                            onSendCommand={() => moveAxis('Z', 1)}
                            className="btn-info"
                            disabled={!isConnected}
                        >
                            <i className="bi bi-arrow-up"></i> Z+
                        </ControlButton>
                        <ControlButton 
                            onSendCommand={() => homeAxis('Z')}
                            className="btn-warning"
                            disabled={!isConnected}
                        >
                            <i className="bi bi-house"></i> Home Z
                        </ControlButton>
                        <ControlButton 
                            onSendCommand={() => moveAxis('Z', -1)}
                            className="btn-info"
                            disabled={!isConnected}
                        >
                            <i className="bi bi-arrow-down"></i> Z-
                        </ControlButton>
                    </div>
                </div>

                {/* Zero Position Controls */}
                <div className="zero-controls mb-4">
                    <h6 className="text-primary mb-2">
                        <i className="bi bi-bullseye me-1"></i>Set Zero Position
                    </h6>
                    <div className="d-flex flex-wrap gap-1">
                        <ControlButton 
                            onSendCommand={() => setZeroPosition('X')}
                            className="btn-outline-secondary btn-sm"
                            disabled={!isConnected}
                        >
                            Zero X
                        </ControlButton>
                        <ControlButton 
                            onSendCommand={() => setZeroPosition('Y')}
                            className="btn-outline-secondary btn-sm"
                            disabled={!isConnected}
                        >
                            Zero Y
                        </ControlButton>
                        <ControlButton 
                            onSendCommand={() => setZeroPosition('Z')}
                            className="btn-outline-secondary btn-sm"
                            disabled={!isConnected}
                        >
                            Zero Z
                        </ControlButton>
                        <ControlButton 
                            onSendCommand={() => onSendCommand('G92 X0 Y0 Z0')}
                            className="btn-outline-warning btn-sm"
                            disabled={!isConnected}
                        >
                            Zero All
                        </ControlButton>
                    </div>
                </div>

                {/* Emergency Controls */}
                <div className="emergency-controls mb-4">
                    <h6 className="text-danger mb-2">
                        <i className="bi bi-exclamation-triangle me-1"></i>Emergency
                    </h6>
                    <div className="d-flex gap-2">
                        <ControlButton 
                            onSendCommand={emergencyStop}
                            className="btn-danger flex-fill"
                            disabled={!isConnected}
                        >
                            <i className="bi bi-stop-circle"></i> STOP
                        </ControlButton>
                        <ControlButton 
                            onSendCommand={motorsOff}
                            className="btn-warning flex-fill"
                            disabled={!isConnected}
                        >
                            <i className="bi bi-power"></i> Motors Off
                        </ControlButton>
                    </div>
                </div>

                {/* Quick Commands */}
                <div className="quick-commands mb-3">
                    <h6 className="text-primary mb-2">
                        <i className="bi bi-lightning me-1"></i>Quick Commands
                    </h6>
                    <div className="row g-1">
                        {quickCommands.map((cmd, index) => (
                            <div key={index} className="col-6">
                                <ControlButton 
                                    onSendCommand={() => onSendCommand(cmd.command)}
                                    className="btn-outline-primary btn-sm w-100"
                                    disabled={!isConnected}
                                >
                                    <i className={`bi bi-${cmd.icon} me-1`}></i>
                                    {cmd.label}
                                </ControlButton>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Custom Command Input */}
                <div className="custom-command">
                    <label className="form-label fw-semibold text-muted mb-2">
                        <i className="bi bi-terminal me-1"></i>
                        Custom G-code Command
                    </label>
                    <form onSubmit={handleSendCommand} className="input-group">
                        <input
                            type="text"
                            className="form-control"
                            placeholder="Enter G-code command..."
                            value={command}
                            onChange={(e) => setCommand(e.target.value)}
                            disabled={!isConnected}
                        />
                        <button 
                            className="btn btn-primary" 
                            type="submit"
                            disabled={!isConnected || !command}
                        >
                            <i className="bi bi-send"></i>
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
}
