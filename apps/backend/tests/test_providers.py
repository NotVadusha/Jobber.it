"""`reasoning_effort` is a per-vendor param on a shared transport: DeepSeek and
the other OpenAI-compatible vendors 400 on it, so the gate is worth a test."""

from types import SimpleNamespace

import pytest
from pydantic import BaseModel

from jobber import providers


class Schema(BaseModel):
    """Any schema will do — the transport is what is under test, not a caller's
    shape. Kept local so this file does not reach into a caller for one."""

    ok: bool


RAW = Schema(ok=True).model_dump_json()


@pytest.fixture
def seen(monkeypatch):
    """Capture the kwargs the OpenAI transport would send, sending nothing."""
    calls = {}

    def create(**kwargs):
        calls.update(kwargs)
        return SimpleNamespace(choices=[SimpleNamespace(message=SimpleNamespace(content=RAW))])

    client = SimpleNamespace(chat=SimpleNamespace(completions=SimpleNamespace(create=create)))
    monkeypatch.setattr(providers, "_client", lambda provider: client)
    return calls


@pytest.mark.parametrize("provider, expected", [("openai", "medium"), ("deepseek", None)])
def test_effort_reaches_only_the_reasoning_vendors(seen, provider, expected):
    providers.call(provider, "sys", "user", Schema, effort="medium")
    assert seen.get("reasoning_effort") == expected


def test_openai_defaults_to_the_registry_model(seen):
    providers.call("openai", "sys", "user", Schema)
    assert seen["model"] == "gpt-5.6-luna"
