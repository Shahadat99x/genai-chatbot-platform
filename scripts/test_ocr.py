import sys
import os
import cv2
import requests

# Add project root to path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from apps.api.cv.ocr import run_ocr

def test_ocr(image_path):
    print(f"Testing OCR on: {image_path}")
    
    if not os.path.exists(image_path):
        print("Image not found.")
        return

    img = cv2.imread(image_path)
    if img is None:
        print("Failed to load image.")
        return

    print("Running OCR...")
    result = run_ocr(img)
    
    print("\n--- OCR Result ---")
    print(f"Engine: {result.engine}")
    print(f"Confidence: {result.confidence:.2f}")
    print(f"Text Length: {len(result.text)}")
    print(f"Debug Info: {result.debug}")
    print("\nText snippet:")
    print(result.text[:500])
    print("------------------")

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python scripts/test_ocr.py <path_to_image>")
        # Create a dummy image with text if none provided?
        # For now just exit
    else:
        test_ocr(sys.argv[1])
