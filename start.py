# Cross-platform startup script
import subprocess
import sys
import os
import time

def start_backend():
    """Start the Flask backend server"""
    print("Starting Backend Server...")
    backend_dir = os.path.join(os.path.dirname(__file__), 'backend')
    return subprocess.Popen([sys.executable, 'app.py'], cwd=backend_dir)

def start_frontend():
    """Start the React frontend server"""
    print("Starting Frontend Server...")
    frontend_dir = os.path.join(os.path.dirname(__file__), 'frontend')
    return subprocess.Popen(['npm', 'run', 'dev'], cwd=frontend_dir, shell=True)

def main():
    print("🚀 Starting 3D Printer Web Controller...")
    print("=" * 50)
    
    # Start backend
    backend_process = start_backend()
    print("✓ Backend starting at http://localhost:5000")
    
    # Wait a moment for backend to initialize
    time.sleep(2)
    
    # Start frontend
    frontend_process = start_frontend()
    print("✓ Frontend starting at http://localhost:5173")
    
    print("\n" + "=" * 50)
    print("🎉 Both servers are running!")
    print("📝 Backend API: http://localhost:5000")
    print("🌐 Frontend UI: http://localhost:5173")
    print("=" * 50)
    print("\nPress Ctrl+C to stop both servers...")
    
    try:
        # Wait for user interrupt
        backend_process.wait()
        frontend_process.wait()
    except KeyboardInterrupt:
        print("\n🛑 Stopping servers...")
        backend_process.terminate()
        frontend_process.terminate()
        print("✓ Servers stopped successfully!")

if __name__ == "__main__":
    main()
