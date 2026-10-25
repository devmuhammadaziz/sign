# Fine-tune hook

The live server uses the pretrained How2Sign pose CSLR checkpoint
(`manohonsy/how2sign-pose-cslr`).

To improve recognition for your signer / vocabulary (e.g. names like LOLA):

1. Record short clips while signing (one phrase per clip).
2. Extract Holistic 153-D sequences with `app.holistic.HolisticExtractor`.
3. Fine-tune `PoseTransformerCSLR` with CTC loss on your gloss labels.
4. Point the server at your checkpoint by setting `CSLR_MODEL_DIR`.

This folder is reserved for those training scripts — the inference path does
not require them.
