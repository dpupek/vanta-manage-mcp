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
1. `VANTA_CLIENT_ID` + `VANTA_CLIENT_SECRET`
2. `VANTA_ENV_FILE` (JSON with `client_id`/`client_secret` or dotenv with `VANTA_CLIENT_ID`/`VANTA_CLIENT_SECRET`)

Fix:
- Set one of the supported credential inputs.
- Validate file shape and path permissions for `VANTA_ENV_FILE`.
- If only one direct env var is set, add the missing credential env var.

## API reads return `404` on `/controls` or `/documents`
Cause:
- API base URL is missing `/v1`, or requests are pointed at a non-v1 root.

Fix:
- Use `VANTA_API_BASE_URL=https://api.vanta.com/v1`.
- Keep OAuth on root origin (`VANTA_OAUTH_BASE_URL=https://api.vanta.com`) unless your environment requires a different auth host.

## Live integration tests skip unexpectedly
Cause:
- Live test guard flags were not enabled.

Fix:
- Set `VANTA_INTEGRATION_LIVE=true`.
- For mutating live tests, set `VANTA_INTEGRATION_ALLOW_MUTATIONS=true`.
- Set `VANTA_INTEGRATION_REQUIRE_MUTATION=true` if mutation permission must fail (instead of skip).

## Live integration cleanup failure
Cause:
- The test created an artifact but could not delete it (permissions, transient API issue, or tenant policy).

Fix:
- Use the reported document ID to clean up manually in Vanta.
- Re-run live tests after confirming write permissions for the credential scope.

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
