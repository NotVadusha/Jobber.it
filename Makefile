# The one root config. It knows how to reach each app in apps/ and nothing else —
# every app owns its own manifest, lockfile and Dockerfile:
#
#   apps/backend   pyproject.toml + uv.lock   (python, the `jobber` package)
#   apps/cron      pyproject.toml + uv.lock   (python, path-depends on backend)
#   apps/frontend  package.json + lock        (node/vite)
#
# Recipes run from the repo root on purpose: data/ (the response cache) is
# resolved relative to the working directory and lives here.
BACKEND := uv run --project apps/backend
CRON    := uv run --project apps/cron
WEB     := npm --prefix apps/frontend

.PHONY: install serve web build test lint clean

install:
	uv sync --project apps/backend
	uv sync --project apps/cron
	$(WEB) ci

serve:            ## search API on :3000
	$(BACKEND) jobber

web:              ## vite dev server
	$(WEB) run dev

build:
	$(WEB) run build

# Each app carries its own [tool.pytest.ini_options], so pytest picks the app
# directory as rootdir from the path argument.
test:
	$(BACKEND) pytest apps/backend/tests
	$(CRON) pytest apps/cron/tests

lint:
	$(WEB) run lint

clean:
	rm -rf apps/backend/.venv apps/cron/.venv apps/frontend/node_modules apps/frontend/dist
