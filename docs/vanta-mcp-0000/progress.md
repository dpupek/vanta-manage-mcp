# Progress Log

## 2026-02-26
- [x] Implemented full OpenAPI parity generation (Manage + Audit + Connectors, 219 operations).
- [x] Added safe-mode mutation confirmation and workflow plan/execute gating.
- [x] Added compatibility read tools and specialized workflow tools.
- [x] Added test suite for parity, safety, multipart, and workflows.
- [x] Added docs bundle (`vanta-mcp-help`, migration, config examples, security).
- [x] Enabled Git-based `npx` execution via package `prepare` script (`npm run build`).

## Gotchas (Carry Forward)
- Keep `_upstream/` and other temporary import folders out of lint/build scope.
- Keep `scripts/*.ts` covered by a dedicated TypeScript config (`tsconfig.scripts.json`) and ESLint project references.
- Always run `npm run verify:spec-parity` after OpenAPI or generator changes.
- Prefer script files over inline `node -e` for large generated markdown/docs to avoid escaping errors.
- For Git-based `npx`, keep `prepare` aligned with build output and `bin` path.
