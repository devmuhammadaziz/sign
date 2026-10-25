"use client";

import { create } from "zustand";

export type TrackerStatus =
  | "idle"
  | "requesting-camera"
  | "loading-mediapipe"
  | "ready"
  | "error";

interface SignState {
  /** Spelled text built from confirmed letters */
  transcript: string;
  /** Live letter being held (preview) */
  liveLetter: string;
  confidence: number;
  handsDetected: boolean;
  status: TrackerStatus;
  errorMessage: string | null;
  setLiveLetter: (letter: string, confidence?: number) => void;
  appendLetter: (letter: string) => void;
  clearTranscript: () => void;
  setHandsDetected: (detected: boolean) => void;
  setStatus: (status: TrackerStatus, errorMessage?: string | null) => void;
}

export const useSignStore = create<SignState>((set, get) => ({
  transcript: "",
  liveLetter: "",
  confidence: 0,
  handsDetected: false,
  status: "idle",
  errorMessage: null,

  setLiveLetter: (letter, confidence = 0) =>
    set({ liveLetter: letter, confidence }),

  appendLetter: (letter) => {
    const L = letter.trim().toUpperCase();
    if (!L || L.length !== 1) return;
    const { transcript } = get();
    // Cooldown in the tracker prevents spam; allow doubles like "BOOK"
    set({ transcript: transcript + L, liveLetter: L });
  },

  clearTranscript: () => set({ transcript: "", liveLetter: "", confidence: 0 }),

  setHandsDetected: (detected) => set({ handsDetected: detected }),

  setStatus: (status, errorMessage = null) => set({ status, errorMessage }),
}));
