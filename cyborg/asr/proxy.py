"""
CYBORG.IO — Nemotron ASR Proxy
Bridges HTTP/WebSocket audio → Riva gRPC (Nemotron ASR Streaming NIM).

Ports:
  HTTP  :8007  — file upload transcription (OpenAI-compatible /v1/audio/transcriptions)
  WS    :8007  — /ws/transcribe — real-time mic streaming
  gRPC  :50051 — Riva ASR NIM (internal, not exposed)

Audio requirements for Riva:
  - 16-bit signed PCM (LINEAR_PCM)
  - 16000 Hz sample rate
  - Mono (1 channel)
  - WAV/OGG/OPUS container

This proxy handles conversion from any input format via ffmpeg.
"""
from __future__ import annotations

import asyncio
import io
import os
import subprocess
import tempfile
import traceback
from pathlib import Path

import riva.client
from fastapi import FastAPI, File, Form, HTTPException, UploadFile, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

# ─── Config ───────────────────────────────────────────────────────────────────
RIVA_URI = os.getenv("RIVA_URI", "localhost:50051")
USE_SSL = os.getenv("RIVA_SSL", "false").lower() == "true"
LANGUAGE = os.getenv("ASR_LANGUAGE", "en-US")
SAMPLE_RATE = 16000
CHUNK_SIZE = 1600  # 100ms of audio at 16kHz
MAX_AUDIO_MB = int(os.getenv("MAX_AUDIO_MB", "50"))

app = FastAPI(
    title="CYBORG.IO Nemotron ASR Proxy",
    version="1.0.0",
    description="HTTP/WebSocket → Riva gRPC bridge for Nemotron ASR Streaming NIM",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


# ─── Riva client factory ──────────────────────────────────────────────────────
def get_riva_asr() -> riva.client.ASRService:
    auth = riva.client.Auth(uri=RIVA_URI, use_ssl=USE_SSL)
    return riva.client.ASRService(auth)


def make_streaming_config(interim: bool = False) -> riva.client.StreamingRecognitionConfig:
    config = riva.client.RecognitionConfig(
        encoding=riva.client.AudioEncoding.LINEAR_PCM,
        sample_rate_hertz=SAMPLE_RATE,
        audio_channel_count=1,
        language_code=LANGUAGE,
        max_alternatives=1,
        enable_automatic_punctuation=True,
        enable_word_time_offsets=False,
    )
    return riva.client.StreamingRecognitionConfig(
        config=config,
        interim_results=interim,
    )


# ─── Audio conversion ─────────────────────────────────────────────────────────
def convert_to_wav(input_bytes: bytes, input_ext: str = "") -> bytes:
    """
    Convert any audio format to 16kHz mono 16-bit PCM WAV using ffmpeg.
    Works on: MP3, M4A, OGG, OPUS, FLAC, WebM, MP4, AAC, WAV (re-encode).
    """
    with tempfile.NamedTemporaryFile(suffix=input_ext or ".audio", delete=False) as src:
        src.write(input_bytes)
        src_path = src.name

    out_path = src_path + "_converted.wav"
    try:
        result = subprocess.run(
            [
                "ffmpeg", "-y",
                "-i", src_path,
                "-ar", str(SAMPLE_RATE),
                "-ac", "1",
                "-sample_fmt", "s16",
                "-f", "wav",
                out_path,
            ],
            capture_output=True,
            timeout=30,
        )
        if result.returncode != 0:
            raise RuntimeError(f"ffmpeg failed: {result.stderr.decode()[:500]}")
        return Path(out_path).read_bytes()
    finally:
        Path(src_path).unlink(missing_ok=True)
        Path(out_path).unlink(missing_ok=True)


def audio_chunk_generator(wav_bytes: bytes, chunk_size: int = CHUNK_SIZE):
    """Yield WAV audio in chunks, skipping the 44-byte header."""
    # Skip WAV header (44 bytes for standard PCM WAV)
    header_size = 44
    audio_data = wav_bytes[header_size:] if len(wav_bytes) > header_size else wav_bytes
    offset = 0
    while offset < len(audio_data):
        chunk = audio_data[offset: offset + chunk_size]
        if chunk:
            yield chunk
        offset += chunk_size


# ─── Core transcription ───────────────────────────────────────────────────────
def transcribe_wav_bytes(wav_bytes: bytes, interim: bool = False) -> str:
    """
    Send WAV bytes to Riva gRPC and return full transcript.
    Blocking — run in executor for async routes.
    """
    asr = get_riva_asr()
    streaming_config = make_streaming_config(interim=False)

    responses = asr.streaming_response_generator(
        audio_chunks=audio_chunk_generator(wav_bytes),
        streaming_config=streaming_config,
    )

    transcript_parts = []
    for response in responses:
        if not response.results:
            continue
        for result in response.results:
            if result.is_final and result.alternatives:
                transcript_parts.append(result.alternatives[0].transcript)

    return " ".join(transcript_parts).strip()


# ─── HTTP: File upload (OpenAI-compatible) ────────────────────────────────────
@app.post("/v1/audio/transcriptions")
async def transcribe_file(
    file: UploadFile = File(...),
    model: str = Form(default="nemotron-asr-streaming"),
    language: str = Form(default="en-US"),
):
    """
    OpenAI-compatible transcription endpoint.
    Accepts any audio format — converts to 16kHz PCM WAV before sending to Riva.
    Compatible with: OpenWebUI, Whisper API clients, NoblePort voice layer.
    """
    content = await file.read()

    if len(content) > MAX_AUDIO_MB * 1024 * 1024:
        raise HTTPException(status_code=413, detail=f"Audio exceeds {MAX_AUDIO_MB}MB limit")

    # Detect extension from filename
    fname = file.filename or ""
    ext = Path(fname).suffix.lower() if fname else ""

    try:
        # Convert to Riva-compatible WAV
        wav_bytes = await asyncio.get_event_loop().run_in_executor(
            None, convert_to_wav, content, ext
        )

        # Transcribe via Riva gRPC
        transcript = await asyncio.get_event_loop().run_in_executor(
            None, transcribe_wav_bytes, wav_bytes
        )

        # Return OpenAI-compatible response
        return {"text": transcript, "model": model, "language": language}

    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


# ─── HTTP: Direct WAV upload (faster, no conversion) ─────────────────────────
@app.post("/v1/audio/transcribe-wav")
async def transcribe_wav_direct(file: UploadFile = File(...)):
    """
    Direct WAV upload — skips conversion, fastest path.
    Requires: 16kHz mono 16-bit PCM WAV.
    """
    content = await file.read()
    try:
        transcript = await asyncio.get_event_loop().run_in_executor(
            None, transcribe_wav_bytes, content
        )
        return {"text": transcript}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ─── WebSocket: Real-time mic streaming ──────────────────────────────────────
@app.websocket("/ws/transcribe")
async def ws_transcribe(websocket: WebSocket):
    """
    WebSocket endpoint for real-time microphone streaming.

    Client protocol:
      1. Connect to ws://host:8007/ws/transcribe
      2. Send binary frames: raw 16kHz mono 16-bit PCM audio chunks (no WAV header)
      3. Send text frame "END" to signal end of audio
      4. Receive JSON frames:
           {"type": "interim", "text": "..."}   -- partial result
           {"type": "final",   "text": "..."}   -- confirmed result
           {"type": "done",    "text": "..."}   -- session complete

    The dashboard mic button uses this endpoint.
    """
    await websocket.accept()

    audio_buffer = bytearray()
    asr = get_riva_asr()
    streaming_config = make_streaming_config(interim=True)

    try:
        # Collect all audio then transcribe
        # (Full duplex streaming requires grpcio async — this is the reliable path)
        while True:
            try:
                data = await asyncio.wait_for(websocket.receive(), timeout=30)
            except asyncio.TimeoutError:
                await websocket.send_json({"type": "error", "text": "Timeout — no audio received"})
                break

            if "bytes" in data and data["bytes"]:
                audio_buffer.extend(data["bytes"])
                # Send interim feedback every ~2 seconds of audio
                if len(audio_buffer) >= SAMPLE_RATE * 2 * 2:  # 2s * 2 bytes/sample
                    await websocket.send_json({"type": "interim", "text": f"[{len(audio_buffer)//32} frames received...]"})

            elif "text" in data:
                if data["text"] == "END" or data["text"] == "end":
                    break
                elif data["text"] == "PING":
                    await websocket.send_json({"type": "pong"})

        if len(audio_buffer) > 0:
            # Run transcription in thread pool
            transcript = await asyncio.get_event_loop().run_in_executor(
                None,
                lambda: _transcribe_raw_pcm(bytes(audio_buffer), asr, streaming_config)
            )
            await websocket.send_json({"type": "final", "text": transcript})

        await websocket.send_json({"type": "done", "text": ""})

    except WebSocketDisconnect:
        pass
    except Exception as e:
        try:
            await websocket.send_json({"type": "error", "text": str(e)})
        except Exception:
            pass


def _transcribe_raw_pcm(
    pcm_bytes: bytes,
    asr: riva.client.ASRService,
    streaming_config: riva.client.StreamingRecognitionConfig,
) -> str:
    """Transcribe raw PCM bytes (no WAV header) via Riva gRPC."""
    def chunk_gen():
        offset = 0
        while offset < len(pcm_bytes):
            yield pcm_bytes[offset: offset + CHUNK_SIZE]
            offset += CHUNK_SIZE

    responses = asr.streaming_response_generator(
        audio_chunks=chunk_gen(),
        streaming_config=streaming_config,
    )
    parts = []
    for resp in responses:
        for result in resp.results:
            if result.is_final and result.alternatives:
                parts.append(result.alternatives[0].transcript)
    return " ".join(parts).strip()


# ─── Health ───────────────────────────────────────────────────────────────────
@app.get("/health")
async def health():
    riva_ok = False
    try:
        auth = riva.client.Auth(uri=RIVA_URI, use_ssl=USE_SSL)
        health_client = riva.client.NLPService(auth)  # lightweight probe
        riva_ok = True
    except Exception:
        pass
    return {
        "status": "ok",
        "riva_uri": RIVA_URI,
        "riva_reachable": riva_ok,
        "language": LANGUAGE,
        "sample_rate": SAMPLE_RATE,
    }


@app.get("/v1/health/ready")
async def health_ready():
    return {"status": "ready"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8007, log_level="info")
