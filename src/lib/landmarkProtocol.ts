/**
 * DeepSign OS landmark wire protocol.
 * Client extracts MediaPipe Holistic-equivalent coords and streams
 * Float32 features — never raw video — to the Bun gateway.
 *
 * Layout (153 floats), matching the Python CSLR front-end:
 *   [0:24)   8 pose joints × xyz   (shoulders, elbows, wrists, hips)
 *   [24:87)  left hand 21 × xyz
 *   [87:150) right hand 21 × xyz
 *   [150:153) presence mask [pose, left, right]
 */

export const LANDMARK_DIM = 153;
export const POSE_IDX = [11, 12, 13, 14, 15, 16, 23, 24] as const;
export const MAGIC = 0x44534947; // "DSIG"
export const PROTOCOL_VERSION = 1;
export const HEADER_BYTES = 16;
export const FRAME_BYTES = HEADER_BYTES + LANDMARK_DIM * 4; // 628

export type LandmarkFrame = {
  t: number;
  vec: Float32Array; // length 153
  pose: boolean;
  left: boolean;
  right: boolean;
};

export function encodeLandmarkBinary(frame: LandmarkFrame): ArrayBuffer {
  const buf = new ArrayBuffer(FRAME_BYTES);
  const view = new DataView(buf);
  view.setUint32(0, MAGIC, true);
  view.setUint16(4, PROTOCOL_VERSION, true);
  let flags = 0;
  if (frame.left) flags |= 1;
  if (frame.right) flags |= 2;
  if (frame.pose) flags |= 4;
  view.setUint16(6, flags, true);
  view.setFloat64(8, frame.t, true);
  const floats = new Float32Array(buf, HEADER_BYTES, LANDMARK_DIM);
  floats.set(frame.vec);
  return buf;
}

export function emptyLandmarkVec(): Float32Array {
  return new Float32Array(LANDMARK_DIM);
}
