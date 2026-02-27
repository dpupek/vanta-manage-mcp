# Conventions

## Tool Naming

- `snake_case` only.
- No dotted names.
- Connector generated tools use `connector_` prefix.
- Collision handling is deterministic (`audit_` disambiguation and explicit overrides).

## Response Contract

All tools must return envelope-form responses and never crash MCP transport:

- Success: `success: true`
- Error: `success: false` with structured `error` object
- Error objects should include compact actionable `agentHint` guidance whenever a concrete next step can be provided.

## Safety Contract

- Mutations require `confirm:true` in safe mode.
- Workflow tools use `mode:"plan"|"execute"`; execute requires confirmation.
- Multipart upload tools require `filePath` (base64 payloads are not accepted).

## Logging Conventions

- Use centralized logger (`src/logging/logger.ts`), never ad hoc `console.error` for server/runtime events.
- Emit structured events with stable `event` keys and contextual fields.
- Respect `VANTA_MCP_LOG_LEVEL` modes:
  - `quiet`: fatal only
  - `minimal`: error/warn/info
  - `verbose`: minimal + debug
  - `all`: verbose + trace
- Never log request/response payload content, tokens, or secrets.

## Codegen Boundaries

Generated artifacts:

- `src/generated/operations.generated.ts`
- `src/generated/manifest.generated.json`

Source specs:

- `openapi/manage-v1.json`
- `openapi/audit-v1.json`
- `openapi/connectors-v1.json`

## Test Conventions

- Use AAAA test structure: Arrange, Initial Assert, Act, Final Assert.
- Mock tests must verify envelope semantics for API/network failures.
- Live write tests must include readback verification and cleanup.
