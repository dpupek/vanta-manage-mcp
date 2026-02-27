# Roadmap

## Phase 0: Shaping and Baseline

- [x] Create epic definition, workflows, baseline, edge cases, CRCs, stakeholder summary.
- [x] Document temporary epic folder and assumptions.

## Phase 1: Bootstrap

- [x] Import upstream `VantaInc/vanta-mcp-server`.
- [x] Remove read-only/default tool filtering bias.
- [x] Update runtime target to Node 20+ baseline.

## Phase 2: OpenAPI Ingestion + Generation

- [x] Add pinned specs under `openapi/`.
- [x] Implement generator for all three specs.
- [x] Emit generated tool metadata + schemas + manifests.
- [x] Add drift/parity verify command for CI.

## Phase 3: Client + Safety Layer

- [x] Add shared Vanta API client with token cache/refresh/retry.
- [x] Add envelope response contract helpers.
- [x] Enforce `confirm` for all mutating tools.
- [x] Add multipart base64 adapter.

## Phase 4: Workflow Tools

- [x] Add control evidence workflow.
- [x] Add failing controls triage workflow.
- [x] Add vendor triage workflow.
- [x] Add people/assets/vulnerability triage workflow.
- [x] Add audit information request triage workflow.

## Phase 5: Tests

- [x] Add generator naming/collision unit tests.
- [x] Add safe-mode/envelope/multipart tests.
- [x] Add spec parity test and uniqueness test.
- [x] Add workflow plan/execute gating tests.

## Phase 6: Docs + Release

- [x] Generate full tool catalog and examples.
- [x] Add migration guidance and MCP config examples.
- [x] Add security guidance (least privilege, write safety, secrets/logging).
- [x] Ensure Git-based `npx` usage works via package `prepare` build hook.
- [x] Add MCP help surface resources (`resource://vanta-manage/*`) for agent discoverability.
- [x] Add task playbook prompts (`playbook_*`) for workflow-guided usage.
- [x] Add fallback `help` tool for clients that do not consume resources.
- [x] Add shared help content generation so runtime resources and docs stay aligned.
- [x] Add live stdio smoke check for help surface (`npm run smoke:help-surface`).
- [x] Validate help surface against real credentials (`C:\Users\dan.pupek\.vanta\vanta-credentials-ast.env`).
- [x] Add main-branch auto-release workflow for tag pattern `v1.0.<buildnumber>`.
- [x] Add idempotent tag guard and GitHub Release creation in CI.
- [x] Document tag-pinned Git `npx` usage and release checklist updates.

## Phase 7: Integration Test Program (Live + Mock + OAuth Stability)

- [x] Add `VANTA_ENV_FILE` dotenv support and direct-env-first credential precedence.
- [x] Add shared live integration gating helper (`src/test/integration/shared/env.ts`).
- [x] Add fake Vanta API server for mocked MCP integration tests.
- [x] Add stdio MCP harness for end-to-end tool envelope assertions.
- [x] Add mocked integration tests for API 4xx/5xx envelope behavior.
- [x] Add mocked integration tests for transport failures (`request_failed` envelope).
- [x] Add mocked integration test for OAuth 401 refresh/retry flow.
- [x] Add live read/write integration tests with ephemeral document lifecycle + cleanup.
- [x] Add optional live control evidence linkage verification by env fixture.
- [x] Add live OAuth stability tests (repeat/concurrent/forced-refresh).
- [x] Add live vendor/finding lifecycle write tests with readback verification.
- [x] Add live vulnerability lifecycle write tests with readback verification.
- [x] Add mock vendor/finding lifecycle write tests with readback verification.
- [x] Add mock vulnerability lifecycle write tests with readback verification.
- [x] Add npm scripts for `test:integration`, `test:integration:mock`, `test:integration:live`.
- [x] Add manual `workflow_dispatch` CI workflow for live integration tests.
- [x] Update README/security/troubleshooting/config docs for new test and credential contracts.

## Phase 8: Agent-Centric Error Guidance

- [x] Extend error envelope contract to support `error.agentHint`.
- [x] Derive compact actionable hints for common error classes (`confirmation_required`, `api_error`, `request_failed`, `validation_error`, `write_disabled`).
- [x] Add explicit rate-limit guidance for `rate_limit_exceeded` responses.
- [x] Update user/dev contracts and help text to document `agentHint`.
- [x] Add unit tests validating hint derivation and explicit override behavior.

## Phase 9: Multipart Upload Contract Hardening

- [x] Replace multipart base64 upload execution contract with `filePath`-based uploads.
- [x] Add strict per-endpoint upload file policy (extension + MIME allowlist).
- [x] Add centralized upload preflight validation and map failures to structured envelopes.
- [x] Update endpoint tool schemas (`filePath`, optional `mimeType`) and remove base64 upload path.
- [x] Update workflow upload actions to pass `filePath` (`workflow_control_evidence`, `workflow_vendor_triage`).
- [x] Add upload-specific agent hints for preflight errors.
- [x] Update help surface and user/dev docs to remove base64 guidance.
- [x] Add schema/endpoint/mock/live test coverage for `filePath` upload behavior and policy enforcement.
- [x] Fix live delete-response parsing for empty JSON 204/205 responses and add regression coverage.
- [x] Re-run lint + deterministic tests + live integration suite and capture results in progress log.
