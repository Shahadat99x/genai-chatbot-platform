"""
Document Scanning Module.
Applies perspective correction using detected or manually specified corners.
"""
import cv2
import numpy as np
from typing import Optional, List, Dict, Any, Tuple

from .boundary import detect_document_corners, order_points
from .schemas import CornerPoint, ScanMeta


def four_point_transform(image: np.ndarray, pts: np.ndarray) -> np.ndarray:
    """
    Applies a perspective transform to obtain a top-down view.
    
    Args:
        image: Source image
        pts: 4 corner points (will be ordered internally)
        
    Returns:
        Warped image with corrected perspective
    """
    rect = order_points(pts)
    (tl, tr, br, bl) = rect
    
    # Compute width of new image
    widthA = np.sqrt(((br[0] - bl[0]) ** 2) + ((br[1] - bl[1]) ** 2))
    widthB = np.sqrt(((tr[0] - tl[0]) ** 2) + ((tr[1] - tl[1]) ** 2))
    maxWidth = max(int(widthA), int(widthB))
    
    # Compute height of new image
    heightA = np.sqrt(((tr[0] - br[0]) ** 2) + ((tr[1] - br[1]) ** 2))
    heightB = np.sqrt(((tl[0] - bl[0]) ** 2) + ((tl[1] - bl[1]) ** 2))
    maxHeight = max(int(heightA), int(heightB))
    
    # Ensure minimum dimensions
    maxWidth = max(maxWidth, 100)
    maxHeight = max(maxHeight, 100)
    
    # Destination points
    dst = np.array([
        [0, 0],
        [maxWidth - 1, 0],
        [maxWidth - 1, maxHeight - 1],
        [0, maxHeight - 1]
    ], dtype="float32")
    
    # Compute perspective transform matrix and apply
    M = cv2.getPerspectiveTransform(rect, dst)
    warped = cv2.warpPerspective(image, M, (maxWidth, maxHeight))
    
    return warped


def corners_dict_to_array(corners: List[Dict[str, float]]) -> np.ndarray:
    """Convert corner dicts to numpy array."""
    return np.array([[c["x"], c["y"]] for c in corners], dtype="float32")


def corners_array_to_schema(corners: np.ndarray) -> List[CornerPoint]:
    """Convert numpy array to CornerPoint list."""
    ordered = order_points(corners)
    return [
        CornerPoint(x=float(ordered[0][0]), y=float(ordered[0][1])),
        CornerPoint(x=float(ordered[1][0]), y=float(ordered[1][1])),
        CornerPoint(x=float(ordered[2][0]), y=float(ordered[2][1])),
        CornerPoint(x=float(ordered[3][0]), y=float(ordered[3][1])),
    ]


def scan_document(
    image: np.ndarray,
    corners_override: Optional[List[Dict[str, float]]] = None,
    debug: bool = False
) -> Tuple[np.ndarray, Dict[str, Any], ScanMeta]:
    """
    Detects document boundary and applies perspective correction.
    
    Args:
        image: Source image (BGR format)
        corners_override: Optional manual corners [{"x": float, "y": float}, ...]
        debug: Include debug info in boundary detection
        
    Returns:
        Tuple of:
        - Warped/scanned image
        - Boundary detection result dict
        - ScanMeta with operation details
    """
    used_auto = True
    corners_used = None
    scan_error = None
    warp_success = False
    
    # Get boundary detection result (even if override provided, for display)
    boundary_result = detect_document_corners(image, debug=debug)
    
    if corners_override is not None:
        # Use manual corners
        used_auto = False
        try:
            if len(corners_override) != 4:
                raise ValueError(f"Expected 4 corners, got {len(corners_override)}")
            
            corners_array = corners_dict_to_array(corners_override)
            corners_used = corners_array_to_schema(corners_array)
            
            # Apply warp
            warped = four_point_transform(image, corners_array)
            warp_success = True
            
        except Exception as e:
            scan_error = f"Manual corners error: {str(e)}"
            warped = image.copy()
            
    elif boundary_result["found"] and boundary_result["corners"]:
        # Use auto-detected corners
        used_auto = True
        try:
            corners_array = corners_dict_to_array(boundary_result["corners"])
            corners_used = corners_array_to_schema(corners_array)
            
            warped = four_point_transform(image, corners_array)
            warp_success = True
            
        except Exception as e:
            scan_error = f"Auto warp error: {str(e)}"
            warped = image.copy()
    else:
        # No corners found/provided - return original
        used_auto = True
        scan_error = "No document boundary detected"
        warped = image.copy()
    
    scan_meta = ScanMeta(
        used_auto_corners=used_auto,
        corners_used=corners_used,
        scan_warp_success=warp_success,
        scan_error=scan_error
    )
    
    return warped, boundary_result, scan_meta

