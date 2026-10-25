"""Map CSLR gloss tokens to readable English (no per-frame LLM)."""

from __future__ import annotations

import re

# Common How2Sign / ASL gloss cleanup
GLOSS_ALIASES = {
    "IX": "",
    "IX-1P": "I",
    "IX-2P": "YOU",
    "IX-3P": "THEY",
    "POSS": "",
    "POSS-1P": "MY",
    "POSS-2P": "YOUR",
    "FS": "",  # fingerspell marker
    "<blank>": "",
    "PAD": "",
    "UNK": "",
    "<unk>": "",
}

FILLER = {"", "-", "--", "//", "\\"}


def _clean_token(tok: str) -> str:
    t = tok.strip()
    # Strip notebook noise like //UNDERSTAND\\
    t = t.replace("//", "").replace("\\", "")
    t = re.sub(r"^[^A-Za-z0-9]+|[^A-Za-z0-9]+$", "", t)
    upper = t.upper()
    if upper in GLOSS_ALIASES:
        return GLOSS_ALIASES[upper]
    # Drop pure punctuation / numeric noise
    if not re.search(r"[A-Za-z]", t):
        return ""
    return upper


def glosses_to_english(glosses: list[str]) -> str:
    if not glosses:
        return ""

    words: list[str] = []
    for g in glosses:
        c = _clean_token(g)
        if not c or c in FILLER:
            continue
        # Collapse immediate repeats from CTC edge noise
        if words and words[-1] == c:
            continue
        words.append(c)

    if not words:
        return ""

    # Title-case first word, keep ASL gloss style uppercase for clarity in UI
    # Product: show space-joined gloss English (HELLO TODAY I LEARN ...)
    return " ".join(words)
