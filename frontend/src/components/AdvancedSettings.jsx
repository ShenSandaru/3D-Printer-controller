import React, { useState, useEffect } from 'react';
import './AdvancedSettings.css';

const AdvancedSettings = ({ isConnected, onSendCommand, onSettingsChange }) => {
    const [settings, setSettings] = useState({
        // Panel Visibility
        enableTemperaturePanel: true,
        enableExtruderPanel: true,
        enableFilesPanel: true,
        enableCommandsPanel: true,
        enableVerboseMode: false,
        enableAutoScroll: true,
        
        // Intervals
        positionInterval: 3,
        temperatureInterval: 3,
        statusInterval: 3,
        
        // Feedrates
        xyFeedrate: 1000,
        zFeedrate: 100,
        eFeedrate: 400,
        
        // Extruder Settings
        numberOfExtruders: 1,
        isMixedExtruder: false,
        enableBedControls: true,
        enableFanControls: true,
        enableZControls: true,
        
        // Temperature Settings
        enableHeatedBed: true,
        enableChamber: false,
        enableProbe: false,
        
        // Advanced Features
        enableGRBLPanel: false,
        enableProbePanel: false,
        enableSurfacePanel: false,
        useCircularControlPad: true,  // New setting for control pad type
        
        // File Filters
        fileFilters: 'gco;gcode;g;G;GCO;GCODE',
        
        // Probe Settings
        probeMaxTravel: 40,
        probeFeedrate: 100,
        probeTouchPlateThickness: 0.5,
        
        // Surface Settings
        surfaceWidth: 100,
        surfaceLength: 400,
        surfaceDepth: 0,
        surfaceBitDiameter: 12.7,
        surfaceStepover: 40,
        surfaceFeedrate: 1000,
        surfaceSpindle: 10000
    });

    const [activeTab, setActiveTab] = useState('general');
    const [showModal, setShowModal] = useState(false);

    // Load settings from localStorage on component mount
    useEffect(() => {
        const savedSettings = localStorage.getItem('printerSettings');
        if (savedSettings) {
            setSettings(JSON.parse(savedSettings));
        }
    }, []);

    // Save settings to localStorage whenever settings change
    useEffect(() => {
        localStorage.setItem('printerSettings', JSON.stringify(settings));
        if (onSettingsChange) {
            onSettingsChange(settings);
        }
    }, [settings, onSettingsChange]);

    const handleSettingChange = (key, value) => {
        setSettings(prev => ({
            ...prev,
            [key]: value
        }));
    };

    const applySettings = () => {
        if (!isConnected) return;
        
        // Apply feedrate settings
        onSendCommand(`M203 X${settings.xyFeedrate} Y${settings.xyFeedrate} Z${settings.zFeedrate}`);
        
        // Apply extruder settings if mixed extruder is enabled
        if (settings.isMixedExtruder) {
            onSendCommand('M567 P0 E1:1'); // Example mixed extruder command
        }
        
        setShowModal(false);
    };

    const resetToDefaults = () => {
        setSettings({
            enableTemperaturePanel: true,
            enableExtruderPanel: true,
            enableFilesPanel: true,
            enableCommandsPanel: true,
            enableVerboseMode: false,
            enableAutoScroll: true,
            positionInterval: 3,
            temperatureInterval: 3,
            statusInterval: 3,
            xyFeedrate: 1000,
            zFeedrate: 100,
            eFeedrate: 400,
            numberOfExtruders: 1,
            isMixedExtruder: false,
            enableBedControls: true,
            enableFanControls: true,
            enableZControls: true,
            enableHeatedBed: true,
            enableChamber: false,
            enableProbe: false,
            enableGRBLPanel: false,
            enableProbePanel: false,
            enableSurfacePanel: false,
            useCircularControlPad: true,
            fileFilters: 'gco;gcode;g;G;GCO;GCODE',
            probeMaxTravel: 40,
            probeFeedrate: 100,
            probeTouchPlateThickness: 0.5,
            surfaceWidth: 100,
            surfaceLength: 400,
            surfaceDepth: 0,
            surfaceBitDiameter: 12.7,
            surfaceStepover: 40,
            surfaceFeedrate: 1000,
            surfaceSpindle: 10000
        });
    };

    const renderGeneralSettings = () => (
        <div className="settings-section">
            <h6 className="text-primary mb-3">
                <i className="bi bi-gear me-2"></i>
                General Settings
            </h6>
            
            <div className="row mb-3">
                <div className="col-md-6">
                    <div className="form-check form-switch mb-2">
                        <input 
                            className="form-check-input" 
                            type="checkbox" 
                            id="enableVerboseMode"
                            checked={settings.enableVerboseMode}
                            onChange={(e) => handleSettingChange('enableVerboseMode', e.target.checked)}
                        />
                        <label className="form-check-label" htmlFor="enableVerboseMode">
                            Enable Verbose Mode
                        </label>
                    </div>
                    
                    <div className="form-check form-switch mb-2">
                        <input 
                            className="form-check-input" 
                            type="checkbox" 
                            id="enableAutoScroll"
                            checked={settings.enableAutoScroll}
                            onChange={(e) => handleSettingChange('enableAutoScroll', e.target.checked)}
                        />
                        <label className="form-check-label" htmlFor="enableAutoScroll">
                            Enable Auto-Scroll
                        </label>
                    </div>
                </div>
                
                <div className="col-md-6">
                    <div className="mb-3">
                        <label className="form-label">Update Intervals (seconds)</label>
                        <div className="row">
                            <div className="col-4">
                                <input 
                                    type="number" 
                                    className="form-control form-control-sm"
                                    value={settings.temperatureInterval}
                                    onChange={(e) => handleSettingChange('temperatureInterval', parseInt(e.target.value))}
                                    min="1"
                                    max="10"
                                />
                                <small className="text-muted">Temp</small>
                            </div>
                            <div className="col-4">
                                <input 
                                    type="number" 
                                    className="form-control form-control-sm"
                                    value={settings.positionInterval}
                                    onChange={(e) => handleSettingChange('positionInterval', parseInt(e.target.value))}
                                    min="1"
                                    max="10"
                                />
                                <small className="text-muted">Pos</small>
                            </div>
                            <div className="col-4">
                                <input 
                                    type="number" 
                                    className="form-control form-control-sm"
                                    value={settings.statusInterval}
                                    onChange={(e) => handleSettingChange('statusInterval', parseInt(e.target.value))}
                                    min="1"
                                    max="10"
                                />
                                <small className="text-muted">Status</small>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );

    const renderPanelSettings = () => (
        <div className="settings-section">
            <h6 className="text-primary mb-3">
                <i className="bi bi-layout-sidebar me-2"></i>
                Panel Visibility
            </h6>
            
            <div className="row">
                <div className="col-md-6">
                    <div className="form-check form-switch mb-2">
                        <input 
                            className="form-check-input" 
                            type="checkbox" 
                            id="enableTemperaturePanel"
                            checked={settings.enableTemperaturePanel}
                            onChange={(e) => handleSettingChange('enableTemperaturePanel', e.target.checked)}
                        />
                        <label className="form-check-label" htmlFor="enableTemperaturePanel">
                            Show Temperature Panel
                        </label>
                    </div>
                    
                    <div className="form-check form-switch mb-2">
                        <input 
                            className="form-check-input" 
                            type="checkbox" 
                            id="enableExtruderPanel"
                            checked={settings.enableExtruderPanel}
                            onChange={(e) => handleSettingChange('enableExtruderPanel', e.target.checked)}
                        />
                        <label className="form-check-label" htmlFor="enableExtruderPanel">
                            Show Extruder Panel
                        </label>
                    </div>
                    
                    <div className="form-check form-switch mb-2">
                        <input 
                            className="form-check-input" 
                            type="checkbox" 
                            id="enableFilesPanel"
                            checked={settings.enableFilesPanel}
                            onChange={(e) => handleSettingChange('enableFilesPanel', e.target.checked)}
                        />
                        <label className="form-check-label" htmlFor="enableFilesPanel">
                            Show Files Panel
                        </label>
                    </div>
                </div>
                
                <div className="col-md-6">
                    <div className="form-check form-switch mb-2">
                        <input 
                            className="form-check-input" 
                            type="checkbox" 
                            id="enableCommandsPanel"
                            checked={settings.enableCommandsPanel}
                            onChange={(e) => handleSettingChange('enableCommandsPanel', e.target.checked)}
                        />
                        <label className="form-check-label" htmlFor="enableCommandsPanel">
                            Show Commands Panel
                        </label>
                    </div>
                    
                    <div className="form-check form-switch mb-2">
                        <input 
                            className="form-check-input" 
                            type="checkbox" 
                            id="enableGRBLPanel"
                            checked={settings.enableGRBLPanel}
                            onChange={(e) => handleSettingChange('enableGRBLPanel', e.target.checked)}
                        />
                        <label className="form-check-label" htmlFor="enableGRBLPanel">
                            Show GRBL Panel
                        </label>
                    </div>
                    
                    <div className="form-check form-switch mb-2">
                        <input 
                            className="form-check-input" 
                            type="checkbox" 
                            id="enableProbePanel"
                            checked={settings.enableProbePanel}
                            onChange={(e) => handleSettingChange('enableProbePanel', e.target.checked)}
                        />
                        <label className="form-check-label" htmlFor="enableProbePanel">
                            Show Probe Panel
                        </label>
                    </div>
                    
                    <div className="form-check form-switch mb-2">
                        <input 
                            className="form-check-input" 
                            type="checkbox" 
                            id="useCircularControlPad"
                            checked={settings.useCircularControlPad}
                            onChange={(e) => handleSettingChange('useCircularControlPad', e.target.checked)}
                        />
                        <label className="form-check-label" htmlFor="useCircularControlPad">
                            Use Circular Control Pad
                        </label>
                        <small className="text-muted d-block">Enable ESP3D-style circular jog control</small>
                    </div>
                </div>
            </div>
        </div>
    );

    const renderExtruderSettings = () => (
        <div className="settings-section">
            <h6 className="text-primary mb-3">
                <i className="bi bi-gear-wide me-2"></i>
                Extruder Settings
            </h6>
            
            <div className="row mb-3">
                <div className="col-md-6">
                    <div className="mb-3">
                        <label className="form-label">Number of Extruders</label>
                        <select 
                            className="form-select"
                            value={settings.numberOfExtruders}
                            onChange={(e) => handleSettingChange('numberOfExtruders', parseInt(e.target.value))}
                        >
                            <option value={1}>1 Extruder</option>
                            <option value={2}>2 Extruders</option>
                        </select>
                    </div>
                    
                    <div className="form-check form-switch mb-2">
                        <input 
                            className="form-check-input" 
                            type="checkbox" 
                            id="isMixedExtruder"
                            checked={settings.isMixedExtruder}
                            onChange={(e) => handleSettingChange('isMixedExtruder', e.target.checked)}
                        />
                        <label className="form-check-label" htmlFor="isMixedExtruder">
                            Mixed Extruder Mode
                        </label>
                    </div>
                </div>
                
                <div className="col-md-6">
                    <div className="mb-3">
                        <label className="form-label">Feedrates (mm/min)</label>
                        <div className="row">
                            <div className="col-4">
                                <input 
                                    type="number" 
                                    className="form-control form-control-sm"
                                    value={settings.xyFeedrate}
                                    onChange={(e) => handleSettingChange('xyFeedrate', parseInt(e.target.value))}
                                    min="100"
                                    max="10000"
                                />
                                <small className="text-muted">XY</small>
                            </div>
                            <div className="col-4">
                                <input 
                                    type="number" 
                                    className="form-control form-control-sm"
                                    value={settings.zFeedrate}
                                    onChange={(e) => handleSettingChange('zFeedrate', parseInt(e.target.value))}
                                    min="50"
                                    max="2000"
                                />
                                <small className="text-muted">Z</small>
                            </div>
                            <div className="col-4">
                                <input 
                                    type="number" 
                                    className="form-control form-control-sm"
                                    value={settings.eFeedrate}
                                    onChange={(e) => handleSettingChange('eFeedrate', parseInt(e.target.value))}
                                    min="100"
                                    max="5000"
                                />
                                <small className="text-muted">E</small>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            
            <div className="row">
                <div className="col-md-4">
                    <div className="form-check form-switch mb-2">
                        <input 
                            className="form-check-input" 
                            type="checkbox" 
                            id="enableBedControls"
                            checked={settings.enableBedControls}
                            onChange={(e) => handleSettingChange('enableBedControls', e.target.checked)}
                        />
                        <label className="form-check-label" htmlFor="enableBedControls">
                            Enable Bed Controls
                        </label>
                    </div>
                </div>
                
                <div className="col-md-4">
                    <div className="form-check form-switch mb-2">
                        <input 
                            className="form-check-input" 
                            type="checkbox" 
                            id="enableFanControls"
                            checked={settings.enableFanControls}
                            onChange={(e) => handleSettingChange('enableFanControls', e.target.checked)}
                        />
                        <label className="form-check-label" htmlFor="enableFanControls">
                            Enable Fan Controls
                        </label>
                    </div>
                </div>
                
                <div className="col-md-4">
                    <div className="form-check form-switch mb-2">
                        <input 
                            className="form-check-input" 
                            type="checkbox" 
                            id="enableZControls"
                            checked={settings.enableZControls}
                            onChange={(e) => handleSettingChange('enableZControls', e.target.checked)}
                        />
                        <label className="form-check-label" htmlFor="enableZControls">
                            Enable Z Controls
                        </label>
                    </div>
                </div>
            </div>
        </div>
    );

    const renderProbeSettings = () => (
        <div className="settings-section">
            <h6 className="text-primary mb-3">
                <i className="bi bi-bullseye me-2"></i>
                Probe Settings
            </h6>
            
            <div className="row">
                <div className="col-md-4">
                    <div className="mb-3">
                        <label className="form-label">Max Travel (mm)</label>
                        <input 
                            type="number" 
                            className="form-control"
                            value={settings.probeMaxTravel}
                            onChange={(e) => handleSettingChange('probeMaxTravel', parseFloat(e.target.value))}
                            min="10"
                            max="100"
                            step="0.1"
                        />
                    </div>
                </div>
                
                <div className="col-md-4">
                    <div className="mb-3">
                        <label className="form-label">Feedrate (mm/min)</label>
                        <input 
                            type="number" 
                            className="form-control"
                            value={settings.probeFeedrate}
                            onChange={(e) => handleSettingChange('probeFeedrate', parseInt(e.target.value))}
                            min="50"
                            max="1000"
                        />
                    </div>
                </div>
                
                <div className="col-md-4">
                    <div className="mb-3">
                        <label className="form-label">Touch Plate Thickness (mm)</label>
                        <input 
                            type="number" 
                            className="form-control"
                            value={settings.probeTouchPlateThickness}
                            onChange={(e) => handleSettingChange('probeTouchPlateThickness', parseFloat(e.target.value))}
                            min="0"
                            max="10"
                            step="0.01"
                        />
                    </div>
                </div>
            </div>
        </div>
    );

    return (
        <>
            <button 
                className="btn btn-outline-primary btn-sm"
                onClick={() => setShowModal(true)}
                title="Advanced Settings"
            >
                <i className="bi bi-gear"></i>
                Settings
            </button>

            {showModal && (
                <div className="modal fade show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
                    <div className="modal-dialog modal-xl">
                        <div className="modal-content">
                            <div className="modal-header bg-primary text-white">
                                <h5 className="modal-title">
                                    <i className="bi bi-gear me-2"></i>
                                    Advanced Settings
                                </h5>
                                <button 
                                    type="button" 
                                    className="btn-close btn-close-white" 
                                    onClick={() => setShowModal(false)}
                                ></button>
                            </div>
                            
                            <div className="modal-body">
                                {/* Tab Navigation */}
                                <ul className="nav nav-tabs mb-4">
                                    <li className="nav-item">
                                        <button 
                                            className={`nav-link ${activeTab === 'general' ? 'active' : ''}`}
                                            onClick={() => setActiveTab('general')}
                                        >
                                            General
                                        </button>
                                    </li>
                                    <li className="nav-item">
                                        <button 
                                            className={`nav-link ${activeTab === 'panels' ? 'active' : ''}`}
                                            onClick={() => setActiveTab('panels')}
                                        >
                                            Panels
                                        </button>
                                    </li>
                                    <li className="nav-item">
                                        <button 
                                            className={`nav-link ${activeTab === 'extruder' ? 'active' : ''}`}
                                            onClick={() => setActiveTab('extruder')}
                                        >
                                            Extruder
                                        </button>
                                    </li>
                                    <li className="nav-item">
                                        <button 
                                            className={`nav-link ${activeTab === 'probe' ? 'active' : ''}`}
                                            onClick={() => setActiveTab('probe')}
                                        >
                                            Probe
                                        </button>
                                    </li>
                                </ul>

                                {/* Tab Content */}
                                <div className="tab-content">
                                    {activeTab === 'general' && renderGeneralSettings()}
                                    {activeTab === 'panels' && renderPanelSettings()}
                                    {activeTab === 'extruder' && renderExtruderSettings()}
                                    {activeTab === 'probe' && renderProbeSettings()}
                                </div>
                            </div>
                            
                            <div className="modal-footer">
                                <button 
                                    type="button" 
                                    className="btn btn-secondary"
                                    onClick={resetToDefaults}
                                >
                                    Reset to Defaults
                                </button>
                                <button 
                                    type="button" 
                                    className="btn btn-outline-secondary"
                                    onClick={() => setShowModal(false)}
                                >
                                    Cancel
                                </button>
                                <button 
                                    type="button" 
                                    className="btn btn-primary"
                                    onClick={applySettings}
                                    disabled={!isConnected}
                                >
                                    Apply Settings
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};

export default AdvancedSettings;
