import hashlib

from jobber_mcp import auth


def scope(*headers):
    return {"type": "http", "headers": list(headers)}


def test_digest_is_plain_sha256_hex():
    assert auth.digest("abc") == hashlib.sha256(b"abc").hexdigest()


def test_bearer_scheme_is_case_insensitive():
    assert auth.presented(scope((b"authorization", b"Bearer tok"))) == "tok"
    assert auth.presented(scope((b"authorization", b"bearer tok"))) == "tok"


def test_anything_that_is_not_a_bearer_token_reads_as_absent():
    assert auth.presented(scope((b"authorization", b"Basic tok"))) is None
    assert auth.presented(scope((b"authorization", b"Bearer"))) is None
    assert auth.presented(scope((b"authorization", b"Bearer    "))) is None
    assert auth.presented(scope()) is None


def test_a_revoked_token_matches_and_is_still_refused():
    assert auth.accepted({"id": 1, "revoked_at": None})
    assert not auth.accepted({"id": 1, "revoked_at": "2026-01-01T00:00:00Z"})
    assert not auth.accepted(None)
