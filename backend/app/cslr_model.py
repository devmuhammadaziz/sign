"""Pose Transformer CSLR — architecture matches manohonsy/how2sign-pose-cslr."""

from __future__ import annotations

import json
import math
from typing import Any

import numpy as np
import torch
import torch.nn as nn
import torch.nn.functional as F
from huggingface_hub import hf_hub_download
from safetensors.torch import load_file

HF_REPO = "manohonsy/how2sign-pose-cslr"


class SinusoidalPositionalEncoding(nn.Module):
    def __init__(self, d_model: int, max_len: int = 4096):
        super().__init__()
        pe = torch.zeros(max_len, d_model)
        position = torch.arange(0, max_len, dtype=torch.float).unsqueeze(1)
        div_term = torch.exp(
            torch.arange(0, d_model, 2).float() * (-math.log(10000.0) / d_model)
        )
        pe[:, 0::2] = torch.sin(position * div_term)
        pe[:, 1::2] = torch.cos(position * div_term)
        self.register_buffer("pe", pe.unsqueeze(0), persistent=True)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        return x + self.pe[:, : x.size(1)]


class PoseTransformerCSLR(nn.Module):
    """
    Stem: Linear(153→256) + LN + GELU + Dropout
    Pos: sinusoidal
    Encoder: 4 × TransformerEncoderLayer (d=256, heads=4, ff=1024, pre-norm GELU)
    Head: Linear(256→vocab)
    """

    def __init__(
        self,
        input_dim: int = 153,
        d_model: int = 256,
        n_heads: int = 4,
        n_layers: int = 4,
        ff_dim: int = 1024,
        dropout: float = 0.1,
        vocab_size: int = 1354,
    ):
        super().__init__()
        self.input_dim = input_dim
        self.d_model = d_model
        self.vocab_size = vocab_size

        # Names must match HF checkpoint: input_proj.*, pos_enc.pe, encoder.*, head.*
        self.input_proj = nn.Sequential(
            nn.Linear(input_dim, d_model),
            nn.LayerNorm(d_model),
            nn.GELU(),
            nn.Dropout(dropout),
        )
        self.pos_enc = SinusoidalPositionalEncoding(d_model, max_len=5000)
        layer = nn.TransformerEncoderLayer(
            d_model=d_model,
            nhead=n_heads,
            dim_feedforward=ff_dim,
            dropout=dropout,
            activation="gelu",
            batch_first=True,
            norm_first=True,
        )
        self.encoder = nn.TransformerEncoder(layer, num_layers=n_layers)
        self.head = nn.Linear(d_model, vocab_size)

    def forward(
        self, x: torch.Tensor, lengths: torch.Tensor | None = None
    ) -> tuple[torch.Tensor, torch.Tensor]:
        """
        x: (B, T, 153)
        returns log_probs (B, T, V), lengths (B,)
        """
        b, t, _ = x.shape
        h = self.input_proj(x)
        h = self.pos_enc(h)

        key_padding_mask = None
        if lengths is not None:
            key_padding_mask = torch.arange(t, device=x.device).unsqueeze(
                0
            ) >= lengths.unsqueeze(1)

        h = self.encoder(h, src_key_padding_mask=key_padding_mask)
        logits = self.head(h)
        log_probs = F.log_softmax(logits, dim=-1)

        if lengths is None:
            lengths = torch.full((b,), t, device=x.device, dtype=torch.long)
        return log_probs, lengths

    @classmethod
    def from_pretrained(
        cls, repo_id: str = HF_REPO, device: str | torch.device = "cpu"
    ) -> tuple["PoseTransformerCSLR", dict[str, Any]]:
        config_path = hf_hub_download(repo_id, "config.json")
        weights_path = hf_hub_download(repo_id, "model.safetensors")
        vocab_path = hf_hub_download(repo_id, "vocab.json")

        with open(config_path) as f:
            cfg = json.load(f)
        with open(vocab_path) as f:
            vocab_blob = json.load(f)

        token_to_id: dict[str, int] = vocab_blob.get("token_to_id", vocab_blob)
        id_to_token = {int(i): t for t, i in token_to_id.items()}

        model = cls(
            input_dim=cfg.get("input_dim", 153),
            d_model=cfg.get("d_model", 256),
            n_heads=cfg.get("n_heads", 4),
            n_layers=cfg.get("n_layers", 4),
            ff_dim=cfg.get("ff_dim", 1024),
            dropout=cfg.get("dropout", 0.1),
            vocab_size=cfg.get("vocab_size", len(token_to_id)),
        )

        state = load_file(weights_path)
        missing, unexpected = model.load_state_dict(state, strict=False)
        if missing:
            print(f"[cslr] missing keys ({len(missing)}): {missing[:8]}")
        if unexpected:
            print(f"[cslr] unexpected keys ({len(unexpected)}): {unexpected[:8]}")

        model.to(device)
        model.eval()

        meta = {
            "token_to_id": token_to_id,
            "id_to_token": id_to_token,
            "blank_id": token_to_id.get("<blank>", 1),
            "repo_id": repo_id,
            "device": str(device),
        }
        return model, meta


@torch.inference_mode()
def decode_ctc(
    log_probs: torch.Tensor,
    id_to_token: dict[int, str],
    blank_id: int,
    lengths: torch.Tensor | None = None,
) -> list[str]:
    """Greedy CTC collapse for batch item 0."""
    preds = log_probs[0].argmax(-1).tolist()
    if lengths is not None:
        preds = preds[: int(lengths[0].item())]

    collapsed: list[int] = []
    prev = None
    for p in preds:
        if p != prev:
            collapsed.append(p)
            prev = p
    gloss_ids = [p for p in collapsed if p != blank_id]
    return [id_to_token.get(i, f"<{i}>") for i in gloss_ids]


def normalize_pose_sequence(features: np.ndarray) -> np.ndarray:
    """
    features: (T, 150) raw xyz keypoints before presence mask.
    Center on mid-shoulder and scale by shoulder width.
    """
    # Layout: 8 pose (0:24), left hand (24:87), right hand (87:150)
    out = features.astype(np.float32).copy()
    pose = out[:, 0:24].reshape(-1, 8, 3)
    # indices 0,1 within the 8-pose set are L/R shoulder in our extractor
    left_sh = pose[:, 0, :2]
    right_sh = pose[:, 1, :2]
    mid = (left_sh + right_sh) / 2.0
    shoulder_dist = np.linalg.norm(left_sh - right_sh, axis=1, keepdims=True)
    shoulder_dist = np.maximum(shoulder_dist, 1e-3)

    coords = out.reshape(out.shape[0], -1, 3)
    coords[..., :2] = (coords[..., :2] - mid[:, None, :]) / shoulder_dist[:, None, :]
    coords[..., 2] = coords[..., 2] / shoulder_dist[:, :, 0][:, None]
    return coords.reshape(out.shape[0], -1)


class CSLREngine:
    def __init__(self, device: str | None = None):
        if device is None:
            if torch.backends.mps.is_available():
                device = "mps"
            elif torch.cuda.is_available():
                device = "cuda"
            else:
                device = "cpu"
        self.device = device
        self.model, self.meta = PoseTransformerCSLR.from_pretrained(device=device)
        self.blank_id = self.meta["blank_id"]
        self.id_to_token = self.meta["id_to_token"]

    @torch.inference_mode()
    def predict(self, sequence_153: np.ndarray) -> list[str]:
        """
        sequence_153: (T, 153) float32 — already includes presence mask dims.
        Subsample to ~8 fps equivalent if denser (stride 3 for ~24fps).
        """
        if sequence_153.ndim != 2 or sequence_153.shape[1] != 153:
            raise ValueError(f"Expected (T,153), got {sequence_153.shape}")

        x = sequence_153.astype(np.float32)
        # Effective 8fps if incoming ~24fps
        if x.shape[0] >= 9:
            x = x[::3]

        # Cap length for memory
        max_t = 256
        if x.shape[0] > max_t:
            x = x[-max_t:]

        if x.shape[0] < 4:
            return []

        tensor = torch.from_numpy(x).unsqueeze(0).to(self.device)
        lengths = torch.tensor([x.shape[0]], device=self.device)
        log_probs, lens = self.model(tensor, lengths)
        return decode_ctc(log_probs, self.id_to_token, self.blank_id, lens)
