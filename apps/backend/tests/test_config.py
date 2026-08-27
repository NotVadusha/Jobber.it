import pytest

from jobber import config
from jobber.providers import DEFAULT, PROVIDERS

DEFAULT_KEY = PROVIDERS[DEFAULT].env_key


def build(monkeypatch, **env):
    for key in config.Config.model_fields:
        monkeypatch.delenv(key.upper(), raising=False)
    for key, value in env.items():
        monkeypatch.setenv(key, value)
    monkeypatch.setattr(config, "_CONFIG", None)
    return config.init()


def test_missing_required_keys_name_all_of_them(monkeypatch):
    with pytest.raises(SystemExit) as e:
        build(monkeypatch)
    assert "DATABASE_URL" in str(e.value) and "PINECONE_API_KEY" in str(e.value)


def test_empty_string_counts_as_unset(monkeypatch):
    # .env.example ships `ANTHROPIC_API_KEY=`; dotenv loads that as "".
    with pytest.raises(SystemExit):
        build(monkeypatch, DATABASE_URL="postgres:///x", PINECONE_API_KEY="  ")


def test_the_default_providers_key_is_required_at_init(monkeypatch):
    with pytest.raises(SystemExit, match=DEFAULT_KEY):
        build(monkeypatch, DATABASE_URL="postgres:///x", PINECONE_API_KEY="pc")


def test_other_provider_keys_stay_optional_and_checked_on_use(monkeypatch):
    conf = build(monkeypatch, DATABASE_URL="postgres:///x", PINECONE_API_KEY="pc",
                 ANTHROPIC_API_KEY="sk-ant", **{DEFAULT_KEY: "sk-default"})
    assert conf.require("ANTHROPIC_API_KEY") == "sk-ant"
    with pytest.raises(SystemExit, match="OLLAMA_BASE_URL"):
        conf.require("OLLAMA_BASE_URL")


def test_every_provider_env_key_is_a_config_field():
    # A key Config does not know makes require() raise forever, set or not.
    for spec in PROVIDERS.values():
        assert spec.env_key.lower() in config.Config.model_fields
