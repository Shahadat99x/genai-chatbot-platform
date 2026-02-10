"""
Document Boundary Detection Module.
Detects document corners using OpenCV edge detection and contour analysis.
"""
import cv2
import numpy as np
from typing import List, Optional, Dict, Any


def order_points(pts: np.ndarray) -> np.ndarray:
    """
    Orders 4 points consistently: top-left, top-right, bottom-right, bottom-left.
    
    Args:
        pts: Array of 4 points with shape (4, 2)
        
    Returns:
        Ordered points array with shape (4, 2)
    """
    rect = np.zeros((4, 2), dtype="float32")
    
    # Sum of coordinates: smallest = top-left, largest = bottom-right
    s = pts.sum(axis=1)
    rect[0] = pts[np.argmin(s)]  # top-left
    rect[2] = pts[np.argmax(s)]  # bottom-right
    
    # Difference of coordinates: smallest = top-right, largest = bottom-left
    diff = np.diff(pts, axis=1).flatten()
    rect[1] = pts[np.argmin(diff)]  # top-right
    rect[3] = pts[np.argmax(diff)]  # bottom-left
    
    return rect


def detect_document_corners(image: np.ndarray, debug: bool = False) -> Dict[str, Any]:
    """
    Detects document boundary corners in an image.
    
    Uses edge detection and contour analysis to find a quadrilateral
    representing the document boundary.
    
    Args:
        image: OpenCV image (BGR format)
        debug: If True, include intermediate images in response
        
    Returns:
        {
            "found": bool,
            "corners": [{"x": float, "y": float}, ...] or None,
            "confidence": float (0.0 to 1.0),
            "debug_notes": [str, ...],
            "intermediate": {...} (only if debug=True)
        }
    """
    debug_notes = []
    intermediate = {}
    
    orig_h, orig_w = image.shape[:2]
    image_area = orig_w * orig_h
    debug_notes.append(f"Image size: {orig_w}x{orig_h}")
    
    # Resize for processing (maintain aspect ratio)
    process_height = 500
    ratio = orig_h / process_height
    process_w = int(orig_w / ratio)
    resized = cv2.resize(image, (process_w, process_height))
    
    # Step 1: Convert to grayscale
    gray = cv2.cvtColor(resized, cv2.COLOR_BGR2GRAY)
    debug_notes.append("Converted to grayscale")
    
    # Step 2: Gaussian blur to reduce noise
    blurred = cv2.GaussianBlur(gray, (5, 5), 0)
    debug_notes.append("Applied Gaussian blur (5x5)")
    
    # Step 3: Edge detection (Canny)
    # Use automatic threshold calculation based on median
    median_val = np.median(blurred)
    lower = int(max(0, 0.66 * median_val))
    upper = int(min(255, 1.33 * median_val))
    edged = cv2.Canny(blurred, lower, upper)
    debug_notes.append(f"Canny edge detection (thresholds: {lower}-{upper})")
    
    if debug:
        _, edge_buffer = cv2.imencode('.jpg', edged)
        import base64
        intermediate["edges_b64"] = base64.b64encode(edge_buffer).decode('utf-8')
    
    # Step 4: Morphological operations to close gaps
    kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (5, 5))
    closed = cv2.morphologyEx(edged, cv2.MORPH_CLOSE, kernel, iterations=2)
    dilated = cv2.dilate(closed, kernel, iterations=1)
    debug_notes.append("Applied morphological close + dilate")
    
    # Step 5: Find contours
    contours, _ = cv2.findContours(dilated, cv2.RETR_LIST, cv2.CHAIN_APPROX_SIMPLE)
    debug_notes.append(f"Found {len(contours)} contours")
    
    # Sort by area descending, take top candidates
    contours = sorted(contours, key=cv2.contourArea, reverse=True)[:10]
    
    # Step 6: Find quadrilateral
    best_quad = None
    best_area = 0
    
    for i, contour in enumerate(contours):
        peri = cv2.arcLength(contour, True)
        # Try different epsilon values for polygon approximation
        for eps_mult in [0.02, 0.03, 0.04, 0.05]:
            approx = cv2.approxPolyDP(contour, eps_mult * peri, True)
            
            if len(approx) == 4:
                area = cv2.contourArea(approx)
                process_area = process_w * process_height
                area_ratio = area / process_area
                
                # Validate: must be at least 10% of image area
                if area_ratio < 0.10:
                    continue
                    
                # Validate: check if it's convex
                if not cv2.isContourConvex(approx):
                    continue
                
                if area > best_area:
                    best_area = area
                    best_quad = approx
                    debug_notes.append(f"Found quad candidate (contour {i}, eps={eps_mult}, area_ratio={area_ratio:.2%})")
                break
    
    if best_quad is None:
        debug_notes.append("No valid quadrilateral found")
        return {
            "found": False,
            "corners": None,
            "confidence": 0.0,
            "debug_notes": debug_notes,
            "intermediate": intermediate if debug else None
        }
    
    # Scale corners back to original image coordinates
    corners_scaled = best_quad.reshape(4, 2) * ratio
    
    # Order corners consistently
    ordered = order_points(corners_scaled)
    
    # Convert to list of dicts
    corners_list = [
        {"x": float(ordered[0][0]), "y": float(ordered[0][1])},  # top-left
        {"x": float(ordered[1][0]), "y": float(ordered[1][1])},  # top-right
        {"x": float(ordered[2][0]), "y": float(ordered[2][1])},  # bottom-right
        {"x": float(ordered[3][0]), "y": float(ordered[3][1])},  # bottom-left
    ]
    
    # Calculate confidence
    quad_area = cv2.contourArea(ordered.astype(np.float32))
    confidence = min(1.0, (quad_area / image_area) * 1.5)
    
    # Reduce confidence if quad is very skewed
    # Check aspect ratio of the quad
    width_top = np.linalg.norm(ordered[1] - ordered[0])
    width_bottom = np.linalg.norm(ordered[2] - ordered[3])
    height_left = np.linalg.norm(ordered[3] - ordered[0])
    height_right = np.linalg.norm(ordered[2] - ordered[1])
    
    width_ratio = min(width_top, width_bottom) / max(width_top, width_bottom) if max(width_top, width_bottom) > 0 else 0
    height_ratio = min(height_left, height_right) / max(height_left, height_right) if max(height_left, height_right) > 0 else 0
    
    # Penalize if sides are very different lengths (perspective skew)
    if width_ratio < 0.5 or height_ratio < 0.5:
        confidence *= 0.7
        debug_notes.append(f"Confidence reduced due to perspective skew (width_ratio={width_ratio:.2f}, height_ratio={height_ratio:.2f})")
    
    debug_notes.append(f"Final confidence: {confidence:.2f}")
    
    return {
        "found": True,
        "corners": corners_list,
        "confidence": float(confidence),
        "debug_notes": debug_notes,
        "intermediate": intermediate if debug else None
    }
