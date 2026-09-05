FROM python:3.12-slim
COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /bin/
WORKDIR /app

COPY apps/backend/pyproject.toml apps/backend/uv.lock apps/backend/.python-version apps/backend/alembic.ini ./apps/backend/
COPY apps/backend/jobber ./apps/backend/jobber
RUN uv sync --project apps/backend --frozen --no-dev --group migrate

ENV PATH="/app/apps/backend/.venv/bin:$PATH" PYTHONUNBUFFERED=1 HOST=:: PORT=8000

# alembic.ini resolves script_location relative to the working directory, and the
# pre-deploy step runs `alembic upgrade head` here. `jobber` is on PATH, so the
# start command does not care where it runs from.
WORKDIR /app/apps/backend

CMD ["jobber"]
