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
- Use `VANTA_ENV_FILE` or direct env vars (`VANTA_CLIENT_ID`, `VANTA_CLIENT_SECRET`).
- Do not commit credential files.
- Rotate credentials on exposure or operator turnover.

## Logging and Redaction
- Do not log raw secrets, bearer tokens, or file content payloads.
- Error envelopes may include API-side details; treat output as sensitive in shared channels.
- Prefer short retention for server stderr/stdout logs.
