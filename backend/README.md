# SignFlow CSLR Backend

Deep continuous ASL recognition: **MediaPipe Holistic** → **How2Sign pose Transformer (CTC)**.

## Setup (Python 3.12)

```bash
cd backend
python3.12 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

## Run

```bash
cd backend
source .venv/bin/activate
uvicorn app.main:app --host 127.0.0.1 --port 8000
```

First start downloads `manohonsy/how2sign-pose-cslr` (~20MB) from Hugging Face.

Health check: [http://127.0.0.1:8000/health](http://127.0.0.1:8000/health)

WebSocket: `ws://127.0.0.1:8000/ws/sign`

### Client protocol

Send JSON text frames:

```json
{ "type": "frame", "image": "data:image/jpeg;base64,..." }
```

Receive:

```json
{
  "type": "prediction",
  "hands": true,
  "active": "…",
  "confirmed": "HELLO TODAY",
  "glosses": ["HELLO", "TODAY"]
}
```

Sign a phrase, then **pause / lower hands** (~0.6s) to trigger CTC decode. Idle ~3s appends a period.

## Frontend

In another terminal from the repo root:

```bash
npm run dev
```

Open `http://localhost:3000`, click **Start camera**.
