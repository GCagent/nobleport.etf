"""
CYBORG.IO — ASR Proxy Test Script
Verifies the full pipeline: file upload → proxy → Riva gRPC → transcript

Usage:
  python test_asr.py                      # uses built-in test tone
  python test_asr.py --file audio.wav    # use your own file
  python test_asr.py --url http://your-server:8007
"""
import argparse
import io
import struct
import wave
import sys
import requests

def make_test_wav(duration_sec: float = 2.0, sample_rate: int = 16000) -> bytes:
    """Generate a silent WAV file for connectivity testing."""
    num_samples = int(sample_rate * duration_sec)
    buf = io.BytesIO()
    with wave.open(buf, 'wb') as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(sample_rate)
        w.writeframes(b'\x00\x00' * num_samples)
    return buf.getvalue()

def test_health(base_url: str):
    print(f"\n[1] Health check → {base_url}/health")
    try:
        r = requests.get(f"{base_url}/health", timeout=5)
        data = r.json()
        print(f"    Status: {data.get('status')}")
        print(f"    Riva URI: {data.get('riva_uri')}")
        print(f"    Riva reachable: {data.get('riva_reachable')}")
        if not data.get('riva_reachable'):
            print("    ⚠ Riva gRPC not reachable — is nemotron-asr container running?")
            return False
        print("    ✓ Health OK")
        return True
    except Exception as e:
        print(f"    ✗ FAILED: {e}")
        return False

def test_transcription(base_url: str, audio_path: str | None = None):
    print(f"\n[2] Transcription test → {base_url}/v1/audio/transcriptions")
    if audio_path:
        print(f"    Using file: {audio_path}")
        with open(audio_path, 'rb') as f:
            audio_bytes = f.read()
        filename = audio_path
    else:
        print("    Using generated silent WAV (2s)")
        audio_bytes = make_test_wav()
        filename = "test.wav"

    try:
        r = requests.post(
            f"{base_url}/v1/audio/transcriptions",
            files={"file": (filename, audio_bytes, "audio/wav")},
            data={"model": "nemotron-asr-streaming"},
            timeout=60,
        )
        if r.status_code == 200:
            data = r.json()
            print(f"    ✓ Transcript: '{data.get('text', '')}'")
            print(f"    Model: {data.get('model')}")
        else:
            print(f"    ✗ HTTP {r.status_code}: {r.text[:300]}")
    except Exception as e:
        print(f"    ✗ FAILED: {e}")

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--url", default="http://localhost:8007")
    parser.add_argument("--file", default=None)
    args = parser.parse_args()

    ok = test_health(args.url)
    if ok:
        test_transcription(args.url, args.file)
    else:
        print("\n⚠ Skipping transcription test — fix health check first")
        sys.exit(1)

    print("\n[3] Quick start reminder:")
    print("    cp .env.template .env")
    print("    nano .env  → set NGC_API_KEY")
    print("    docker compose up --build")
    print("    # Wait 10-30 min for model download on first run")
    print(f"    curl {args.url}/v1/health/ready")
