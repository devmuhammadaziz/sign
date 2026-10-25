"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { classifyASLLetter } from "@/lib/aslAlphabet";
import { HandOnlyTracker } from "@/lib/handOnly";
import { useSignStore } from "@/store/signStore";

const FRAME_MS = 1000 / 30;
/** Same letter must win this many consecutive frames before confirm */
const STABLE_FRAMES = 12;
/** After confirming a letter, ignore repeats briefly */
const COOLDOWN_MS = 900;

export type UseSignLanguageTrackerResult = {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  start: () => Promise<void>;
  stop: () => void;
  isRunning: boolean;
};

export function useSignLanguageTracker(): UseSignLanguageTrackerResult {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const trackerRef = useRef<HandOnlyTracker | null>(null);
  const rafRef = useRef<number | null>(null);
  const lastDetectRef = useRef(0);
  const sessionRef = useRef(0);
  const runningRef = useRef(false);
  const tickRef = useRef<() => void>(() => {});

  const stableLetterRef = useRef<string>("");
  const stableCountRef = useRef(0);
  const lastConfirmedRef = useRef<{ letter: string; at: number } | null>(null);

  const [isRunning, setIsRunning] = useState(false);

  const setLiveLetter = useSignStore((s) => s.setLiveLetter);
  const appendLetter = useSignStore((s) => s.appendLetter);
  const setHandsDetected = useSignStore((s) => s.setHandsDetected);
  const setStatus = useSignStore((s) => s.setStatus);

  const stopLoop = useCallback(() => {
    if (rafRef.current != null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  }, []);

  const stop = useCallback(() => {
    sessionRef.current += 1;
    runningRef.current = false;
    setIsRunning(false);
    stopLoop();

    trackerRef.current?.close();
    trackerRef.current = null;

    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;

    stableLetterRef.current = "";
    stableCountRef.current = 0;
    setLiveLetter("");
    setHandsDetected(false);
    setStatus("idle");
  }, [setHandsDetected, setLiveLetter, setStatus, stopLoop]);

  useEffect(() => {
    tickRef.current = () => {
      if (!runningRef.current) return;
      const video = videoRef.current;
      const tracker = trackerRef.current;
      const now = performance.now();

      if (
        video &&
        tracker &&
        video.readyState >= 2 &&
        now - lastDetectRef.current >= FRAME_MS
      ) {
        lastDetectRef.current = now;
        const landmarks = tracker.detect(video, now);
        const hasHand = Boolean(landmarks);
        setHandsDetected(hasHand);

        if (!hasHand) {
          stableLetterRef.current = "";
          stableCountRef.current = 0;
          setLiveLetter("");
        } else {
          const result = classifyASLLetter(landmarks!, 0.52);
          if (!result) {
            stableCountRef.current = 0;
            setLiveLetter("");
          } else {
            setLiveLetter(result.letter, result.confidence);

            if (result.letter === stableLetterRef.current) {
              stableCountRef.current += 1;
            } else {
              stableLetterRef.current = result.letter;
              stableCountRef.current = 1;
            }

            if (stableCountRef.current >= STABLE_FRAMES) {
              const last = lastConfirmedRef.current;
              const cooled =
                !last ||
                last.letter !== result.letter ||
                now - last.at >= COOLDOWN_MS;

              if (cooled) {
                appendLetter(result.letter);
                lastConfirmedRef.current = { letter: result.letter, at: now };
                stableCountRef.current = 0;
              }
            }
          }
        }
      }

      rafRef.current = requestAnimationFrame(() => tickRef.current());
    };
  }, [appendLetter, setHandsDetected, setLiveLetter]);

  const start = useCallback(async () => {
    if (runningRef.current) return;
    const session = ++sessionRef.current;

    try {
      setStatus("requesting-camera");
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: "user",
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      });
      if (session !== sessionRef.current) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }

      streamRef.current = stream;
      const video = videoRef.current;
      if (!video) throw new Error("Video element missing — press Start again.");
      video.srcObject = stream;
      video.muted = true;
      await video.play();

      setStatus("loading-mediapipe");
      const tracker = new HandOnlyTracker();
      await tracker.init();
      if (session !== sessionRef.current) {
        tracker.close();
        return;
      }
      trackerRef.current = tracker;

      runningRef.current = true;
      setIsRunning(true);
      setStatus("ready");
      rafRef.current = requestAnimationFrame(() => tickRef.current());
    } catch (err) {
      if (session !== sessionRef.current) return;
      const message = err instanceof Error ? err.message : "Failed to start";
      stop();
      setStatus("error", message);
    }
  }, [setStatus, stop]);

  useEffect(() => {
    return () => {
      sessionRef.current += 1;
      runningRef.current = false;
      stopLoop();
      trackerRef.current?.close();
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, [stopLoop]);

  return { videoRef, start, stop, isRunning };
}
