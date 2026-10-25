"use client";

import {
  FilesetResolver,
  HandLandmarker,
  type NormalizedLandmark,
} from "@mediapipe/tasks-vision";
import type { Landmark } from "./aslAlphabet";

const WASM =
  "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.1.1/wasm";
const HAND_MODEL =
  "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task";

export class HandOnlyTracker {
  private hands: HandLandmarker | null = null;
  private lastTs = -1;

  async init() {
    const vision = await FilesetResolver.forVisionTasks(WASM);
    try {
      this.hands = await HandLandmarker.createFromOptions(vision, {
        baseOptions: { modelAssetPath: HAND_MODEL, delegate: "GPU" },
        runningMode: "VIDEO",
        numHands: 1,
      });
    } catch {
      this.hands = await HandLandmarker.createFromOptions(vision, {
        baseOptions: { modelAssetPath: HAND_MODEL, delegate: "CPU" },
        runningMode: "VIDEO",
        numHands: 1,
      });
    }
  }

  detect(video: HTMLVideoElement, timestampMs: number): Landmark[] | null {
    if (!this.hands) return null;
    if (timestampMs <= this.lastTs) return null;
    this.lastTs = timestampMs;

    const res = this.hands.detectForVideo(video, timestampMs);
    const lm = res.landmarks?.[0] as NormalizedLandmark[] | undefined;
    if (!lm || lm.length < 21) return null;
    return lm.map((p) => ({ x: p.x, y: p.y, z: p.z }));
  }

  close() {
    this.hands?.close();
    this.hands = null;
  }
}
