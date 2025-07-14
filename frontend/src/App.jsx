import { useState, useEffect, useRef } from 'react';

function App() {
    const [port, setPort] = useState('COM6'); // Default COM port
    const [isConnected, setIsConnected] = useState(false);
    const [log, setLog] = useState([]);
    const [command, setCommand] = useState('');
    const logEndRef = useRef(null);

    const addToLog = (message) => {
        const timestamp = new Date().toLocaleTimeString();
        setLog(prevLog => [...prevLog, `${timestamp} - ${message}`]);
    };

    useEffect(() => {
        logEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [log]);

    const handleApiCall = async (endpoint, options = {}) => {
        try {
            const response = await fetch(`http://127.0.0.1:5000${endpoint}`, options);
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
            }
            return await response.json();
        } catch (error) {
            addToLog(`Error: ${error.message}`);
            return null;
        }
    };

    const handleConnect = async () => {
        addToLog(`Connecting to ${port}...`);
        const data = await handleApiCall('/api/connect', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ port: port })
        });

        if (data && data.status === 'success') {
            setIsConnected(true);
            addToLog(data.message);
            if (data.data) data.data.forEach(line => addToLog(`PRINTER: ${line}`));
        }
    };

    const handleDisconnect = async () => {
        const data = await handleApiCall('/api/disconnect', { method: 'POST' });
        if (data && data.status === 'success') {
            setIsConnected(false);
            addToLog(data.message);
        }
    };

    const handleSendCommand = async (e) => {
        e.preventDefault();
        if (!command || !isConnected) return;
        addToLog(`>>> ${command}`);
        const data = await handleApiCall('/api/command', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ command: command })
        });
        if (data && data.response) {
            data.response.forEach(line => addToLog(`<<< ${line}`));
        }
        setCommand('');
    };

    return (
        <div className="container my-4">
            <h1 className="mb-4">3D Printer Web Controller</h1>

            <div className="card mb-3">
                <div className="card-header">Connection</div>
                <div className="card-body d-flex align-items-center">
                    <div className="col-auto">
                        <input type="text" className="form-control" value={port} onChange={(e) => setPort(e.target.value)} disabled={isConnected} />
                    </div>
                    <div className="col-auto ms-2">
                        <button className="btn btn-primary" onClick={handleConnect} disabled={isConnected}>Connect</button>
                    </div>
                    <div className="col-auto ms-2">
                        <button className="btn btn-danger" onClick={handleDisconnect} disabled={!isConnected}>Disconnect</button>
                    </div>
                    <div className="col-auto ms-3">
                        <span className={`badge ${isConnected ? 'bg-success' : 'bg-danger'}`}>
                            {isConnected ? 'Connected' : 'Disconnected'}
                        </span>
                    </div>
                </div>
            </div>

            <div className="card mb-3">
                <div className="card-header">Manual Command</div>
                <div className="card-body">
                    <form onSubmit={handleSendCommand} className="d-flex">
                        <input type="text" className="form-control" placeholder="Enter G-code..." value={command} onChange={(e) => setCommand(e.target.value)} disabled={!isConnected} />
                        <button type="submit" className="btn btn-success ms-2" disabled={!isConnected}>Send</button>
                    </form>
                </div>
            </div>

            <div className="card">
                <div className="card-header">Log</div>
                <pre className="card-body bg-light" style={{ height: '400px', overflowY: 'scroll', fontFamily: 'monospace', fontSize: '0.8rem' }}>
                    {log.join('\n')}
                    <div ref={logEndRef} />
                </pre>
            </div>
        </div>
    );
}

export default App
