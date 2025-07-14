// frontend/src/components/Connection.jsx
import React from 'react';

export default function Connection({ port, setPort, isConnected, onConnect, onDisconnect }) {
    return (
        <div className="card mb-3">
            <div className="card-header">Connection</div>
            <div className="card-body d-flex align-items-center flex-wrap">
                <div className="col-auto">
                    <label htmlFor="comPort" className="me-2">COM Port:</label>
                    <input 
                        id="comPort" 
                        type="text" 
                        className="form-control" 
                        value={port} 
                        onChange={(e) => setPort(e.target.value)} 
                        disabled={isConnected} 
                    />
                </div>
                <div className="col-auto ms-2">
                    <button 
                        className="btn btn-primary" 
                        onClick={onConnect} 
                        disabled={isConnected}
                    >
                        Connect
                    </button>
                </div>
                <div className="col-auto ms-2">
                    <button 
                        className="btn btn-danger" 
                        onClick={onDisconnect} 
                        disabled={!isConnected}
                    >
                        Disconnect
                    </button>
                </div>
                <div className="col-auto ms-3">
                    <span className={`badge fs-6 ${isConnected ? 'bg-success' : 'bg-danger'}`}>
                        {isConnected ? 'Connected' : 'Disconnected'}
                    </span>
                </div>
            </div>
        </div>
    );
}
