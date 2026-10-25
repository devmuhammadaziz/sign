"""Hands-present segment buffer + pause-triggered CSLR inference."""

from __future__ import annotations

import time
from dataclasses import dataclass, field

import numpy as np

from .cslr_model import CSLREngine
from .gloss_to_text import glosses_to_english


@dataclass
class SegmentResult:
    glosses: list[str]
    text: str
    confidence_hint: float


@dataclass
class SignSegmenter:
    engine: CSLREngine
    pause_ms: float = 600.0
    max_frames: int = 120  # ~4s at 30fps before forced flush
    min_frames: int = 12
    cooldown_ms: float = 1200.0
    sentence_idle_ms: float = 3000.0

    buffer: list[np.ndarray] = field(default_factory=list)
    hands_missing_since: float | None = None
    last_emit_at: float = 0.0
    last_text: str = ""
    last_hands_at: float | None = None
    period_emitted: bool = False

    def reset(self):
        self.buffer.clear()
        self.hands_missing_since = None
        self.last_emit_at = 0.0
        self.last_text = ""
        self.last_hands_at = None
        self.period_emitted = False

    def push(
        self,
        frame_vec: np.ndarray,
        left_ok: bool,
        right_ok: bool,
        now: float | None = None,
    ) -> dict:
        """
        Ingest one 153-D frame. Returns event dict for the WebSocket client.
        Possible keys: active, confirmed, period, status
        """
        now = now if now is not None else time.time() * 1000.0
        hands = left_ok or right_ok
        events: dict = {"status": "tracking", "hands": hands}

        if hands:
            self.last_hands_at = now
            self.period_emitted = False
            self.hands_missing_since = None
            self.buffer.append(frame_vec.astype(np.float32))
            events["active"] = "…"
            events["buffer_len"] = len(self.buffer)

            if len(self.buffer) >= self.max_frames:
                result = self._flush(now)
                if result:
                    events.update(result)
            return events

        # No hands
        if self.hands_missing_since is None:
            self.hands_missing_since = now

        missing_for = now - self.hands_missing_since

        if self.buffer and missing_for >= self.pause_ms:
            result = self._flush(now)
            if result:
                events.update(result)

        if (
            self.last_hands_at is not None
            and not self.period_emitted
            and (now - self.last_hands_at) >= self.sentence_idle_ms
            and not self.buffer
        ):
            self.period_emitted = True
            events["period"] = True

        if not self.buffer:
            events["active"] = ""

        return events

    def _flush(self, now: float) -> dict | None:
        frames = self.buffer
        self.buffer = []
        self.hands_missing_since = None

        if len(frames) < self.min_frames:
            return {"active": ""}

        if now - self.last_emit_at < self.cooldown_ms:
            return {"active": ""}

        seq = np.stack(frames, axis=0)
        glosses = self.engine.predict(seq)
        text = glosses_to_english(glosses)

        if not text:
            return {"active": "", "glosses": []}

        # Drop identical phrase spam
        if text.upper() == self.last_text.upper() and (
            now - self.last_emit_at
        ) < self.cooldown_ms * 2:
            return {"active": text, "glosses": glosses}

        self.last_emit_at = now
        self.last_text = text
        return {
            "active": text,
            "confirmed": text,
            "glosses": glosses,
        }
