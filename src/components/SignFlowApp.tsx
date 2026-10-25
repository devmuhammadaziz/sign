"use client";

import { useSignLanguageTracker } from "@/hooks/useSignLanguageTracker";
import { useSignStore } from "@/store/signStore";

export default function SignFlowApp() {
  const { videoRef, start, stop, isRunning } = useSignLanguageTracker();
  const transcript = useSignStore((s) => s.transcript);
  const liveLetter = useSignStore((s) => s.liveLetter);
  const confidence = useSignStore((s) => s.confidence);
  const handsDetected = useSignStore((s) => s.handsDetected);
  const status = useSignStore((s) => s.status);
  const errorMessage = useSignStore((s) => s.errorMessage);
  const clearTranscript = useSignStore((s) => s.clearTranscript);

  const statusLabel =
    status === "requesting-camera"
      ? "Requesting camera…"
      : status === "loading-mediapipe"
        ? "Loading hand tracker…"
        : status === "ready"
          ? handsDetected
            ? liveLetter
              ? `Seeing: ${liveLetter}`
              : "Hand detected — hold an ASL letter steady"
            : "Show one hand — ASL alphabet A–Z"
          : status === "error"
            ? "Error"
            : "Idle — press Start";

  const showStartOverlay = status === "idle" || status === "error";
  const live = isRunning || status === "loading-mediapipe" || status === "ready";

  return (
    <main className="relative h-dvh w-screen overflow-hidden bg-black text-white">
      <video
        ref={videoRef}
        className="absolute inset-0 h-full w-full object-cover scale-x-[-1] bg-black"
        playsInline
        muted
        autoPlay
        aria-label="Camera for ASL alphabet"
      />

      <div
        className="pointer-events-none absolute inset-x-0 bottom-0 h-[40%] bg-gradient-to-t from-black/90 via-black/50 to-transparent"
        aria-hidden
      />

      {showStartOverlay && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/75 px-6 backdrop-blur-sm">
          <div className="max-w-md text-center">
            <p className="text-xs font-medium tracking-[0.25em] text-white/50 uppercase">
              ASL Alphabet
            </p>
            <h1 className="mt-3 text-2xl font-semibold tracking-tight sm:text-3xl">
              Letter by letter
            </h1>
            <p className="mt-3 text-sm leading-relaxed text-white/70">
              {errorMessage ||
                "Hold up one ASL fingerspelling handshape (A–Z). Keep it steady for about half a second — we’ll show that letter."}
            </p>
            <button
              type="button"
              onClick={() => void start()}
              className="mt-6 rounded-lg bg-white px-6 py-3 text-sm font-semibold text-black transition hover:bg-white/90"
            >
              Start camera
            </button>
            <p className="mt-4 text-xs text-white/40">
              Tip: good light, one hand, palm facing camera
            </p>
          </div>
        </div>
      )}

      <header className="absolute inset-x-0 top-0 z-10 flex items-start justify-between gap-4 p-4 sm:p-6">
        <div>
          <p className="text-xs font-medium tracking-[0.2em] text-white/55 uppercase">
            ASL Letters
          </p>
          <p className="mt-1 text-sm text-white/85">{statusLabel}</p>
        </div>
        <div className="flex items-center gap-2">
          <span
            className={`h-2.5 w-2.5 rounded-full ${
              handsDetected && liveLetter
                ? "bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.8)]"
                : handsDetected
                  ? "bg-amber-400"
                  : "bg-white/30"
            }`}
            aria-hidden
          />
          <button
            type="button"
            onClick={clearTranscript}
            className="rounded-md border border-white/20 bg-black/40 px-3 py-1.5 text-sm backdrop-blur-sm transition hover:bg-black/60"
          >
            Clear
          </button>
          {live && status !== "error" ? (
            <button
              type="button"
              onClick={stop}
              className="rounded-md border border-white/20 bg-black/40 px-3 py-1.5 text-sm backdrop-blur-sm transition hover:bg-black/60"
            >
              Stop
            </button>
          ) : (
            <button
              type="button"
              onClick={() => void start()}
              className="rounded-md border border-white/20 bg-white/15 px-3 py-1.5 text-sm transition hover:bg-white/25"
            >
              Start
            </button>
          )}
        </div>
      </header>

      {/* Big live letter */}
      {status === "ready" && (
        <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center">
          <p
            className={`select-none text-[min(40vw,14rem)] font-bold leading-none tracking-tight transition-all ${
              liveLetter ? "text-white/90" : "text-white/15"
            }`}
            style={{ textShadow: "0 8px 40px rgba(0,0,0,0.65)" }}
            aria-live="polite"
          >
            {liveLetter || "?"}
          </p>
        </div>
      )}

      <section className="absolute inset-x-0 bottom-0 z-10 px-4 pb-6 sm:px-10 sm:pb-8">
        <div className="mx-auto w-full max-w-3xl rounded-lg bg-black/60 px-5 py-4 backdrop-blur-md sm:px-8">
          <p className="text-center text-xs tracking-wide text-white/40 uppercase">
            Spelled so far
            {liveLetter
              ? ` · holding ${liveLetter} (${Math.round(confidence * 100)}%)`
              : ""}
          </p>
          <p
            className="mt-2 min-h-[1.5em] text-center font-mono text-3xl font-semibold tracking-[0.2em] text-white sm:text-4xl"
            style={{ textShadow: "0 2px 12px rgba(0,0,0,0.8)" }}
          >
            {transcript || (
              <span className="font-sans text-lg tracking-normal text-white/35">
                Hold a letter steady to add it…
              </span>
            )}
          </p>
        </div>
      </section>
    </main>
  );
}
