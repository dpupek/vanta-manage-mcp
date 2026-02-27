# Developer Troubleshooting

## Parity Drift (`verify:spec-parity` fails)

- Re-run `npm run generate`.
- Confirm pinned OpenAPI snapshots are current.
- Check for naming collisions or unsupported schema shapes.

## Lint/Type/Test Failures

- Run `npm run lint` and `npm test` locally.
- Verify generated artifacts are present before testing.

## Build Failures in Git-based `npx`

- Ensure `prepare` still executes `npm run build`.
- Confirm `bin` points at `build/index.js`.

## Release Pipeline Issues

- Validate tag format `v1.0.<buildnumber>`.
- Confirm main-release workflow has `contents: write`.
- Confirm idempotency guard handles existing tags.
- Confirm moving tag update succeeds (`stable` should point at latest successful main release commit).

## Live Integration Rate Limits

- OAuth 429 can occur under tenant/API throttling.
- Live tests include retry and skip semantics for transient startup failures.
- Re-run tests during lower-traffic windows when needed.

## Runtime Diagnostics

- Increase server logging verbosity for diagnostics:
  - `VANTA_MCP_LOG_LEVEL=verbose` for request/retry lifecycle visibility
  - `VANTA_MCP_LOG_LEVEL=all` for trace-level metadata
- Backward-compatible alias: `VANTA_MCP_VERBOSE=true` (used only when `VANTA_MCP_LOG_LEVEL` is unset).
