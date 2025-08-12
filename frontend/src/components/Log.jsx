// frontend/src/components/Log.jsx
import React, { useEffect, useRef, useState } from 'react';
import './Log.css';

export default function Log({ log, onSendCommand }) {
    const logEndRef = useRef(null);
    const [autoScroll, setAutoScroll] = useState(false); // Default to disabled
    const [customCommand, setCustomCommand] = useState('');
    const [commandHistory, setCommandHistory] = useState([]);
    const [historyIndex, setHistoryIndex] = useState(-1);
    const commandInputRef = useRef(null);
    
    useEffect(() => {
        if (autoScroll) {
            logEndRef.current?.scrollIntoView({ behavior: "smooth" });
        }
    }, [log, autoScroll]);

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

    const handleCommandSubmit = async (e) => {
        e.preventDefault();
        if (!customCommand.trim() || !onSendCommand) return;

        const command = customCommand.trim();
        
        // Add to command history
        setCommandHistory(prev => {
            const newHistory = prev.filter(cmd => cmd !== command);
            return [command, ...newHistory.slice(0, 19)]; // Keep last 20 commands
        });
        
        // Reset history index
        setHistoryIndex(-1);
        
        // Clear input
        setCustomCommand('');
        
        // Send command
        try {
            await onSendCommand(command);
        } catch (error) {
            console.error('Failed to send command:', error);
        }
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter') {
            if (e.shiftKey) {
                // Allow line break on Shift+Enter
                return;
            } else {
                // Submit on Enter
                e.preventDefault();
                handleCommandSubmit(e);
            }
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            if (historyIndex < commandHistory.length - 1) {
                const newIndex = historyIndex + 1;
                setHistoryIndex(newIndex);
                setCustomCommand(commandHistory[newIndex]);
            }
        } else if (e.key === 'ArrowDown') {
            e.preventDefault();
            if (historyIndex > 0) {
                const newIndex = historyIndex - 1;
                setHistoryIndex(newIndex);
                setCustomCommand(commandHistory[newIndex]);
            } else if (historyIndex === 0) {
                setHistoryIndex(-1);
                setCustomCommand('');
            }
        }
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
                    <button 
                        className={`btn btn-sm ${autoScroll ? 'btn-primary' : 'btn-outline-secondary'}`}
                        onClick={() => setAutoScroll(!autoScroll)}
                        title={autoScroll ? 'Auto-scroll enabled - Click to disable' : 'Auto-scroll disabled - Click to enable'}
                    >
                        <i className={`bi ${autoScroll ? 'bi-arrow-down-circle-fill' : 'bi-arrow-down-circle'}`}></i>
                    </button>
                </div>
            </div>
            <div className="card-body p-0 log-container">
                {log.length === 0 ? (
                    <div className="log-empty-state text-muted">
                        <div className="text-center">
                            <i className="bi bi-chat-dots log-empty-icon"></i>
                            <p className="mt-2 mb-0">No activity yet</p>
                            <small>Connect to your printer to see communication logs</small>
                        </div>
                    </div>
                ) : (
                    <div className="p-2">
                        {log.map((entry, index) => {
                            const { timestamp, message } = formatLogEntry(entry);
                            return (
                                <div key={index} className="log-entry d-flex align-items-start">
                                    <i className={`${getLogIcon(message)} log-entry-icon`}></i>
                                    <div className="flex-grow-1 log-entry-content">
                                        <div className="log-entry-timestamp">{timestamp}</div>
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
            
            {/* Custom Command Input Section */}
            {onSendCommand && (
                <div className="card-footer bg-transparent border-top">
                    <form onSubmit={handleCommandSubmit} className="d-flex gap-2">
                        <div className="flex-grow-1">
                            <div className="input-group">
                                <span className="input-group-text bg-light">
                                    <i className="bi bi-chevron-right text-primary"></i>
                                </span>
                                <input
                                    ref={commandInputRef}
                                    type="text"
                                    className="form-control font-monospace"
                                    placeholder="Enter G-code command (e.g., M105, G28, etc.)"
                                    value={customCommand}
                                    onChange={(e) => setCustomCommand(e.target.value)}
                                    onKeyDown={handleKeyDown}
                                    style={{ fontSize: '0.9rem' }}
                                />
                            </div>
                            {commandHistory.length > 0 && (
                                <small className="text-muted mt-1 d-block">
                                    <i className="bi bi-arrow-up me-1"></i>Use ↑/↓ arrows for command history
                                </small>
                            )}
                        </div>
                        <button
                            type="submit"
                            className="btn btn-primary px-3"
                            disabled={!customCommand.trim()}
                            title="Send command (Enter)"
                        >
                            <i className="bi bi-send-fill"></i>
                        </button>
                    </form>
                </div>
            )}
        </div>
    );
}
