import type { DecodedFrame } from "./protocol";

export type WindowSnapshot = {
  frames: Float32Array[]; // each length 153
  timestamps: number[];
  left: boolean;
  right: boolean;
  pose: boolean;
};

/**
 * Per-connection rolling buffer of landmark frames (30–60 @ ~30fps ≈ 1–2s).
 */
export class SlidingWindow {
  readonly maxFrames: number;
  private frames: DecodedFrame[] = [];

  constructor(maxFrames = 45) {
    this.maxFrames = maxFrames;
  }

  push(frame: DecodedFrame) {
    this.frames.push(frame);
    if (this.frames.length > this.maxFrames) {
      this.frames.shift();
    }
  }

  clear() {
    this.frames = [];
  }

  get length() {
    return this.frames.length;
  }

  latest(): DecodedFrame | undefined {
    return this.frames[this.frames.length - 1];
  }

  snapshot(): WindowSnapshot {
    const last = this.latest();
    return {
      frames: this.frames.map((f) => f.vec),
      timestamps: this.frames.map((f) => f.t),
      left: last?.left ?? false,
      right: last?.right ?? false,
      pose: last?.pose ?? false,
    };
  }

  /** Flatten to row-major Float32Array [T * 153] for Python */
  toMatrix(): { data: number[]; T: number; D: number } {
    const T = this.frames.length;
    const D = 153;
    const data = new Array<number>(T * D);
    let i = 0;
    for (const f of this.frames) {
      for (let j = 0; j < D; j++) data[i++] = f.vec[j];
    }
    return { data, T, D };
  }
}
