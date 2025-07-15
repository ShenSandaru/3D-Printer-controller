// frontend/src/components/GcodeViewer.jsx - Simple text viewer version
import React, { useState } from 'react';

export default function GcodeViewer({ gcode }) {
    const [viewMode, setViewMode] = useState('text');
    
    return (
        <div className="card h-100">
            <div className="card-header d-flex justify-content-between align-items-center">
                <h5 className="card-title mb-0">
                    <i className="bi bi-file-text me-2"></i>
                    G-Code Viewer
                </h5>
                <div className="btn-group btn-group-sm">
                    <button 
                        className={`btn ${viewMode === 'text' ? 'btn-primary' : 'btn-outline-primary'}`}
                        onClick={() => setViewMode('text')}
                    >
                        <i className="bi bi-file-text"></i> Text
                    </button>
                    <button 
                        className={`btn ${viewMode === '3d' ? 'btn-primary' : 'btn-outline-primary'}`}
                        onClick={() => setViewMode('3d')}
                        disabled
                    >
                        <i className="bi bi-cube"></i> 3D (Coming Soon)
                    </button>
                </div>
            </div>
            <div className="card-body p-0" style={{ height: '300px' }}>
                {viewMode === 'text' ? (
                    <div className="h-100 position-relative">
                        <textarea
                            value={gcode || ''}
                            readOnly
                            className="form-control h-100 border-0 font-monospace"
                            placeholder="No G-code loaded. Upload a file to view its contents here."
                            style={{ 
                                resize: 'none',
                                fontSize: '12px',
                                backgroundColor: '#f8f9fa'
                            }}
                        />
                        {gcode && (
                            <div className="position-absolute top-0 end-0 m-2">
                                <small className="badge bg-secondary">
                                    {gcode.split('\n').length} lines
                                </small>
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="d-flex align-items-center justify-content-center h-100 text-muted">
                        <div className="text-center">
                            <i className="bi bi-cube display-1 mb-3"></i>
                            <p>3D visualization coming soon!</p>
                            <small>Will require additional dependencies</small>
                        </div>
                    </div>
                )}
            </div>
            {gcode && (
                <div className="card-footer">
                    <div className="row g-2 text-center">
                        <div className="col">
                            <small className="text-muted d-block">Size</small>
                            <strong>{(gcode.length / 1024).toFixed(1)} KB</strong>
                        </div>
                        <div className="col">
                            <small className="text-muted d-block">Lines</small>
                            <strong>{gcode.split('\n').length}</strong>
                        </div>
                        <div className="col">
                            <small className="text-muted d-block">Status</small>
                            <span className="badge bg-success">Ready</span>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}