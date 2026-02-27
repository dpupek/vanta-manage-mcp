# CRCs

## `src/client/vanta-client.ts` (`VantaApiClient`)

Responsibilities:

- Acquire and refresh OAuth token.
- Execute authenticated requests with retry/error translation.
- Build URLs, query strings, and multipart/form-data bodies.

Collaborators:

- `TokenManager`
- generated operation metadata
- envelope/error utilities

## `src/client/token-manager.ts` (`TokenManager`)

Responsibilities:

- Load credentials from env file/env vars.
- Cache token with expiration buffer.
- Serialize refresh to avoid races.

Collaborators:

- config module
- `VantaApiClient`

## `src/generated/operations.generated.ts` (`GeneratedOperationRegistry`)

Responsibilities:

- Store generated endpoint tool metadata and schemas.
- Map MCP tool names to OpenAPI operation details.

Collaborators:

- generation script
- endpoint registration layer

## `src/runtime/endpoint-tools.ts` (`EndpointToolRegistrar`)

Responsibilities:

- Register generated endpoint tools.
- Enforce mutation confirmation contract.
- Convert tool args into request objects and return envelopes.

Collaborators:

- `VantaApiClient`
- generated metadata
- envelope helpers

## `src/workflows/*.ts` (`WorkflowTool*`)

Responsibilities:

- Provide plan/execute orchestration for high-value workflows.
- Keep deterministic plan output and explicit execute gating.

Collaborators:

- endpoint invoker
- `VantaApiClient`

## `scripts/generate-tools.ts` (`OpenApiToolGenerator`)

Responsibilities:

- Load all pinned OpenAPI specs.
- Resolve naming collisions and emit generated registry/types.
- Emit summary manifest and parity metadata for tests.

Collaborators:

- `openapi/*.json`
- test suite + verify script
