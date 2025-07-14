// frontend/src/components/TemperatureDisplay.jsx
import React from 'react';

export default function TemperatureDisplay({ temperatures, isConnected }) {
    const { hotend_actual = 0, hotend_target = 0, bed_actual = 0, bed_target = 0 } = temperatures || {};
    
    if (!isConnected) {
        return (
            <div className="card border-0 shadow-sm mb-3" style={{ backgroundColor: 'rgba(255, 255, 255, 0.98)' }}>
                <div className="card-header bg-transparent border-bottom-0">
                    <h6 className="mb-0 fw-bold text-primary">
                        <i className="bi bi-thermometer-half me-2"></i>Temperature Monitor
                    </h6>
                </div>
                <div className="card-body text-center py-4">
                    <div className="text-muted">
                        <i className="bi bi-thermometer" style={{ fontSize: '2rem', opacity: 0.5 }}></i>
                        <p className="mt-2 mb-0">Connect to printer to monitor temperatures</p>
                    </div>
                </div>
            </div>
        );
    }

    const getTemperatureColor = (actual, target, type) => {
        const percentage = target > 0 ? (actual / target) * 100 : 0;
        if (type === 'hotend') {
            if (percentage >= 95) return '#28a745'; // Green
            if (percentage >= 80) return '#ffc107'; // Yellow
            return '#dc3545'; // Red
        } else {
            if (percentage >= 90) return '#17a2b8'; // Info blue
            if (percentage >= 70) return '#ffc107'; // Yellow
            return '#6c757d'; // Gray
        }
    };

    return (
        <div className="card border-0 shadow-sm mb-3" style={{ backgroundColor: 'rgba(255, 255, 255, 0.98)' }}>
            <div className="card-header bg-transparent border-bottom-0 d-flex justify-content-between align-items-center">
                <h6 className="mb-0 fw-bold text-primary">
                    <i className="bi bi-thermometer-half me-2"></i>Temperature Monitor
                </h6>
                <span className="badge bg-success pulse">
                    <i className="bi bi-circle-fill me-1" style={{ fontSize: '0.6rem' }}></i>
                    Live
                </span>
            </div>
            <div className="card-body">
                <div className="row g-3">
                    {/* Hotend Temperature */}
                    <div className="col-6">
                        <div className="p-3 rounded-3" style={{ backgroundColor: '#fff5f5', border: '2px solid #fee2e2' }}>
                            <div className="d-flex justify-content-between align-items-center mb-2">
                                <h6 className="mb-0 fw-bold text-danger">
                                    <i className="bi bi-fire me-1"></i>Hotend
                                </h6>
                                <small className="badge bg-danger bg-opacity-25 text-danger">
                                    Target: {hotend_target.toFixed(0)}°C
                                </small>
                            </div>
                            <div className="d-flex align-items-baseline mb-2">
                                <h3 className="mb-0 fw-bold" style={{ color: getTemperatureColor(hotend_actual, hotend_target, 'hotend') }}>
                                    {hotend_actual.toFixed(1)}
                                </h3>
                                <span className="ms-1 text-muted">°C</span>
                            </div>
                            <div className="progress" style={{ height: '8px', borderRadius: '4px' }}>
                                <div 
                                    className="progress-bar" 
                                    style={{ 
                                        width: `${Math.min((hotend_actual / Math.max(hotend_target, 200)) * 100, 100)}%`,
                                        backgroundColor: getTemperatureColor(hotend_actual, hotend_target, 'hotend'),
                                        borderRadius: '4px'
                                    }}
                                ></div>
                            </div>
                        </div>
                    </div>
                    
                    {/* Bed Temperature */}
                    <div className="col-6">
                        <div className="p-3 rounded-3" style={{ backgroundColor: '#f0f9ff', border: '2px solid #dbeafe' }}>
                            <div className="d-flex justify-content-between align-items-center mb-2">
                                <h6 className="mb-0 fw-bold text-info">
                                    <i className="bi bi-square me-1"></i>Bed
                                </h6>
                                <small className="badge bg-info bg-opacity-25 text-info">
                                    Target: {bed_target.toFixed(0)}°C
                                </small>
                            </div>
                            <div className="d-flex align-items-baseline mb-2">
                                <h3 className="mb-0 fw-bold" style={{ color: getTemperatureColor(bed_actual, bed_target, 'bed') }}>
                                    {bed_actual.toFixed(1)}
                                </h3>
                                <span className="ms-1 text-muted">°C</span>
                            </div>
                            <div className="progress" style={{ height: '8px', borderRadius: '4px' }}>
                                <div 
                                    className="progress-bar" 
                                    style={{ 
                                        width: `${Math.min((bed_actual / Math.max(bed_target, 100)) * 100, 100)}%`,
                                        backgroundColor: getTemperatureColor(bed_actual, bed_target, 'bed'),
                                        borderRadius: '4px'
                                    }}
                                ></div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
