// frontend/src/components/Log.jsx
import React, { useEffect, useRef } from 'react';

export default function Log({ log }) {
    const logEndRef = useRef(null);
    
    useEffect(() => {
        logEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [log]);

    const getLogIcon = (message) => {
        if (message.includes('Error:') || message.includes('error')) return 'bi-exclamation-triangle-fill text-danger';
        if (message.includes('success') || message.includes('Connected')) return 'bi-check-circle-fill text-success';
        if (message.includes('Sending:')) return 'bi-arrow-up-circle text-primary';
        if (message.includes('Response:')) return 'bi-arrow-down-circle text-info';
        return 'bi-info-circle text-muted';
    };

    const formatLogEntry = (entry) => {
        const [timestamp, ...messageParts] = entry.split(' - ');
        const message = messageParts.join(' - ');
        return { timestamp, message };
    };

    return (
        <div className="card border-0 shadow-sm" style={{ backgroundColor: 'rgba(255, 255, 255, 0.98)' }}>
            <div className="card-header bg-transparent border-bottom d-flex justify-content-between align-items-center">
                <h6 className="mb-0 fw-bold text-primary">
                    <i className="bi bi-terminal me-2"></i>System Log
                </h6>
                <div className="d-flex align-items-center">
                    <span className="badge bg-primary me-2">
                        {log.length} entries
                    </span>
                    <button className="btn btn-sm btn-outline-secondary" title="Auto-scroll enabled">
                        <i className="bi bi-arrow-down-circle"></i>
                    </button>
                </div>
            </div>
            <div 
                className="card-body p-0" 
                style={{ 
                    height: '100%',
                    maxHeight: '100%',
                    overflowY: 'auto',
                    backgroundColor: '#f8f9fa'
                }}
            >
                {log.length === 0 ? (
                    <div className="d-flex align-items-center justify-content-center h-100 text-muted">
                        <div className="text-center">
                            <i className="bi bi-chat-dots" style={{ fontSize: '2rem', opacity: 0.5 }}></i>
                            <p className="mt-2 mb-0">No activity yet</p>
                            <small>Connect to your printer to see communication logs</small>
                        </div>
                    </div>
                ) : (
                    <div className="p-2">
                        {log.map((entry, index) => {
                            const { timestamp, message } = formatLogEntry(entry);
                            return (
                                <div 
                                    key={index} 
                                    className="d-flex align-items-start mb-1 p-2 rounded-2 bg-white border border-light"
                                    style={{ fontSize: '0.8rem' }}
                                >
                                    <i className={`${getLogIcon(message)} me-2 mt-1`} style={{ fontSize: '0.7rem' }}></i>
                                    <div className="flex-grow-1" style={{ fontFamily: 'monospace' }}>
                                        <div className="text-muted small">{timestamp}</div>
                                        <div className={`${message.includes('Error:') ? 'text-danger' : message.includes('success') ? 'text-success' : ''}`}>
                                            {message}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                        <div ref={logEndRef} />
                    </div>
                )}
            </div>
        </div>
    );
}
