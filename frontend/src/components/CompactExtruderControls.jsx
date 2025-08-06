import React, { useState } from 'react';
import './CompactExtruderControls.css';

const CompactExtruderControls = ({ isConnected, onSendCommand, temperatures }) => {
    const [extruderSettings, setExtruderSettings] = useState({
        feedRate: 100,
        flowRate: 100,
        extrudeDistance: 5,
        extrusionSpeed: 100,
        hotendTarget: 185,
        bedTarget: 60
    });

    // SVG Icons for buttons
    const ExtrudeIcon = () => (
        <svg width="1em" height="1em" viewBox="0 0 24 24">
            <path fill="currentColor" d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
        </svg>
    );

    const RetractIcon = () => (
        <svg width="1em" height="1em" viewBox="0 0 24 24">
            <path fill="currentColor" d="M7.41 8.58L12 13.17l4.59-4.59L18 10l-6 6-6-6 1.41-1.42z"/>
        </svg>
    );

    const handleExtrudeCommand = (direction) => {
        if (!isConnected) return;
        const distance = direction > 0 ? extruderSettings.extrudeDistance : -extruderSettings.extrudeDistance;
        onSendCommand(`G1 E${distance} F${extruderSettings.extrusionSpeed * 60}`);
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

    const handleInputChange = (field, value) => {
        setExtruderSettings(prev => ({ ...prev, [field]: value }));
    };

    const handleSetTemperature = (type, temperature) => {
        if (!isConnected) return;
        if (type === 'hotend') {
            onSendCommand(`M104 S${temperature}`);
        } else if (type === 'bed') {
            onSendCommand(`M140 S${temperature}`);
        }
    };

    const handleTemperatureOff = (type) => {
        if (!isConnected) return;
        if (type === 'hotend') {
            onSendCommand('M104 S0');
            setExtruderSettings(prev => ({ ...prev, hotendTarget: 0 }));
        } else if (type === 'bed') {
            onSendCommand('M140 S0');
            setExtruderSettings(prev => ({ ...prev, bedTarget: 0 }));
        }
    };

    return (
        <div className="compact-extruder-controls">
            <div className="compact-extruder-header">
                <h6 className="mb-0">
                    <i className="bi bi-gear-fill me-1"></i>
                    Quick Controls
                </h6>
            </div>
            
            <div className="compact-controls-grid">
                {/* Temperature Controls */}
                <div className="control-row">
                    <label className="control-label">Heat:</label>
                    <div className="temperature-controls">
                        <div className="temp-row">
                            <span className="temp-label">Off</span>
                            <select 
                                className="form-select form-select-sm me-2"
                                value={extruderSettings.hotendTarget}
                                onChange={(e) => setExtruderSettings(prev => ({ ...prev, hotendTarget: parseInt(e.target.value) }))}
                                style={{ fontSize: '12px', width: 'auto', minWidth: '80px' }}
                            >
                                <option value={185}>185.0 (PLA)</option>
                                <option value={210}>210.0 (PETG)</option>
                                <option value={240}>240.0 (ABS)</option>
                                <option value={260}>260.0 (PC)</option>
                            </select>
                            <button 
                                className="btn btn-outline-danger btn-sm me-1"
                                onClick={() => handleTemperatureOff('hotend')}
                                disabled={!isConnected}
                                style={{ fontSize: '10px', padding: '2px 6px' }}
                            >
                                Off
                            </button>
                            <button 
                                className="btn btn-outline-primary btn-sm"
                                onClick={() => handleSetTemperature('hotend', extruderSettings.hotendTarget)}
                                disabled={!isConnected}
                                style={{ fontSize: '10px', padding: '2px 6px' }}
                            >
                                Set
                            </button>
                        </div>
                    </div>
                </div>

                <div className="control-row">
                    <label className="control-label">Bed:</label>
                    <div className="temperature-controls">
                        <div className="temp-row">
                            <span className="temp-label">Off</span>
                            <select 
                                className="form-select form-select-sm me-2"
                                value={extruderSettings.bedTarget}
                                onChange={(e) => setExtruderSettings(prev => ({ ...prev, bedTarget: parseInt(e.target.value) }))}
                                style={{ fontSize: '12px', width: 'auto', minWidth: '80px' }}
                            >
                                <option value={60}>60.0 (PLA)</option>
                                <option value={70}>70.0 (PETG)</option>
                                <option value={80}>80.0 (ABS)</option>
                                <option value={90}>90.0 (PC)</option>
                            </select>
                            <button 
                                className="btn btn-outline-danger btn-sm me-1"
                                onClick={() => handleTemperatureOff('bed')}
                                disabled={!isConnected}
                                style={{ fontSize: '10px', padding: '2px 6px' }}
                            >
                                Off
                            </button>
                            <button 
                                className="btn btn-outline-primary btn-sm"
                                onClick={() => handleSetTemperature('bed', extruderSettings.bedTarget)}
                                disabled={!isConnected}
                                style={{ fontSize: '10px', padding: '2px 6px' }}
                            >
                                Set
                            </button>
                        </div>
                    </div>
                </div>

                {/* Extrude Section Header */}
                <div className="control-row">
                    <label className="control-label section-header">Extrude</label>
                </div>

                {/* Length and Speed Controls */}
                <div className="control-row">
                    <label className="control-label">Length:</label>
                    <div className="input-group input-group-sm">
                        <input 
                            type="number"
                            className="form-control form-control-sm"
                            value={extruderSettings.extrudeDistance}
                            onChange={(e) => handleInputChange('extrudeDistance', e.target.value)}
                            min="0.1"
                            max="100"
                            step="0.1"
                            style={{ fontSize: '12px' }}
                        />
                        <span className="input-group-text" style={{ fontSize: '12px' }}>mm</span>
                    </div>
                </div>

                <div className="control-row">
                    <label className="control-label">Speed:</label>
                    <div className="input-group input-group-sm">
                        <input 
                            type="number"
                            className="form-control form-control-sm"
                            value={extruderSettings.extrusionSpeed}
                            onChange={(e) => handleInputChange('extrusionSpeed', e.target.value)}
                            min="50"
                            max="500"
                            step="10"
                            style={{ fontSize: '12px' }}
                        />
                        <span className="input-group-text" style={{ fontSize: '12px' }}>mm/s</span>
                    </div>
                </div>

                {/* Extrude/Retract Buttons */}
                <div className="control-row">
                    <div className="extrude-buttons">
                        <button 
                            className="btn btn-success btn-sm me-1"
                            onClick={() => handleExtrudeCommand(1)}
                            disabled={!isConnected}
                            title="Extrude"
                            style={{ fontSize: '12px', padding: '4px 8px' }}
                        >
                            <ExtrudeIcon /> Extrude
                        </button>
                        
                        <button 
                            className="btn btn-warning btn-sm"
                            onClick={() => handleExtrudeCommand(-1)}
                            disabled={!isConnected}
                            title="Reverse/Retract"
                            style={{ fontSize: '12px', padding: '4px 8px' }}
                        >
                            <RetractIcon /> Reverse
                        </button>
                    </div>
                </div>

                {/* Print Speed Control */}
                <div className="control-row">
                    <label className="control-label">Print speed:</label>
                    <div className="d-flex align-items-center">
                        <input 
                            type="range"
                            className="form-range flex-grow-1 me-2"
                            min="25"
                            max="150"
                            value={extruderSettings.feedRate}
                            onChange={(e) => setExtruderSettings(prev => ({ ...prev, feedRate: parseInt(e.target.value) }))}
                            style={{ fontSize: '12px' }}
                        />
                        <span className="speed-value">{extruderSettings.feedRate}%</span>
                        <button 
                            className="btn btn-outline-primary btn-sm ms-1"
                            onClick={() => handleFeedRateChange(extruderSettings.feedRate)}
                            disabled={!isConnected}
                            title="Apply Print Speed"
                            style={{ fontSize: '10px', padding: '2px 6px' }}
                        >
                            Set
                        </button>
                    </div>
                </div>

                {/* Print Flow Control */}
                <div className="control-row">
                    <label className="control-label">Print flow:</label>
                    <div className="d-flex align-items-center">
                        <input 
                            type="range"
                            className="form-range flex-grow-1 me-2"
                            min="50"
                            max="200"
                            value={extruderSettings.flowRate}
                            onChange={(e) => setExtruderSettings(prev => ({ ...prev, flowRate: parseInt(e.target.value) }))}
                            style={{ fontSize: '12px' }}
                        />
                        <span className="speed-value">{extruderSettings.flowRate}%</span>
                        <button 
                            className="btn btn-outline-primary btn-sm ms-1"
                            onClick={() => handleFlowRateChange(extruderSettings.flowRate)}
                            disabled={!isConnected}
                            title="Apply Print Flow"
                            style={{ fontSize: '10px', padding: '2px 6px' }}
                        >
                            Set
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default CompactExtruderControls;
