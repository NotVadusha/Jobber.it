FROM python:3.12-slim
COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /bin/
WORKDIR /app

# Both apps: the sync resolves jobber from ../backend, so that tree has to be
# laid out exactly as it is in the repo before uv runs.
COPY apps/backend/pyproject.toml apps/backend/uv.lock apps/backend/.python-version ./apps/backend/
COPY apps/backend/jobber ./apps/backend/jobber
COPY apps/mcp/pyproject.toml apps/mcp/uv.lock apps/mcp/.python-version ./apps/mcp/
COPY apps/mcp/jobber_mcp ./apps/mcp/jobber_mcp
RUN uv sync --project apps/mcp --frozen --no-dev

ENV PATH="/app/apps/mcp/.venv/bin:$PATH" PYTHONUNBUFFERED=1 HOST=:: PORT=8000

# Binds :: for the same reason apps/backend/Dockerfile does — Railway's private
# network is IPv6, and Linux's default dual-stack still accepts IPv4 on it.
CMD ["python", "-m", "jobber_mcp"]
