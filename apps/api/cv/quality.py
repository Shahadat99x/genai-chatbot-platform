import cv2
import numpy as np
from .schemas import QualityResult

# Thresholds
BLUR_THRESHOLD = 100.0  # Lower is blurrier
BRIGHTNESS_LOW = 70.0   # 0-255
BRIGHTNESS_HIGH = 230.0 # 0-255
GLARE_RATIO = 0.05      # >5% pixels saturated

def analyze_quality(image: np.ndarray, doc_confidence: float = 1.0) -> QualityResult:
    """Computes quality metrics for the image."""
    
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    
    # 1. Blur
    laplacian_var = cv2.Laplacian(gray, cv2.CV_64F).var()
    
    # 2. Brightness
    brightness_mean = np.mean(gray)
    
    # 3. Glare (pixels close to white)
    _, bright_mask = cv2.threshold(gray, 245, 255, cv2.THRESH_BINARY)
    glare_pixels = cv2.countNonZero(bright_mask)
    total_pixels = gray.size
    glare_ratio = glare_pixels / total_pixels
    
    # 4. Assessment
    score = 100
    issues = []
    tips = []
    
    if laplacian_var < BLUR_THRESHOLD:
        score -= 30
        issues.append("blurry")
        tips.append("Hold camera steady and tap to focus.")
        
    if brightness_mean < BRIGHTNESS_LOW:
        score -= 20
        issues.append("too_dark")
        tips.append("Turn on flash or move to better light.")
        
    if brightness_mean > BRIGHTNESS_HIGH:
        score -= 10
        issues.append("too_bright")
        
    if glare_ratio > GLARE_RATIO:
        score -= 20
        issues.append("glare")
        tips.append("Avoid direct reflection on the paper.")
        
    if doc_confidence < 0.6:
        score -= 20
        issues.append("cropping_issue")
        tips.append("Ensure all 4 corners of the document are visible on a dark background.")

    return QualityResult(
        score=max(0, min(100, score)),
        issues=issues,
        tips=tips,
        blur_score=laplacian_var,
        brightness_mean=brightness_mean,
        glare_ratio=glare_ratio,
        doc_confidence=doc_confidence
    )
