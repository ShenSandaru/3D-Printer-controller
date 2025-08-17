// frontend/src/components/TemperatureDisplay.jsx
import React from 'react';
import CompactExtruderControls from './CompactExtruderControls';

export default function TemperatureDisplay({ temperatures, isConnected, onSendCommand }) {
    const hotendTemp = temperatures?.hotend_actual || temperatures?.hotend || 0;
    const bedTemp = temperatures?.bed_actual || temperatures?.bed || 0;
    const hotendTarget = temperatures?.hotend_target || temperatures?.hotendTarget || 0;
    const bedTarget = temperatures?.bed_target || temperatures?.bedTarget || 0;

    const getTemperatureStatus = (current, target) => {
        if (target === 0) return 'secondary';
        const diff = Math.abs(current - target);
        if (diff <= 2) return 'success';
        if (diff <= 5) return 'warning';
        return 'danger';
    };

    return (
        <div className="card">
            <div className="card-header">
                <h5 className="card-title mb-0">
                    <i className="bi bi-thermometer-half me-2"></i>
                    Temperature & Controls
                </h5>
            </div>
            <div className="card-body" style={{ padding: '12px' }}>
                <div className="row g-2">
                    {/* Hotend Temperature - Compact */}
                    <div className="col-md-6">
                        <div className="d-flex align-items-center mb-1">
                            <i className="bi bi-fire text-danger me-1" style={{ fontSize: '14px' }}></i>
                            <strong style={{ fontSize: '13px' }}>Heat:</strong>
                            <span className="ms-auto" style={{ fontSize: '12px' }}>
                                {hotendTarget === 0 ? 'Off' : 
                                 Math.abs(hotendTemp - hotendTarget) <= 2 ? 'Ready' : 
                                 hotendTemp < hotendTarget ? 'Heating' : 'Cooling'}
                            </span>
                        </div>
                        <div className="d-flex align-items-center justify-content-between mb-1">
                            <span className="fs-5 fw-bold" style={{ fontSize: '18px !important' }}>{hotendTemp.toFixed(1)}°C</span>
                            <span className="text-muted" style={{ fontSize: '12px' }}>/ {hotendTarget}°C</span>
                        </div>
                        <div className="progress" style={{ height: '6px' }}>
                            <div 
                                className={`progress-bar bg-${getTemperatureStatus(hotendTemp, hotendTarget)}`}
                                style={{ 
                                    width: hotendTarget > 0 ? `${Math.min((hotendTemp / hotendTarget) * 100, 100)}%` : '0%'
                                }}
                            ></div>
                        </div>
                    </div>

                    {/* Bed Temperature - Compact */}
                    <div className="col-md-6">
                        <div className="d-flex align-items-center mb-1">
                            <i className="bi bi-square text-primary me-1" style={{ fontSize: '14px' }}></i>
                            <strong style={{ fontSize: '13px' }}>Bed:</strong>
                            <span className="ms-auto" style={{ fontSize: '12px' }}>
                                {bedTarget === 0 ? 'Off' : 
                                 Math.abs(bedTemp - bedTarget) <= 2 ? 'Ready' : 
                                 bedTemp < bedTarget ? 'Heating' : 'Cooling'}
                            </span>
                        </div>
                        <div className="d-flex align-items-center justify-content-between mb-1">
                            <span className="fs-5 fw-bold" style={{ fontSize: '18px !important' }}>{bedTemp.toFixed(1)}°C</span>
                            <span className="text-muted" style={{ fontSize: '12px' }}>/ {bedTarget}°C</span>
                        </div>
                        <div className="progress" style={{ height: '6px' }}>
                            <div 
                                className={`progress-bar bg-${getTemperatureStatus(bedTemp, bedTarget)}`}
                                style={{ 
                                    width: bedTarget > 0 ? `${Math.min((bedTemp / bedTarget) * 100, 100)}%` : '0%'
                                }}
                            ></div>
                        </div>
                    </div>
                </div>

                {/* Compact Extruder Controls */}
                <CompactExtruderControls 
                    isConnected={isConnected}
                    onSendCommand={onSendCommand}
                    temperatures={temperatures}
                />

                {(!temperatures || (hotendTemp === 0 && bedTemp === 0)) && (
                    <div className="text-center text-muted mt-2">
                        <i className="bi bi-thermometer fs-4 mb-1"></i>
                        <p className="mb-0" style={{ fontSize: '12px' }}>No temperature data available</p>
                        <small style={{ fontSize: '10px' }}>Connect to printer to see real-time temperatures</small>
                    </div>
                )}
            </div>
        </div>
    );
}