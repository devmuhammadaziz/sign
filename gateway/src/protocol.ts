/** Shared binary landmark protocol (must match frontend landmarkProtocol.ts) */

export const MAGIC = 0x44534947;
export const PROTOCOL_VERSION = 1;
export const HEADER_BYTES = 16;
export const LANDMARK_DIM = 153;
export const FRAME_BYTES = HEADER_BYTES + LANDMARK_DIM * 4;

export type DecodedFrame = {
  t: number;
  vec: Float32Array;
  left: boolean;
  right: boolean;
  pose: boolean;
};

export function decodeLandmarkBinary(buf: ArrayBuffer): DecodedFrame | null {
  if (buf.byteLength < FRAME_BYTES) return null;
  const view = new DataView(buf);
  if (view.getUint32(0, true) !== MAGIC) return null;
  if (view.getUint16(4, true) !== PROTOCOL_VERSION) return null;
  const flags = view.getUint16(6, true);
  const t = view.getFloat64(8, true);
  const vec = new Float32Array(buf, HEADER_BYTES, LANDMARK_DIM).slice();
  return {
    t,
    vec,
    left: Boolean(flags & 1),
    right: Boolean(flags & 2),
    pose: Boolean(flags & 4),
  };
}
