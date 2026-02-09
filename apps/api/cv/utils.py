import base64
import numpy as np
import cv2
from io import BytesIO
from PIL import Image

def decode_image_to_cv2(file_bytes: bytes) -> np.ndarray:
    """Decodes image bytes to OpenCV format (BGR)."""
    nparr = np.frombuffer(file_bytes, np.uint8)
    image = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
    return image

def encode_cv2_to_base64(image: np.ndarray) -> str:
    """Encodes OpenCV image to base64 string."""
    _, buffer = cv2.imencode('.jpg', image)
    img_str = base64.b64encode(buffer).decode('utf-8')
    return f"data:image/jpeg;base64,{img_str}"

def resize_maintain_aspect(image: np.ndarray, width: int = None, height: int = None) -> np.ndarray:
    """Resizes image keeping aspect ratio."""
    (h, w) = image.shape[:2]
    if width is None and height is None:
        return image
    
    if width is None:
        r = height / float(h)
        dim = (int(w * r), height)
    else:
        r = width / float(w)
        dim = (width, int(h * r))
        
    return cv2.resize(image, dim, interpolation=cv2.INTER_AREA)
