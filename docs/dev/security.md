# Security Guidance

## Least Privilege
- Prefer separate credentials per environment.
- Scope credentials to only the Vanta capabilities needed by the MCP deployment.
- Restrict exposed tools with `VANTA_MCP_ENABLED_TOOLS` when full parity is not required.

## Write Safety Defaults
- `VANTA_MCP_SAFE_MODE=true` by default.
- All mutating endpoint tools require `confirm=true` in safe mode.
- Workflow tools require `mode=execute` and `confirm=true`.

## Secret Handling
- Use direct env vars (`VANTA_CLIENT_ID`, `VANTA_CLIENT_SECRET`) or `VANTA_ENV_FILE` (JSON or dotenv format).
- If both direct env vars and `VANTA_ENV_FILE` are set, direct env vars are used.
- Do not commit credential files.
- Rotate credentials on exposure or operator turnover.

## Live Integration Test Safety
- Live integration tests are opt-in and should be run only when explicitly requested.
- Enable live tests with `VANTA_INTEGRATION_LIVE=true`.
- Enable mutations only with `VANTA_INTEGRATION_ALLOW_MUTATIONS=true`.
- Use dedicated non-production credentials whenever possible.
- If a cleanup step fails, treat reported artifact IDs as sensitive operational data and remediate promptly.

## Logging and Redaction
- Do not log raw secrets, bearer tokens, or file content payloads.
- Runtime logging uses structured JSON to `stderr` and supports `VANTA_MCP_LOG_LEVEL=quiet|minimal|verbose|all`.
- Sensitive fields are redacted by key pattern (for example token/authorization/secret/password/apiKey/cookie).
- Error envelopes may include API-side details; treat output as sensitive in shared channels.
- Prefer short retention for server stderr/stdout logs.

