from types import SimpleNamespace

import pytest
from pydantic import BaseModel

from jobber import providers


class Schema(BaseModel):

    ok: bool


RAW = Schema(ok=True).model_dump_json()


@pytest.fixture
def seen(monkeypatch):
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
