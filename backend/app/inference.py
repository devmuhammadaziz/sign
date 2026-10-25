"""
DeepSign OS — Stage 1–3 AI pipeline

1. Intent Gate  — ignore resting / non-signing motion
2. Temporal model — PoseTransformer CSLR (How2Sign)
3. CTC decode   — collapse frame-level repeats into tokens
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any

import numpy as np

from .cslr_model import CSLREngine
from .gloss_to_text import glosses_to_english


@dataclass
class InferResult:
    intent: str  # SIGNING | IGNORE
    speculative: str | None = None
    confirmed: str | None = None
    glosses: list[str] | None = None
    meta: dict[str, Any] | None = None


class IntentGate:
    """
    Lightweight motion / presence gate.
    Drops windows where hands are absent or velocity is near zero
    (resting "peace sign" / scratching face).
    """

    def __init__(
        self,
        velocity_thresh: float = 0.012,
        min_hand_frames: float = 0.35,
        signing_space_y_max: float = 0.85,
    ):
        self.velocity_thresh = velocity_thresh
        self.min_hand_frames = min_hand_frames
        self.signing_space_y_max = signing_space_y_max

    def decide(self, window: np.ndarray) -> tuple[str, dict[str, Any]]:
        """
        window: (T, 153)
        presence mask at indices 150,151,152 = pose,left,right
        Hand keypoints: left [24:87), right [87:150)
        """
        T = window.shape[0]
        if T < 4:
            return "IGNORE", {"reason": "too_short"}

        left_on = window[:, 151] > 0.5
        right_on = window[:, 152] > 0.5
        hand_ratio = float(np.mean(left_on | right_on))
        if hand_ratio < self.min_hand_frames:
            return "IGNORE", {"reason": "no_hands", "hand_ratio": hand_ratio}

        # Wrist velocity (pose joints 4 & 5 within 8-pose set → offsets 12,15)
        # left wrist = pose idx 4 → floats 12:15, right wrist idx 5 → 15:18
        def wrist_speed(base: int) -> float:
            pts = window[:, base : base + 2]  # x,y
            d = np.linalg.norm(np.diff(pts, axis=0), axis=1)
            return float(np.mean(d)) if len(d) else 0.0

        v_l = wrist_speed(12)
        v_r = wrist_speed(15)
        # Also use hand landmark motion when pose wrists weak
        hand_l = window[:, 24:27]  # wrist of left hand landmark 0
        hand_r = window[:, 87:90]
        hv_l = float(np.mean(np.linalg.norm(np.diff(hand_l, axis=0), axis=1))) if T > 1 else 0.0
        hv_r = float(np.mean(np.linalg.norm(np.diff(hand_r, axis=0), axis=1))) if T > 1 else 0.0

        velocity = max(v_l, v_r, hv_l, hv_r)
        if velocity < self.velocity_thresh:
            return "IGNORE", {
                "reason": "low_velocity",
                "velocity": velocity,
                "hand_ratio": hand_ratio,
            }

        return "SIGNING", {
            "reason": "ok",
            "velocity": velocity,
            "hand_ratio": hand_ratio,
        }


class DeepSignPipeline:
    def __init__(self, engine: CSLREngine | None = None):
        self.gate = IntentGate()
        self.engine = engine or CSLREngine()
        self._last_confirmed: str = ""
        self._stable_hits: int = 0
        self._pending: str = ""

    def infer_window(self, landmarks: np.ndarray) -> InferResult:
        """
        landmarks: (T, 153) float32
        """
        if landmarks.ndim != 2 or landmarks.shape[1] != 153:
            raise ValueError(f"Expected (T,153), got {landmarks.shape}")

        intent, meta = self.gate.decide(landmarks)
        if intent == "IGNORE":
            self._stable_hits = 0
            self._pending = ""
            return InferResult(intent="IGNORE", meta=meta)

        glosses = self.engine.predict(landmarks.astype(np.float32))
        text = glosses_to_english(glosses)
        if not text:
            return InferResult(intent="SIGNING", speculative=None, meta=meta)

        # Speculative = current decode; confirm after 2 consecutive same phrases
        speculative = text
        confirmed = None
        if text.upper() == self._pending.upper():
            self._stable_hits += 1
        else:
            self._pending = text
            self._stable_hits = 1

        if self._stable_hits >= 2 and text.upper() != self._last_confirmed.upper():
            confirmed = text
            self._last_confirmed = text
            self._stable_hits = 0
            self._pending = ""

        return InferResult(
            intent="SIGNING",
            speculative=speculative if not confirmed else None,
            confirmed=confirmed,
            glosses=glosses,
            meta=meta,
        )
