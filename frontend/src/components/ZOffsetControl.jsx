import React, { useState, useEffect } from 'react';
import './ZOffsetControl.css';

export default function ZOffsetControl({ isConnected }) {
    const [zOffset, setZOffset] = useState(0.0);
    const [currentOffset, setCurrentOffset] = useState(0.0);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    // Fetch current Z-offset on component mount
    useEffect(() => {
        if (isConnected) {
            fetchCurrentOffset();
        }
    }, [isConnected]);

    const fetchCurrentOffset = async () => {
        try {
            const response = await fetch('/api/z-offset');
            const data = await response.json();
            if (data.status === 'success') {
                setCurrentOffset(data.z_offset);
                setZOffset(data.z_offset);
            }
        } catch (error) {
            console.error('Error fetching Z-offset:', error);
        }
    };

    const adjustZOffset = async (offsetValue) => {
        if (!isConnected) {
            setError('Printer not connected');
            return;
        }

        setIsLoading(true);
        setError('');
        setSuccess('');

        try {
            const response = await fetch('/api/z-offset', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ offset: offsetValue }),
            });

            const data = await response.json();

            if (data.status === 'success') {
                setCurrentOffset(offsetValue);
                setZOffset(offsetValue);
                setSuccess(`Z-offset adjusted to ${offsetValue.toFixed(3)}mm`);
                setTimeout(() => setSuccess(''), 3000);
            } else {
                setError(data.message || 'Failed to adjust Z-offset');
            }
        } catch (error) {
            setError('Network error: ' + error.message);
        } finally {
            setIsLoading(false);
        }
    };

    const handleQuickAdjust = (amount) => {
        const newOffset = currentOffset + amount;
        if (newOffset >= -2.0 && newOffset <= 2.0) {
            adjustZOffset(newOffset);
        }
    };

    const handleManualSet = () => {
        const offsetValue = parseFloat(zOffset);
        if (isNaN(offsetValue)) {
            setError('Please enter a valid number');
            return;
        }
        if (offsetValue < -2.0 || offsetValue > 2.0) {
            setError('Z-offset must be between -2.0 and +2.0 mm');
            return;
        }
        adjustZOffset(offsetValue);
    };

    const resetOffset = () => {
        adjustZOffset(0.0);
    };

    return (
        <div className="z-offset-control">
            <h3>🔧 Z-Offset Adjustment</h3>
            <div className="z-offset-info">
                <p>
                    <strong>Current Z-Offset:</strong> 
                    <span className={`offset-value ${currentOffset !== 0 ? 'active' : ''}`}>
                        {currentOffset.toFixed(3)}mm
                    </span>
                </p>
                <p className="help-text">
                    Negative values bring nozzle closer to bed (reduce gap)<br/>
                    Positive values move nozzle away from bed (increase gap)
                </p>
            </div>

            {error && <div className="error-message">❌ {error}</div>}
            {success && <div className="success-message">✅ {success}</div>}

            <div className="quick-adjust">
                <h4>Quick Adjust</h4>
                <div className="quick-buttons">
                    <button 
                        onClick={() => handleQuickAdjust(-0.1)}
                        disabled={!isConnected || isLoading || currentOffset <= -2.0}
                        className="btn btn-quick"
                        title="Lower nozzle by 0.1mm"
                    >
                        -0.1mm
                    </button>
                    <button 
                        onClick={() => handleQuickAdjust(-0.05)}
                        disabled={!isConnected || isLoading || currentOffset <= -2.0}
                        className="btn btn-quick"
                        title="Lower nozzle by 0.05mm"
                    >
                        -0.05mm
                    </button>
                    <button 
                        onClick={() => handleQuickAdjust(0.05)}
                        disabled={!isConnected || isLoading || currentOffset >= 2.0}
                        className="btn btn-quick"
                        title="Raise nozzle by 0.05mm"
                    >
                        +0.05mm
                    </button>
                    <button 
                        onClick={() => handleQuickAdjust(0.1)}
                        disabled={!isConnected || isLoading || currentOffset >= 2.0}
                        className="btn btn-quick"
                        title="Raise nozzle by 0.1mm"
                    >
                        +0.1mm
                    </button>
                </div>
            </div>

            <div className="manual-adjust">
                <h4>Manual Set</h4>
                <div className="manual-controls">
                    <input
                        type="number"
                        step="0.001"
                        min="-2.0"
                        max="2.0"
                        value={zOffset}
                        onChange={(e) => setZOffset(e.target.value)}
                        disabled={!isConnected || isLoading}
                        className="offset-input"
                        placeholder="0.000"
                    />
                    <button 
                        onClick={handleManualSet}
                        disabled={!isConnected || isLoading}
                        className="btn btn-primary"
                    >
                        {isLoading ? 'Adjusting...' : 'Set Z-Offset'}
                    </button>
                    <button 
                        onClick={resetOffset}
                        disabled={!isConnected || isLoading}
                        className="btn btn-secondary"
                        title="Reset Z-offset to 0.0mm"
                    >
                        Reset
                    </button>
                </div>
            </div>

            <div className="z-offset-tips">
                <h4>💡 Tips for Z-Offset Calibration</h4>
                <ul>
                    <li>Start with small adjustments (±0.05mm)</li>
                    <li>Too close: Nozzle scrapes bed → Increase Z-offset</li>
                    <li>Too far: Poor first layer adhesion → Decrease Z-offset</li>
                    <li>Perfect: Filament squishes slightly without scraping</li>
                    <li>Settings are saved automatically to printer memory</li>
                </ul>
            </div>
        </div>
    );
}
