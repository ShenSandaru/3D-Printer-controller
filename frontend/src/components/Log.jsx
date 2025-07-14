// frontend/src/components/Log.jsx
import React, { useEffect, useRef } from 'react';

export default function Log({ log }) {
    const logEndRef = useRef(null);
    
    useEffect(() => {
        logEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [log]);

    const clearLog = () => {
        // This would need to be passed as a prop from parent
        console.log('Clear log functionality would be implemented here');
    };

    return (
        <div className="card">
            <div className="card-header d-flex justify-content-between align-items-center">
                <span>Communication Log</span>
                <div>
                    <span className="badge bg-secondary me-2">{log.length} entries</span>
                    <button className="btn btn-sm btn-outline-secondary" title="Clear log">
                        🗑️
                    </button>
                </div>
            </div>
            <pre 
                className="card-body bg-light m-0" 
                style={{ 
                    height: '300px', 
                    overflowY: 'scroll', 
                    fontFamily: 'monospace', 
                    fontSize: '0.8rem',
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word'
                }}
            >
                {log.length === 0 ? (
                    <span className="text-muted">No communication yet. Connect to your printer to see activity...</span>
                ) : (
                    log.join('\n')
                )}
                <div ref={logEndRef} />
            </pre>
        </div>
    );
}
