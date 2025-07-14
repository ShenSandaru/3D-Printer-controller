// frontend/src/components/GcodeViewer.jsx - Updated with file viewing and live print simulation
import React, { useState, useEffect } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Line, Text } from '@react-three/drei';

function parseGcode(gcode) {
    const points = [];
    let lastPos = { x: 0, y: 0, z: 0 };
    gcode.split('\n').forEach(line => {
        line = line.split(';')[0].trim();
        if (line.startsWith('G0') || line.startsWith('G1')) {
            const newPos = { ...lastPos };
            let isExtruding = false;
            line.split(' ').forEach(part => {
                const key = part.charAt(0).toLowerCase();
                const value = parseFloat(part.substring(1));
                if (['x', 'y', 'z'].includes(key)) newPos[key] = value;
                if (key === 'e' && value > 0) isExtruding = true;
            });
            if (isExtruding) {
                points.push(lastPos.x, lastPos.y, lastPos.z, newPos.x, newPos.y, newPos.z);
            }
            lastPos = newPos;
        }
    });
    return new Float32Array(points);
}

export default function GcodeViewer({ fileToView, printStatus }) {
    const [toolpath, setToolpath] = useState(null);
    const [printedPath, setPrintedPath] = useState(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');

    // This effect loads a new file whenever 'fileToView' changes
    useEffect(() => {
        if (!fileToView) return;

        const loadFile = async () => {
            setIsLoading(true);
            setToolpath(null);
            setPrintedPath(null);
            setError('');
            
            try {
                const response = await fetch(`http://127.0.0.1:5000/api/gcode/${fileToView}`);
                if (!response.ok) {
                    throw new Error('File not found on server');
                }
                const gcodeText = await response.text();
                const fullPath = parseGcode(gcodeText);
                setToolpath(fullPath);
            } catch (error) {
                console.error("Error loading G-code:", error);
                setError(`Failed to load ${fileToView}: ${error.message}`);
            } finally {
                setIsLoading(false);
            }
        };
        loadFile();
    }, [fileToView]);

    // This effect updates the "printed" path when a print is active
    useEffect(() => {
        if (printStatus?.status === 'printing' && toolpath && printStatus.filename === fileToView) {
            const progressPoints = Math.floor((toolpath.length / 6) * (printStatus.progress / 100)) * 6;
            setPrintedPath(toolpath.slice(0, progressPoints));
        } else {
            // Clear the printed path if not printing this file
            setPrintedPath(null);
        }
    }, [printStatus, toolpath, fileToView]);

    const getStatusMessage = () => {
        if (!fileToView) return "Upload a G-code file and click 'View' to preview it here";
        if (isLoading) return `Loading ${fileToView}...`;
        if (error) return error;
        if (printStatus?.status === 'printing' && printStatus.filename === fileToView) {
            return `Printing: ${fileToView} (${printStatus.progress?.toFixed(1)}%)`;
        }
        if (toolpath) return `Viewing: ${fileToView}`;
        return "No G-code loaded";
    };

    return (
        <div className="h-100 d-flex flex-column">
            <div className="flex-grow-1 position-relative">
                {(isLoading || error || !fileToView) && (
                    <div className="position-absolute top-50 start-50 translate-middle text-center z-1">
                        <div className="card border-0 shadow-lg p-4" style={{ backgroundColor: 'rgba(255, 255, 255, 0.95)', borderRadius: '16px' }}>
                            {isLoading && (
                                <div className="text-primary">
                                    <div className="spinner-border mb-3" role="status" style={{ width: '3rem', height: '3rem' }}>
                                        <span className="visually-hidden">Loading...</span>
                                    </div>
                                    <h5 className="fw-bold">Loading G-code...</h5>
                                    <p className="text-muted mb-0">Parsing {fileToView} for 3D visualization</p>
                                </div>
                            )}
                            {error && (
                                <div className="text-warning">
                                    <i className="bi bi-exclamation-triangle" style={{ fontSize: '3rem' }}></i>
                                    <h5 className="fw-bold mt-3">Failed to Load File</h5>
                                    <p className="text-muted mb-0">{error}</p>
                                </div>
                            )}
                            {!fileToView && !isLoading && !error && (
                                <div className="text-muted">
                                    <i className="bi bi-cloud-arrow-up" style={{ fontSize: '3rem' }}></i>
                                    <h5 className="fw-bold mt-3">No File Selected</h5>
                                    <p className="mb-0">Upload a G-code file and click "View" to see the 3D preview</p>
                                    <small className="text-muted">Supported formats: .gcode, .gco</small>
                                </div>
                            )}
                        </div>
                    </div>
                )}
                
                <Canvas camera={{ position: [100, 150, 150], fov: 50 }} style={{ background: 'linear-gradient(to bottom, #e3f2fd, #f5f5f5)' }}>
                    <ambientLight intensity={0.6} />
                    <directionalLight position={[100, 100, 100]} intensity={0.8} castShadow />
                    <pointLight position={[-50, 50, 50]} intensity={0.3} />
                    
                    {/* Enhanced Grid */}
                    <gridHelper args={[220, 22, '#2196f3', '#e0e0e0']} />
                    
                    {/* Full toolpath in subtle gray */}
                    {toolpath && <Line points={toolpath} color="#bdbdbd" lineWidth={1.5} />}
                    
                    {/* Printed path in bright blue with glow effect */}
                    {printedPath && <Line points={printedPath} color="#2196f3" lineWidth={3} />}

                    {/* Enhanced Build plate with border */}
                    <mesh position={[0, -0.5, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
                        <planeGeometry args={[220, 220]} />
                        <meshLambertMaterial color="#ffffff" transparent opacity={0.15} />
                    </mesh>
                    
                    {/* Build plate border */}
                    <mesh position={[0, -0.4, 0]} rotation={[-Math.PI / 2, 0, 0]}>
                        <ringGeometry args={[110, 112, 32]} />
                        <meshBasicMaterial color="#2196f3" transparent opacity={0.6} />
                    </mesh>

                    <OrbitControls 
                        enablePan={true} 
                        enableZoom={true} 
                        enableRotate={true}
                        maxDistance={500}
                        minDistance={50}
                    />
                </Canvas>
                
                {/* Overlay Controls */}
                {toolpath && (
                    <div className="position-absolute bottom-0 start-0 m-3">
                        <div className="card border-0 shadow-sm" style={{ backgroundColor: 'rgba(255, 255, 255, 0.9)' }}>
                            <div className="card-body p-2">
                                <div className="d-flex align-items-center small text-muted">
                                    <div className="me-3">
                                        <div className="d-flex align-items-center">
                                            <div className="me-1" style={{ width: '12px', height: '2px', backgroundColor: '#bdbdbd' }}></div>
                                            <span>Full Path</span>
                                        </div>
                                    </div>
                                    {printedPath && (
                                        <div>
                                            <div className="d-flex align-items-center">
                                                <div className="me-1" style={{ width: '12px', height: '2px', backgroundColor: '#2196f3' }}></div>
                                                <span>Printed</span>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}