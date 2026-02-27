# Migration Guide: Read-Only to Full Management

## What Changed

- The server now exposes full endpoint parity for:
- Manage API
- Audit API
- Connectors API
- Mutating tools are safe-by-default and require explicit confirmation.
- Workflow tools are available for common multi-step operations.
- Git-based `npx` execution is supported through `prepare` (`npm run build`).

## Backward Compatibility

- Compatibility read tools are preserved (`controls`, `documents`, `tests`, `integrations`, `frameworks`, `vulnerabilities`, `people`, `vendors`, `risks`, and supporting list/resource tools).
- Responses are now standardized JSON envelopes for both success and error outcomes.

## Required Environment Updates

1. Keep existing `VANTA_ENV_FILE` (JSON with `client_id` and `client_secret`) or set direct credentials:

- `VANTA_CLIENT_ID`
- `VANTA_CLIENT_SECRET`

2. Optional safety/config flags:

- `VANTA_MCP_SAFE_MODE=true` (default)
- `VANTA_MCP_ENABLE_WRITE=true` (default)
- `VANTA_MCP_ENABLED_TOOLS=tool_a,tool_b` (allowlist)

## Mutation Behavior

1. Endpoint tools:

- Add `confirm: true` to execute mutating calls.
- Without confirmation in safe mode, tool returns `confirmation_required`.

2. Workflow tools:

- Use `mode: "plan"` to preview.
- Use `mode: "execute"` with `confirm: true` to apply.

## Verification Checklist

- Run `npm run build`
- Run `npm test`
- Run `npm run lint`
- Run `npm run verify:spec-parity`

## Git npx Note

- For `npx github:<org>/<repo>` and `npx git+https://...`, npm runs `prepare` during install, which compiles `build/index.js` before execution.
