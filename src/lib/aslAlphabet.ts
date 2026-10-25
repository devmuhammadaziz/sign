/**
 * ASL fingerspelling alphabet (A–Z) from MediaPipe 21 hand landmarks.
 * Static handshape geometry + scores — hold steady for confirmation.
 */

export type Landmark = { x: number; y: number; z: number };

export type LetterResult = {
  letter: string;
  confidence: number;
};

// Landmark indices
const WRIST = 0;
const THUMB_MCP = 2;
const THUMB_TIP = 4;
const INDEX_MCP = 5;
const INDEX_PIP = 6;
const INDEX_TIP = 8;
const MIDDLE_MCP = 9;
const MIDDLE_PIP = 10;
const MIDDLE_TIP = 12;
const RING_MCP = 13;
const RING_PIP = 14;
const RING_TIP = 16;
const PINKY_MCP = 17;
const PINKY_PIP = 18;
const PINKY_TIP = 20;

function dist(a: Landmark, b: Landmark) {
  return Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
}

function fingerExtended(lms: Landmark[], tip: number, pip: number) {
  // Tip farther from wrist than PIP, and tip "above" PIP in image (lower y)
  const tipD = dist(lms[tip], lms[WRIST]);
  const pipD = dist(lms[pip], lms[WRIST]);
  const up = lms[tip].y < lms[pip].y - 0.02;
  return tipD > pipD * 1.05 && up;
}

function fingerCurled(lms: Landmark[], tip: number, pip: number) {
  return lms[tip].y > lms[pip].y - 0.01;
}

function thumbUp(lms: Landmark[]) {
  // Thumb tip above MCP (for upright hand)
  return lms[THUMB_TIP].y < lms[THUMB_MCP].y - 0.02;
}

function thumbOut(lms: Landmark[]) {
  // Thumb extended sideways away from palm
  const palm = dist(lms[THUMB_TIP], lms[INDEX_MCP]);
  return palm > dist(lms[THUMB_MCP], lms[INDEX_MCP]) * 1.15;
}

function tipsClose(a: Landmark, b: Landmark, thresh = 0.06) {
  return dist(a, b) < thresh;
}

type FingerState = {
  thumbExt: boolean;
  indexExt: boolean;
  middleExt: boolean;
  ringExt: boolean;
  pinkyExt: boolean;
  indexCurl: boolean;
  middleCurl: boolean;
  ringCurl: boolean;
  pinkyCurl: boolean;
  thumbSide: boolean;
  okCircle: boolean; // thumb tip near index tip
  indexMiddleClose: boolean;
  crossedRM: boolean; // rough R: index/middle tips crossed
};

function analyze(lms: Landmark[]): FingerState {
  return {
    thumbExt: thumbUp(lms) || thumbOut(lms),
    indexExt: fingerExtended(lms, INDEX_TIP, INDEX_PIP),
    middleExt: fingerExtended(lms, MIDDLE_TIP, MIDDLE_PIP),
    ringExt: fingerExtended(lms, RING_TIP, RING_PIP),
    pinkyExt: fingerExtended(lms, PINKY_TIP, PINKY_PIP),
    indexCurl: fingerCurled(lms, INDEX_TIP, INDEX_PIP),
    middleCurl: fingerCurled(lms, MIDDLE_TIP, MIDDLE_PIP),
    ringCurl: fingerCurled(lms, RING_TIP, RING_PIP),
    pinkyCurl: fingerCurled(lms, PINKY_TIP, PINKY_PIP),
    thumbSide: thumbOut(lms),
    okCircle: tipsClose(lms[THUMB_TIP], lms[INDEX_TIP], 0.07),
    indexMiddleClose:
      dist(lms[INDEX_TIP], lms[MIDDLE_TIP]) <
      dist(lms[INDEX_MCP], lms[MIDDLE_MCP]) * 0.9,
    crossedRM:
      Math.abs(lms[INDEX_TIP].x - lms[MIDDLE_TIP].x) < 0.03 &&
      fingerExtended(lms, INDEX_TIP, INDEX_PIP) &&
      fingerExtended(lms, MIDDLE_TIP, MIDDLE_PIP),
  };
}

type Rule = {
  letter: string;
  score: (s: FingerState, lms: Landmark[]) => number;
};

const RULES: Rule[] = [
  {
    letter: "A",
    score: (s) => {
      // Fist, thumb beside (not over fingers)
      let sc = 0;
      if (s.indexCurl && s.middleCurl && s.ringCurl && s.pinkyCurl) sc += 0.55;
      if (s.thumbSide || s.thumbExt) sc += 0.35;
      if (!s.indexExt && !s.middleExt) sc += 0.1;
      return sc;
    },
  },
  {
    letter: "B",
    score: (s, lms) => {
      // Four fingers up, thumb folded across palm
      let sc = 0;
      if (s.indexExt && s.middleExt && s.ringExt && s.pinkyExt) sc += 0.7;
      if (!s.thumbSide && lms[THUMB_TIP].x > lms[INDEX_MCP].x - 0.05) sc += 0.2;
      if (!s.thumbExt) sc += 0.1;
      return sc;
    },
  },
  {
    letter: "C",
    score: (s, lms) => {
      // Curved C — tips not touching, fingers bent mid
      const open =
        dist(lms[THUMB_TIP], lms[INDEX_TIP]) > 0.08 &&
        dist(lms[THUMB_TIP], lms[INDEX_TIP]) < 0.22;
      const midBend =
        lms[INDEX_TIP].y > lms[INDEX_MCP].y - 0.08 &&
        !s.indexCurl &&
        !s.indexExt;
      let sc = 0;
      if (open) sc += 0.45;
      if (midBend || (!s.indexExt && !s.indexCurl)) sc += 0.35;
      if (!s.okCircle) sc += 0.1;
      return sc;
    },
  },
  {
    letter: "D",
    score: (s, lms) => {
      // Index up, others curled, thumb touches middle
      let sc = 0;
      if (s.indexExt && !s.middleExt && !s.ringExt && !s.pinkyExt) sc += 0.55;
      if (s.middleCurl && s.ringCurl && s.pinkyCurl) sc += 0.25;
      if (tipsClose(lms[THUMB_TIP], lms[MIDDLE_TIP], 0.1)) sc += 0.2;
      return sc;
    },
  },
  {
    letter: "E",
    score: (s, lms) => {
      // Fist, thumb tucked against fingers
      let sc = 0;
      if (s.indexCurl && s.middleCurl && s.ringCurl && s.pinkyCurl) sc += 0.5;
      if (!s.thumbSide && lms[THUMB_TIP].y > lms[INDEX_TIP].y - 0.05) sc += 0.35;
      if (!s.thumbExt) sc += 0.15;
      return sc;
    },
  },
  {
    letter: "F",
    score: (s) => {
      // OK circle + other three up
      let sc = 0;
      if (s.okCircle) sc += 0.5;
      if (s.middleExt && s.ringExt && s.pinkyExt) sc += 0.4;
      if (!s.indexExt) sc += 0.1;
      return sc;
    },
  },
  {
    letter: "G",
    score: (s, lms) => {
      // Index pointing sideways, thumb parallel
      const sideways =
        Math.abs(lms[INDEX_TIP].x - lms[INDEX_MCP].x) >
        Math.abs(lms[INDEX_TIP].y - lms[INDEX_MCP].y);
      let sc = 0;
      if (s.indexExt && !s.middleExt && !s.ringExt && !s.pinkyExt) sc += 0.4;
      if (sideways) sc += 0.35;
      if (s.thumbExt || s.thumbSide) sc += 0.2;
      return sc;
    },
  },
  {
    letter: "H",
    score: (s, lms) => {
      const sideways =
        Math.abs(lms[INDEX_TIP].x - lms[INDEX_MCP].x) >
        Math.abs(lms[INDEX_TIP].y - lms[INDEX_MCP].y) * 0.8;
      let sc = 0;
      if (s.indexExt && s.middleExt && !s.ringExt && !s.pinkyExt) sc += 0.5;
      if (s.indexMiddleClose) sc += 0.2;
      if (sideways) sc += 0.25;
      return sc;
    },
  },
  {
    letter: "I",
    score: (s) => {
      let sc = 0;
      if (s.pinkyExt && !s.indexExt && !s.middleExt && !s.ringExt) sc += 0.75;
      if (s.indexCurl && s.middleCurl && s.ringCurl) sc += 0.2;
      return sc;
    },
  },
  {
    letter: "K",
    score: (s, lms) => {
      // Index + middle up, thumb between
      let sc = 0;
      if (s.indexExt && s.middleExt && !s.ringExt && !s.pinkyExt) sc += 0.5;
      if (!s.indexMiddleClose) sc += 0.2;
      if (
        lms[THUMB_TIP].y < lms[MIDDLE_PIP].y &&
        lms[THUMB_TIP].y > lms[INDEX_MCP].y
      )
        sc += 0.25;
      return sc;
    },
  },
  {
    letter: "L",
    score: (s) => {
      let sc = 0;
      if (s.indexExt && (s.thumbExt || s.thumbSide) && !s.middleExt) sc += 0.6;
      if (!s.ringExt && !s.pinkyExt) sc += 0.25;
      if (s.middleCurl) sc += 0.1;
      return sc;
    },
  },
  {
    letter: "O",
    score: (s, lms) => {
      const circle = tipsClose(lms[THUMB_TIP], lms[INDEX_TIP], 0.08);
      let sc = 0;
      if (circle || s.okCircle) sc += 0.45;
      if (!s.indexExt && !s.middleExt && !s.ringExt && !s.pinkyExt) sc += 0.35;
      if (dist(lms[THUMB_TIP], lms[MIDDLE_TIP]) < 0.1) sc += 0.15;
      return sc;
    },
  },
  {
    letter: "R",
    score: (s) => {
      let sc = 0;
      if (s.indexExt && s.middleExt && !s.ringExt && !s.pinkyExt) sc += 0.45;
      if (s.crossedRM || s.indexMiddleClose) sc += 0.4;
      return sc;
    },
  },
  {
    letter: "S",
    score: (s, lms) => {
      let sc = 0;
      if (s.indexCurl && s.middleCurl && s.ringCurl && s.pinkyCurl) sc += 0.5;
      // Thumb over fingers
      if (lms[THUMB_TIP].y < lms[INDEX_PIP].y && !s.thumbSide) sc += 0.4;
      return sc;
    },
  },
  {
    letter: "T",
    score: (s, lms) => {
      let sc = 0;
      if (s.indexCurl && s.middleCurl && s.ringCurl && s.pinkyCurl) sc += 0.4;
      // Thumb between index and middle
      if (
        lms[THUMB_TIP].x > lms[INDEX_PIP].x &&
        lms[THUMB_TIP].x < lms[MIDDLE_PIP].x
      )
        sc += 0.45;
      return sc;
    },
  },
  {
    letter: "U",
    score: (s) => {
      let sc = 0;
      if (s.indexExt && s.middleExt && !s.ringExt && !s.pinkyExt) sc += 0.55;
      if (s.indexMiddleClose) sc += 0.35;
      return sc;
    },
  },
  {
    letter: "V",
    score: (s) => {
      let sc = 0;
      if (s.indexExt && s.middleExt && !s.ringExt && !s.pinkyExt) sc += 0.55;
      if (!s.indexMiddleClose) sc += 0.4;
      return sc;
    },
  },
  {
    letter: "W",
    score: (s) => {
      let sc = 0;
      if (s.indexExt && s.middleExt && s.ringExt && !s.pinkyExt) sc += 0.85;
      return sc;
    },
  },
  {
    letter: "X",
    score: (s, lms) => {
      // Hooked index
      const hooked =
        lms[INDEX_TIP].y > lms[INDEX_PIP].y - 0.02 &&
        lms[INDEX_PIP].y < lms[INDEX_MCP].y;
      let sc = 0;
      if (hooked && !s.middleExt && !s.ringExt && !s.pinkyExt) sc += 0.7;
      if (s.indexCurl || hooked) sc += 0.15;
      return sc;
    },
  },
  {
    letter: "Y",
    score: (s) => {
      let sc = 0;
      if (s.pinkyExt && (s.thumbExt || s.thumbSide) && !s.indexExt && !s.middleExt)
        sc += 0.75;
      if (!s.ringExt) sc += 0.15;
      return sc;
    },
  },
];

/**
 * Classify one hand's 21 landmarks into A–Z (best score).
 * Returns null if confidence is too low / no hand.
 */
export function classifyASLLetter(
  landmarks: Landmark[] | undefined,
  minConfidence = 0.55
): LetterResult | null {
  if (!landmarks || landmarks.length < 21) return null;

  const state = analyze(landmarks);
  let best: LetterResult = { letter: "?", confidence: 0 };

  for (const rule of RULES) {
    const confidence = Math.min(1, Math.max(0, rule.score(state, landmarks)));
    if (confidence > best.confidence) {
      best = { letter: rule.letter, confidence };
    }
  }

  if (best.confidence < minConfidence || best.letter === "?") return null;
  return best;
}
