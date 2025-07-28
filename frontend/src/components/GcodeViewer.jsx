// frontend/src/components/GcodeViewer.jsx - Enhanced with responsive design and collapsible functionality
import React, { useState, Suspense, lazy } from 'react';

// Use lazy loading for the 3D viewer to improve initial load performance
const GcodeViewer3D = lazy(() => import('./GcodeViewer3D'));

export default function GcodeViewer({ gcode }) {
    const [viewMode, setViewMode] = useState('text');
    const [loadingSample, setLoadingSample] = useState(false);
    const [isCollapsed, setIsCollapsed] = useState(false);
    const [viewerHeight, setViewerHeight] = useState('60vh'); // Start with larger default
    
    const handleLoadSample = async () => {
        setLoadingSample(true);
        try {
            const response = await fetch('http://127.0.0.1:5000/api/gcode/sample.gcode');
            if (response.ok) {
                const content = await response.text();
                // This is a simple way to trigger a re-render with new gcode
                // In a real app, this would be passed up to parent component
                window.dispatchEvent(new CustomEvent('loadSampleGcode', { detail: content }));
            }
        } catch (error) {
            console.error('Failed to load sample G-code:', error);
        }
        setLoadingSample(false);
    };
    
    const toggleCollapse = () => {
        setIsCollapsed(!isCollapsed);
    };
    
    const handleHeightChange = (height) => {
        setViewerHeight(height);
    };
    
    return (
        <div className="card h-100">
            <div className="card-header d-flex justify-content-between align-items-center">
                <div className="d-flex align-items-center">
                    <h5 className="card-title mb-0 me-3">
                        <i className="bi bi-file-text me-2"></i>
                        G-Code Viewer
                    </h5>
                    {gcode && (
                        <span className="badge bg-primary badge-sm">
                            {(gcode.length / 1024).toFixed(1)} KB
                        </span>
                    )}
                </div>
                <div className="d-flex gap-2 align-items-center">
                        {/* Height Control for larger screens */}
                        <div className="d-none d-lg-flex align-items-center me-2">
                            <small className="text-muted me-2">Height:</small>
                            <select 
                                className="form-select form-select-sm"
                                value={viewerHeight}
                                onChange={(e) => handleHeightChange(e.target.value)}
                                style={{ width: '120px' }}
                            >
                                <option value="40vh">Compact</option>
                                <option value="50vh">Medium</option>
                                <option value="60vh">Large</option>
                                <option value="70vh">Extra Large</option>
                                <option value="80vh">Full View</option>
                            </select>
                        </div>                    <button 
                        className="btn btn-outline-secondary btn-sm"
                        onClick={handleLoadSample}
                        disabled={loadingSample}
                        title="Load sample G-code for testing"
                    >
                        {loadingSample ? (
                            <>
                                <span className="spinner-border spinner-border-sm me-1"></span>
                                <span className="d-none d-sm-inline">Loading...</span>
                            </>
                        ) : (
                            <>
                                <i className="bi bi-file-earmark-code"></i> 
                                <span className="d-none d-sm-inline ms-1">Load Sample</span>
                            </>
                        )}
                    </button>
                    <div className="btn-group btn-group-sm">
                        <button 
                            className={`btn ${viewMode === 'text' ? 'btn-primary' : 'btn-outline-primary'}`}
                            onClick={() => setViewMode('text')}
                            title="Text View"
                        >
                            <i className="bi bi-file-text"></i> 
                            <span className="d-none d-md-inline ms-1">Text</span>
                        </button>
                        <button 
                            className={`btn ${viewMode === '3d' ? 'btn-primary' : 'btn-outline-primary'}`}
                            onClick={() => setViewMode('3d')}
                            title="3D/2D Visual View"
                        >
                            <i className="bi bi-diagram-3"></i> 
                            <span className="d-none d-md-inline ms-1">2D/3D View</span>
                        </button>
                    </div>
                    <button 
                        className="btn btn-outline-secondary btn-sm"
                        onClick={toggleCollapse}
                        title={isCollapsed ? "Expand viewer" : "Collapse viewer"}
                    >
                        <i className={`bi bi-chevron-${isCollapsed ? 'down' : 'up'}`}></i>
                    </button>
                </div>
            </div>
            
            <div className={`collapse ${!isCollapsed ? 'show' : ''}`}>
                <div className="card-body p-0" style={{ height: isCollapsed ? '0' : viewerHeight }}>
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
                        <Suspense fallback={
                            <div className="d-flex align-items-center justify-content-center h-100 text-muted">
                                <div className="text-center">
                                    <div className="spinner-border text-primary mb-2" role="status">
                                        <span className="visually-hidden">Loading 3D viewer...</span>
                                    </div>
                                    <p className="small">Loading Interactive 3D Viewer...</p>
                                </div>
                            </div>
                        }>
                            <GcodeViewer3D gcode={gcode} />
                        </Suspense>
                    )}
                </div>
                
                {/* Footer with stats and responsive layout */}
                {gcode && !isCollapsed && (
                    <div className="card-footer">
                        <div className="row g-2 text-center">
                            <div className="col-6 col-md-3">
                                <small className="text-muted d-block">Size</small>
                                <strong className="small">{(gcode.length / 1024).toFixed(1)} KB</strong>
                            </div>
                            <div className="col-6 col-md-3">
                                <small className="text-muted d-block">Lines</small>
                                <strong className="small">{gcode.split('\n').length.toLocaleString()}</strong>
                            </div>
                            <div className="col-6 col-md-3">
                                <small className="text-muted d-block">Commands</small>
                                <strong className="small">{gcode.split('\n').filter(line => line.trim().startsWith('G')).length}</strong>
                            </div>
                            <div className="col-6 col-md-3">
                                <small className="text-muted d-block">Status</small>
                                <span className="badge bg-success small">Ready</span>
                            </div>
                        </div>
                        
                        {/* Mobile-friendly controls */}
                        <div className="d-md-none mt-2 pt-2 border-top">
                            <div className="d-flex justify-content-center gap-2">
                                <small className="text-muted">Height:</small>
                                <div className="btn-group btn-group-sm">
                                    <button 
                                        className={`btn ${viewerHeight === '40vh' ? 'btn-primary' : 'btn-outline-secondary'} btn-sm`}
                                        onClick={() => handleHeightChange('40vh')}
                                    >
                                        S
                                    </button>
                                    <button 
                                        className={`btn ${viewerHeight === '50vh' ? 'btn-primary' : 'btn-outline-secondary'} btn-sm`}
                                        onClick={() => handleHeightChange('50vh')}
                                    >
                                        M
                                    </button>
                                    <button 
                                        className={`btn ${viewerHeight === '60vh' ? 'btn-primary' : 'btn-outline-secondary'} btn-sm`}
                                        onClick={() => handleHeightChange('60vh')}
                                    >
                                        L
                                    </button>
                                    <button 
                                        className={`btn ${viewerHeight === '80vh' ? 'btn-primary' : 'btn-outline-secondary'} btn-sm`}
                                        onClick={() => handleHeightChange('80vh')}
                                    >
                                        XL
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}