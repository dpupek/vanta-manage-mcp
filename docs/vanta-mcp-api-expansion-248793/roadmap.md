# VantaMcp API Expansion Roadmap

FogBugz epic: https://darwin-global.fogbugz.com/f/cases/248793/

## Next delivery: download integrity and November API expansion

November 9, 2026: the [implementation plan](download-integrity-and-api-refresh-plan.md) decomposes the reported binary download failures and the API recommendations into ordered iterations, workflows, CRCs, proposed child cases, decisions, and acceptance gates. [Baseline](baseline.md), [epic definition](epic-definition.md), [workflows](workflows.md), [edge cases](edge-cases.md), [CRCs](crcs.md), and [stakeholder summary](stakeholder-summary.md) provide the supporting blueprint. Earlier checkpoints below remain historical evidence.

- [x] Capture source baseline and compare official contracts: 333 pinned versus 383 published operations; 50 additions, 44 existing operations with structural changes, no removals. Exact identities and source hashes: [November 9 inventory](contract-review-2026-11-09.json) (248793).
- [ ] Phase 0: reproduce the installed connector failure and settle file delivery, limits, identity, and fixture decisions (248793).
- [ ] Phase 1: preserve raw bytes through the active generated MCP path, persist files safely, and return SHA-256 receipts (248793).
- [ ] Phase 2: diagnose approved-policy artifact routes and provide a version-aware fallback without treating policy IDs as document IDs (248793).
- [ ] Phase 3: pin reviewed public contracts, expose all additions/changed inputs, preserve tool names and download handling, regenerate help (248793).
- [ ] Phase 4: extend vendor triage with alerts, external findings, settings, categories, and engagement relationships (248793).
- [ ] Phase 5: extend risk mappings and current issue filters/detail review (248793).
- [ ] Phase 6: add document evaluation and framework export/lifecycle recipes (248793).
- [ ] Phase 7: add personnel requirement-set/custom-requirement and group administration recipes (248793).
- [ ] Phase 8: complete scoped acceptance, retain implementation-write readback, release when authorized, and verify the installed runtime (248793).

The original planning revision did not change runtime behavior. Incident paths supplied by the user were unavailable locally; installed-runtime reproduction remains open. Child cases, tenant mutations, and publication have not been performed for this work.

### November 9 implementation checkpoint

Read-only follow-up: an existing AST PDF fetched directly and through the local generated operation matched byte-for-byte: 42,093 bytes and SHA-256 `524b82609ab1d72a315cb945454d2d0e76f6cab10cef6dee226958863fec4f3b`. The test file was removed; this establishes agreement for that retrieval, not identity with the original upload or the installed MCP. Mock tests now include redirects, 429 retry, truncated body, cancellation, 403 and write-disabled reads.

The [contract migration review](contract-schema-review-2026-11-09.md) and [field-level comparison](contract-schema-review-2026-11-09.json) cover the 44 structurally changed operations. The local vendor-alert and risk-mapping workflows use confirmed writes and independent readback; vendor triage also reads alert settings and selected-vendor details. Framework export, evaluation, personnel requirements, category and engagement maintenance have documented direct-tool recipes with operator readback, not new automatic write workflows. Live mutation acceptance and installed-runtime adoption remain open.

Validation for this follow-up: `npm test` passed 239 tests; lint, 383-to-383 spec parity, generated help, deterministic generated operation/manifest comparison and `git diff --check` passed. Mock stdio tests additionally exercise evaluation acceptance with unavailable results, framework export status, and personnel requirement readback. This checkpoint has not been published or installed in the connected MCP.

- Download media operations now stream to a server-local file with SHA-256 and source-identity receipts. Mock stdio tests exercise XLSX, PDF, PNG, JPEG, and non-UTF-8 text; local tests cover mismatches, size limits, cancellation, interrupted transfer, and existing-file preservation. The later direct API comparison above validates one existing PDF; installed-runtime acceptance and broader coverage remain open.
- The three public contracts were refreshed and pinned with source hashes. The generator produces 383 operations, and all 333 prior names retain their API family, method, and path. Generated help was refreshed.
- Vendor planning has an opt-in extended context for independently paginated organization-wide alerts, categories, selected-vendor external findings, and filtered security incidents. Issue planning accepts the documented filters and an optional issue detail. Alert and risk-mapping writes have verified local workflows; the other administrative paths remain direct-tool recipes with operator readback.
- A read-only review found that cancellation during file publication could leave a destination without a receipt. The fix waits for download cleanup, removes a destination published after cancellation, and has a deterministic race regression test.
- After the review fix `npm test` passed 212 tests; `npm run lint` and `git diff --check` passed. The earlier refreshed-spec parity check passed 383-to-383. The connected AST MCP reported version 1.0.22 and 333 operations; the new local implementation has not been installed there. These results do not establish live tenant acceptance. No live mutations, publication, or release were performed.
- Next slice: expand mock lifecycle and readback coverage for vendor settings/category/engagement and framework/personnel changes, including partial failures and permission denials. Retain direct-tool recipes until a verified operator need justifies additional orchestration; record live mutation acceptance separately.

## Phase 1: OpenAPI Parity Refresh

- [x] Refresh public Vanta Manage, Audit, and Connectors OpenAPI specs under `openapi/`.
- [x] Regenerate `src/generated/operations.generated.ts` and `src/generated/manifest.generated.json` for the selected Manage parity additions.
- [x] Record operation count deltas and any endpoints present in docs but unavailable as downloadable specs.
- [x] Run `npm run verify:spec-parity`.

Notes:

- The October 8 snapshot generated 333 operations (Manage 251, Audit 57, Connectors 25); the November 9 refresh generates 383 (Manage 301, Audit 57, Connectors 25). See the checkpoint above.
- September 9, 2026 review: authoritative public downloads are available at the [Manage](https://developer.vanta.com/reference/manage-vanta.json), [Audit](https://developer.vanta.com/reference/auditor-api.json), and [Integrations](https://developer.vanta.com/reference/build-integrations.json) reference URLs. The earlier download blocker is obsolete.
- The September 9 comparison found 322 public operations against 222 pinned. The September 10 download contains 323; this refresh adds 101 operations. Earlier validation counts below are historical checkpoints.

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
2. [x] Refresh all three public OpenAPI contracts and record source URLs, retrieval timestamps, hashes, operation identities, and request-schema differences before regeneration. The September 9 comparison identified 100 additional operations.
3. [x] Regenerate tools and help, review breaking input changes, and add regression coverage for changed contracts; rerun parity and mock integration checks.
4. [x] Expand issue/event-log planning and selected-vendor assessment context after contract refresh.
5. [ ] Extend risk/control and audit lifecycle workflows when operator needs justify them.

The September 9 runtime implementation is complete. Later checkpoints record contract refresh and workflow expansion; remaining live tenant acceptance is listed separately below.

### DG live validation checkpoint

- [x] Validate DG OAuth, Manage reads, bounded/resumable workflow pagination, and complete vendor inventory.
- [x] Validate disposable Markdown-to-PDF upload, file readback, source preservation, temporary cleanup, document deletion, and 404 readback.
- [x] Verify failed vulnerability workflow outcomes with an ID proven absent; no existing vulnerabilities changed.
- [x] Preserve HTTP status/raw error text when an unsuccessful API response contains malformed JSON (observed connector 403); verified with regression tests and a live DG read-only recheck.
- [ ] Complete Audit/Connector acceptance with permitted credentials and connector resource fixtures.
- [ ] Complete successful vendor/vulnerability/SLA lifecycle tests using dedicated fixtures.

Evidence and exact limits: [DG validation report](dg-validation-2026-09-09.md). Full live integration remains open; this checkpoint does not imply deployment.

### September 10 contract-refresh checkpoint

- [x] Pin all official contracts with retrieval timestamps and exact byte hashes.
- [x] Expand to 323 operations and preserve all 222 existing tool names.
- [x] Capture 31 changed input contracts and document risk-control payload migration.
- [x] Add six upload policies and retain confirmation gates across all 166 mutations.
- [x] Verify 131 unit/mock tests, exact identity parity, source hashes, and deterministic generation.
- [x] Regenerate help and validate four new Manage reads on DG.

Details: [contract refresh and migration](contract-refresh.md). Successful Audit/Connector access and new mutation lifecycle acceptance remain separate gates.

### Focused workflow expansion checkpoint

- [x] Add plan-only issue/event-log review with independent cursors and truthful completeness.
- [x] Add selected-vendor assessment history to vendor triage using a separate assessment cursor.
- [x] Validate 137 unit/mock tests and live DG planning reads.
- [x] Validate disposable PRIVATE Knowledge Base document create/update/delete with readbacks and confirmed cleanup.

Evidence and remaining acceptance boundaries: [workflow expansion](workflow-expansion.md). Seven workflows are implemented; Audit/Connector access and dedicated vendor/vulnerability/SLA lifecycle fixtures remain outstanding.

### Runtime release identity

- [x] Expose the built semantic version in the MCP initialization handshake and `capabilities` response.
- [x] Include the immutable release tag and commit SHA in `capabilities` when build metadata is available.
- [x] Generate build metadata during local/tagged Git installs, resolving tag refs from the repository when npm omits local tag refs, and provide CI release metadata before validation.

### October 8 capabilities iteration

Baseline, workflow/CRC decomposition, decisions, plan, and validation: [capabilities-2026-10-08.md](capabilities-2026-10-08.md).

- [x] Compare all three official specifications, record input/response deltas, and pin exact bytes with provenance (248793).
- [x] Generate ten new Manage endpoints and refreshed inputs across all API families (248793).
- [x] Verify control implementation editing, scoped reads, settings/mapping writes, new Trust Center inputs, audit linkage, and nullable connector payloads with unit/mock coverage (248793).
- [x] Regenerate help and complete deterministic generation, name preservation, parity, lint, and test gates: 188 tests passed; 333 endpoint tools; all 323 baseline names preserved (248793).

Live Audit/Connector and dedicated vendor/vulnerability/SLA acceptance remain separate from this locally validated API-capability implementation.

### Implementation-details persistence verification (248793)

- [x] Require independent exact GET readback before reporting success for implementation-details writes; preserve accepted-write context when verification fails.
- [x] Validate locally with 199 unit/mock tests, including 11 new regressions, and confirm the new `write_unverified` outcome on a disposable DG control.
- [x] Attempt a CMMC-mapped fixture, record the API mapping rejection, and confirm no partial creation; deactivate the separate negative-test fixture and verify cleanup.
- [x] Compare direct REST and UI edits on an existing DG CMMC control; confirm API writes have no visible effect, UI writes persist, API reads omit UI-saved values, and original content is restored.
- [x] Compare other metadata on the same existing CMMC control: five scalar fields persist and restore, an unconfigured custom-field label is rejected, and note null-to-empty normalization is recorded.
- [x] Verify public-API implementation-details persistence after Vanta's rollout correction: October 13 PATCH and independent GET return the exact temporary string, full UI reload shows it, and API clearing plus GET/UI reload confirm the original blank value on the existing CMMC control.
- [ ] Resolve the separate custom-control CMMC mapping question before claiming mapped-fixture coverage.
- [x] Retest October 9 after the reported vendor fix and requested support-email review: direct PATCH on the exact existing CMMC control returns 200, GET omits the field, and full UI reload remains blank. Explicit restoration and another reload confirm the original blank value. Disposable MCP write/replacement/clear also remain unverified and fixture cleanup passes.
- [x] Reply in the existing Vanta support thread with sanitized reproduction details and request verification of the affected workspace's public Controls API rollout; response pending.
- [ ] Release the locally validated readback guard when publishing is authorized.

Baseline, workflow, evidence, and Vanta support request: [implementation write verification](implementation-write-verification.md). The readback fix is local and has not been released.
