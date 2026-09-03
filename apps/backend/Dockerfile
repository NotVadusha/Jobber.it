FROM python:3.12-slim
COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /bin/
WORKDIR /app

COPY apps/backend/pyproject.toml apps/backend/uv.lock apps/backend/.python-version ./apps/backend/
COPY apps/backend/jobber ./apps/backend/jobber
RUN uv sync --project apps/backend --frozen --no-dev

ENV PATH="/app/apps/backend/.venv/bin:$PATH" PYTHONUNBUFFERED=1 HOST=:: PORT=8000

CMD ["jobber"]
