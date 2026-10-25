"use client";

import {
  FilesetResolver,
  HandLandmarker,
  PoseLandmarker,
  type NormalizedLandmark,
} from "@mediapipe/tasks-vision";
import { packHolisticFrame } from "./packLandmarks";
import type { LandmarkFrame } from "./landmarkProtocol";

const WASM =
  "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.1.1/wasm";
const HAND_MODEL =
  "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task";
const POSE_MODEL =
  "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task";

function toXYZ(lms: NormalizedLandmark[] | undefined) {
  if (!lms) return undefined;
  return lms.map((lm) => ({ x: lm.x, y: lm.y, z: lm.z }));
}

/**
 * Client-side Holistic-equivalent extractor (Pose + Hands on GPU/WASM).
 * Video never leaves the browser — only packed landmark vectors stream out.
 */
export class ClientHolistic {
  private hands: HandLandmarker | null = null;
  private pose: PoseLandmarker | null = null;
  private lastTs = -1;

  async init() {
    const vision = await FilesetResolver.forVisionTasks(WASM);
    const [hands, pose] = await Promise.all([
      HandLandmarker.createFromOptions(vision, {
        baseOptions: { modelAssetPath: HAND_MODEL, delegate: "GPU" },
        runningMode: "VIDEO",
        numHands: 2,
      }),
      PoseLandmarker.createFromOptions(vision, {
        baseOptions: { modelAssetPath: POSE_MODEL, delegate: "GPU" },
        runningMode: "VIDEO",
        numPoses: 1,
      }),
    ]);
    this.hands = hands;
    this.pose = pose;
  }

  detect(video: HTMLVideoElement, timestampMs: number): LandmarkFrame | null {
    if (!this.hands || !this.pose) return null;
    if (timestampMs <= this.lastTs) return null;
    this.lastTs = timestampMs;

    const handRes = this.hands.detectForVideo(video, timestampMs);
    const poseRes = this.pose.detectForVideo(video, timestampMs);

    const poseLms = toXYZ(poseRes.landmarks?.[0]);

    // MediaPipe may return hands without stable left/right; use handedness.
    let left: ReturnType<typeof toXYZ>;
    let right: ReturnType<typeof toXYZ>;
    const landmarks = handRes.landmarks ?? [];
    const handedness = handRes.handednesses ?? [];

    for (let i = 0; i < landmarks.length; i++) {
      const label = handedness[i]?.[0]?.categoryName?.toLowerCase() ?? "";
      const pts = toXYZ(landmarks[i]);
      // Mirrored selfie: MediaPipe "Left" is the person's left (screen-right)
      if (label.includes("left")) left = pts;
      else if (label.includes("right")) right = pts;
      else if (!right) right = pts;
      else left = pts;
    }

    return packHolisticFrame(poseLms, left, right, timestampMs);
  }

  close() {
    this.hands?.close();
    this.pose?.close();
    this.hands = null;
    this.pose = null;
  }
}
