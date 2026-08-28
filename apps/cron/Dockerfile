FROM python:3.12-slim
COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /bin/
WORKDIR /app

# Both apps: the sync resolves jobber from ../backend, so that tree has to be
# laid out exactly as it is in the repo before uv runs.
COPY apps/backend/pyproject.toml apps/backend/uv.lock apps/backend/.python-version ./apps/backend/
COPY apps/backend/jobber ./apps/backend/jobber
COPY apps/cron/pyproject.toml apps/cron/uv.lock apps/cron/.python-version ./apps/cron/
COPY apps/cron/jobber_cron ./apps/cron/jobber_cron
RUN uv sync --project apps/cron --frozen --no-dev

# Puts the venv's python first, so `python -m jobber_cron...` resolves there and
# jobber (a dependency of jobber-cron) is importable alongside it.
ENV PATH="/app/apps/cron/.venv/bin:$PATH" PYTHONUNBUFFERED=1

# Default is the gather chain. The prune service overrides this with
# `python -m jobber_cron.prune`. Both exit when done, which Railway cron requires.
# Individual gather steps are runnable the same way, e.g.
# `python -m jobber_cron.gather.scrape`.
CMD ["python", "-m", "jobber_cron.gather"]
