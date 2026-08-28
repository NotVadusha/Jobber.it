from __future__ import annotations

import argparse
import secrets

from dotenv import load_dotenv

from jobber import db
from jobber_mcp import config
from jobber_mcp.auth import digest

ENTROPY_BYTES = 32


def main() -> int:
    ap = argparse.ArgumentParser(prog="mint_token.py", description=__doc__)
    ap.add_argument("name", help="what this token is for, e.g. claude-desktop")
    args = ap.parse_args()

    load_dotenv()
    config.init()

    token = secrets.token_urlsafe(ENTROPY_BYTES)
    with db.conn() as c:
        row = c.execute(
            "insert into api_tokens (name, token_hash) values (%s, %s) returning id",
            (args.name, digest(token)),
        ).fetchone()

    print(f"\n  {token}\n")
    print(f"api_tokens id {row['id']}, name {args.name!r}.")
    print("Only the sha256 digest was stored, so this is the one and only time the")
    print("token is shown — a lost token is re-minted, never recovered.")
    print(f"\nRevoke with:\n  update api_tokens set revoked_at = now() where id = {row['id']};")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
