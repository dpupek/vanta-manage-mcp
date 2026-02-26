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
