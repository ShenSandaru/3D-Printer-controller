// frontend/src/components/GcodeViewer3D.jsx - Simple 2D/3D G-code visualization
import React, { useState, useEffect, useRef, useCallback } from 'react';

// G-code parser utility
const parseGcode = (gcodeText) => {
    const lines = gcodeText.split('\n');
    const moves = [];
    let currentPos = { x: 0, y: 0, z: 0, e: 0 };
    
    for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith(';')) continue;
        
        // Parse G0/G1 movement commands
        if (trimmed.startsWith('G0') || trimmed.startsWith('G1')) {
            const newPos = { ...currentPos };
            let hasExtrusion = false;
            
            // Extract coordinates
            const xMatch = trimmed.match(/X([-\d.]+)/i);
            const yMatch = trimmed.match(/Y([-\d.]+)/i);
            const zMatch = trimmed.match(/Z([-\d.]+)/i);
            const eMatch = trimmed.match(/E([-\d.]+)/i);
            
            if (xMatch) newPos.x = parseFloat(xMatch[1]);
            if (yMatch) newPos.y = parseFloat(yMatch[1]);
            if (zMatch) newPos.z = parseFloat(zMatch[1]);
            if (eMatch) {
                newPos.e = parseFloat(eMatch[1]);
                hasExtrusion = newPos.e > currentPos.e;
            }
            
            // Create move object
            if (currentPos.x !== newPos.x || currentPos.y !== newPos.y || currentPos.z !== newPos.z) {
                moves.push({
                    from: { ...currentPos },
                    to: { ...newPos },
                    isExtrusion: hasExtrusion
                });
            }
            
            currentPos = newPos;
        }
    }
    
    return moves;
};

// Interactive Canvas-based 3D/2D renderer with full 360-degree rotation
const InteractiveCanvasRenderer = ({ moves, simulationProgress, viewMode }) => {
    const canvasRef = useRef(null);
    const [transform, setTransform] = useState({
        scale: 1,
        offsetX: 0,
        offsetY: 0,
        rotation: 0, // For 2D rotation
        rotationMatrix: [
            [1, 0, 0],
            [0, 1, 0],
            [0, 0, 1]
        ] // For full 3D rotation
    });
    
    const [isDragging, setIsDragging] = useState(false);
    const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
    const [lastTransform, setLastTransform] = useState(null);
    const [rotationMode, setRotationMode] = useState('free'); // 'free', 'pan'
    
    // Smooth rotation variables
    const animationFrameRef = useRef(null);
    const velocityRef = useRef({ x: 0, y: 0 });
    const lastMoveTime = useRef(Date.now());
    const lastPosition = useRef({ x: 0, y: 0 });
    
    // Matrix multiplication for 3D transformations
    const multiplyMatrix = (a, b) => {
        const result = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
        for (let i = 0; i < 3; i++) {
            for (let j = 0; j < 3; j++) {
                for (let k = 0; k < 3; k++) {
                    result[i][j] += a[i][k] * b[k][j];
                }
            }
        }
        return result;
    };
    
    // Create rotation matrix around X axis
    const rotationMatrixX = (angle) => {
        const cos = Math.cos(angle);
        const sin = Math.sin(angle);
        return [
            [1, 0, 0],
            [0, cos, -sin],
            [0, sin, cos]
        ];
    };
    
    // Create rotation matrix around Y axis
    const rotationMatrixY = (angle) => {
        const cos = Math.cos(angle);
        const sin = Math.sin(angle);
        return [
            [cos, 0, sin],
            [0, 1, 0],
            [-sin, 0, cos]
        ];
    };
    
    // Create rotation matrix around Z axis
    const rotationMatrixZ = (angle) => {
        const cos = Math.cos(angle);
        const sin = Math.sin(angle);
        return [
            [cos, -sin, 0],
            [sin, cos, 0],
            [0, 0, 1]
        ];
    };
    
    // Apply matrix transformation to a 3D point
    const applyMatrix = (point, matrix) => {
        const [x, y, z] = point;
        return [
            matrix[0][0] * x + matrix[0][1] * y + matrix[0][2] * z,
            matrix[1][0] * x + matrix[1][1] * y + matrix[1][2] * z,
            matrix[2][0] * x + matrix[2][1] * y + matrix[2][2] * z
        ];
    };
    
    // Transform 3D point to 2D screen coordinates with full rotation matrix
    const project3D = (x, y, z, rotationMatrix, scale) => {
        if (viewMode === '2D') {
            // Simple 2D projection with Z-axis rotation
            const cos = Math.cos(transform.rotation);
            const sin = Math.sin(transform.rotation);
            return {
                x: (x * cos - y * sin) * scale,
                y: (x * sin + y * cos) * scale,
                depth: 0
            };
        }
        
        // Apply full 3D rotation matrix
        const [rx, ry, rz] = applyMatrix([x, y, z], rotationMatrix);
        
        // Enhanced perspective projection with better depth handling
        const distance = 400; // Increased distance for better perspective
        const perspectiveFactor = distance / (distance + rz);
        
        return {
            x: rx * perspectiveFactor * scale,
            y: ry * perspectiveFactor * scale,
            depth: rz
        };
    };
    
    // Smooth momentum rotation system
    const startMomentum = useCallback(() => {
        if (animationFrameRef.current) return; // Already running
        
        const momentum = () => {
            const currentVelocity = velocityRef.current;
            const speed = Math.sqrt(currentVelocity.x * currentVelocity.x + currentVelocity.y * currentVelocity.y);
            
            if (speed < 0.001) {
                // Stop momentum when velocity is very low
                animationFrameRef.current = null;
                return;
            }
            
            // Apply momentum rotation
            if (viewMode === '3D') {
                const rotationSpeed = 0.004; // Smooth momentum speed
                const rotX = -currentVelocity.y * rotationSpeed;
                const rotY = currentVelocity.x * rotationSpeed;
                
                const matrixX = rotationMatrixX(rotX);
                const matrixY = rotationMatrixY(rotY);
                const combinedRotation = multiplyMatrix(matrixX, matrixY);
                
                setTransform(prev => ({
                    ...prev,
                    rotationMatrix: multiplyMatrix(combinedRotation, prev.rotationMatrix)
                }));
            }
            
            // Apply friction to gradually reduce velocity
            velocityRef.current = {
                x: currentVelocity.x * 0.96,
                y: currentVelocity.y * 0.96
            };
            
            animationFrameRef.current = requestAnimationFrame(momentum);
        };
        
        animationFrameRef.current = requestAnimationFrame(momentum);
    }, [viewMode]);
    
    // Enhanced mouse and touch event handlers
    const handlePointerDown = (e) => {
        e.preventDefault();
        setIsDragging(true);
        
        // Cancel any existing momentum animation
        if (animationFrameRef.current) {
            cancelAnimationFrame(animationFrameRef.current);
            animationFrameRef.current = null;
        }
        
        // Support both mouse and touch events
        const clientX = e.clientX || (e.touches && e.touches[0]?.clientX) || 0;
        const clientY = e.clientY || (e.touches && e.touches[0]?.clientY) || 0;
        
        setDragStart({ x: clientX, y: clientY });
        setLastTransform({ ...transform });
        
        // Initialize velocity tracking
        velocityRef.current = { x: 0, y: 0 };
        lastMoveTime.current = Date.now();
        lastPosition.current = { x: clientX, y: clientY };
        
        // Determine rotation mode based on modifier keys or touch
        if (e.ctrlKey || e.metaKey || e.touches?.length > 1) {
            setRotationMode('pan');
        } else {
            setRotationMode('free');
        }
    };
    
    const handlePointerMove = (e) => {
        if (!isDragging || !lastTransform) return;
        e.preventDefault();
        
        // Support both mouse and touch events
        const clientX = e.clientX || (e.touches && e.touches[0]?.clientX) || 0;
        const clientY = e.clientY || (e.touches && e.touches[0]?.clientY) || 0;
        
        const deltaX = clientX - dragStart.x;
        const deltaY = clientY - dragStart.y;
        
        // Calculate velocity for momentum
        const currentTime = Date.now();
        const timeDelta = currentTime - lastMoveTime.current;
        
        if (timeDelta > 0) {
            const positionDeltaX = clientX - lastPosition.current.x;
            const positionDeltaY = clientY - lastPosition.current.y;
            
            // Smooth velocity calculation with weighted average
            const newVelocityX = positionDeltaX / timeDelta * 16; // Normalize to 60fps
            const newVelocityY = positionDeltaY / timeDelta * 16;
            
            velocityRef.current = {
                x: velocityRef.current.x * 0.7 + newVelocityX * 0.3,
                y: velocityRef.current.y * 0.7 + newVelocityY * 0.3
            };
            
            lastMoveTime.current = currentTime;
            lastPosition.current = { x: clientX, y: clientY };
        }
        
        if (rotationMode === 'pan' || (e.ctrlKey || e.metaKey)) {
            // Pan mode with smoother movement
            setTransform(prev => ({
                ...prev,
                offsetX: lastTransform.offsetX + deltaX * 0.8,
                offsetY: lastTransform.offsetY + deltaY * 0.8
            }));
        } else {
            // Enhanced rotation mode with improved sensitivity
            if (viewMode === '3D') {
                // Adaptive rotation speed based on movement distance
                const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
                const adaptiveSpeed = Math.min(0.012, 0.006 + distance * 0.00002);
                
                const rotX = -deltaY * adaptiveSpeed;
                const rotY = deltaX * adaptiveSpeed;
                
                // Create incremental rotation matrices
                const matrixX = rotationMatrixX(rotX);
                const matrixY = rotationMatrixY(rotY);
                
                // Combine rotations: apply Y rotation first, then X rotation
                const combinedRotation = multiplyMatrix(matrixX, matrixY);
                
                // Apply to existing rotation matrix
                const newMatrix = multiplyMatrix(combinedRotation, lastTransform.rotationMatrix);
                
                setTransform(prev => ({
                    ...prev,
                    rotationMatrix: newMatrix
                }));
            } else {
                // 2D rotation with improved smoothness
                setTransform(prev => ({
                    ...prev,
                    rotation: lastTransform.rotation + deltaX * 0.008
                }));
            }
        }
    };
    
    const handlePointerUp = (e) => {
        e.preventDefault();
        setIsDragging(false);
        setLastTransform(null);
        setRotationMode('free');
        
        // Start momentum rotation if there's sufficient velocity
        const currentVelocity = velocityRef.current;
        const speed = Math.sqrt(currentVelocity.x * currentVelocity.x + currentVelocity.y * currentVelocity.y);
        
        if (speed > 2 && viewMode === '3D' && rotationMode === 'free') {
            // Only start momentum for 3D rotation, not panning
            startMomentum();
        } else {
            // Reset velocity if momentum won't start
            velocityRef.current = { x: 0, y: 0 };
        }
    };
    
    const handleWheel = (e) => {
        e.preventDefault();
        
        // Smooth zoom with adaptive scaling
        const zoomSensitivity = 0.1;
        const scaleFactor = e.deltaY > 0 ? (1 - zoomSensitivity) : (1 + zoomSensitivity);
        
        setTransform(prev => {
            const newScale = Math.max(0.1, Math.min(10, prev.scale * scaleFactor));
            return {
                ...prev,
                scale: newScale
            };
        });
    };
    
    // Reset view function with better default angles
    const resetView = () => {
        setTransform({
            scale: 1,
            offsetX: 0,
            offsetY: 0,
            rotation: 0,
            rotationMatrix: multiplyMatrix(
                rotationMatrixX(Math.PI / 6), // 30 degrees around X
                rotationMatrixY(Math.PI / 4)  // 45 degrees around Y
            )
        });
    };
    
    // Preset view functions
    const setTopView = () => {
        setTransform(prev => ({
            ...prev,
            rotationMatrix: [
                [1, 0, 0],
                [0, 1, 0],
                [0, 0, 1]
            ]
        }));
    };
    
    const setFrontView = () => {
        setTransform(prev => ({
            ...prev,
            rotationMatrix: rotationMatrixX(Math.PI / 2) // 90 degrees around X
        }));
    };
    
    const setSideView = () => {
        setTransform(prev => ({
            ...prev,
            rotationMatrix: rotationMatrixY(Math.PI / 2) // 90 degrees around Y
        }));
    };
    
    const setIsometricView = () => {
        setTransform(prev => ({
            ...prev,
            rotationMatrix: multiplyMatrix(
                rotationMatrixX(Math.PI / 4), // 45 degrees around X
                rotationMatrixY(Math.PI / 4)  // 45 degrees around Y
            )
        }));
    };
    
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas || moves.length === 0) return;
        
        const ctx = canvas.getContext('2d');
        const rect = canvas.getBoundingClientRect();
        
        // Set canvas size with device pixel ratio for sharp rendering
        const dpr = window.devicePixelRatio || 1;
        canvas.width = rect.width * dpr;
        canvas.height = rect.height * dpr;
        ctx.scale(dpr, dpr);
        
        // Clear canvas
        ctx.clearRect(0, 0, rect.width, rect.height);
        
        // Calculate bounds
        let minX = Infinity, maxX = -Infinity;
        let minY = Infinity, maxY = -Infinity;
        let minZ = Infinity, maxZ = -Infinity;
        
        moves.forEach(move => {
            minX = Math.min(minX, move.from.x, move.to.x);
            maxX = Math.max(maxX, move.from.x, move.to.x);
            minY = Math.min(minY, move.from.y, move.to.y);
            maxY = Math.max(maxY, move.from.y, move.to.y);
            minZ = Math.min(minZ, move.from.z, move.to.z);
            maxZ = Math.max(maxZ, move.from.z, move.to.z);
        });
        
        const rangeX = maxX - minX || 1;
        const rangeY = maxY - minY || 1;
        const rangeZ = maxZ - minZ || 1;
        const centerX = (minX + maxX) / 2;
        const centerY = (minY + maxY) / 2;
        const centerZ = (minZ + maxZ) / 2;
        
        const maxRange = Math.max(rangeX, rangeY, rangeZ);
        const baseScale = Math.min(rect.width, rect.height) / (maxRange * 1.2);
        const finalScale = baseScale * transform.scale;
        
        // Save context
        ctx.save();
        
        // Apply transforms
        ctx.translate(rect.width / 2 + transform.offsetX, rect.height / 2 + transform.offsetY);
        if (viewMode === '2D') {
            ctx.rotate(transform.rotation);
        }
        
        // Draw grid
        ctx.strokeStyle = '#e0e0e0';
        ctx.lineWidth = 0.5;
        const gridSize = 10;
        const gridExtent = maxRange * 2;
        
        for (let i = -gridExtent; i <= gridExtent; i += gridSize) {
            if (viewMode === '3D') {
                // 3D grid - using new rotation matrix system
                const from3D = project3D(i - centerX, -centerY, -centerZ, transform.rotationMatrix, finalScale);
                const to3D = project3D(i - centerX, rangeY - centerY, -centerZ, transform.rotationMatrix, finalScale);
                
                ctx.beginPath();
                ctx.moveTo(from3D.x, from3D.y);
                ctx.lineTo(to3D.x, to3D.y);
                ctx.stroke();
                
                const from3D2 = project3D(-centerX, i - centerY, -centerZ, transform.rotationMatrix, finalScale);
                const to3D2 = project3D(rangeX - centerX, i - centerY, -centerZ, transform.rotationMatrix, finalScale);
                
                ctx.beginPath();
                ctx.moveTo(from3D2.x, from3D2.y);
                ctx.lineTo(to3D2.x, to3D2.y);
                ctx.stroke();
            } else {
                // 2D grid
                ctx.beginPath();
                ctx.moveTo((i - centerX) * finalScale, (-gridExtent - centerY) * finalScale);
                ctx.lineTo((i - centerX) * finalScale, (gridExtent - centerY) * finalScale);
                ctx.stroke();
                
                ctx.beginPath();
                ctx.moveTo((-gridExtent - centerX) * finalScale, (i - centerY) * finalScale);
                ctx.lineTo((gridExtent - centerX) * finalScale, (i - centerY) * finalScale);
                ctx.stroke();
            }
        }
        
        // Prepare moves for depth sorting in 3D mode
        let sortedMoves = moves.map((move, index) => ({ move, index }));
        
        if (viewMode === '3D') {
            // Sort by depth for proper 3D rendering
            sortedMoves.sort((a, b) => {
                const depthA = project3D(
                    (a.move.from.x + a.move.to.x) / 2 - centerX,
                    (a.move.from.y + a.move.to.y) / 2 - centerY,
                    (a.move.from.z + a.move.to.z) / 2 - centerZ,
                    transform.rotationMatrix, finalScale
                ).depth;
                const depthB = project3D(
                    (b.move.from.x + b.move.to.x) / 2 - centerX,
                    (b.move.from.y + b.move.to.y) / 2 - centerY,
                    (b.move.from.z + b.move.to.z) / 2 - centerZ,
                    transform.rotationMatrix, finalScale
                ).depth;
                return depthB - depthA; // Draw far to near
            });
        }
        
        // Draw toolpath
        const progressIndex = Math.floor(simulationProgress * moves.length);
        
        sortedMoves.forEach(({ move, index }) => {
            const isCompleted = index < progressIndex;
            const isExtrusion = move.isExtrusion;
            
            // Color based on height in 3D mode
            let strokeColor;
            if (isCompleted) {
                strokeColor = '#0066cc';
            } else if (viewMode === '3D' && isExtrusion) {
                const heightRatio = (move.from.z - minZ) / (rangeZ || 1);
                const hue = heightRatio * 240; // Blue to red gradient
                strokeColor = `hsl(${240 - hue}, 70%, 50%)`;
            } else {
                strokeColor = isExtrusion ? '#666666' : '#cccccc';
            }
            
            ctx.strokeStyle = strokeColor;
            ctx.lineWidth = isExtrusion ? 2 : 1;
            
            let fromX, fromY, toX, toY;
            
            if (viewMode === '3D') {
                const from3D = project3D(
                    move.from.x - centerX,
                    move.from.y - centerY,
                    move.from.z - centerZ,
                    transform.rotationMatrix, finalScale
                );
                const to3D = project3D(
                    move.to.x - centerX,
                    move.to.y - centerY,
                    move.to.z - centerZ,
                    transform.rotationMatrix, finalScale
                );
                
                fromX = from3D.x;
                fromY = from3D.y;
                toX = to3D.x;
                toY = to3D.y;
            } else {
                fromX = (move.from.x - centerX) * finalScale;
                fromY = -(move.from.y - centerY) * finalScale;
                toX = (move.to.x - centerX) * finalScale;
                toY = -(move.to.y - centerY) * finalScale;
            }
            
            ctx.beginPath();
            ctx.moveTo(fromX, fromY);
            ctx.lineTo(toX, toY);
            ctx.stroke();
        });
        
        // Draw coordinate axes
        ctx.lineWidth = 3;
        const axisLength = 30;
        
        if (viewMode === '3D') {
            // 3D axes using new rotation matrix system
            const originX = project3D(-centerX, -centerY, -centerZ, transform.rotationMatrix, finalScale);
            const xAxis = project3D(axisLength - centerX, -centerY, -centerZ, transform.rotationMatrix, finalScale);
            const yAxis = project3D(-centerX, axisLength - centerY, -centerZ, transform.rotationMatrix, finalScale);
            const zAxis = project3D(-centerX, -centerY, axisLength - centerZ, transform.rotationMatrix, finalScale);
            
            // X axis (red)
            ctx.strokeStyle = '#ff0000';
            ctx.beginPath();
            ctx.moveTo(originX.x, originX.y);
            ctx.lineTo(xAxis.x, xAxis.y);
            ctx.stroke();
            
            // Y axis (green)
            ctx.strokeStyle = '#00ff00';
            ctx.beginPath();
            ctx.moveTo(originX.x, originX.y);
            ctx.lineTo(yAxis.x, yAxis.y);
            ctx.stroke();
            
            // Z axis (blue)
            ctx.strokeStyle = '#0000ff';
            ctx.beginPath();
            ctx.moveTo(originX.x, originX.y);
            ctx.lineTo(zAxis.x, zAxis.y);
            ctx.stroke();
        } else {
            // 2D axes
            const originX = (-centerX) * finalScale;
            const originY = -(-centerY) * finalScale;
            
            // X axis (red)
            ctx.strokeStyle = '#ff0000';
            ctx.beginPath();
            ctx.moveTo(originX, originY);
            ctx.lineTo(originX + axisLength, originY);
            ctx.stroke();
            
            // Y axis (green)
            ctx.strokeStyle = '#00ff00';
            ctx.beginPath();
            ctx.moveTo(originX, originY);
            ctx.lineTo(originX, originY - axisLength);
            ctx.stroke();
        }
        
        // Restore context
        ctx.restore();
        
        // Draw axis labels in screen coordinates
        ctx.fillStyle = '#333';
        ctx.font = '14px Arial';
        ctx.fillText('X', 20, rect.height - 5);
        ctx.fillStyle = '#333';
        ctx.fillText('Y', 5, 20);
        if (viewMode === '3D') {
            ctx.fillStyle = '#333';
            ctx.fillText('Z', 35, rect.height - 5);
        }
        
    }, [moves, simulationProgress, transform, viewMode]);
    
    // Cleanup effect for animation frames
    useEffect(() => {
        return () => {
            if (animationFrameRef.current) {
                cancelAnimationFrame(animationFrameRef.current);
            }
        };
    }, []);
    
    return (
        <div className="position-relative gcode-3d-viewer" style={{ width: '100%', height: '100%' }}>
            <canvas 
                ref={canvasRef}
                onMouseDown={handlePointerDown}
                onMouseMove={handlePointerMove}
                onMouseUp={handlePointerUp}
                onMouseLeave={handlePointerUp}
                onTouchStart={handlePointerDown}
                onTouchMove={handlePointerMove}
                onTouchEnd={handlePointerUp}
                onWheel={handleWheel}
                style={{ 
                    width: '100%', 
                    height: '100%',
                    border: '1px solid #ddd',
                    borderRadius: '4px',
                    cursor: isDragging ? 'grabbing' : 'grab',
                    touchAction: 'none' // Prevent default touch behaviors
                }}
            />
            
            {/* Enhanced view controls overlay */}
            <div className="position-absolute top-0 end-0 m-2">
                <div className="btn-group-vertical btn-group-sm">
                    <button 
                        className="btn btn-outline-secondary"
                        onClick={() => setTransform(prev => ({ ...prev, scale: prev.scale * 1.2 }))}
                        title="Zoom In"
                    >
                        <i className="bi bi-zoom-in"></i>
                    </button>
                    <button 
                        className="btn btn-outline-secondary"
                        onClick={() => setTransform(prev => ({ ...prev, scale: prev.scale * 0.8 }))}
                        title="Zoom Out"
                    >
                        <i className="bi bi-zoom-out"></i>
                    </button>
                    <button 
                        className="btn btn-outline-secondary"
                        onClick={resetView}
                        title="Reset View"
                    >
                        <i className="bi bi-house"></i>
                    </button>
                </div>
            </div>
            
            {/* View preset buttons for 3D mode */}
            {viewMode === '3D' && (
                <div className="position-absolute top-0 start-0 m-2">
                    <div className="btn-group btn-group-sm">
                        <button 
                            className="btn btn-outline-info btn-sm"
                            onClick={setTopView}
                            title="Top View"
                        >
                            Top
                        </button>
                        <button 
                            className="btn btn-outline-info btn-sm"
                            onClick={setFrontView}
                            title="Front View"
                        >
                            Front
                        </button>
                        <button 
                            className="btn btn-outline-info btn-sm"
                            onClick={setSideView}
                            title="Side View"
                        >
                            Side
                        </button>
                        <button 
                            className="btn btn-outline-info btn-sm"
                            onClick={setIsometricView}
                            title="Isometric View"
                        >
                            ISO
                        </button>
                    </div>
                </div>
            )}
            
            {/* Enhanced instructions overlay */}
            <div className="position-absolute bottom-0 start-0 m-2">
                <small className="text-muted bg-white px-2 py-1 rounded shadow-sm">
                    {viewMode === '3D' ? (
                        <>
                            <strong>3D Controls:</strong> Drag to rotate 360° • Ctrl+Drag to pan • Wheel to zoom
                        </>
                    ) : (
                        <>
                            <strong>2D Controls:</strong> Drag to rotate • Ctrl+Drag to pan • Wheel to zoom
                        </>
                    )}
                </small>
            </div>
        </div>
    );
};

// Main 3D viewer component
export default function GcodeViewer3D({ gcode }) {
    const [moves, setMoves] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [simulationProgress, setSimulationProgress] = useState(0);
    const [isSimulating, setIsSimulating] = useState(false);
    const [stats, setStats] = useState({ totalMoves: 0, extrusionMoves: 0 });
    const [viewMode, setViewMode] = useState('3D'); // '2D' or '3D'
    const [showLayers, setShowLayers] = useState(false);
    const [selectedLayer, setSelectedLayer] = useState(null);
    
    // Parse G-code when it changes
    useEffect(() => {
        if (!gcode) {
            setMoves([]);
            setStats({ totalMoves: 0, extrusionMoves: 0 });
            return;
        }
        
        setIsLoading(true);
        
        // Parse in a timeout to avoid blocking UI
        setTimeout(() => {
            try {
                const parsedMoves = parseGcode(gcode);
                setMoves(parsedMoves);
                setStats({
                    totalMoves: parsedMoves.length,
                    extrusionMoves: parsedMoves.filter(m => m.isExtrusion).length
                });
                setSimulationProgress(0);
                
                // Calculate layers
                const layers = [...new Set(parsedMoves.map(m => m.from.z))].sort((a, b) => a - b);
                setSelectedLayer(layers.length > 0 ? layers[layers.length - 1] : null);
            } catch (error) {
                console.error('Error parsing G-code:', error);
            }
            setIsLoading(false);
        }, 100);
    }, [gcode]);
    
    // Simulation logic
    useEffect(() => {
        let interval;
        
        if (isSimulating && moves.length > 0) {
            interval = setInterval(() => {
                setSimulationProgress(prev => {
                    const newProgress = prev + 0.01; // 1% per update
                    if (newProgress >= 1) {
                        setIsSimulating(false);
                        return 1;
                    }
                    return newProgress;
                });
            }, 50); // Update every 50ms for smooth animation
        }
        
        return () => {
            if (interval) clearInterval(interval);
        };
    }, [isSimulating, moves.length]);
    
    const startSimulation = () => {
        setSimulationProgress(0);
        setIsSimulating(true);
    };
    
    const stopSimulation = () => {
        setIsSimulating(false);
    };
    
    const resetSimulation = () => {
        setIsSimulating(false);
        setSimulationProgress(0);
    };
    
    if (isLoading) {
        return (
            <div className="d-flex justify-content-center align-items-center" style={{ height: '400px' }}>
                <div className="spinner-border text-primary" role="status">
                    <span className="visually-hidden">Loading...</span>
                </div>
            </div>
        );
    }
    
    if (!gcode || moves.length === 0) {
        return (
            <div className="text-center py-5 text-muted">
                <i className="bi bi-file-earmark-code display-1"></i>
                <p className="mt-3">No G-code to display</p>
                <small>Upload a G-code file to see the 3D visualization</small>
            </div>
        );
    }
    
    return (
        <div className="gcode-3d-viewer border rounded shadow-sm bg-white">
            {/* Enhanced Control Panel */}
            <div className="p-3 border-bottom">
                <div className="row align-items-center">
                    <div className="col-md-6">
                        <div className="d-flex align-items-center gap-3">
                            {/* View Mode Toggle */}
                            <div className="btn-group" role="group">
                                <button 
                                    className={`btn btn-sm ${viewMode === '3D' ? 'btn-primary' : 'btn-outline-primary'}`}
                                    onClick={() => setViewMode('3D')}
                                >
                                    <i className="bi bi-box"></i> 3D View
                                </button>
                                <button 
                                    className={`btn btn-sm ${viewMode === '2D' ? 'btn-primary' : 'btn-outline-primary'}`}
                                    onClick={() => setViewMode('2D')}
                                >
                                    <i className="bi bi-square"></i> 2D View
                                </button>
                            </div>
                            
                            {/* Simulation Controls */}
                            <div className="btn-group" role="group">
                                <button 
                                    className="btn btn-sm btn-success"
                                    onClick={startSimulation}
                                    disabled={isSimulating}
                                >
                                    <i className="bi bi-play-fill"></i>
                                </button>
                                <button 
                                    className="btn btn-sm btn-warning"
                                    onClick={stopSimulation}
                                    disabled={!isSimulating}
                                >
                                    <i className="bi bi-pause-fill"></i>
                                </button>
                                <button 
                                    className="btn btn-sm btn-secondary"
                                    onClick={resetSimulation}
                                >
                                    <i className="bi bi-stop-fill"></i>
                                </button>
                            </div>
                        </div>
                    </div>
                    
                    <div className="col-md-6">
                        <div className="d-flex align-items-center gap-3 justify-content-end">
                            {/* Progress Display */}
                            <small className="text-muted">
                                Progress: {Math.round(simulationProgress * 100)}%
                            </small>
                            
                            {/* Stats */}
                            <small className="text-muted">
                                {stats.totalMoves} moves | {stats.extrusionMoves} extrusions
                            </small>
                        </div>
                    </div>
                </div>
                
                {/* Progress Bar */}
                <div className="progress mt-2" style={{ height: '4px' }}>
                    <div 
                        className="progress-bar bg-primary" 
                        style={{ width: `${simulationProgress * 100}%` }}
                    ></div>
                </div>
            </div>
            
            {/* 3D Renderer */}
            <div style={{ height: '500px', position: 'relative' }}>
                <InteractiveCanvasRenderer 
                    moves={moves}
                    simulationProgress={simulationProgress}
                    viewMode={viewMode}
                />
            </div>
            
            {/* Enhanced Legend */}
            <div className="p-3 border-top bg-light">
                <div className="row text-center">
                    <div className="col-md-3 col-6">
                        <span className="badge bg-secondary me-1">Gray</span> Travel moves
                    </div>
                    <div className="col-md-3 col-6">
                        <span className="badge bg-dark me-1">Dark</span> Extrusion moves
                    </div>
                    <div className="col-md-3 col-6">
                        <span className="badge bg-primary me-1">Blue</span> Simulated progress
                    </div>
                    <div className="col-md-3 col-6">
                        {viewMode === '3D' && <span className="badge bg-info me-1">Color</span>}
                        {viewMode === '3D' ? 'Height gradient' : '2D projection'}
                    </div>
                </div>
                <div className="mt-1 text-center">
                    <small>
                        <strong>Controls:</strong> 
                        Drag to pan • Shift+Drag to rotate • Mouse wheel to zoom • 
                        {viewMode === '3D' ? '3D perspective with depth sorting' : '2D top-down view with rotation'}
                    </small>
                </div>
            </div>
        </div>
    );
}
