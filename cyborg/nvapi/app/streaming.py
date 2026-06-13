"""
CYBORG.IO — Streaming Inference Engine
Supports NVIDIA NIM streaming with reasoning_budget (Nemotron thinking models).
Uses openai SDK pointed at NVIDIA's base_url — exact pattern from NVIDIA docs.

Supported models with reasoning:
  - nvidia/nemotron-3-nano-30b-a3b    (fast, reasoning enabled)
  - nvidia/nemotron-4-340b-instruct   (large, no reasoning budget)
  - meta/llama-3.1-70b-instruct       (standard)
"""
from __future__ import annotations

import asyncio
import json
from typing import AsyncGenerator

# REASONING_MODELS: these support reasoning_budget + enable_thinking
REASONING_MODELS = {
    "nvidia/nemotron-3-nano-30b-a3b",
    "nvidia/nemotron-3-8b-qa-4k",
}

# All models exposed in the UI dropdown
AVAILABLE_MODELS = [
    {"id": "nvidia/nemotron-3-nano-30b-a3b", "name": "Nemotron-3 Nano 30B (reasoning)", "reasoning": True},
    {"id": "nvidia/nemotron-4-340b-instruct", "name": "Nemotron-4 340B Instruct", "reasoning": False},
    {"id": "meta/llama-3.1-70b-instruct", "name": "Llama 3.1 70B Instruct", "reasoning": False},
    {"id": "meta/llama-3.1-8b-instruct", "name": "Llama 3.1 8B Instruct (fast)", "reasoning": False},
    {"id": "mistralai/mixtral-8x22b-instruct", "name": "Mixtral 8x22B Instruct", "reasoning": False},
    {"id": "google/gemma-2-27b-it", "name": "Gemma 2 27B IT", "reasoning": False},
]

NIM_BASE_URL = "https://integrate.api.nvidia.com/v1"


async def stream_nim_response(
    api_key: str,
    model: str,
    messages: list[dict],
    temperature: float = 1.0,
    top_p: float = 1.0,
    max_tokens: int = 16384,
    reasoning_budget: int = 16384,
    system_prompt: str | None = None,
) -> AsyncGenerator[str, None]:
    """
    Stream SSE chunks from NVIDIA NIM.
    Yields JSON strings: { "type": "reasoning"|"content"|"done"|"error", "text": "..." }

    Uses the openai SDK with NVIDIA base_url — exact pattern from NVIDIA docs snippet.
    Falls back to httpx streaming if openai SDK not installed.
    """
    if system_prompt:
        messages = [{"role": "system", "content": system_prompt}] + messages

    is_reasoning = model in REASONING_MODELS
    extra_body = {}
    if is_reasoning:
        extra_body = {
            "reasoning_budget": reasoning_budget,
            "chat_template_kwargs": {"enable_thinking": True},
        }

    try:
        # Primary: openai SDK path (matches NVIDIA docs exactly)
        from openai import AsyncOpenAI

        client = AsyncOpenAI(
            base_url=NIM_BASE_URL,
            api_key=api_key,
        )

        stream = await client.chat.completions.create(
            model=model,
            messages=messages,
            temperature=temperature,
            top_p=top_p,
            max_tokens=max_tokens,
            extra_body=extra_body if extra_body else None,
            stream=True,
        )

        async for chunk in stream:
            if not chunk.choices:
                continue
            delta = chunk.choices[0].delta

            # Reasoning tokens (thinking trace — Nemotron specific)
            reasoning = getattr(delta, "reasoning_content", None)
            if reasoning:
                yield json.dumps({"type": "reasoning", "text": reasoning})

            # Main content tokens
            if delta.content is not None:
                yield json.dumps({"type": "content", "text": delta.content})

        yield json.dumps({"type": "done", "text": ""})

    except ImportError:
        # Fallback: raw httpx streaming (no openai SDK needed)
        yield json.dumps({"type": "reasoning", "text": "[openai SDK not installed — using httpx fallback]\n"})

        import httpx

        payload: dict = {
            "model": model,
            "messages": messages,
            "temperature": temperature,
            "top_p": top_p,
            "max_tokens": max_tokens,
            "stream": True,
        }
        if extra_body:
            payload.update(extra_body)

        async with httpx.AsyncClient(timeout=120) as client:
            async with client.stream(
                "POST",
                f"{NIM_BASE_URL}/chat/completions",
                headers={
                    "Authorization": f"Bearer {api_key}",
                    "Content-Type": "application/json",
                    "Accept": "text/event-stream",
                },
                json=payload,
            ) as resp:
                if resp.status_code != 200:
                    yield json.dumps({"type": "error", "text": f"HTTP {resp.status_code}"})
                    return

                async for line in resp.aiter_lines():
                    if not line.startswith("data: "):
                        continue
                    data = line[6:]
                    if data.strip() == "[DONE]":
                        break
                    try:
                        obj = json.loads(data)
                        choices = obj.get("choices", [])
                        if not choices:
                            continue
                        delta = choices[0].get("delta", {})

                        reasoning = delta.get("reasoning_content")
                        if reasoning:
                            yield json.dumps({"type": "reasoning", "text": reasoning})

                        content = delta.get("content")
                        if content:
                            yield json.dumps({"type": "content", "text": content})
                    except json.JSONDecodeError:
                        continue

        yield json.dumps({"type": "done", "text": ""})

    except Exception as e:
        yield json.dumps({"type": "error", "text": str(e)})
