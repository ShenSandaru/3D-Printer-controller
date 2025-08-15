#!/usr/bin/env python3
"""
Simple test script to verify the connection endpoint returns proper HTTP status codes
"""
import requests
import json

def test_connection_endpoint():
    """Test the printer connection endpoint"""
    url = "http://127.0.0.1:5000/api/connect"
    data = {
        "port": "COM3",
        "baud_rate": 250000
    }
    
    print("Testing printer connection endpoint...")
    print(f"URL: {url}")
    print(f"Data: {json.dumps(data, indent=2)}")
    print("-" * 50)
    
    try:
        response = requests.post(url, json=data, timeout=5)
        print(f"Status Code: {response.status_code}")
        print(f"Status: {response.reason}")
        
        try:
            result = response.json()
            print(f"Response Body: {json.dumps(result, indent=2)}")
        except:
            print(f"Raw Response: {response.text}")
            
        # Check if it's the expected status code
        if response.status_code == 400:
            print("✅ SUCCESS: Returns 400 (Bad Request) as expected when no printer is connected")
        elif response.status_code == 200:
            print("✅ SUCCESS: Returns 200 (OK) - printer connected successfully")
        else:
            print(f"❌ UNEXPECTED: Returns {response.status_code} (should be 400 for connection errors or 200 for success)")
            
    except requests.exceptions.ConnectionError:
        print("❌ ERROR: Cannot connect to backend server. Is it running on port 5000?")
    except requests.exceptions.Timeout:
        print("❌ ERROR: Request timed out")
    except Exception as e:
        print(f"❌ ERROR: {str(e)}")

if __name__ == "__main__":
    test_connection_endpoint()
