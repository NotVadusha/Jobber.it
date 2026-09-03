from __future__ import annotations

import os
from logging.config import fileConfig

from alembic import context
from dotenv import load_dotenv
from sqlalchemy import create_engine, pool

from jobber.db.migrations import schema

alembic_config = context.config
if alembic_config.config_file_name is not None:
    fileConfig(alembic_config.config_file_name)

target_metadata = schema.metadata


def url() -> str:
    load_dotenv()
    raw = os.environ.get("DATABASE_URL", "").strip()
    if not raw:
        raise SystemExit("not set: DATABASE_URL")
    for scheme in ("postgresql://", "postgres://"):
        if raw.startswith(scheme):
            return "postgresql+psycopg://" + raw[len(scheme):]
    return raw


def run_migrations_offline() -> None:
    context.configure(url=url(), target_metadata=target_metadata, literal_binds=True,
                      dialect_opts={"paramstyle": "named"})
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    engine = create_engine(url(), poolclass=pool.NullPool)
    with engine.connect() as connection:
        context.configure(connection=connection, target_metadata=target_metadata)
        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
