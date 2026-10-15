"""Configuration presets for youtube-analyzer engine."""
from __future__ import annotations

DETAIL_PRESETS = {
    "transcript": {"cap": 0, "engine": "none"},
    "efficient": {"cap": 50, "engine": "keyframe"},
    "balanced": {"cap": 100, "engine": "scene"},
    "token-burner": {"cap": None, "engine": "scene"},
}


def frame_cap(detail: str) -> int | None:
    preset = DETAIL_PRESETS.get(detail, DETAIL_PRESETS["transcript"])
    return preset["cap"]


def default_detail() -> str:
    return "transcript"
