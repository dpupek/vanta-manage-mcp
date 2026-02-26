# Troubleshooting

## `confirmation_required` on writes
Cause:
- Safe mode is enabled and tool call omitted `confirm: true`.

Fix:
- Re-run with `confirm: true`.
- For workflows, also set `mode: "execute"`.

## Missing generated manifest/tools
Cause:
- Generated artifacts are stale or absent.

Fix:
- Run `npm run generate`.
- Verify `src/generated/operations.generated.ts` and `src/generated/manifest.generated.json` exist.
- Run `npm run verify:spec-parity`.

## Credential loading failures
Cause:
- No credentials found or malformed `VANTA_ENV_FILE`.

Resolution order used by server:
1. `VANTA_ENV_FILE` JSON (`client_id`, `client_secret`)
2. `VANTA_CLIENT_ID` + `VANTA_CLIENT_SECRET`

Fix:
- Set one of the supported credential inputs.
- Validate JSON shape and path permissions for `VANTA_ENV_FILE`.

## Git-based `npx` fails before execution
Cause:
- Build step failed during `prepare`.

Fix:
- Run locally:
- `npm install`
- `npm run build`
- Confirm Node version is 20+.

## Lint includes unintended folders
Cause:
- Temporary source import folders or build folders are being linted.

Fix:
- Remove temp folders like `_upstream/`.
- Keep ESLint ignore list updated for generated/build directories.

