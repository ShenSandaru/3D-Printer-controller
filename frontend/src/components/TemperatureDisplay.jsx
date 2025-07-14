// frontend/src/components/TemperatureDisplay.jsx
import React from 'react';

export default function TemperatureDisplay({ temperatures, isConnected }) {
    const { hotend_actual = 0, hotend_target = 0, bed_actual = 0, bed_target = 0 } = temperatures || {};
    
    if (!isConnected) {
        return (
            <div className="card mb-3">
                <div className="card-header">Live Status</div>
                <div className="card-body text-center">
                    <p className="text-muted">Connect to printer to view live temperatures</p>
                </div>
            </div>
        );
    }

    return (
        <div className="card mb-3">
            <div className="card-header d-flex justify-content-between align-items-center">
                <span>Live Status</span>
                <span className="badge bg-success">Live</span>
            </div>
            <div className="card-body">
                <div className="row text-center">
                    <div className="col-md-6">
                        <div className="border rounded p-3 mb-3 mb-md-0">
                            <h5 className="text-primary">🔥 Hotend</h5>
                            <p className="display-6 mb-1 fw-bold">{hotend_actual.toFixed(1)}°C</p>
                            <small className="text-muted">Target: {hotend_target.toFixed(1)}°C</small>
                            <div className="mt-2">
                                <div className="progress" style={{ height: '8px' }}>
                                    <div 
                                        className="progress-bar bg-danger" 
                                        style={{ 
                                            width: `${Math.min((hotend_actual / Math.max(hotend_target, 200)) * 100, 100)}%` 
                                        }}
                                    ></div>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div className="col-md-6">
                        <div className="border rounded p-3">
                            <h5 className="text-info">🛏️ Bed</h5>
                            <p className="display-6 mb-1 fw-bold">{bed_actual.toFixed(1)}°C</p>
                            <small className="text-muted">Target: {bed_target.toFixed(1)}°C</small>
                            <div className="mt-2">
                                <div className="progress" style={{ height: '8px' }}>
                                    <div 
                                        className="progress-bar bg-info" 
                                        style={{ 
                                            width: `${Math.min((bed_actual / Math.max(bed_target, 100)) * 100, 100)}%` 
                                        }}
                                    ></div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
