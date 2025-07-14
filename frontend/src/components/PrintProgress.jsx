// frontend/src/components/PrintProgress.jsx - Production Version with Pause/Resume
import React from 'react';

export default function PrintProgress({ printStatus, onCancelPrint, onPausePrint, onResumePrint, onEmergencyStop }) {
    if (printStatus.status !== 'printing' && printStatus.status !== 'paused') {
        return null; // Don't show anything if not printing or paused
    }

    const isPaused = printStatus.status === 'paused' || printStatus.is_paused;
    const isActive = printStatus.status === 'printing' && !isPaused;

    return (
        <div className={`card border-0 shadow-sm mb-3 ${isPaused ? 'print-progress-paused' : 'print-progress-card'}`} 
             style={{ 
                 backgroundColor: 'rgba(255, 255, 255, 0.98)', 
                 border: isPaused ? '2px solid #ffc107' : '2px solid #28a745' 
             }}>
            <div className={`card-header ${isPaused ? 'bg-warning bg-opacity-10' : 'bg-success bg-opacity-10'} border-bottom-0`}>
                <div className="d-flex justify-content-between align-items-center">
                    <h6 className={`mb-0 fw-bold ${isPaused ? 'text-warning' : 'text-success'}`}>
                        <i className={`bi ${isPaused ? 'bi-pause-circle-fill' : 'bi-play-circle-fill'} me-2`}></i>
                        {isPaused ? 'Print Paused' : 'Print in Progress'}
                    </h6>
                    <span className={`badge ${isPaused ? 'bg-warning text-dark' : 'bg-success'} pulse`}>
                        <i className={`bi ${isPaused ? 'bi-pause' : 'bi-printer'} me-1`}></i>
                        {isPaused ? 'Paused' : 'Printing'}
                    </span>
                </div>
            </div>
            <div className="card-body">
                {/* File Information */}
                <div className="d-flex align-items-center mb-3 p-2 bg-light rounded-3">
                    <i className="bi bi-file-earmark-code-fill text-primary me-2" style={{ fontSize: '1.2rem' }}></i>
                    <div>
                        <div className="fw-bold text-primary">{printStatus.filename}</div>
                        <small className="text-muted">
                            Line {printStatus.current_line || 0} of {printStatus.total_lines || 0}
                        </small>
                    </div>
                </div>
                
                {/* Progress Bar */}
                <div className="mb-3">
                    <div className="d-flex justify-content-between align-items-center mb-2">
                        <span className="text-muted small">Progress</span>
                        <span className={`fw-bold ${isPaused ? 'text-warning' : 'text-success'}`}>
                            {(printStatus.progress || 0).toFixed(1)}%
                        </span>
                    </div>
                    <div className="progress shadow-sm" style={{ height: '12px', borderRadius: '6px' }}>
                        <div
                            className={`progress-bar ${isPaused ? 'bg-warning' : 'progress-bar-striped progress-bar-animated bg-success'}`}
                            role="progressbar"
                            style={{ 
                                width: `${printStatus.progress || 0}%`,
                                borderRadius: '6px'
                            }}
                        ></div>
                    </div>
                </div>
                
                {/* Control Buttons */}
                <div className="row g-2 mb-3">
                    {/* Pause/Resume Button */}
                    <div className="col-6">
                        {isPaused ? (
                            <button 
                                className="btn btn-success btn-lg w-100 shadow-sm" 
                                onClick={onResumePrint}
                                style={{ borderRadius: '10px' }}
                            >
                                <i className="bi bi-play-fill me-2"></i>
                                Resume
                            </button>
                        ) : (
                            <button 
                                className="btn btn-warning btn-lg w-100 shadow-sm" 
                                onClick={onPausePrint}
                                style={{ borderRadius: '10px' }}
                            >
                                <i className="bi bi-pause-fill me-2"></i>
                                Pause
                            </button>
                        )}
                    </div>
                    
                    {/* Cancel Button */}
                    <div className="col-6">
                        <button 
                            className="btn btn-outline-danger btn-lg w-100 shadow-sm" 
                            onClick={onCancelPrint}
                            style={{ borderRadius: '10px' }}
                        >
                            <i className="bi bi-stop-circle me-2"></i>
                            Cancel
                        </button>
                    </div>
                </div>
                
                {/* Emergency Stop Button */}
                <div className="d-grid mb-2">
                    <button 
                        className="btn btn-danger btn-lg shadow-sm" 
                        onClick={onEmergencyStop}
                        title="Immediate emergency stop - Use only in emergencies!"
                        style={{ 
                            borderRadius: '10px',
                            background: 'linear-gradient(45deg, #dc3545, #c82333)',
                            border: 'none',
                            boxShadow: '0 4px 15px rgba(220, 53, 69, 0.3)'
                        }}
                    >
                        <i className="bi bi-exclamation-triangle-fill me-2"></i>
                        EMERGENCY STOP
                    </button>
                </div>
                
                <div className="text-center">
                    <small className="text-muted">
                        <i className="bi bi-info-circle me-1"></i>
                        Print can be monitored in real-time in the 3D viewer
                    </small>
                </div>
            </div>
        </div>
    );
}