# The one root config. It knows how to reach each app in apps/ and nothing else —
# every app owns its own manifest, lockfile and Dockerfile:
#
#   apps/backend   pyproject.toml + uv.lock   (python, the `jobber` package)
#   apps/cron      pyproject.toml + uv.lock   (python, path-depends on backend)
#   apps/mcp       pyproject.toml + uv.lock   (python, path-depends on backend)
#   apps/frontend  package.json + lock        (node/vite)
#
# Recipes run from the repo root on purpose: data/ (the response cache) is
# resolved relative to the working directory and lives here.
BACKEND := uv run --project apps/backend
CRON    := uv run --project apps/cron
MCP     := uv run --project apps/mcp
WEB     := npm --prefix apps/frontend

E2E_DATABASE_URL  ?= postgresql://postgres:postgres@127.0.0.1:5432/jobber_e2e
TEST_DATABASE_URL ?= postgresql://postgres:postgres@127.0.0.1:5432/jobber_test_e2e

# Expanded inline in every preparation recipe rather than shared as a phony
# prerequisite: make builds a prerequisite once per invocation, so `verify`
# would guard whichever database came first and skip the other one entirely.
DB_GUARD = url="$$DB_URL"; \
	test -n "$$url" || { echo "refusing an empty database URL"; exit 1; }; \
	name="$$(basename "$${url%%\?*}")"; \
	case "$$name" in *_e2e) ;; \
		*) echo "refusing database name in URL: $$name"; exit 1 ;; esac; \
	database_name="$$(psql "$$url" -Atc 'select current_database()')" || exit 1; \
	case "$$database_name" in *_e2e) ;; \
		*) echo "refusing database: $$database_name"; exit 1 ;; esac

.PHONY: install serve mcp web build test test-unit test-integration test-db e2e e2e-db \
        lint check verify verify-full \
        api-contracts api-contracts-check clean migrate stamp token

install:
	uv sync --project apps/backend
	uv sync --project apps/cron
	uv sync --project apps/mcp
	$(WEB) ci

serve:            ## search API on :3000
	$(BACKEND) jobber

mcp:              ## MCP server on :3001
	$(MCP) python -m jobber_mcp

web:              ## vite dev server
	$(WEB) run dev

build:
	$(WEB) run build

# Each app carries its own [tool.pytest.ini_options], so pytest picks the app
# directory as rootdir from the path argument.
test: test-unit test-integration

test-unit:
	$(BACKEND) pytest apps/backend/tests --ignore=apps/backend/tests/integration
	$(CRON) pytest apps/cron/tests
	$(MCP) pytest apps/mcp/tests
	$(WEB) run test:unit

test-integration: test-db
	TEST_DATABASE_URL="$(TEST_DATABASE_URL)" $(BACKEND) pytest apps/backend/tests/integration

# Alembic reads apps/backend/alembic.ini, and script_location in it is relative,
# so these run from that directory rather than the repo root.
migrate:          ## apply migrations to DATABASE_URL
	cd apps/backend && uv run alembic upgrade head

stamp:            ## one-time: record an already-populated database as at 0001
	cd apps/backend && uv run alembic stamp 0001

token:            ## mint an MCP token, e.g. make token NAME=claude-desktop
	@test -n "$(NAME)" || { echo "usage: make token NAME=<label>"; exit 1; }
	$(MCP) python scripts/mint_token.py "$(NAME)"

lint:
	$(WEB) run lint

# FastAPI/Pydantic own the wire schema; both artifacts below are generated.
api-contracts:
	$(BACKEND) python scripts/export_openapi.py apps/frontend/openapi.json
	$(WEB) run api:generate

api-contracts-check: api-contracts
	git diff --exit-code -- apps/frontend/openapi.json apps/frontend/src/api/schema.ts

check: api-contracts-check
	$(WEB) run lint
	$(WEB) run typecheck
	$(BACKEND) lint-imports --config apps/backend/.importlinter

e2e-db:
	@DB_URL="$(E2E_DATABASE_URL)"; $(DB_GUARD)
	cd apps/backend && DATABASE_URL="$(E2E_DATABASE_URL)" uv run alembic upgrade head
	psql -v ON_ERROR_STOP=1 "$(E2E_DATABASE_URL)" -f apps/frontend/e2e/fixtures/catalogue.sql

test-db:
	@DB_URL="$(TEST_DATABASE_URL)"; $(DB_GUARD)
	cd apps/backend && DATABASE_URL="$(TEST_DATABASE_URL)" uv run alembic upgrade head
	psql -v ON_ERROR_STOP=1 "$(TEST_DATABASE_URL)" -f apps/frontend/e2e/fixtures/catalogue.sql

e2e: e2e-db
	E2E_DATABASE_URL="$(E2E_DATABASE_URL)" $(WEB) run e2e

verify: check test e2e

verify-full: verify build
	$(BACKEND) python -c "from jobber.api.app import app; app.openapi()"

clean:
	rm -rf apps/backend/.venv apps/cron/.venv apps/mcp/.venv \
	       apps/frontend/node_modules apps/frontend/dist
