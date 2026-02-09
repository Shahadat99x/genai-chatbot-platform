import sys
import os

# Add apps/api to path so we can import cv modules
sys.path.append(os.path.join(os.getcwd(), 'apps', 'api'))

from cv.ocr import resolve_tesseract_cmd, run_ocr
import cv2
import numpy as np

def test_ocr():
    print("=== 1. Testing Tesseract Discovery ===")
    cmd, notes = resolve_tesseract_cmd()
    print(f"Detected Path: {cmd}")
    print("Discovery Notes:")
    for note in notes:
        print(f"  - {note}")
    
    if not cmd:
        print("CRITICAL: Tesseract not found. Skipping OCR test.")
        return

    print("\n=== 2. Testing OCR on Dummy Image ===")
    # Black text on white background
    img = np.ones((100, 300, 3), dtype=np.uint8) * 255
    cv2.putText(img, "TEST OCR 123", (20, 60), cv2.FONT_HERSHEY_SIMPLEX, 1, (0, 0, 0), 2)
    
    # Run OCR
    result = run_ocr(img)
    
    print("OCR Result Object:")
    print(f"  Text: '{result.text}'")
    print(f"  Confidence: {result.confidence:.2f}")
    print(f"  Engine: {result.engine}")
    print(f"  Tesseract Found: {result.tesseract_found}")
    print(f"  Path Used: {result.tesseract_path_used}")
    print(f"  Error: {result.ocr_error}")
    
    if "TEST" in result.text and "OCR" in result.text:
        print("\nSUCCESS: Text extracted correctly.")
    else:
        print("\nWARNING: Text extraction failed or didn't match expected.")

if __name__ == "__main__":
    test_ocr()
