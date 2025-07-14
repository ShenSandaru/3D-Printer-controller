// frontend/src/components/ManualControl.jsx
import React, { useState } from 'react';

export default function ManualControl({ isConnected, onSendCommand }) {
    const [command, setCommand] = useState('');

    const handleSendCommand = async (e) => {
        e.preventDefault();
        if (!command || !isConnected) return;
        
        await onSendCommand(command);
        setCommand('');
    };

    const quickCommands = [
        { label: 'Get Info', command: 'M115', description: 'Firmware info' },
        { label: 'Get Temp', command: 'M105', description: 'Temperature status' },
        { label: 'Home All', command: 'G28', description: 'Home all axes' },
        { label: 'Auto Level', command: 'G29', description: 'Auto bed leveling' }
    ];

    return (
        <div className="card mb-3">
            <div className="card-header">Manual Control</div>
            <div className="card-body">
                {/* Manual G-code input */}
                <form onSubmit={handleSendCommand} className="mb-3">
                    <div className="input-group">
                        <input 
                            type="text" 
                            className="form-control" 
                            placeholder="Enter G-code command..." 
                            value={command} 
                            onChange={(e) => setCommand(e.target.value)} 
                            disabled={!isConnected} 
                        />
                        <button 
                            type="submit" 
                            className="btn btn-success" 
                            disabled={!isConnected || !command}
                        >
                            Send
                        </button>
                    </div>
                </form>

                {/* Quick command buttons */}
                <div className="row g-2">
                    {quickCommands.map((cmd, index) => (
                        <div key={index} className="col-6 col-md-3">
                            <button
                                className="btn btn-outline-primary btn-sm w-100"
                                onClick={() => onSendCommand(cmd.command)}
                                disabled={!isConnected}
                                title={cmd.description}
                            >
                                {cmd.label}
                            </button>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
