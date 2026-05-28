# VantaMcp API Expansion Roadmap

FogBugz epic: https://darwin-global.fogbugz.com/f/cases/248793/

## Phase 1: OpenAPI Parity Refresh

- [ ] Refresh public Vanta Manage, Audit, and Connectors OpenAPI specs under `openapi/`.
- [x] Regenerate `src/generated/operations.generated.ts` and `src/generated/manifest.generated.json` for the selected Manage parity additions.
- [x] Record operation count deltas and any endpoints present in docs but unavailable as downloadable specs.
- [x] Run `npm run verify:spec-parity`.

Notes:

- Current pinned specs generate 222 operations after adding selected Manage parity endpoints for risk-scenario control linking and users.
- Current Vanta public docs index at `https://developer.vanta.com/llms.txt` lists 262 API reference entries.
- `https://developer.vanta.com/api-reference/openapi.json` currently returns a placeholder "OpenAPI Plant Store" spec, not Vanta Manage/Audit/Connectors specs.
- `https://api.vanta.com/openapi.json` and `/v1/openapi.json` require authorization, so public refresh is blocked until Vanta publishes or grants authoritative specs.

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
