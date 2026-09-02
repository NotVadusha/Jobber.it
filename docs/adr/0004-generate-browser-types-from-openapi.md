# Generate browser types from FastAPI OpenAPI

FastAPI Pydantic models are the browser API source of truth. The frontend will generate TypeScript types from the deterministic OpenAPI document. Verification will fail when checked-in generated types do not match the backend contract.
