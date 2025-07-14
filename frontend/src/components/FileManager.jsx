// frontend/src/components/FileManager.jsx - Production Version with View functionality
import React, { useState, useEffect } from 'react';

export default function FileManager({ isConnected, onStartPrint, onViewFile }) {
    const [files, setFiles] = useState([]);
    const [selectedFile, setSelectedFile] = useState(null);
    const [uploading, setUploading] = useState(false);
    const [error, setError] = useState('');

    const fetchFiles = async () => {
        try {
            const response = await fetch('http://127.0.0.1:5000/api/files');
            if (response.ok) {
                const data = await response.json();
                setFiles(data.files || []);
                setError('');
            } else {
                throw new Error('Failed to fetch files');
            }
        } catch (err) {
            setError('Failed to load files');
            console.error('Error fetching files:', err);
        }
    };

    // Fetch files on initial load and when the printer connects
    useEffect(() => {
        fetchFiles();
    }, [isConnected]);

    const handleUpload = async (event) => {
        const file = event.target.files[0];
        if (!file) return;

        // Validate file type
        if (!file.name.toLowerCase().endsWith('.gcode') && !file.name.toLowerCase().endsWith('.gco')) {
            setError('Only G-code files (.gcode, .gco) are allowed');
            return;
        }

        // Validate file size (50MB limit)
        if (file.size > 50 * 1024 * 1024) {
            setError('File too large (max 50MB)');
            return;
        }

        setUploading(true);
        setError('');
        
        try {
            const formData = new FormData();
            formData.append('file', file);
            
            const response = await fetch('http://127.0.0.1:5000/api/upload', {
                method: 'POST',
                body: formData
            });
            
            const data = await response.json();
            
            if (response.ok && data.status === 'success') {
                await fetchFiles(); // Refresh the file list
                event.target.value = ''; // Clear the input
            } else {
                setError(data.message || 'Upload failed');
            }
        } catch (err) {
            setError('Upload failed: ' + err.message);
            console.error('Upload error:', err);
        } finally {
            setUploading(false);
        }
    };

    const handlePrint = () => {
        if (selectedFile && onStartPrint) {
            onStartPrint(selectedFile);
        }
    };

    const handleView = (filename, event) => {
        event.stopPropagation(); // Prevent selecting the file
        if (onViewFile) {
            onViewFile(filename);
        }
    };

    return (
        <div className="card border-0 shadow-sm mb-3" style={{ backgroundColor: 'rgba(255, 255, 255, 0.98)' }}>
            <div className="card-header bg-transparent border-bottom-0">
                <h6 className="mb-0 fw-bold text-primary">
                    <i className="bi bi-folder2-open me-2"></i>File Manager
                </h6>
            </div>
            <div className="card-body">
                {error && (
                    <div className="alert alert-danger border-0 shadow-sm py-2 mb-3" role="alert" style={{ borderRadius: '8px' }}>
                        <i className="bi bi-exclamation-triangle me-2"></i>
                        {error}
                    </div>
                )}
                
                {/* File Upload Section */}
                <div className="mb-4">
                    <label className="form-label fw-semibold text-muted mb-2">
                        <i className="bi bi-cloud-arrow-up me-1"></i>
                        Upload G-code File
                    </label>
                    <div className="input-group">
                        <input 
                            type="file" 
                            className="form-control border-end-0" 
                            onChange={handleUpload} 
                            disabled={!isConnected || uploading}
                            accept=".gcode,.gco"
                            style={{ borderRadius: '8px 0 0 8px' }}
                        />
                        <span className="input-group-text bg-primary text-white border-0" style={{ borderRadius: '0 8px 8px 0' }}>
                            <i className="bi bi-file-earmark-arrow-up"></i>
                        </span>
                    </div>
                    <small className="text-muted">Supported formats: .gcode, .gco (max 50MB)</small>
                </div>
                
                {/* Files List */}
                {files.length > 0 ? (
                    <div className="mb-3">
                        <label className="form-label fw-semibold text-muted mb-2">
                            <i className="bi bi-files me-1"></i>
                            Available Files ({files.length})
                        </label>
                        <div className="border rounded-3 p-2 file-list-container" style={{ backgroundColor: '#f8f9fa' }}>
                            {files.map(file => (
                                <div 
                                    key={file} 
                                    className={`d-flex justify-content-between align-items-center p-2 mb-1 rounded-2 ${selectedFile === file ? 'bg-primary bg-opacity-10 border border-primary border-opacity-25' : 'bg-white border'}`} 
                                    style={{ cursor: 'pointer', transition: 'all 0.2s ease' }} 
                                    onClick={() => setSelectedFile(file)}
                                >
                                    <div className="d-flex align-items-center">
                                        <i className={`bi ${selectedFile === file ? 'bi-file-earmark-check-fill text-primary' : 'bi-file-earmark-code'} me-2`}></i>
                                        <span className={`${selectedFile === file ? 'fw-semibold text-primary' : ''}`} style={{ fontSize: '0.9rem' }}>
                                            {file}
                                        </span>
                                    </div>
                                    <button 
                                        className="btn btn-outline-info btn-sm" 
                                        onClick={(e) => handleView(file, e)}
                                        title="View G-code in 3D viewer"
                                        style={{ fontSize: '0.7rem', padding: '0.25rem 0.5rem' }}
                                    >
                                        <i className="bi bi-eye me-1"></i>View
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>
                ) : (
                    <div className="text-center py-4 mb-3">
                        <div className="text-muted">
                            <i className="bi bi-inbox" style={{ fontSize: '2rem', opacity: 0.5 }}></i>
                            <p className="mt-2 mb-0">
                                {isConnected ? 'No G-code files uploaded yet' : 'Connect to printer to manage files'}
                            </p>
                        </div>
                    </div>
                )}
                
                {/* Action Buttons */}
                <div className="d-grid">
                    <button 
                        className="btn btn-success btn-lg shadow-sm" 
                        onClick={handlePrint} 
                        disabled={!selectedFile || !isConnected || uploading}
                        style={{ borderRadius: '10px' }}
                    >
                        {uploading ? (
                            <>
                                <span className="spinner-border spinner-border-sm me-2" role="status"></span>
                                Uploading...
                            </>
                        ) : (
                            <>
                                <i className="bi bi-printer-fill me-2"></i>
                                {selectedFile ? `Print ${selectedFile}` : 'Select a file to print'}
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
}