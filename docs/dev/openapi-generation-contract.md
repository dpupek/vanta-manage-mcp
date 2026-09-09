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
- JSON request bodies map to `body`, retaining their schema.
- Referenced input schemas are retained per API family in `generatedSchemaDefinitions`. Runtime validators enforce nested required properties, enums, bounds, string formats, nullable values, arrays, and compositions.
- Direct MCP calls and internal workflow calls share `buildOperationSchema`; invalid arguments return `validation_error` before HTTP.
- Unknown body properties follow the pinned `additionalProperties` contract.
- Multipart request bodies map to MCP-friendly fields:
- `filePath` is required only when the file property is required by the contract.
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

## Runtime contract

Connector operation paths already contain `/v1`; URL resolution removes the duplicate version from the configured base. Manage and Audit retain their base version, and custom proxy path prefixes are preserved.

Endpoint invocation owns prepared upload files until the HTTP request settles, including retry attempts. Conversion/preflight failures clean their own artifacts; caller-owned sources are preserved.

`VANTA_REQUEST_TIMEOUT_MS` bounds an API request including its OAuth wait, fetch, response body, and retry delays (default 60000, accepted range greater than zero through 300000 ms). MCP cancellation propagates through endpoint, compatibility, and workflow calls. OAuth refresh is single-flight and has its own deadline; cancelling one waiter does not cancel a refresh shared by other requests.

Reads (GET/HEAD/OPTIONS) retry transient transport failures and HTTP 408/429/500/502/503/504 at most twice. All methods may retry authentication rejection once and rate-limit rejection within the same attempt budget. Conflicts and ambiguous mutation failures are returned without replay. Retry-After seconds and HTTP dates are honored; a delay beyond the deadline causes timeout rather than an early retry.

Workflow collections default to 100 items per page and ten pages per inventory. Explicit pageSize/maxPages accept 1–100. Missing completion indicators/cursors, repeated cursors, and failed pages return errors with partial evidence. A page limit returns an incomplete collection with a resume cursor and warning. Resource discovery must be complete before bulk mutation; explicitly reviewed resourceIds can be supplied instead.
