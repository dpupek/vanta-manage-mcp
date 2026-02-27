# OpenAPI Generation Contract

This document defines the stable contract for endpoint tool generation from pinned Vanta OpenAPI specs.

## Source Specs

- `openapi/manage-v1.json`
- `openapi/audit-v1.json`
- `openapi/connectors-v1.json`

## Naming Rules

1. Default name = `snake_case(operationId)`.
2. Connectors tools must be prefixed with `connector_`.
3. Audit collisions are disambiguated with `audit_` prefix.
4. Hard overrides:

- `CreateCustomControl` (manage) -> `create_custom_control`
- `CreateCustomControl` (audit) -> `audit_create_custom_control`
- `ListVulnerabilities` (manage) -> `list_vulnerabilities`
- `ListVulnerabilities` (audit) -> `audit_list_vulnerabilities`

5. Names must match `^[a-z0-9_]+$` and never include dots.

## Schema Mapping Rules

- Path/query params become top-level tool fields.
- JSON request bodies map to `body` (object).
- Multipart request bodies map to MCP-friendly fields:
- `filePath`
- `mimeType?`
- plus endpoint metadata fields from OpenAPI.

## Safety Rules

- Every mutating endpoint tool (`POST`, `PUT`, `PATCH`, `DELETE`, etc.) includes `confirm?: boolean`.
- If `VANTA_MCP_SAFE_MODE=true` and `confirm !== true`, return:
- `success: false`
- `error.code: "confirmation_required"`
- include an intent preview in error details.

## Response Envelope

- Success: `{ success: true, data, message?, notes? }`
- Error: `{ success: false, error: { code, message, hint?, agentHint?, details? }, notes? }`

## Required Verification

- `npm run generate`
- `npm run verify:spec-parity`
- `npm run lint`
- `npm test`
