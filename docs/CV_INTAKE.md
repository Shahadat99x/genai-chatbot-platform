# Computer Vision Intake Module

## Overview

The "Intake" module allows users to upload medical documents (photos of prescriptions, reports, etc.) for processing.
It performs:

1. **Scanning**: Detecting document edges and warping/deskewing.
2. **Quality Check**: Assessing blur, glare, and brightness.
3. **OCR**: Extracting text using Tesseract.

## Tesseract Setup (Windows)

This module requires Tesseract-OCR.

### 1. Installation

Install from the official installer (e.g., UB-Mannheim):

- Path: `C:\Program Files\Tesseract-OCR` or `C:\Program Files (x86)\Tesseract-OCR`

### 2. Configuration

The backend attempts to find Tesseract automatically in common paths.

- **Verification**:
  Run this PowerShell command to confirm it's callable:

  ```powershell
  & "C:\Program Files\Tesseract-OCR\tesseract.exe" --version
  ```

- **Custom Path**:
  If installed elsewhere, set the environment variable in `apps/api/.env`:
  ```bash
  TESSERACT_CMD=D:\Custom\Path\tesseract.exe
  ```
  _Note: Restart the backend after changing .env._

## Debugging OCR

The `/intake/document` endpoint returns extensive debug information.
If OCR fails (text is empty):

1. Check the **"Debug Info"** section in the UI (below "Extracted Text").
2. Look for `tesseract_found: false`.
3. Check `ocr_error` for specific messages.

### Common Errors

- **"Tesseract binary not found"**: The system cannot locate `tesseract.exe`. Install it or set `TESSERACT_CMD`.
- **"OCR Runtime Error"**: Tesseract crashed. This might be due to a corrupt image or incompatible Tesseract version.

## Architecture

- `apps/api/cv/ocr.py`: Handles Tesseract resolution and execution.
- `apps/api/cv/scan.py`: OpenCV document scanner.
- `apps/api/cv/quality.py`: Image quality heuristics.
- `apps/web/app/intake/page.tsx`: Frontend UI with debug capabilities.
