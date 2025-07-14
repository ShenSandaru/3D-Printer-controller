// frontend/src/components/ManualControl.jsx
import React, { useState } from 'react';

const ControlButton = ({ command, onSendCommand, children, className = '', style = {} }) => (
    <button 
        onClick={() => onSendCommand(command)} 
        className={`btn ${className}`}
        style={style}
    >
        {children}
    </button>
);

export default function ManualControl({ isConnected, onSendCommand }) {
    const [command, setCommand] = useState('');

    const handleSendCommand = async (e) => {
        e.preventDefault();
        if (!command || !isConnected) return;
        
        await onSendCommand(command);
        setCommand('');
    };

    const quickCommands = [
        { label: 'Get Info', command: 'M115', description: 'Firmware info' },
        { label: 'Get Temp', command: 'M105', description: 'Temperature status' },
        { label: 'Home All', command: 'G28', description: 'Home all axes' }
    ];

    if (!isConnected) {
        return (
            <div className="card border-0 shadow-sm mb-3" style={{ backgroundColor: 'rgba(255, 255, 255, 0.98)' }}>
                <div className="card-header bg-transparent border-bottom-0">
                    <h6 className="mb-0 fw-bold text-primary">
                        <i className="bi bi-joystick me-2"></i>Manual Control
                    </h6>
                </div>
                <div className="card-body text-center py-4">
                    <div className="text-muted">
                        <i className="bi bi-joystick" style={{ fontSize: '2rem', opacity: 0.5 }}></i>
                        <p className="mt-2 mb-0">Connect to printer to enable manual controls</p>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="card border-0 shadow-sm mb-3" style={{ backgroundColor: 'rgba(255, 255, 255, 0.98)' }}>
            <div className="card-header bg-transparent border-bottom-0">
                <h6 className="mb-0 fw-bold text-primary">
                    <i className="bi bi-joystick me-2"></i>Manual Control
                </h6>
            </div>
            <div className="card-body">
                {/* Directional Control Panel */}
                <div className="mb-4">
                    <div className="d-flex justify-content-between align-items-center mb-3">
                        <span className="fw-semibold text-muted">
                            <i className="bi bi-arrows-move me-1"></i>XY Movement
                        </span>
                        <small className="text-muted">10mm steps</small>
                    </div>
                    <div className="bg-light p-3 rounded-3">
                        <div className="row text-center mb-2">
                            <div className="col-4"></div>
                            <div className="col-4">
                                <ControlButton 
                                    onSendCommand={onSendCommand} 
                                    command="G1 Y10 F3000"
                                    className="btn-info w-100 shadow-sm"
                                    style={{ borderRadius: '8px' }}
                                >
                                    <i className="bi bi-arrow-up"></i> +Y
                                </ControlButton>
                            </div>
                            <div className="col-4">
                                <ControlButton 
                                    onSendCommand={onSendCommand} 
                                    command="G28 Z"
                                    className="btn-warning w-100 shadow-sm"
                                    style={{ borderRadius: '8px' }}
                                >
                                    <i className="bi bi-house"></i> Z
                                </ControlButton>
                            </div>
                        </div>
                        <div className="row text-center mb-2">
                            <div className="col-4">
                                <ControlButton 
                                    onSendCommand={onSendCommand} 
                                    command="G1 X-10 F3000"
                                    className="btn-info w-100 shadow-sm"
                                    style={{ borderRadius: '8px' }}
                                >
                                    <i className="bi bi-arrow-left"></i> -X
                                </ControlButton>
                            </div>
                            <div className="col-4">
                                <ControlButton 
                                    onSendCommand={onSendCommand} 
                                    command="G28 X Y"
                                    className="btn-success w-100 shadow-sm"
                                    style={{ borderRadius: '8px' }}
                                >
                                    <i className="bi bi-house-fill"></i> XY
                                </ControlButton>
                            </div>
                            <div className="col-4">
                                <ControlButton 
                                    onSendCommand={onSendCommand} 
                                    command="G1 X10 F3000"
                                    className="btn-info w-100 shadow-sm"
                                    style={{ borderRadius: '8px' }}
                                >
                                    <i className="bi bi-arrow-right"></i> +X
                                </ControlButton>
                            </div>
                        </div>
                        <div className="row text-center">
                            <div className="col-4"></div>
                            <div className="col-4">
                                <ControlButton 
                                    onSendCommand={onSendCommand} 
                                    command="G1 Y-10 F3000"
                                    className="btn-info w-100 shadow-sm"
                                    style={{ borderRadius: '8px' }}
                                >
                                    <i className="bi bi-arrow-down"></i> -Y
                                </ControlButton>
                            </div>
                            <div className="col-4">
                                <ControlButton 
                                    onSendCommand={onSendCommand} 
                                    command="M84"
                                    className="btn-danger w-100 shadow-sm"
                                    style={{ borderRadius: '8px' }}
                                >
                                    <i className="bi bi-power"></i> Off
                                </ControlButton>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Manual G-code input */}
                <div className="mb-3">
                    <label className="form-label fw-semibold text-muted mb-2">
                        <i className="bi bi-terminal me-1"></i>
                        Custom G-code Command
                    </label>
                    <form onSubmit={handleSendCommand}>
                        <div className="input-group">
                            <span className="input-group-text bg-dark text-white border-0">
                                <i className="bi bi-chevron-right"></i>
                            </span>
                            <input 
                                type="text" 
                                className="form-control border-start-0" 
                                placeholder="Enter G-code command (e.g., G28, M105)..." 
                                value={command} 
                                onChange={(e) => setCommand(e.target.value)} 
                                disabled={!isConnected}
                                style={{ borderRadius: '0 8px 8px 0' }}
                            />
                            <button 
                                type="submit" 
                                className="btn btn-primary border-0 shadow-sm" 
                                disabled={!isConnected || !command}
                                style={{ borderRadius: '0 8px 8px 0' }}
                            >
                                <i className="bi bi-send"></i>
                            </button>
                        </div>
                    </form>
                </div>

                {/* Quick command buttons */}
                <div>
                    <label className="form-label fw-semibold text-muted mb-2">
                        <i className="bi bi-lightning me-1"></i>
                        Quick Commands
                    </label>
                    <div className="row g-2">
                        {quickCommands.map((cmd, index) => (
                            <div key={index} className="col-4">
                                <button
                                    className="btn btn-outline-primary btn-sm w-100 shadow-sm"
                                    onClick={() => onSendCommand(cmd.command)}
                                    disabled={!isConnected}
                                    title={cmd.description}
                                    style={{ borderRadius: '8px' }}
                                >
                                    {cmd.label}
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}
