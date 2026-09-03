import httpx
import pytest

from jobber_mcp import auth, server

INITIALIZE = {
    "jsonrpc": "2.0",
    "id": 1,
    "method": "initialize",
    "params": {"protocolVersion": "2025-06-18", "capabilities": {},
               "clientInfo": {"name": "test", "version": "0"}},
}
HEADERS = {"content-type": "application/json",
           "accept": "application/json, text/event-stream"}


@pytest.fixture(scope="module")
def anyio_backend():
    return "asyncio"


@pytest.fixture(scope="module")
async def client():
    app = server.create_app()
    inner = app.app
    async with inner.router.lifespan_context(inner):
        transport = httpx.ASGITransport(app=app)
        async with httpx.AsyncClient(transport=transport,
                                     base_url="http://127.0.0.1:3001") as c:
            yield c


@pytest.fixture
def tokens(monkeypatch):
    rows = {
        auth.digest("live-token"): {"id": 1, "name": "ok", "revoked_at": None},
        auth.digest("dead-token"): {"id": 2, "name": "revoked",
                                    "revoked_at": "2026-01-01T00:00:00Z"},
    }
    monkeypatch.setattr(auth.db, "token_by_hash", rows.get)


async def initialize(client: httpx.AsyncClient, token: str | None) -> httpx.Response:
    headers = dict(HEADERS)
    if token is not None:
        headers["authorization"] = f"Bearer {token}"
    return await client.post("/mcp", json=INITIALIZE, headers=headers)


@pytest.mark.anyio
async def test_no_token_is_refused_with_a_challenge(client, tokens):
    r = await initialize(client, None)
    assert r.status_code == 401
    assert r.headers["www-authenticate"].startswith("Bearer")


@pytest.mark.anyio
async def test_an_unknown_token_is_refused(client, tokens):
    assert (await initialize(client, "not-a-real-token")).status_code == 401


@pytest.mark.anyio
async def test_a_revoked_token_is_refused(client, tokens):
    assert (await initialize(client, "dead-token")).status_code == 401


@pytest.mark.anyio
async def test_a_live_token_reaches_the_server(client, tokens):
    r = await initialize(client, "live-token")
    assert r.status_code == 200, r.text
    assert "jobber" in r.text


@pytest.fixture(scope="module")
async def deployed():
    app = server.create_app("::")
    inner = app.app
    async with inner.router.lifespan_context(inner):
        transport = httpx.ASGITransport(app=app)
        async with httpx.AsyncClient(transport=transport,
                                     base_url="https://jobber-mcp.up.railway.app") as c:
            yield c


@pytest.mark.anyio
async def test_a_deployed_host_is_not_refused_by_host_validation(deployed, tokens):
    r = await initialize(deployed, "live-token")
    assert r.status_code == 200, r.text
