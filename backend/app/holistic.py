"""MediaPipe Holistic → 153-D frame vector for CSLR."""

from __future__ import annotations

import numpy as np

# Upper-body pose subset (8 landmarks) — MediaPipe PoseLandmark indices
# L/R shoulder, elbow, wrist, hip
POSE_IDX = [11, 12, 13, 14, 15, 16, 23, 24]
N_POSE = 8
N_HAND = 21
COORDS = 3
KEYPOINT_DIM = (N_POSE + N_HAND + N_HAND) * COORDS  # 150
FRAME_DIM = KEYPOINT_DIM + 3  # + pose/left/right presence → 153


def _lm_xyz(lms, idx: int) -> tuple[float, float, float]:
    lm = lms[idx]
    return float(lm.x), float(lm.y), float(lm.z)


def _hand_xyz(hand) -> np.ndarray:
    out = np.zeros(N_HAND * COORDS, dtype=np.float32)
    if hand is None:
        return out
    for i in range(N_HAND):
        out[i * 3 : i * 3 + 3] = _lm_xyz(hand.landmark, i)
    return out


def _pose_xyz(pose) -> np.ndarray:
    out = np.zeros(N_POSE * COORDS, dtype=np.float32)
    if pose is None:
        return out
    for j, idx in enumerate(POSE_IDX):
        out[j * 3 : j * 3 + 3] = _lm_xyz(pose.landmark, idx)
    return out


class HolisticExtractor:
    """Wraps classic MediaPipe Holistic solutions API."""

    def __init__(self):
        import mediapipe as mp

        self._mp = mp
        self._holistic = mp.solutions.holistic.Holistic(
            static_image_mode=False,
            model_complexity=1,
            smooth_landmarks=True,
            enable_segmentation=False,
            refine_face_landmarks=False,
            min_detection_confidence=0.5,
            min_tracking_confidence=0.5,
        )

    def close(self):
        self._holistic.close()

    def process_bgr(self, frame_bgr: np.ndarray) -> tuple[np.ndarray, bool, bool, bool]:
        """
        Returns:
          vec: (153,) float32
          pose_ok, left_ok, right_ok
        """
        import cv2

        rgb = cv2.cvtColor(frame_bgr, cv2.COLOR_BGR2RGB)
        rgb.flags.writeable = False
        res = self._holistic.process(rgb)

        pose_ok = res.pose_landmarks is not None
        left_ok = res.left_hand_landmarks is not None
        right_ok = res.right_hand_landmarks is not None

        pose = _pose_xyz(res.pose_landmarks)
        left = _hand_xyz(res.left_hand_landmarks)
        right = _hand_xyz(res.right_hand_landmarks)

        keypoints = np.concatenate([pose, left, right]).astype(np.float32)
        # Normalize single frame relative to shoulders when pose exists
        if pose_ok:
            keypoints = _normalize_frame(keypoints)

        presence = np.array(
            [1.0 if pose_ok else 0.0, 1.0 if left_ok else 0.0, 1.0 if right_ok else 0.0],
            dtype=np.float32,
        )
        vec = np.concatenate([keypoints, presence])
        return vec, pose_ok, left_ok, right_ok


def _normalize_frame(keypoints_150: np.ndarray) -> np.ndarray:
    pose = keypoints_150[0:24].reshape(8, 3)
    left_sh = pose[0, :2]
    right_sh = pose[1, :2]
    mid = (left_sh + right_sh) / 2.0
    scale = float(np.linalg.norm(left_sh - right_sh))
    scale = max(scale, 1e-3)

    coords = keypoints_150.reshape(-1, 3).copy()
    coords[:, :2] = (coords[:, :2] - mid) / scale
    coords[:, 2] = coords[:, 2] / scale
    return coords.reshape(-1)
