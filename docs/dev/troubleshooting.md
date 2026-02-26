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

## Live Integration Rate Limits
- OAuth 429 can occur under tenant/API throttling.
- Live tests include retry and skip semantics for transient startup failures.
- Re-run tests during lower-traffic windows when needed.
