import React, { useState, useEffect } from 'react';
import './ExtruderControl.css';

const ExtruderControl = ({ isConnected, onSendCommand, temperatures }) => {
    const [extruderSettings, setExtruderSettings] = useState({
        feedRate: 100,
        flowRate: 100,
        fanSpeed: 0,
        extrudeDistance: 5,
        retractDistance: 5,
        extrusionSpeed: 300,
        hotendTarget: 185,
        bedTarget: 60
    });

    const [activeExtruder, setActiveExtruder] = useState(0);
    const [multiExtruder, setMultiExtruder] = useState(false);

    const handleSetTemperature = (type, temperature) => {
        if (!isConnected) return;
        const command = type === 'hotend' ? `M104 S${temperature}` : `M140 S${temperature}`;
        onSendCommand(command);
    };

    const handleTemperatureOff = (type) => {
        if (!isConnected) return;
        if (type === 'hotend') {
            onSendCommand('M104 S0');
            // Don't reset the target in the dropdown, just send the off command
        } else if (type === 'bed') {
            onSendCommand('M140 S0');
            // Don't reset the target in the dropdown, just send the off command
        }
    };

    // SVG Icons for buttons
    const ExtrudeIcon = () => (
        <svg width="1.3em" height="1.2em" viewBox="0 0 1300 1200">
            <g transform="translate(50,1200) scale(1, -1)">
                <path fill="currentColor" d="M650 1200h50q40 0 70 -40.5t30 -84.5v-150l-28 -125h328q40 0 70 -40.5t30 -84.5v-100q0 -45 -29 -74l-238 -344q-16 -24 -38 -40.5t-45 -16.5h-250q-7 0 -42 25t-66 50l-31 25h-61q-45 0 -72.5 18t-27.5 57v400q0 36 20 63l145 196l96 198q13 28 37.5 48t51.5 20z"/>
            </g>
        </svg>
    );

    const RetractIcon = () => (
        <svg width="1.3em" height="1.2em" viewBox="0 0 1300 1200">
            <g transform="translate(50,1200) scale(1, -1)">
                <path fill="currentColor" d="M465 477l571 571q8 8 18 8t17 -8l177 -177q8 -7 8 -17t-8 -18l-783 -784q-7 -8 -17.5 -8t-17.5 8l-384 384q-8 8 -8 18t8 17l177 177q7 8 17 8t18 -8l171 -171q7 -7 18 -7t18 7z"/>
            </g>
        </svg>
    );

    const FanIcon = () => (
        <svg width="1.3em" height="1.2em" viewBox="0 0 24 24">
            <path fill="currentColor" d="M12 2C13.1 2 14 2.9 14 4C14 5.1 13.1 6 12 6C10.9 6 10 5.1 10 4C10 2.9 10.9 2 12 2M21 9V7L20.32 7.13C20.56 6.58 20.56 5.94 20.32 5.39L21 5.26V3.26L20.31 3.39C19.95 2.84 19.4 2.42 18.76 2.2L19 1.5H17L16.74 2.21C16.1 2.21 15.46 2.42 14.92 2.78L14.79 2.09H12.79L12.92 2.78C12.38 2.42 11.74 2.21 11.1 2.21L10.84 1.5H8.84L9.08 2.2C8.44 2.42 7.89 2.84 7.53 3.39L6.84 3.26V5.26L7.53 5.39C7.17 5.94 7.17 6.58 7.53 7.13L6.84 7V9L7.53 8.87C7.89 9.42 8.44 9.84 9.08 10.06L8.84 10.76H10.84L11.1 10.05C11.74 10.05 12.38 9.84 12.92 9.48L13.05 10.17H15.05L14.92 9.48C15.46 9.84 16.1 10.05 16.74 10.05L17 10.76H19L18.76 10.06C19.4 9.84 19.95 9.42 20.31 8.87L21 9M12 8C10.9 8 10 8.9 10 10S10.9 12 12 12 14 11.1 14 10 13.1 8 12 8Z"/>
        </svg>
    );

    const handleExtrudeCommand = (direction) => {
        if (!isConnected) return;
        
        const distance = direction > 0 ? extruderSettings.extrudeDistance : -extruderSettings.retractDistance;
        const extruderPrefix = multiExtruder ? `T${activeExtruder}` : '';
        
        onSendCommand(`${extruderPrefix} G1 E${distance} F${extruderSettings.extrusionSpeed}`);
    };

    const handleFeedRateChange = (value) => {
        setExtruderSettings(prev => ({ ...prev, feedRate: value }));
        if (isConnected) {
            onSendCommand(`M220 S${value}`);
        }
    };

    const handleFlowRateChange = (value) => {
        setExtruderSettings(prev => ({ ...prev, flowRate: value }));
        if (isConnected) {
            onSendCommand(`M221 S${value}`);
        }
    };

    const handleFanSpeedChange = (value) => {
        setExtruderSettings(prev => ({ ...prev, fanSpeed: value }));
        if (isConnected) {
            const fanValue = Math.round((value / 100) * 255);
            onSendCommand(`M106 S${fanValue}`);
        }
    };

    const handleInputChange = (field, value) => {
        setExtruderSettings(prev => ({ ...prev, [field]: value }));
    };

    const handleKeyUp = (event, type) => {
        if (event.key === 'Enter') {
            const value = parseInt(event.target.value);
            if (type === 'Feed') {
                handleFeedRateChange(value);
            } else if (type === 'Flow') {
                handleFlowRateChange(value);
            } else if (type === 'Fan') {
                handleFanSpeedChange(value);
            }
        }
    };

    return (
        <div className="card border-0 shadow-lg mb-3" style={{ backgroundColor: 'rgba(255, 255, 255, 0.98)' }}>
            <div className="card-header bg-primary text-white">
                <div className="d-flex justify-content-between align-items-center">
                    <h6 className="mb-0">
                        <i className="bi bi-gear-fill me-2"></i>
                        Extruder & Temp Controls
                    </h6>
                    <div className="form-check form-switch">
                        <input 
                            className="form-check-input" 
                            type="checkbox" 
                            id="multiExtruder"
                            checked={multiExtruder}
                            onChange={(e) => setMultiExtruder(e.target.checked)}
                        />
                        <label className="form-check-label text-white" htmlFor="multiExtruder">
                            Multi-Extruder
                        </label>
                    </div>
                </div>
            </div>
            
            <div className="card-body">
                {/* Temperature Controls */}
                <div className="row mb-3">
                    <div className="col-md-6 mb-2 mb-md-0">
                        <div className="control-row">
                            <label className="control-label fw-bold">Hotend:</label>
                            <div className="temperature-controls">
                                <span className={`temp-status me-2 ${(temperatures?.hotend_target || 0) > 0 ? 'on' : 'off'}`}>
                                    {(temperatures?.hotend_target || 0) > 0 ? 'ON' : 'OFF'}
                                </span>
                                <select 
                                    className="form-select form-select-sm me-2"
                                    value={extruderSettings.hotendTarget}
                                    onChange={(e) => setExtruderSettings(prev => ({ ...prev, hotendTarget: parseInt(e.target.value) }))}
                                >
                                    <option value={185}>185° (PLA)</option>
                                    <option value={210}>210° (PETG)</option>
                                    <option value={240}>240° (ABS)</option>
                                    <option value={260}>260° (PC)</option>
                                </select>
                                <div className="btn-group btn-group-sm">
                                    <button 
                                        className="btn btn-outline-success"
                                        onClick={() => handleSetTemperature('hotend', extruderSettings.hotendTarget)}
                                        disabled={!isConnected}
                                    >
                                        Set
                                    </button>
                                    <button 
                                        className="btn btn-outline-danger"
                                        onClick={() => handleTemperatureOff('hotend')}
                                        disabled={!isConnected}
                                    >
                                        Off
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div className="col-md-6">
                        <div className="control-row">
                            <label className="control-label fw-bold">Bed:</label>
                            <div className="temperature-controls">
                                <span className={`temp-status me-2 ${(temperatures?.bed_target || 0) > 0 ? 'on' : 'off'}`}>
                                    {(temperatures?.bed_target || 0) > 0 ? 'ON' : 'OFF'}
                                </span>
                                <select 
                                    className="form-select form-select-sm me-2"
                                    value={extruderSettings.bedTarget}
                                    onChange={(e) => setExtruderSettings(prev => ({ ...prev, bedTarget: parseInt(e.target.value) }))}
                                >
                                    <option value={60}>60° (PLA)</option>
                                    <option value={70}>70° (PETG)</option>
                                    <option value={80}>80° (ABS)</option>
                                    <option value={90}>90° (PC)</option>
                                </select>
                                <div className="btn-group btn-group-sm">
                                    <button 
                                        className="btn btn-outline-success"
                                        onClick={() => handleSetTemperature('bed', extruderSettings.bedTarget)}
                                        disabled={!isConnected}
                                    >
                                        Set
                                    </button>
                                    <button 
                                        className="btn btn-outline-danger"
                                        onClick={() => handleTemperatureOff('bed')}
                                        disabled={!isConnected}
                                    >
                                        Off
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Extruder Selection */}
                {multiExtruder && (
                    <div className="row mb-3">
                        <div className="col-md-4">
                            <span className="fw-bold">Active Extruder</span>
                        </div>
                        <div className="col-md-8">
                            <select 
                                className="form-select form-select-sm"
                                value={activeExtruder}
                                onChange={(e) => setActiveExtruder(parseInt(e.target.value))}
                                disabled={!isConnected}
                            >
                                <option value={0}>Extruder T0</option>
                                <option value={1}>Extruder T1</option>
                            </select>
                        </div>
                    </div>
                )}

                {/* Extrusion Controls */}
                <div className="row mb-3">
                    <div className="col-md-4">
                        <span className="fw-bold">Extrusion</span>
                    </div>
                    <div className="col-md-8">
                        <div className="d-flex align-items-center gap-2">
                            <button 
                                className="btn btn-primary btn-sm"
                                onClick={() => handleExtrudeCommand(1)}
                                disabled={!isConnected}
                                title="Extrude"
                            >
                                <ExtrudeIcon />
                            </button>
                            
                            <button 
                                className="btn btn-info btn-sm"
                                onClick={() => handleExtrudeCommand(-1)}
                                disabled={!isConnected}
                                title="Retract"
                            >
                                <RetractIcon />
                            </button>
                            
                            <div className="input-group input-group-sm" style={{ width: '120px' }}>
                                <input 
                                    type="number"
                                    className="form-control"
                                    value={extruderSettings.extrudeDistance}
                                    onChange={(e) => handleInputChange('extrudeDistance', e.target.value)}
                                    min="0.1"
                                    max="100"
                                    step="0.1"
                                />
                                <span className="input-group-text">mm</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Feed Rate Control */}
                <div className="row mb-3">
                    <div className="col-md-4">
                        <span className="fw-bold">Feed Rate (25-150%)</span>
                    </div>
                    <div className="col-md-8">
                        <div className="d-flex align-items-center gap-2">
                            <button 
                                className="btn btn-outline-primary btn-sm"
                                onClick={() => handleFeedRateChange(100)}
                                disabled={!isConnected}
                                title="Reset to 100%"
                            >
                                Reset
                            </button>
                            
                            <div className="input-group input-group-sm" style={{ width: '120px' }}>
                                <input 
                                    type="number"
                                    className="form-control"
                                    value={extruderSettings.feedRate}
                                    onChange={(e) => handleInputChange('feedRate', e.target.value)}
                                    onKeyUp={(e) => handleKeyUp(e, 'Feed')}
                                    min="25"
                                    max="150"
                                />
                                <span className="input-group-text">%</span>
                            </div>
                            
                            <button 
                                className="btn btn-danger btn-sm"
                                onClick={() => handleFeedRateChange(extruderSettings.feedRate)}
                                disabled={!isConnected}
                                title="Apply Feed Rate"
                            >
                                Apply
                            </button>
                        </div>
                    </div>
                </div>

                {/* Flow Rate Control */}
                <div className="row mb-3">
                    <div className="col-md-4">
                        <span className="fw-bold">Flow Rate (50-300%)</span>
                    </div>
                    <div className="col-md-8">
                        <div className="d-flex align-items-center gap-2">
                            <button 
                                className="btn btn-outline-primary btn-sm"
                                onClick={() => handleFlowRateChange(100)}
                                disabled={!isConnected}
                                title="Reset to 100%"
                            >
                                Reset
                            </button>
                            
                            <div className="input-group input-group-sm" style={{ width: '120px' }}>
                                <input 
                                    type="number"
                                    className="form-control"
                                    value={extruderSettings.flowRate}
                                    onChange={(e) => handleInputChange('flowRate', e.target.value)}
                                    onKeyUp={(e) => handleKeyUp(e, 'Flow')}
                                    min="50"
                                    max="300"
                                />
                                <span className="input-group-text">%</span>
                            </div>
                            
                            <button 
                                className="btn btn-danger btn-sm"
                                onClick={() => handleFlowRateChange(extruderSettings.flowRate)}
                                disabled={!isConnected}
                                title="Apply Flow Rate"
                            >
                                Apply
                            </button>
                        </div>
                    </div>
                </div>

                {/* Fan Control */}
                <div className="row mb-3">
                    <div className="col-md-4">
                        <span className="fw-bold">Fan Speed (0-100%)</span>
                    </div>
                    <div className="col-md-8">
                        <div className="d-flex align-items-center gap-2">
                            <button 
                                className="btn btn-outline-primary btn-sm"
                                onClick={() => handleFanSpeedChange(0)}
                                disabled={!isConnected}
                                title="Turn Off Fan"
                            >
                                <FanIcon />
                                Off
                            </button>
                            
                            <div className="input-group input-group-sm" style={{ width: '120px' }}>
                                <input 
                                    type="number"
                                    className="form-control"
                                    value={extruderSettings.fanSpeed}
                                    onChange={(e) => handleInputChange('fanSpeed', e.target.value)}
                                    onKeyUp={(e) => handleKeyUp(e, 'Fan')}
                                    min="0"
                                    max="100"
                                />
                                <span className="input-group-text">%</span>
                            </div>
                            
                            <button 
                                className="btn btn-danger btn-sm"
                                onClick={() => handleFanSpeedChange(extruderSettings.fanSpeed)}
                                disabled={!isConnected}
                                title="Apply Fan Speed"
                            >
                                Apply
                            </button>
                        </div>
                    </div>
                </div>

                {/* Extrusion Speed */}
                <div className="row">
                    <div className="col-md-4">
                        <span className="fw-bold">Extrusion Speed</span>
                    </div>
                    <div className="col-md-8">
                        <div className="input-group input-group-sm" style={{ width: '150px' }}>
                            <input 
                                type="number"
                                className="form-control"
                                value={extruderSettings.extrusionSpeed}
                                onChange={(e) => handleInputChange('extrusionSpeed', e.target.value)}
                                min="50"
                                max="3000"
                                step="50"
                            />
                            <span className="input-group-text">mm/min</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ExtruderControl;
