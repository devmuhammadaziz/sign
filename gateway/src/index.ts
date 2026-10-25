import { Elysia } from "elysia";
import { decodeLandmarkBinary } from "./protocol";
import { SlidingWindow } from "./slidingWindow";

const PORT = Number(process.env.GATEWAY_PORT ?? 3001);
const AI_URL = process.env.AI_URL ?? "http://127.0.0.1:8000";
const WINDOW_SIZE = Number(process.env.WINDOW_SIZE ?? 45);
const INFER_EVERY_MS = Number(process.env.INFER_EVERY_MS ?? 400);
const MIN_FRAMES = Number(process.env.MIN_FRAMES ?? 12);

type ClientState = {
  window: SlidingWindow;
  lastInferAt: number;
  inferring: boolean;
  lastSigning: boolean;
};

const clients = new Map<object, ClientState>();

async function callInfer(matrix: {
  data: number[];
  T: number;
  D: number;
}): Promise<{
  intent: "SIGNING" | "IGNORE";
  speculative?: string;
  confirmed?: string;
  glosses?: string[];
}> {
  const res = await fetch(`${AI_URL}/infer`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      T: matrix.T,
      D: matrix.D,
      landmarks: matrix.data,
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`AI /infer ${res.status}: ${text}`);
  }
  return res.json();
}

function bufferFromMessage(message: unknown): Buffer | null {
  if (typeof Buffer !== "undefined" && Buffer.isBuffer(message)) {
    return message;
  }
  if (message instanceof ArrayBuffer) {
    return Buffer.from(message);
  }
  if (ArrayBuffer.isView(message)) {
    const v = message as ArrayBufferView;
    return Buffer.from(v.buffer, v.byteOffset, v.byteLength);
  }
  return null;
}

new Elysia()
  .get("/health", async () => {
    let ai: unknown = null;
    try {
      const r = await fetch(`${AI_URL}/health`);
      ai = await r.json();
    } catch (e) {
      ai = { ok: false, error: String(e) };
    }
    return { ok: true, service: "deepsign-gateway", ai };
  })
  .ws("/ws", {
    open(ws) {
      clients.set(ws.raw, {
        window: new SlidingWindow(WINDOW_SIZE),
        lastInferAt: 0,
        inferring: false,
        lastSigning: false,
      });
      ws.send(JSON.stringify({ type: "ready", gateway: "bun-elysia" }));
    },
    async message(ws, message) {
      const state = clients.get(ws.raw);
      if (!state) return;

      if (typeof message === "string") {
        try {
          const j = JSON.parse(message);
          if (j.type === "ping") {
            ws.send(JSON.stringify({ type: "pong" }));
            return;
          }
          if (j.type === "reset") {
            state.window.clear();
            ws.send(JSON.stringify({ type: "clear" }));
            return;
          }
        } catch {
          /* ignore */
        }
        return;
      }

      const nodeBuf = bufferFromMessage(message);
      if (!nodeBuf) return;

      // Copy into a clean ArrayBuffer for DataView
      const ab = nodeBuf.buffer.slice(
        nodeBuf.byteOffset,
        nodeBuf.byteOffset + nodeBuf.byteLength
      ) as ArrayBuffer;
      const frame = decodeLandmarkBinary(ab);
      if (!frame) return;

      state.window.push(frame);

      const now = Date.now();
      if (
        state.inferring ||
        state.window.length < MIN_FRAMES ||
        now - state.lastInferAt < INFER_EVERY_MS
      ) {
        return;
      }

      state.inferring = true;
      state.lastInferAt = now;
      const matrix = state.window.toMatrix();

      try {
        const result = await callInfer(matrix);
        const signing = result.intent === "SIGNING";
        if (signing !== state.lastSigning) {
          state.lastSigning = signing;
          ws.send(JSON.stringify({ type: "gate", signing }));
        }
        if (result.speculative) {
          ws.send(
            JSON.stringify({
              type: "speculative",
              token: result.speculative,
            })
          );
        }
        if (result.confirmed) {
          ws.send(
            JSON.stringify({
              type: "confirmed",
              token: result.confirmed,
              glosses: result.glosses ?? [],
            })
          );
          state.window.clear();
        }
      } catch (e) {
        ws.send(
          JSON.stringify({
            type: "error",
            message: e instanceof Error ? e.message : "Infer failed",
          })
        );
      } finally {
        state.inferring = false;
      }
    },
    close(ws) {
      clients.delete(ws.raw);
    },
  })
  .listen(PORT);

console.log(
  `DeepSign gateway (Bun+Elysia) → ws://127.0.0.1:${PORT}/ws  AI=${AI_URL}`
);
