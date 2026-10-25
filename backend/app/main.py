"""DeepSign AI microservice — landmark windows → Intent Gate + CSLR + CTC."""

from __future__ import annotations

import asyncio
import logging
from contextlib import asynccontextmanager
from typing import Any

import numpy as np
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from .cslr_model import CSLREngine
from .inference import DeepSignPipeline

logging.basicConfig(level=logging.INFO)
log = logging.getLogger("deepsign-ai")

pipeline: DeepSignPipeline | None = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    global pipeline
    log.info("Loading DeepSign CSLR engine…")
    engine = await asyncio.to_thread(CSLREngine)
    pipeline = DeepSignPipeline(engine=engine)
    log.info("DeepSign AI ready on %s", engine.device)
    yield
    pipeline = None


app = FastAPI(title="DeepSign AI", version="2.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class InferRequest(BaseModel):
    T: int = Field(..., ge=1, le=256)
    D: int = Field(153, ge=153, le=153)
    landmarks: list[float]


@app.get("/health")
def health() -> dict[str, Any]:
    return {
        "ok": True,
        "service": "deepsign-ai",
        "model_loaded": pipeline is not None,
        "device": pipeline.engine.device if pipeline else None,
    }


@app.post("/infer")
def infer(body: InferRequest) -> dict[str, Any]:
    if pipeline is None:
        raise HTTPException(503, "Model not loaded")

    expected = body.T * body.D
    if len(body.landmarks) != expected:
        raise HTTPException(
            400,
            f"landmarks length {len(body.landmarks)} != T*D ({expected})",
        )

    window = np.asarray(body.landmarks, dtype=np.float32).reshape(body.T, body.D)
    result = pipeline.infer_window(window)
    out: dict[str, Any] = {"intent": result.intent}
    if result.speculative:
        out["speculative"] = result.speculative
    if result.confirmed:
        out["confirmed"] = result.confirmed
    if result.glosses is not None:
        out["glosses"] = result.glosses
    if result.meta:
        out["meta"] = result.meta
    return out
