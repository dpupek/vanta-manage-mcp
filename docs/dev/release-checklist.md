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
- `docs/dev/help-surface-reference.md`
- `docs/dev/migration-read-only-to-full-management.md`
- `docs/user/get-started-codex.md`
- `docs/user/get-started-claude.md`
- `docs/dev/security.md`

## Breaking Change Callouts
- If multipart upload interfaces changed, add an explicit release note with migration guidance.
- Current required callout: upload tools no longer accept `contentBase64`/`filename`; use `filePath` (+ optional `mimeType`) instead.
- Confirm user docs include the same migration note:
- `docs/user/get-started-codex.md`
- `docs/user/get-started-claude.md`
- `docs/user/interface-overview.md`

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
- `npx github:dpupek/vanta-manage-mcp`
- Smoke test tag-pinned Git npx:
- `npx github:dpupek/vanta-manage-mcp#v1.0.<buildnumber>`

## MVP Exit Checks
- Verify tagged release install in Codex using `npx github:dpupek/vanta-manage-mcp#v1.0.<buildnumber>`.
- Verify tagged release install in Claude Desktop using the same pinned tag.
- Confirm both clients can discover tools/resources/prompts and call `help`.
- Confirm accepted live-test policy:
- pass with transient OAuth throttle skips allowed, or
- strict no-skip pass requirement.

## Main Auto-Release Tag Contract
- Tag format must match: `^v1\.0\.\d+$`
- Build number source: `${{ github.run_number }}`
- Canonical release source is git tag + GitHub Release (no package.json writeback required).
- Moving tag: `stable` must be force-updated to the successful main release commit.
- Workflow rerun behavior:
- If the computed tag already exists, workflow exits successfully as no-op for release creation.
- `stable` is still updated on successful reruns and points to the current `main` release commit.

## Final Review
- Verify safety defaults:
- `VANTA_MCP_SAFE_MODE=true`
- `VANTA_MCP_ENABLE_WRITE=true` (or intentional override)
- Confirm no credentials/secrets in tracked files.
- Confirm changelog/release notes are updated.

