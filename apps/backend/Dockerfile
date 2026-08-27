# Image for the always-on API service. Build from the REPO ROOT:
#
#     docker build -f apps/backend/Dockerfile .
#
# The context is the root, not this directory: .dockerignore is only read from
# the context root.
#
# On Railway, set the service's Dockerfile path to apps/backend/Dockerfile and
# leave the root directory at /.
#
# No node stage: the frontend is its own image and its own service
# (apps/frontend/Dockerfile). router.py still mounts apps/frontend/dist when the
# directory exists, so a local `npm run build` keeps working — in this image the
# directory is simply absent.
FROM python:3.12-slim
COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /bin/
WORKDIR /app

# This app owns its manifest and lock; nothing from the repo root is involved in
# the install. The package tree has to land before the sync — jobber is the
# project itself, so hatch builds its wheel as part of it.
COPY apps/backend/pyproject.toml apps/backend/uv.lock apps/backend/.python-version ./apps/backend/
COPY apps/backend/jobber ./apps/backend/jobber
RUN uv sync --project apps/backend --frozen --no-dev

ENV PATH="/app/apps/backend/.venv/bin:$PATH" PYTHONUNBUFFERED=1 HOST=:: PORT=8000

# Binds :: rather than 0.0.0.0 — Railway's private network is IPv6, and the web
# service reaches this one over it. On Linux's default dual-stack (bindv6only=0)
# a :: listener still accepts IPv4, so the public proxy is unaffected either way.
CMD ["jobber"]
