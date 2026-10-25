# DeepSign Gateway (Bun + Elysia)

Ingests **binary landmark packets** from the Next.js client at ~30 FPS,
keeps a **sliding window** (default 45 frames), and POSTs the matrix to the
Python AI microservice (`/infer`).

## Run

```bash
cd gateway
bun install
bun run dev
```

Listens on `ws://127.0.0.1:3001/ws`

Requires AI at `http://127.0.0.1:8000` (override with `AI_URL`).
