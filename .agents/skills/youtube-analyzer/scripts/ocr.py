"""Local OCR extraction for video frames (0 LLM image tokens)."""
from __future__ import annotations

import shutil
import subprocess
from pathlib import Path


def is_ocr_available() -> bool:
    return shutil.which("tesseract") is not None


def run_local_ocr(image_paths: list[Path | str]) -> list[dict]:
    """Run local OCR on image frames. Returns list of {path, text}."""
    if not is_ocr_available():
        return []

    results = []
    for p in image_paths:
        path = Path(p)
        if not path.exists():
            continue
        try:
            res = subprocess.run(
                ["tesseract", str(path.resolve()), "stdout", "--oem", "1", "-l", "eng"],
                capture_output=True,
                text=True,
                timeout=10,
            )
            raw_text = res.stdout.strip()
            lines = [ln.strip() for ln in raw_text.splitlines() if len(ln.strip()) > 3]
            clean_text = "\n".join(lines)
            if clean_text:
                results.append({
                    "path": str(path),
                    "text": clean_text,
                })
        except Exception:
            continue
    return results
