"""
Visualization Module for debug overlays.
Generates visual overlays for glare detection and other CV debug outputs.
"""
import cv2
import numpy as np
import base64
from typing import Optional, Tuple


def detect_glare_mask(image: np.ndarray, threshold: int = 245) -> np.ndarray:
    """
    Detect glare/bright areas in an image.
    
    Args:
        image: BGR image
        threshold: Brightness threshold (0-255)
        
    Returns:
        Binary mask where glare areas are white
    """
    # Convert to grayscale
    if len(image.shape) == 3:
        gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    else:
        gray = image
    
    # Threshold for very bright pixels
    _, bright_mask = cv2.threshold(gray, threshold, 255, cv2.THRESH_BINARY)
    
    # Morphological operations to connect nearby bright regions
    kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5))
    bright_mask = cv2.dilate(bright_mask, kernel, iterations=2)
    bright_mask = cv2.morphologyEx(bright_mask, cv2.MORPH_CLOSE, kernel, iterations=2)
    
    return bright_mask


def create_glare_overlay(
    image: np.ndarray,
    threshold: int = 245,
    overlay_color: Tuple[int, int, int] = (0, 0, 255),  # Red in BGR
    alpha: float = 0.4
) -> Tuple[np.ndarray, float]:
    """
    Create a visualization overlay highlighting glare areas.
    
    Args:
        image: BGR image
        threshold: Brightness threshold for glare detection
        overlay_color: BGR color for the glare highlight
        alpha: Transparency of the overlay (0-1)
        
    Returns:
        Tuple of (overlay_image, glare_ratio)
    """
    # Detect glare
    glare_mask = detect_glare_mask(image, threshold)
    
    # Calculate glare ratio
    total_pixels = glare_mask.size
    glare_pixels = cv2.countNonZero(glare_mask)
    glare_ratio = glare_pixels / total_pixels if total_pixels > 0 else 0
    
    # Create overlay
    overlay = image.copy()
    
    # Apply colored highlight to glare areas
    overlay[glare_mask > 0] = overlay_color
    
    # Blend with original
    result = cv2.addWeighted(image, 1 - alpha, overlay, alpha, 0)
    
    # Add glare contours for better visibility
    contours, _ = cv2.findContours(glare_mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    cv2.drawContours(result, contours, -1, (0, 255, 255), 2)  # Yellow contours
    
    return result, glare_ratio


def create_edge_overlay(
    image: np.ndarray,
    overlay_color: Tuple[int, int, int] = (0, 255, 0),  # Green in BGR
    alpha: float = 0.5
) -> np.ndarray:
    """
    Create a visualization overlay showing detected edges.
    
    Args:
        image: BGR image
        overlay_color: BGR color for the edge highlight
        alpha: Transparency of the overlay (0-1)
        
    Returns:
        Overlay image with edges highlighted
    """
    # Convert to grayscale
    if len(image.shape) == 3:
        gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    else:
        gray = image
    
    # Apply Gaussian blur
    blurred = cv2.GaussianBlur(gray, (5, 5), 0)
    
    # Canny edge detection
    edges = cv2.Canny(blurred, 50, 150)
    
    # Dilate edges for visibility
    kernel = np.ones((2, 2), np.uint8)
    edges = cv2.dilate(edges, kernel, iterations=1)
    
    # Create colored edge overlay
    if len(image.shape) == 3:
        result = image.copy()
    else:
        result = cv2.cvtColor(gray, cv2.COLOR_GRAY2BGR)
    
    # Apply color to edges
    result[edges > 0] = overlay_color
    
    return result


def encode_image_to_base64(image: np.ndarray, format: str = 'jpg') -> str:
    """Encode OpenCV image to base64 data URL."""
    if format == 'jpg':
        _, buffer = cv2.imencode('.jpg', image, [cv2.IMWRITE_JPEG_QUALITY, 85])
        mime = 'image/jpeg'
    else:
        _, buffer = cv2.imencode('.png', image)
        mime = 'image/png'
    
    b64 = base64.b64encode(buffer).decode('utf-8')
    return f"data:{mime};base64,{b64}"


def generate_debug_overlays(
    original_image: np.ndarray,
    include_glare: bool = True,
    include_edges: bool = False
) -> dict:
    """
    Generate all requested debug overlays.
    
    Args:
        original_image: BGR image
        include_glare: Whether to include glare overlay
        include_edges: Whether to include edge overlay
        
    Returns:
        Dict with overlay base64 strings
    """
    result = {}
    
    if include_glare:
        glare_overlay, glare_ratio = create_glare_overlay(original_image)
        result["glare_overlay"] = encode_image_to_base64(glare_overlay)
        result["glare_ratio"] = glare_ratio
    
    if include_edges:
        edge_overlay = create_edge_overlay(original_image)
        result["edge_overlay"] = encode_image_to_base64(edge_overlay)
    
    return result
