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
