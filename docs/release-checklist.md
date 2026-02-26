# Release Checklist

Use this before tagging or publishing a new server version.

## Generation and Parity
- Run `npm run generate`.
- Run `npm run verify:spec-parity`.
- Confirm expected operation totals (current baseline: 219).

## Quality Gates
- Run `npm run lint`.
- Run `npm test`.
- Run `npm run build`.

## Docs
- Run `npm run generate:help`.
- Confirm docs are current:
- `docs/vanta-mcp-help.md`
- `docs/migration-read-only-to-full-management.md`
- `docs/mcp-config-examples.md`
- `docs/security.md`

## Packaging and Runtime
- Confirm `package.json` includes:
- `bin` -> `build/index.js`
- `prepare` -> `npm run build`
- `engines.node` >= 20
- Confirm CI main-release workflow exists and targets `main`:
- `.github/workflows/release-main-tag.yml`
- Smoke test local:
- `node build/index.js`
- Smoke test Git-based npx:
- `npx github:<org>/<repo>`
- Smoke test tag-pinned Git npx:
- `npx github:dpupek/vanta-manage-mcp#v1.0.<buildnumber>`

## Main Auto-Release Tag Contract
- Tag format must match: `^v1\.0\.\d+$`
- Build number source: `${{ github.run_number }}`
- Canonical release source is git tag + GitHub Release (no package.json writeback required).
- Workflow rerun behavior:
- If the computed tag already exists, workflow exits successfully as no-op for release creation.

## Final Review
- Verify safety defaults:
- `VANTA_MCP_SAFE_MODE=true`
- `VANTA_MCP_ENABLE_WRITE=true` (or intentional override)
- Confirm no credentials/secrets in tracked files.
- Confirm changelog/release notes are updated.
