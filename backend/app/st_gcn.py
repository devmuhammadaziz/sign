"""
Mock ST-GCN / temporal backbone sketch for DeepSign OS.

Production inference currently uses PoseTransformerCSLR (How2Sign CTC).
This module documents the (batch, frames, joints, coords) tensor contract
and a drop-in PyTorch stub you can swap behind DeepSignPipeline later.
"""

from __future__ import annotations

import torch
import torch.nn as nn


class STGCNBlock(nn.Module):
    def __init__(self, in_channels: int, out_channels: int, stride: int = 1):
        super().__init__()
        # Spatial graph conv approximated as 1x1 on joints, then temporal conv
        self.spatial = nn.Conv2d(in_channels, out_channels, kernel_size=1)
        self.temporal = nn.Conv2d(
            out_channels,
            out_channels,
            kernel_size=(9, 1),
            padding=(4, 0),
            stride=(stride, 1),
        )
        self.bn = nn.BatchNorm2d(out_channels)
        self.act = nn.ReLU(inplace=True)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        # x: (N, C, T, V)
        x = self.spatial(x)
        x = self.temporal(x)
        return self.act(self.bn(x))


class STGCNEncoder(nn.Module):
    """
    Input:  (B, T, V, C)  e.g. (batch, 45, 50, 3) joints×xyz
    Output: (B, T', num_classes) frame-wise logits for CTC
    """

    def __init__(self, num_joints: int = 50, in_coords: int = 3, num_classes: int = 1354):
        super().__init__()
        self.stem = nn.Conv2d(in_coords, 64, kernel_size=1)
        self.blocks = nn.Sequential(
            STGCNBlock(64, 64),
            STGCNBlock(64, 128, stride=2),
            STGCNBlock(128, 256, stride=2),
        )
        self.head = nn.Conv2d(256, num_classes, kernel_size=1)
        self.num_joints = num_joints

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        # (B,T,V,C) -> (B,C,T,V)
        x = x.permute(0, 3, 1, 2).contiguous()
        x = self.stem(x)
        x = self.blocks(x)
        x = self.head(x)  # (B, classes, T', V)
        x = x.mean(dim=-1)  # pool joints → (B, classes, T')
        return x.permute(0, 2, 1).contiguous()


def window_to_joint_tensor(window_153: torch.Tensor) -> torch.Tensor:
    """
    Convert DeepSign 153-D frames (B,T,153) → (B,T,50,3) joint tensor
    (drops the 3-D presence mask).
    """
    kp = window_153[..., :150]
    return kp.reshape(*kp.shape[:-1], 50, 3)
