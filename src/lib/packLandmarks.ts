import {
  LANDMARK_DIM,
  POSE_IDX,
  emptyLandmarkVec,
  type LandmarkFrame,
} from "./landmarkProtocol";

type XYZ = { x: number; y: number; z: number };

function writeJoint(
  out: Float32Array,
  offset: number,
  lm: XYZ | undefined
) {
  if (!lm) return;
  out[offset] = lm.x;
  out[offset + 1] = lm.y;
  out[offset + 2] = lm.z;
}

/**
 * Pack PoseLandmarker + HandLandmarker results into the 153-D vector,
 * normalized by shoulder width when pose is available.
 */
export function packHolisticFrame(
  poseLms: XYZ[] | undefined,
  leftHand: XYZ[] | undefined,
  rightHand: XYZ[] | undefined,
  t: number
): LandmarkFrame {
  const vec = emptyLandmarkVec();
  const poseOk = Boolean(poseLms && poseLms.length >= 25);
  const leftOk = Boolean(leftHand && leftHand.length >= 21);
  const rightOk = Boolean(rightHand && rightHand.length >= 21);

  if (poseOk && poseLms) {
    for (let i = 0; i < POSE_IDX.length; i++) {
      writeJoint(vec, i * 3, poseLms[POSE_IDX[i]]);
    }
  }
  if (leftOk && leftHand) {
    for (let i = 0; i < 21; i++) {
      writeJoint(vec, 24 + i * 3, leftHand[i]);
    }
  }
  if (rightOk && rightHand) {
    for (let i = 0; i < 21; i++) {
      writeJoint(vec, 87 + i * 3, rightHand[i]);
    }
  }

  if (poseOk) {
    const lx = vec[0];
    const ly = vec[1];
    const rx = vec[3];
    const ry = vec[4];
    const mx = (lx + rx) / 2;
    const my = (ly + ry) / 2;
    const scale = Math.max(Math.hypot(lx - rx, ly - ry), 1e-3);
    for (let i = 0; i < 50; i++) {
      const o = i * 3;
      vec[o] = (vec[o] - mx) / scale;
      vec[o + 1] = (vec[o + 1] - my) / scale;
      vec[o + 2] = vec[o + 2] / scale;
    }
  }

  vec[150] = poseOk ? 1 : 0;
  vec[151] = leftOk ? 1 : 0;
  vec[152] = rightOk ? 1 : 0;

  if (vec.length !== LANDMARK_DIM) {
    throw new Error(`Bad landmark dim ${vec.length}`);
  }

  return { t, vec, pose: poseOk, left: leftOk, right: rightOk };
}
