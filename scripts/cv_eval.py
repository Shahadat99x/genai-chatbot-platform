import os
import cv2
import json
import argparse
import pandas as pd
from datetime import datetime
from glob import glob
from tqdm import tqdm

# Import our CV modules
# Need to add project root to path
import sys
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from apps.api.cv.quality import analyze_quality
from apps.api.cv.scan import scan_document
from apps.api.cv.ocr import run_ocr

def evaluate_cv_pipeline(image_dir: str, output_dir: str):
    """Runs CV pipeline on all images in a directory."""
    
    os.makedirs(output_dir, exist_ok=True)
    
    image_paths = glob(os.path.join(image_dir, "*"))
    image_paths = [p for p in image_paths if p.lower().endswith(('.jpg', '.jpeg', '.png'))]
    
    results = []
    
    print(f"Found {len(image_paths)} images in {image_dir}")
    
    for img_path in tqdm(image_paths):
        img_name = os.path.basename(img_path)
        
        try:
            # Load
            img = cv2.imread(img_path)
            if img is None:
                print(f"Could not read {img_path}")
                continue
                
            # 1. Scan
            scanned, doc_conf, was_warped = scan_document(img)
            
            # 2. Quality
            quality = analyze_quality(img, doc_confidence=doc_conf)
            
            # 3. OCR
            ocr = run_ocr(scanned)
            
            results.append({
                "image": img_name,
                "quality_score": quality.score,
                "issues": ", ".join(quality.issues),
                "doc_confidence": doc_conf,
                "was_warped": was_warped,
                "blur_score": quality.blur_score,
                "brightness": quality.brightness_mean,
                "glare_ratio": quality.glare_ratio,
                "ocr_confidence": ocr.confidence,
                "text_length": len(ocr.text),
                "extracted_text_snippet": ocr.text[:100].replace("\n", " ")
            })
            
            # Save debug image
            debug_path = os.path.join(output_dir, f"debug_{img_name}")
            cv2.imwrite(debug_path, scanned)
            
        except Exception as e:
            print(f"Error processing {img_name}: {e}")
            
    # Save results
    df = pd.DataFrame(results)
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    csv_path = os.path.join(output_dir, f"cv_report_{timestamp}.csv")
    df.to_csv(csv_path, index=False)
    
    print(f"\nEvaluation Complete. Results saved to {csv_path}")
    print(df.describe())

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--images", required=True, help="Path to folder with input images")
    parser.add_argument("--out", default="eval/cv_results", help="Output directory")
    args = parser.parse_args()
    
    evaluate_cv_pipeline(args.images, args.out)
