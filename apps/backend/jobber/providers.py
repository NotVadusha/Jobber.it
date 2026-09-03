from __future__ import annotations

import json
import time
from dataclasses import dataclass
from functools import lru_cache

import anthropic as anthropic_sdk
import httpx
from openai import OpenAI
from pydantic import BaseModel, ValidationError

from . import config


@dataclass(frozen=True)
class Spec:
    model: str
    env_key: str
    base_url: str | None = None
    reasoning: bool = False


PROVIDERS = {
    "anthropic": Spec("claude-opus-5", "ANTHROPIC_API_KEY", reasoning=True),
    "openai": Spec("gpt-5.6-luna", "OPENAI_API_KEY", reasoning=True),
    "deepseek": Spec("deepseek-v4-flash", "DEEPSEEK_API_KEY", "https://api.deepseek.com"),
    "ollama": Spec("mistral:latest", "OLLAMA_BASE_URL"),
}

EFFORT = "low"
MAX_TOKENS = 8000

NUM_CTX = 8192
OLLAMA_TIMEOUT = 300.0
OLLAMA_429_TRIES = 5

DEFAULT = "openai"

SCHEMA_HINT = (
    "\n\nReturn a single json object matching this JSON Schema exactly. "
    "Emit no prose, no markdown fences — only the json object.\n"
)


@lru_cache(maxsize=None)
def _client(provider: str):
    spec = PROVIDERS[provider]
    key = config.get().require(spec.env_key)
    if provider == "anthropic":
        return anthropic_sdk.Anthropic(api_key=key)
    if provider == "ollama":
        return httpx.Client(base_url=key.rstrip("/").removesuffix("/v1"),
                            timeout=OLLAMA_TIMEOUT)
    return OpenAI(api_key=key, base_url=spec.base_url)


def _anthropic(client, system: str, user: str, schema: type[BaseModel], model: str,
               effort: str = EFFORT) -> str:
    response = client.messages.create(
        model=model,
        max_tokens=MAX_TOKENS,
        system=[
            {"type": "text", "text": system, "cache_control": {"type": "ephemeral"}}
        ],
        output_config={
            "effort": effort,
            "format": {"type": "json_schema", "schema": schema.model_json_schema()},
        },
        messages=[{"role": "user", "content": user}],
    )
    if response.stop_reason == "refusal":
        raise RuntimeError("refusal")
    return next(b.text for b in response.content if b.type == "text")


def _openai(client, system: str, user: str, schema: type[BaseModel], model: str,
            effort: str | None = None) -> str:
    completion = client.chat.completions.create(
        model=model,
        response_format={"type": "json_object"},
        messages=[
            {"role": "system", "content": system + SCHEMA_HINT
             + json.dumps(schema.model_json_schema())},
            {"role": "user", "content": user},
        ],
        **({"reasoning_effort": effort} if effort else {}),
    )
    return completion.choices[0].message.content


def _ollama(client, system: str, user: str, schema: type[BaseModel], model: str) -> str:
    for attempt in range(OLLAMA_429_TRIES):
        response = _ollama_post(client, system, user, schema, model)
        if response.status_code != 429:
            break
        time.sleep(float(response.headers.get("retry-after") or 2 ** attempt))
    response.raise_for_status()
    body = response.json()
    if body.get("prompt_eval_count", 0) >= NUM_CTX:
        raise RuntimeError(f"prompt hit num_ctx ({NUM_CTX}) — truncated")
    fields = schema.model_fields
    return json.dumps({k: v for k, v in json.loads(body["message"]["content"]).items()
                       if k in fields})


def _ollama_post(client, system: str, user: str, schema: type[BaseModel], model: str):
    return client.post("/api/chat", json={
        "model": model,
        "stream": False,
        "format": schema.model_json_schema(),
        "options": {"num_ctx": NUM_CTX, "temperature": 0},
        "messages": [{"role": "system", "content": system + SCHEMA_HINT
                      + json.dumps(schema.model_json_schema())},
                     {"role": "user", "content": user}],
    })


def call(
    provider: str, system: str, user: str, schema: type[BaseModel],
    model: str | None = None, effort: str = EFFORT,
    timeout: float | None = None,
) -> BaseModel:
    client = _client(provider)
    spec = PROVIDERS[provider]
    model = model or spec.model
    if timeout is not None and provider != "ollama":
        client = client.with_options(timeout=timeout)
    last = ""

    for _ in range(2):
        try:
            if provider == "anthropic":
                raw = _anthropic(client, system, user, schema, model, effort)
            elif provider == "ollama":
                raw = _ollama(client, system, user, schema, model)
            else:
                raw = _openai(client, system, user, schema, model,
                              effort if spec.reasoning else None)
            return schema.model_validate_json(raw)
        except ValidationError as e:
            last = f"schema: {e.error_count()} field error(s)"
        except Exception as e:
            last = f"{type(e).__name__}: {e}"
    raise RuntimeError(last)
