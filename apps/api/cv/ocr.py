"""
OCR Module with robust Tesseract discovery and enhanced preprocessing.
Supports basic and enhanced modes for different image quality scenarios.
"""
import pytesseract
import cv2
import numpy as np
import shutil
import os
import sys
import time
from typing import Tuple, List, Optional, Dict, Any
from .schemas import OcrResult

# Common Windows paths for Tesseract
WINDOWS_PATHS = [
    r"C:\Program Files\Tesseract-OCR\tesseract.exe",
    r"C:\Program Files (x86)\Tesseract-OCR\tesseract.exe",
    r"C:\Users\Public\Tesseract-OCR\tesseract.exe"
]

def resolve_tesseract_cmd() -> Tuple[Optional[str], List[str]]:
    """
    Attempts to find the Tesseract executable.
    Resolution order:
    1. TESSERACT_CMD env var (if set AND file exists)
    2. shutil.which("tesseract") (PATH lookup)
    3. Common Windows install locations
    
    Returns: (cmd_path, debug_notes)
    """
    notes = []
    
    # 1. Check Environment Variable
    env_path = os.environ.get("TESSERACT_CMD")
    if env_path:
        # Normalize path (handle spaces, quotes)
        env_path = env_path.strip().strip('"').strip("'")
        if os.path.exists(env_path):
            notes.append(f"✓ Found via TESSERACT_CMD: {env_path}")
            return env_path, notes
        else:
            notes.append(f"✗ TESSERACT_CMD='{env_path}' but file not found")
    else:
        notes.append("• TESSERACT_CMD env var not set")

    # 2. Check PATH (shutil.which)
    which_path = shutil.which("tesseract")
    if which_path:
        notes.append(f"✓ Found via PATH: {which_path}")
        return which_path, notes
    else:
        notes.append("• Not found in system PATH")

    # 3. Check Common Windows Paths
    if sys.platform.startswith("win"):
        for path in WINDOWS_PATHS:
            if os.path.exists(path):
                notes.append(f"✓ Found at common location: {path}")
                return path, notes
            else:
                notes.append(f"• Checked {path}: Not found")

    notes.append("✗ Tesseract executable not found anywhere")
    return None, notes


def preprocess_for_ocr(image: np.ndarray, mode: str = "basic") -> np.ndarray:
    """
    Preprocess image to improve OCR accuracy.
    
    Modes:
    - basic: Grayscale + CLAHE contrast enhancement
    - enhanced: Upscale 2x + sharpen + adaptive threshold
    """
    try:
        # Convert to grayscale if needed
        if len(image.shape) == 3:
            gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
        else:
            gray = image.copy()

        if mode == "enhanced":
            # 1. Upscale 2x for better OCR on small text
            h, w = gray.shape
            gray = cv2.resize(gray, (w * 2, h * 2), interpolation=cv2.INTER_CUBIC)
            
            # 2. Denoise
            gray = cv2.fastNlMeansDenoising(gray, h=10)
            
            # 3. Sharpen
            kernel = np.array([[-1, -1, -1],
                               [-1,  9, -1],
                               [-1, -1, -1]])
            gray = cv2.filter2D(gray, -1, kernel)
            
            # 4. Adaptive threshold for better text isolation
            gray = cv2.adaptiveThreshold(
                gray, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, 
                cv2.THRESH_BINARY, 11, 2
            )
        else:
            # Basic mode: CLAHE contrast enhancement
            clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
            gray = clahe.apply(gray)
        
        return gray
    except Exception:
        # Fallback to original if anything fails
        if len(image.shape) == 3:
            return cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
        return image


def run_ocr_with_config(image: np.ndarray, tesseract_cmd: str, psm: int = 6) -> Tuple[str, float]:
    """
    Run OCR with specific PSM config.
    Returns (text, avg_confidence)
    """
    pytesseract.pytesseract.tesseract_cmd = tesseract_cmd
    
    # Build config: OEM 1 (LSTM), specified PSM
    config = f"--oem 1 --psm {psm}"
    
    data = pytesseract.image_to_data(
        image, 
        output_type=pytesseract.Output.DICT,
        config=config
    )
    
    text_parts = []
    confidences = []
    
    n_boxes = len(data['text'])
    for i in range(n_boxes):
        text = data['text'][i]
        conf = float(data['conf'][i])
        
        # conf -1 means no text found in that block
        if int(conf) != -1 and text.strip():
            text_parts.append(text)
            confidences.append(conf)
    
    full_text = " ".join(text_parts).strip()
    avg_conf = sum(confidences) / len(confidences) if confidences else 0.0
    
    return full_text, avg_conf


def run_ocr(image: np.ndarray, engine: str = "tesseract", mode: str = "basic") -> OcrResult:
    """
    Run OCR on the image with robust error handling.
    
    Args:
        image: OpenCV image (BGR or grayscale)
        engine: OCR engine (only "tesseract" supported)
        mode: "basic" or "enhanced"
    
    Returns:
        OcrResult with text, confidence, and debug info
    """
    start_time = time.time()
    
    tesseract_cmd, discovery_notes = resolve_tesseract_cmd()
    
    # Base debug info
    debug_info: Dict[str, Any] = {
        "engine_requested": engine,
        "mode": mode,
        "os": sys.platform,
        "image_shape": list(image.shape) if image is not None else None,
    }

    # Check if Tesseract is found
    if not tesseract_cmd:
        elapsed_ms = int((time.time() - start_time) * 1000)
        return OcrResult(
            text="", 
            confidence=0.0, 
            engine="error",
            tesseract_found=False,
            tesseract_path_used=None,
            ocr_error="Tesseract not found. Install from https://github.com/UB-Mannheim/tesseract/wiki and set TESSERACT_CMD in .env",
            debug_notes=discovery_notes,
            mode=mode,
            timing_ms=elapsed_ms,
            debug=debug_info
        )
    
    # Configure pytesseract
    pytesseract.pytesseract.tesseract_cmd = tesseract_cmd
    
    try:
        # Preprocess the image
        processed_img = preprocess_for_ocr(image, mode)
        debug_info["preprocessing"] = f"grayscale+{'enhanced' if mode == 'enhanced' else 'clahe'}"
        debug_info["preprocessed_shape"] = list(processed_img.shape)
        
        # For enhanced mode, try multiple PSM values
        if mode == "enhanced":
            psm_sequence = [6, 4, 11, 3]  # Try different page segmentation modes
        else:
            psm_sequence = [6]  # Default: assume uniform block of text
        
        best_text = ""
        best_conf = 0.0
        best_psm = psm_sequence[0]
        
        for psm in psm_sequence:
            try:
                text, conf = run_ocr_with_config(processed_img, tesseract_cmd, psm)
                
                # Keep best result
                if len(text) > len(best_text) or (len(text) == len(best_text) and conf > best_conf):
                    best_text = text
                    best_conf = conf
                    best_psm = psm
                
                # If we got good results, stop trying
                if len(text) > 20 and conf > 50:
                    break
            except Exception:
                continue
        
        debug_info["psm_used"] = best_psm
        debug_info["psm_tried"] = psm_sequence
        
        elapsed_ms = int((time.time() - start_time) * 1000)
        
        return OcrResult(
            text=best_text,
            confidence=best_conf / 100.0,  # Normalize to 0-1
            engine="tesseract",
            tesseract_found=True,
            tesseract_path_used=tesseract_cmd,
            ocr_error=None,
            debug_notes=discovery_notes,
            mode=mode,
            timing_ms=elapsed_ms,
            debug=debug_info
        )

    except Exception as e:
        error_msg = str(e)
        # Truncate if too long
        if len(error_msg) > 300:
            error_msg = error_msg[:300] + "..."
        
        elapsed_ms = int((time.time() - start_time) * 1000)

        return OcrResult(
            text="", 
            confidence=0.0, 
            engine="error", 
            tesseract_found=True,
            tesseract_path_used=tesseract_cmd,
            ocr_error=f"OCR Runtime Error: {error_msg}",
            debug_notes=discovery_notes + [f"Exception: {error_msg}"],
            mode=mode,
            timing_ms=elapsed_ms,
            debug=debug_info
        )
