import requests
import json
import sys

# Windows terminal encoding fix
sys.stdout.reconfigure(encoding='utf-8')

try:
    url = "http://127.0.0.1:8000/chat"
    payload = {
        "message": "I have a mild fever of 38C for 1 day. I am otherwise healthy. What should I do?",
        "mode": "rag"
    }
    headers = {"Content-Type": "application/json"}
    
    # Increase timeout for model loading
    response = requests.post(url, json=payload, headers=headers, timeout=60)
    
    if response.status_code == 200:
        data = response.json()
        print("✅ Status: 200 OK")
        msg = data.get("assistant_message", "")
        citations = data.get("citations", [])
        
        print("\n--- Assistant Message Snippet ---")
        print(msg[:300] + "...")
        
        print("\n--- Citations ---")
        for i, c in enumerate(citations):
            print(f"[{i+1}] {c.get('title')} ({c.get('org')})")
            
        # Check for [1] format
        if "[1]" in msg:
            print("\n✅ SUCCESS: Found numeric citation [1] in response.")
        else:
            print("\n⚠️ WARNING: Did not find [1] in response. Check prompt.")
            print("Full message:")
            print(msg)
            
    else:
        print(f"❌ Error: {response.status_code}")
        print(response.text)

except Exception as e:
    print(f"❌ Exception: {e}")
