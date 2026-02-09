"""
Verify OCR functionality by hitting the live API.
Run this after restarting the backend.
"""
import requests
import cv2
import numpy as np
import io

def test_ocr_endpoint():
    # Create a test image with text
    img = np.ones((200, 600, 3), dtype=np.uint8) * 255
    cv2.putText(img, "Healthcare AI", (30, 80), cv2.FONT_HERSHEY_SIMPLEX, 2, (0, 0, 0), 3)
    cv2.putText(img, "OCR Test 123", (30, 150), cv2.FONT_HERSHEY_SIMPLEX, 1.5, (50, 50, 50), 2)
    
    is_success, buffer = cv2.imencode(".png", img)
    io_buf = io.BytesIO(buffer)

    url = "http://127.0.0.1:8000/intake/document"
    
    print("=" * 60)
    print("OCR Verification Script")
    print("=" * 60)
    
    for mode in ["basic", "enhanced"]:
        print(f"\n--- Testing mode: {mode} ---")
        io_buf.seek(0)  # Reset buffer
        
        files = {"file": ("test.png", io_buf, "image/png")}
        data = {
            "ocr_engine": "tesseract",
            "ocr_mode": mode,
            "return_preview": "false"
        }
        
        try:
            res = requests.post(url, files=files, data=data)
            
            if res.status_code == 200:
                json_data = res.json()
                ocr = json_data.get("ocr", {})
                
                print(f"  Text: '{ocr.get('text', '')}'")
                print(f"  Confidence: {ocr.get('confidence', 0):.2f}")
                print(f"  Mode: {ocr.get('mode', 'N/A')}")
                print(f"  Timing: {ocr.get('timing_ms', 0)}ms")
                print(f"  Tesseract Found: {ocr.get('tesseract_found', False)}")
                print(f"  Path: {ocr.get('tesseract_path_used', 'N/A')}")
                
                if ocr.get('ocr_error'):
                    print(f"  ERROR: {ocr.get('ocr_error')}")
                
                if ocr.get('text') and "Healthcare" in ocr.get('text', ''):
                    print("  ✓ SUCCESS: Text extracted correctly!")
                elif ocr.get('tesseract_found'):
                    print("  ⚠ WARNING: Tesseract found but no expected text")
                else:
                    print("  ✗ FAILURE: Tesseract not found")
            else:
                print(f"  ✗ HTTP Error: {res.status_code}")
                print(f"  Response: {res.text[:200]}")
        except Exception as e:
            print(f"  ✗ Exception: {e}")
    
    print("\n" + "=" * 60)
    print("Verification complete.")
    print("If Tesseract was not found, restart the backend after setting TESSERACT_CMD.")

if __name__ == "__main__":
    test_ocr_endpoint()
