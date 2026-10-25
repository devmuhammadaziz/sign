# ASL Alphabet Recognizer

Show one **ASL fingerspelling** handshape → see that **letter (A–Z)** on screen.

Runs entirely in the browser (MediaPipe Hand Landmarker). No Python / Bun gateway required for this mode.

## Run

```bash
npm install
npm run dev
```

Open http://localhost:3000 → **Start camera** → allow webcam.

## How to use

1. Face the camera with **one hand**, palm toward the lens.
2. Form an ASL alphabet letter and **hold still** ~0.5s.
3. The big letter updates live; after it’s stable, it’s added to “Spelled so far”.
4. Change to the next letter (or lower your hand briefly between same letters like OO).

## Tips

- Good lighting helps a lot.
- Mirror selfie view — sign as you normally would in a mirror.
- Letters that look similar (A/E/S, U/V/R) need a clear, steady shape.

## Optional older stack

`backend/` and `gateway/` are the previous continuous CSLR experiment. Not needed for alphabet mode.
