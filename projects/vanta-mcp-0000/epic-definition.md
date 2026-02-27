# Epic Definition: Full-Capability Vanta MCP Server

## Big Idea

Build a TypeScript MCP server in this repository that exposes complete Vanta API coverage across Manage, Audit, and Connectors APIs, with safe-by-default write behavior and specialized triage/evidence workflows.

## Success Criteria

- [ ] 100% operation parity across all three pinned OpenAPI specs.
- [ ] Dual-layer tools are available:
- endpoint-parity tools generated from OpenAPI
- specialized workflow tools for common operations (controls/evidence, failing control triage, vendor triage, people/assets/vulnerability triage, information requests)
- [ ] All mutating tools require explicit confirmation (`confirm: true`) in safe mode.
- [ ] Tool responses use a consistent JSON envelope for success/error.
- [ ] Error envelopes include compact actionable `agentHint` guidance when possible (resource/playbook pointers for AI agents).
- [ ] Generated outputs are committed and checked for drift in CI.
- [ ] Core scenarios are covered with unit + parity + workflow tests.

## Non-Goals (v1)

- [ ] Build a separate web UI.
- [ ] Add business-specific policy logic beyond safe-mode + explicit workflow execution.
- [ ] Introduce runtime code generation.

## Risks

- [ ] OpenAPI schema variance (multipart, oneOf/anyOf, nullable semantics) may need incremental generator hardening.
- [ ] Write endpoints can cause irreversible state changes without strict confirmation enforcement.
- [ ] Large payload upload + retry behavior can introduce duplicate actions if idempotency is not handled carefully.
