# Urgent runtime improvements

Parent epic: [248793](https://darwin-global.fogbugz.com/f/cases/248793/). Baseline: `fbd704c`, September 9, 2026.

## Recommendation capture

The September 9 review compared 222 pinned operations with 322 operations in the published Manage (240), Audit (57), and Integrations (25) specifications. The public specifications are now downloadable from https://developer.vanta.com/reference/manage-vanta.json, https://developer.vanta.com/reference/auditor-api.json, and https://developer.vanta.com/reference/build-integrations.json. The earlier spec-download blocker is obsolete.

Prioritize runtime correctness, then contract refresh, then workflow expansion. Additional recommended capabilities are issues/event logs, deactivated controls, vendor assessments, risk-control lifecycle, current audit populations/snapshots, Knowledge Base/Answer Library, and Customer Trust administration. Later maintenance work includes exact spec identity/schema comparison, provenance, PR validation, and moving evaluations to the active registry. These broader expansions remain separate from this implementation's five urgent requirements.

## Baseline and edge cases

1. Connector paths include `/v1`, while the shared base defaults to `https://api.vanta.com/v1`. Requests become `/v1/v1/resources/...`. Manage/Audit paths omit the version. Custom base URLs used by tests must keep working.
2. Multipart preparation uses a file-backed Blob, then removes converted Markdown output before fetch consumes it. Conversion failures can also leak temporary directories. Caller-owned source files must never be removed.
3. Failing-control deactivation actions lack a reason; workflows wrap failed actions in a successful outer envelope. Dependent evidence uploads continue after failed linkage. Invalid later actions can follow already-applied writes.
4. Generated schemas retain primitive types but lose nested constraints. Enums, ranges, required JSON properties, unions, and nullability are not enforced. Internal workflow dispatch bypasses MCP validation. Optional multipart files must remain optional.
5. Requests retry ambiguous writes on conflicts/server errors, lack deadlines/cancellation, and several triage plans fetch one page only. Expired OAuth refresh, Retry-After dates, repeated/missing cursors, page limits, and failures after earlier pages need explicit outcomes.

## Workflows and CRCs

| Workflow                   | Developer/operator outcome                                                                                  | Responsibilities and collaborators                                                                                                                |
| -------------------------- | ----------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| W1 Call any API family     | Correct URL for Manage, Audit, and Connectors with configured environments                                  | `VantaApiClient` resolves URLs; generated operation metadata supplies API source; configuration supplies base URLs.                               |
| W2 Upload evidence         | Prepared files survive request completion/retries and are cleaned on every exit                             | Endpoint invocation owns upload lifetime; upload preflight prepares files; Markdown converter cleans its own failed conversions.                  |
| W3 Execute a batch         | Validate before writing, report each outcome, skip dependent work after failure                             | Workflow action schemas describe inputs; shared endpoint invocation validates contracts; workflow result aggregation reports counts and failures. |
| W4 Invoke a typed tool     | Invalid payloads fail locally with actionable paths                                                         | Build-time generator preserves referenced schemas; schema builder creates Zod validators; endpoint invocation validates all callers.              |
| W5 Read/retry bounded work | No ambiguous write replay; cancellation and deadlines bound requests; paginated plans disclose completeness | Client and token manager share request deadline; pagination helper checks cursor progress and page budget; workflows expose resumable results.    |

## Decisions

- Implement the five urgent improvements against the pinned contracts; refreshing all specs would mix in breaking changes and 100 unrelated endpoint additions.
- Keep existing tool names, confirmation gates, filePath uploads, and custom API URL configuration.
- Use schema-derived validation for direct and internal calls. Fix workflow payloads that fail the existing published contract rather than weaken validation.
- Keep pagination bounded and report partial/incomplete results explicitly. Avoid claiming a complete inventory from a partial page.
- Retry reads after transient failures; do not automatically replay ambiguous writes. Authentication/rate-limit rejection can be retried within the deadline. Conflicts are returned to the caller.
- Existing epic 248793 associates the tasks below. No new tracker cases or deployment are required; the subsequent user request authorizes committing the completed implementation.

## Iteration roadmap

### Iteration 1 â€” routing and upload lifetime (W1, W2)

- [x] Preserve each API family's version/base-path convention.
- [x] Keep converted files until request completion, including errors/retries.
- [x] Clean failed conversions and preserve caller-owned input files.
- [x] Validate URL matrices and consume real multipart bytes before/after request completion.

### Iteration 2 â€” truthful workflow outcomes (W3)

- [x] Add action-specific validation, including deactivation reasons.
- [x] Validate batches before mutations and report succeeded/failed/skipped counts.
- [x] Stop dependent evidence steps after failure and handle plan-read failures.
- [x] Test failures, mixed outcomes, invalid batches, and successful actions.

### Iteration 3 â€” generated request contracts (W4)

- [x] Preserve nested schemas, refs, enum values, bounds, nullability, and compositions.
- [x] Enforce the same contract for direct and workflow dispatch.
- [x] Retain correct multipart file requirements and field schemas.
- [x] Verify all generated tool schemas register and test realistic invalid/valid nested payloads.

### Iteration 4 â€” retry, deadline, cancellation, and pagination (W5)

- [x] Use operation-aware retries; return conflicts and ambiguous mutation failures without replay.
- [x] Bound OAuth, fetch, body reads, and backoff with deadline/cancellation.
- [x] Support bounded Retry-After handling and deterministic retry tests.
- [x] Paginate triage inventories with limits, cursor checks, and completeness/resume metadata.
- [x] Test multiple pages, missing/repeated cursors, page limits, and partial failures.

### Completion audit

- [x] Update user/developer documentation and parent roadmap with actual behavior and evidence.
- [x] Run full tests, lint, scoped formatting, generation/parity checks, and diff checks.
- [x] Review evidence against all five requirements; distinguish local verification from live tenant validation.

## Validation log

Baseline review: 70 tests, lint, and pinned parity passed; targeted reproductions exposed duplicated connector URLs, file-backed Blob read failure after cleanup, successful workflow envelopes with failed actions, and acceptance of invalid enum/page-size inputs.

Iteration 1: build passed; 21 focused routing/upload/endpoint/conversion tests passed. Added conversion-failure cleanup coverage and reran the six conversion tests successfully. Multipart lifecycle tests consume real file-backed bytes twice and prove cleanup after success, HTTP failure, and thrown transport failure while preserving the original source.

Iterations 2â€“3: 30 focused schema/workflow/endpoint tests passed. Corrected two old fixtures that omitted API-required control fields. A full mock run registered all 251 tools successfully with the new input schemas. Mixed resource results now return workflow_failed with prior successes retained, missing results treated as unverified failures, and succeeded/failed/skipped counts.

Iteration 4 and completion: `npm test` passed all 109 unit/mock integration tests (zero failures/skips), including SDK registration of all 251 tools. `npm run lint` and `npm run verify:spec-parity` passed (222 operations, 222 unique tools). Scoped handwritten TypeScript/Markdown formatting and `git diff --check` passed; generated TypeScript uses the generator's emitted format.

Reliability coverage includes read/write replay matrices, bounded 401 refresh, Retry-After seconds/dates, deadline expiry while awaiting OAuth/fetch/body/backoff, caller cancellation, multipart field-only vendor status updates, multi-page inventories, page limits, missing/repeated cursors, failed later pages, top-level incomplete-plan warnings, and blocking incomplete discovered-resource writes. The persistent transport integration fixture now exhausts all three read attempts before asserting failure and subsequent session recovery.

All five urgent requirements are implemented and locally verified. No live tenant calls or mutations were used for this validation, and no deployment was performed. The user subsequently requested a progress update and commit of the completed implementation. Full current-contract refresh remains open in the parent roadmap.

## Review correction: vulnerability bulk outcomes

Baseline finding: the shared action aggregator counted HTTP 200 as success even when vulnerability updates returned per-item errors. Deactivation, reactivation, and SLA acknowledgement now require a matching SUCCESS result for every requested item before counting the action as successful. Failures preserve confirmed successes, failed/unconfirmed items, and the original API response under the action error details. Missing or mismatched results require readback before retrying.

Validation: TypeScript compilation and all 28 focused workflow tests passed, including 15 regression cases across the three bulk operations for success, failure, mixed, missing, and mismatched results.

Final commit checkpoint: `npm test` passed all 124 tests after the review correction; pinned parity remains 222 operations/222 unique tools. The parent roadmap records the remaining live acceptance and contract-refresh work.
