# Image for the web service — the built SPA, plus an /api proxy to the backend.
# Build from THIS directory; it needs nothing from the repo root:
#
#     docker build -f apps/frontend/Dockerfile apps/frontend
#
# On Railway, the root directory is what sets the build context — not the
# Dockerfile path. Set the root to /apps/frontend and the path to Dockerfile.
# Leaving the root at / builds this file against the repo root, where every COPY
# below misses and the root .dockerignore excludes apps/frontend outright.
FROM node:22-slim AS web
WORKDIR /web
COPY package.json package-lock.json ./
RUN npm ci
COPY . ./
RUN npm run build

# No node in the final image: vite output is static files, so the runtime only
# needs something that serves them and forwards /api.
FROM caddy:2-alpine
COPY --from=web /web/dist /srv
COPY Caddyfile /etc/caddy/Caddyfile
