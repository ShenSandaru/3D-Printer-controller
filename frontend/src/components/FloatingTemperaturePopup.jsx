// frontend/src/components/FloatingTemperaturePopup.jsx
import React, { useState, useEffect, useCallback } from 'react';
import './FloatingTemperaturePopup.css';

export default function FloatingTemperaturePopup({ temperatures, isConnected }) {
    const [isVisible, setIsVisible] = useState(false);
    const [scrollTimeout, setScrollTimeout] = useState(null);
    const [isScrolling, setIsScrolling] = useState(false);
    
    // Test mode - set to false for production, true for testing
    const TEST_MODE = false;

    const hotendTemp = temperatures?.hotend_actual || temperatures?.hotend || (TEST_MODE ? 25.5 : 0);
    const bedTemp = temperatures?.bed_actual || temperatures?.bed || (TEST_MODE ? 22.3 : 0);
    const hotendTarget = temperatures?.hotend_target || temperatures?.hotendTarget || (TEST_MODE ? 200 : 0);
    const bedTarget = temperatures?.bed_target || temperatures?.bedTarget || (TEST_MODE ? 60 : 0);

    // Show popup when connected and temperatures are available
    useEffect(() => {
        if (isConnected && temperatures && (hotendTemp > 0 || bedTemp > 0)) {
            console.log('FloatingTempPopup: Temperature data available - Hotend:', hotendTemp, 'Bed:', bedTemp);
            // Only show for a brief moment initially, then rely on scroll detection
            setIsVisible(true);
            const initialTimeout = setTimeout(() => {
                if (!isScrolling) {
                    setIsVisible(false);
                }
            }, 2000); // Show for 2 seconds initially
            
            return () => clearTimeout(initialTimeout);
        } else {
            setIsVisible(false);
        }
    }, [isConnected, temperatures, hotendTemp, bedTemp, isScrolling]);

    // Handle scroll events to show/hide the popup
    const handleScroll = useCallback(() => {
        // Only show if connected and temperatures are available
        if (!isConnected || !temperatures || (hotendTemp === 0 && bedTemp === 0)) {
            return;
        }

        console.log('FloatingTempPopup: Scroll detected, showing popup');
        
        // Set scrolling state
        setIsScrolling(true);
        setIsVisible(true);

        // Clear any existing timeout
        if (scrollTimeout) {
            clearTimeout(scrollTimeout);
        }

        // Hide the popup after 4 seconds of no scrolling
        const timeout = setTimeout(() => {
            console.log('FloatingTempPopup: Hiding popup after timeout');
            setIsVisible(false);
            setIsScrolling(false);
        }, 4000);

        setScrollTimeout(timeout);
    }, [isConnected, temperatures, hotendTemp, bedTemp, scrollTimeout]);

    useEffect(() => {
        // Add scroll listener with throttling for better performance
        let ticking = false;
        
        const scrollListener = (event) => {
            if (!ticking) {
                requestAnimationFrame(() => {
                    console.log('FloatingTempPopup: Scroll event detected from:', event.target);
                    handleScroll();
                    ticking = false;
                });
                ticking = true;
            }
        };

        // Add scroll listeners to multiple elements for better detection
        window.addEventListener('scroll', scrollListener, { passive: true });
        document.addEventListener('scroll', scrollListener, { passive: true });
        
        // Also listen to scroll events on the main container
        const mainContainer = document.querySelector('.container-fluid');
        const gcodeViewer = document.querySelector('.gcode-viewer');
        const logViewer = document.querySelector('.log-viewer');
        
        if (mainContainer) {
            mainContainer.addEventListener('scroll', scrollListener, { passive: true });
        }
        if (gcodeViewer) {
            gcodeViewer.addEventListener('scroll', scrollListener, { passive: true });
        }
        if (logViewer) {
            logViewer.addEventListener('scroll', scrollListener, { passive: true });
        }

        console.log('FloatingTempPopup: Scroll listeners attached');

        // Cleanup
        return () => {
            window.removeEventListener('scroll', scrollListener);
            document.removeEventListener('scroll', scrollListener);
            if (mainContainer) {
                mainContainer.removeEventListener('scroll', scrollListener);
            }
            if (gcodeViewer) {
                gcodeViewer.removeEventListener('scroll', scrollListener);
            }
            if (logViewer) {
                logViewer.removeEventListener('scroll', scrollListener);
            }
            if (scrollTimeout) {
                clearTimeout(scrollTimeout);
            }
            console.log('FloatingTempPopup: Scroll listeners removed');
        };
    }, [handleScroll, scrollTimeout]);

    // Don't render if not connected or no temperature data
    if (!isConnected || !temperatures || (hotendTemp === 0 && bedTemp === 0)) {
        console.log('FloatingTempPopup: Not rendering - Connected:', isConnected, 'Temperatures available:', !!temperatures, 'Hotend:', hotendTemp, 'Bed:', bedTemp);
        return null;
    }

    console.log('FloatingTempPopup: Rendering - Visible:', isVisible, 'Scrolling:', isScrolling, 'Hotend:', hotendTemp, 'Bed:', bedTemp);

    const getTemperatureStatus = (current, target) => {
        if (target === 0) return 'secondary';
        const diff = Math.abs(current - target);
        if (diff <= 2) return 'success';
        if (diff <= 5) return 'warning';
        return 'danger';
    };

    const getStatusIcon = (current, target) => {
        if (target === 0) return 'bi-dash-circle';
        const diff = Math.abs(current - target);
        if (diff <= 2) return 'bi-check-circle-fill';
        if (diff <= 5) return 'bi-exclamation-triangle-fill';
        return 'bi-x-circle-fill';
    };

    const getStatusText = (current, target) => {
        if (target === 0) return 'Standby';
        const diff = Math.abs(current - target);
        if (diff <= 2) return 'Ready';
        return current < target ? 'Heating' : 'Cooling';
    };

    return (
        <div className={`floating-temp-popup ${isVisible ? 'visible' : ''} ${isScrolling ? 'scrolling' : ''}`}>
            <div className="temp-popup-content">
                {/* Hotend Temperature */}
                <div className="temp-item">
                    <div className="temp-icon">
                        <i className="bi bi-fire text-danger"></i>
                    </div>
                    <div className="temp-info">
                        <div className="temp-value">
                            <span className="current-temp">{hotendTemp.toFixed(1)}°</span>
                            {hotendTarget > 0 && (
                                <span className="target-temp">/{hotendTarget}°</span>
                            )}
                        </div>
                        <div className="temp-status">
                            <i className={`bi ${getStatusIcon(hotendTemp, hotendTarget)} text-${getTemperatureStatus(hotendTemp, hotendTarget)}`}></i>
                            <span className="temp-label">Hotend</span>
                            <span className="status-text">{getStatusText(hotendTemp, hotendTarget)}</span>
                        </div>
                    </div>
                </div>

                {/* Separator */}
                <div className="temp-separator"></div>

                {/* Bed Temperature */}
                <div className="temp-item">
                    <div className="temp-icon">
                        <i className="bi bi-square text-primary"></i>
                    </div>
                    <div className="temp-info">
                        <div className="temp-value">
                            <span className="current-temp">{bedTemp.toFixed(1)}°</span>
                            {bedTarget > 0 && (
                                <span className="target-temp">/{bedTarget}°</span>
                            )}
                        </div>
                        <div className="temp-status">
                            <i className={`bi ${getStatusIcon(bedTemp, bedTarget)} text-${getTemperatureStatus(bedTemp, bedTarget)}`}></i>
                            <span className="temp-label">Bed</span>
                            <span className="status-text">{getStatusText(bedTemp, bedTarget)}</span>
                        </div>
                    </div>
                </div>

                {/* Settings Icon */}
                <div className="temp-settings-icon">
                    <i className="bi bi-gear"></i>
                </div>

                {/* Live indicator */}
                <div className="live-indicator">
                    <div className="live-dot" title="Live Temperature Data"></div>
                </div>

                {/* Modern minimize button for smaller view */}
                <div className="temp-controls" style={{ 
                    position: 'absolute', 
                    top: '8px', 
                    left: '8px',
                    display: 'flex',
                    gap: '4px'
                }}>
                    <div style={{
                        width: '4px',
                        height: '4px',
                        borderRadius: '50%',
                        background: 'linear-gradient(135deg, #64748b 0%, #475569 100%)',
                        opacity: '0.3'
                    }}></div>
                    <div style={{
                        width: '4px',
                        height: '4px',
                        borderRadius: '50%',
                        background: 'linear-gradient(135deg, #64748b 0%, #475569 100%)',
                        opacity: '0.3'
                    }}></div>
                    <div style={{
                        width: '4px',
                        height: '4px',
                        borderRadius: '50%',
                        background: 'linear-gradient(135deg, #64748b 0%, #475569 100%)',
                        opacity: '0.3'
                    }}></div>
                </div>
            </div>
        </div>
    );
}
