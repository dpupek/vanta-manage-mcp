# VantaMcp API Expansion Roadmap

FogBugz epic: https://darwin-global.fogbugz.com/f/cases/248793/

## Phase 1: OpenAPI Parity Refresh

- [ ] Refresh public Vanta Manage, Audit, and Connectors OpenAPI specs under `openapi/`.
- [x] Regenerate `src/generated/operations.generated.ts` and `src/generated/manifest.generated.json` for the selected Manage parity additions.
- [x] Record operation count deltas and any endpoints present in docs but unavailable as downloadable specs.
- [x] Run `npm run verify:spec-parity`.

Notes:

- Current pinned specs generate 222 operations after adding selected Manage parity endpoints for risk-scenario control linking and users.
- September 9, 2026 review: authoritative public downloads are available at the [Manage](https://developer.vanta.com/reference/manage-vanta.json), [Audit](https://developer.vanta.com/reference/auditor-api.json), and [Integrations](https://developer.vanta.com/reference/build-integrations.json) reference URLs. The earlier download blocker is obsolete.
- Published operation counts are 240 Manage, 57 Audit, and 25 Integrations (322 total), versus 222 pinned operations. Contract refresh and the 100 additional operations remain planned separately from urgent runtime corrections.

## Phase 2: Agent-Safe Response Contract

- [x] Normalize success and error envelopes with warnings, correlation ID, tenant identity, and pagination metadata.
- [x] Add machine-readable `capabilities` tool.
- [x] Translate idempotent `422 already mapped` responses into success no-ops.
- [x] Translate policy-derived document identifier failures into actionable validation errors.
- [x] Return executable fallback batches when writes are disabled.

## Phase 3: Unsupported Surface Boundaries

- [x] Document Vanta object boundaries: Policy, Policy approval test, Document, Control-test mapping, Control-document mapping, and Policy-control mapping.
- [x] Add unsupported-operation tools for policy-control linkage and direct Manage test comments.
- [x] Ensure unsupported tools return UI/control-note fallback guidance instead of pretending API support exists.
- [x] Clarify docs/playbooks that control-test remaps are not policy relinks.

## Phase 4: Markdown Evidence Conversion

- [x] Add `.md` preflight detection for upload tools.
- [x] Convert Markdown to PDF by default before upload.
- [x] Add PDF footer with document name on the left and `Page X of Y` on the right.
- [x] Add optional DOCX conversion for editable evidence.
- [x] Return conversion metadata in upload responses.

## Phase 5: Validation

- [x] Add unit tests for envelope shape, capability output, policy slug validation, idempotent mapping behavior, pagination metadata, upload type details, and Markdown conversion arguments.
- [x] Add mock integration coverage for unsupported surfaces and `.md` upload conversion.
- [x] Run `npm run lint`.
- [x] Run `npm test`.
- [x] Run `npm run verify:spec-parity`.
- [x] Run `npm run test:integration:mock`.
- [ ] Run live integration only with credentials and mutation gates enabled.

Validation notes:

- `npm run lint` passed.
- `npm test` passed: 62 tests.
- `npm run verify:spec-parity` passed: 222 operations mapped to 222 unique tools.
- `npm run test:integration:mock` passed: 8 tests.
- Live integration was not run in this pass.

## Phase 6: Integration Resource Owner Assignment

- [x] Review Vanta guide for assigning owners to resources.
- [x] Add plan/execute workflow for integration resource owner, description, and in-scope updates.
- [x] Validate owners are CURRENT Vanta people before mutation.
- [x] Split bulk updates into Vanta-compliant batches of 50 or fewer updates.
- [x] Return partial per-resource failures as structured workflow output with warnings.
- [x] Update help prompts and user docs to distinguish integration resource ownership from control, document, and policy ownership.
- [x] Resolve owner email across paginated CURRENT people results before reporting no match.

Validation notes:

- `npm run build; node --test build/test/workflows.test.js` passed: 6 workflow tests.
- `npm run lint` passed.
- `npm test` passed: 66 tests.
- `npm run verify:spec-parity` passed: 222 operations mapped to 222 unique tools.
- `npm run test:integration:mock` passed: 8 tests.

## Phase 7: Focused urgent runtime improvements

See [baseline, workflow/CRC decomposition, decisions, and implementation evidence](urgent-improvements.md).

- [x] Correct API-family URL construction and prepared-upload lifetime.
- [x] Validate workflow batches and report failed/skipped outcomes.
- [x] Enforce nested generated request contracts for all callers.
- [x] Add operation-aware retries, request deadlines, and cancellation.
- [x] Bound workflow pagination and expose completeness/resume metadata.

This phase preserves the 222-operation pinned surface. Live tenant validation and the full public-contract refresh remain outstanding.

### September 9 completion checkpoint

- [x] Fix the review finding: vulnerability deactivation, reactivation, and SLA acknowledgement inspect every bulk result before declaring action success.
- [x] Validate the final implementation with all 124 unit/mock integration tests passing, including 15 bulk-outcome regression cases.
- [x] Verify pinned parity: 222 operations mapped to 222 unique tools.

### Next iteration

1. [ ] Validate this checkpoint against an authorized test tenant: read-only calls across API families, then controlled upload and mutation readback. Record scope/permission failures separately from code defects.
2. [ ] Refresh all three public OpenAPI contracts and record source URLs, retrieval timestamps, hashes, operation identities, and request-schema differences before regeneration. The September 9 comparison identified 100 additional operations.
3. [ ] Regenerate tools and help, review breaking input changes, and add regression coverage for changed contracts; rerun parity and mock integration checks.
4. [ ] Prioritize workflow expansion after contract refresh: issues/event logs and vendor assessments first, followed by risk/control and audit lifecycle capabilities.

Engineering implementation is complete; live tenant acceptance, deployment, and the broader contract refresh remain open.
