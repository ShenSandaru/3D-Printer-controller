// frontend/src/components/TemperatureDisplay.jsx
import React from 'react';

export default function TemperatureDisplay({ temperatures }) {
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
                    Temperature Monitor
                </h5>
            </div>
            <div className="card-body">
                <div className="row g-3">
                    {/* Hotend Temperature */}
                    <div className="col-md-6">
                        <div className="d-flex align-items-center mb-2">
                            <i className="bi bi-fire text-danger me-2"></i>
                            <strong>Hotend</strong>
                        </div>
                        <div className="d-flex align-items-center justify-content-between mb-2">
                            <span className="fs-3 fw-bold">{hotendTemp.toFixed(1)}°C</span>
                            <span className="text-muted">/ {hotendTarget}°C</span>
                        </div>
                        <div className="progress" style={{ height: '8px' }}>
                            <div 
                                className={`progress-bar bg-${getTemperatureStatus(hotendTemp, hotendTarget)}`}
                                style={{ 
                                    width: hotendTarget > 0 ? `${Math.min((hotendTemp / hotendTarget) * 100, 100)}%` : '0%'
                                }}
                            ></div>
                        </div>
                        <small className="text-muted">
                            Status: <span className={`badge bg-${getTemperatureStatus(hotendTemp, hotendTarget)}`}>
                                {hotendTarget === 0 ? 'Standby' : 
                                 Math.abs(hotendTemp - hotendTarget) <= 2 ? 'Ready' : 
                                 hotendTemp < hotendTarget ? 'Heating' : 'Cooling'}
                            </span>
                        </small>
                    </div>

                    {/* Bed Temperature */}
                    <div className="col-md-6">
                        <div className="d-flex align-items-center mb-2">
                            <i className="bi bi-square text-primary me-2"></i>
                            <strong>Heated Bed</strong>
                        </div>
                        <div className="d-flex align-items-center justify-content-between mb-2">
                            <span className="fs-3 fw-bold">{bedTemp.toFixed(1)}°C</span>
                            <span className="text-muted">/ {bedTarget}°C</span>
                        </div>
                        <div className="progress" style={{ height: '8px' }}>
                            <div 
                                className={`progress-bar bg-${getTemperatureStatus(bedTemp, bedTarget)}`}
                                style={{ 
                                    width: bedTarget > 0 ? `${Math.min((bedTemp / bedTarget) * 100, 100)}%` : '0%'
                                }}
                            ></div>
                        </div>
                        <small className="text-muted">
                            Status: <span className={`badge bg-${getTemperatureStatus(bedTemp, bedTarget)}`}>
                                {bedTarget === 0 ? 'Standby' : 
                                 Math.abs(bedTemp - bedTarget) <= 2 ? 'Ready' : 
                                 bedTemp < bedTarget ? 'Heating' : 'Cooling'}
                            </span>
                        </small>
                    </div>
                </div>

                {(!temperatures || (hotendTemp === 0 && bedTemp === 0)) && (
                    <div className="text-center text-muted mt-3">
                        <i className="bi bi-thermometer display-4 mb-2"></i>
                        <p className="mb-0">No temperature data available</p>
                        <small>Connect to printer to see real-time temperatures</small>
                    </div>
                )}
            </div>
        </div>
    );
}