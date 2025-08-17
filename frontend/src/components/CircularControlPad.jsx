// frontend/src/components/CircularControlPad.jsx
import React, { useState } from 'react';
import './CircularControlPad.css';

const CircularControlPad = ({ isConnected, onSendCommand, currentPosition = {} }) => {
    const [stepSize, setStepSize] = useState(10);
    const [feedRate, setFeedRate] = useState(3000);
    
    const stepSizes = [100, 10, 1, 0.1];

    const moveAxis = (axis, direction, distance = stepSize) => {
        const moveDistance = direction * distance;
        onSendCommand(`G91\nG1 ${axis}${moveDistance} F${feedRate}\nG90`);
    };

    const homeAxis = (axes) => {
        onSendCommand(`G28 ${axes}`);
    };

    const homeAll = () => {
        onSendCommand('G28');
    };

    return (
        <div className="circular-control-container">
            <div className={`modern-control-panel ${!isConnected ? 'disconnected' : ''}`}>
                <div className="control-header">
                    <h6 className="control-title">
                        <i className="bi bi-joystick me-2"></i>
                        XY Movement Control
                        {!isConnected && <span className="status-indicator disconnected">(Disconnected)</span>}
                    </h6>
                </div>

                <div className="control-main">
                    {/* Left Side - Control Pad */}
                    <div className="control-left">
                        <div className="modern-circular-pad">
                            {/* Outer Ring with Concentric Circles */}
                            <div className="pad-ring ring-outer"></div>
                            <div className="pad-ring ring-middle"></div>
                            <div className="pad-ring ring-inner"></div>
                            
                            {/* Corner Home Buttons */}
                            <button 
                                className="corner-btn corner-top-left"
                                onClick={() => homeAxis('X')}
                                title="Home X"
                                disabled={!isConnected}
                            >
                                <i className="bi bi-house-fill"></i>
                                <span>X</span>
                            </button>
                            
                            <button 
                                className="corner-btn corner-top-right"
                                onClick={() => homeAxis('Y')}
                                title="Home Y"
                                disabled={!isConnected}
                            >
                                <i className="bi bi-house-fill"></i>
                                <span>Y</span>
                            </button>
                            
                            <button 
                                className="corner-btn corner-bottom-left"
                                onClick={() => homeAxis('Z')}
                                title="Home Z"
                                disabled={!isConnected}
                            >
                                <i className="bi bi-house-fill"></i>
                                <span>Z</span>
                            </button>
                            
                            <button 
                                className="corner-btn corner-bottom-right"
                                onClick={homeAll}
                                title="Home All"
                                disabled={!isConnected}
                            >
                                <i className="bi bi-house-fill"></i>
                                <span>ALL</span>
                            </button>

                            {/* Direction Controls */}
                            <div className="direction-controls">
                                {/* Y+ (Top) */}
                                <button 
                                    className="modern-direction-btn y-plus"
                                    onClick={() => moveAxis('Y', 1)}
                                    title={`Move Y+ ${stepSize}mm`}
                                    disabled={!isConnected}
                                >
                                    <i className="bi bi-chevron-up"></i>
                                    <span className="axis-text">+Y</span>
                                </button>

                                {/* X+ (Right) */}
                                <button 
                                    className="modern-direction-btn x-plus"
                                    onClick={() => moveAxis('X', 1)}
                                    title={`Move X+ ${stepSize}mm`}
                                    disabled={!isConnected}
                                >
                                    <i className="bi bi-chevron-right"></i>
                                    <span className="axis-text">+X</span>
                                </button>

                                {/* Y- (Bottom) */}
                                <button 
                                    className="modern-direction-btn y-minus"
                                    onClick={() => moveAxis('Y', -1)}
                                    title={`Move Y- ${stepSize}mm`}
                                    disabled={!isConnected}
                                >
                                    <i className="bi bi-chevron-down"></i>
                                    <span className="axis-text">-Y</span>
                                </button>

                                {/* X- (Left) */}
                                <button 
                                    className="modern-direction-btn x-minus"
                                    onClick={() => moveAxis('X', -1)}
                                    title={`Move X- ${stepSize}mm`}
                                    disabled={!isConnected}
                                >
                                    <i className="bi bi-chevron-left"></i>
                                    <span className="axis-text">-X</span>
                                </button>
                            </div>

                            {/* Center Home Button */}
                            <button 
                                className="modern-center-btn"
                                onClick={homeAll}
                                title="Home All Axes"
                                disabled={!isConnected}
                            >
                                <i className="bi bi-crosshair"></i>
                            </button>

                            {/* Current Step Size Display */}
                            <div className="current-step-display">
                                <span className="step-value">{stepSize}</span>
                                <span className="step-unit">mm</span>
                            </div>
                        </div>
                    </div>

                    {/* Right Side - Step Controls */}
                    <div className="control-right">
                        <div className="step-controls">
                            <div className="step-header">
                                <span>Step Size</span>
                            </div>
                            {stepSizes.map((size) => (
                                <button
                                    key={size}
                                    className={`step-btn ${stepSize === size ? 'active' : ''}`}
                                    onClick={() => setStepSize(size)}
                                    disabled={!isConnected}
                                >
                                    <span className="step-number">{size}</span>
                                    <span className="step-label">mm</span>
                                </button>
                            ))}
                        </div>

                        {/* Z-Axis Controls */}
                        <div className="z-axis-controls">
                            <div className="z-header">
                                <span>Z-Axis</span>
                            </div>
                            <button 
                                className="z-btn z-plus"
                                onClick={() => moveAxis('Z', 1)}
                                title={`Move Z+ ${stepSize}mm`}
                                disabled={!isConnected}
                            >
                                <i className="bi bi-chevron-up"></i>
                                <span>+Z</span>
                            </button>
                            <button 
                                className="z-btn z-minus"
                                onClick={() => moveAxis('Z', -1)}
                                title={`Move Z- ${stepSize}mm`}
                                disabled={!isConnected}
                            >
                                <i className="bi bi-chevron-down"></i>
                                <span>-Z</span>
                            </button>
                        </div>
                    </div>
                </div>

                {/* Position Display */}
                <div className="position-status">
                    <div className="position-item">
                        <label>X:</label>
                        <span>{currentPosition.x || '0.00'}</span>
                    </div>
                    <div className="position-item">
                        <label>Y:</label>
                        <span>{currentPosition.y || '0.00'}</span>
                    </div>
                    <div className="position-item">
                        <label>Z:</label>
                        <span>{currentPosition.z || '0.00'}</span>
                    </div>
                    <div className="position-item">
                        <label>E:</label>
                        <span>{currentPosition.e || '0.00'}</span>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default CircularControlPad;
