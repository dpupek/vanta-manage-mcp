# Download integrity and API refresh implementation plan

Epic: [248793](https://darwin-global.fogbugz.com/f/cases/248793/). Drafted November 9, 2026. Unchecked items include outstanding or partially completed work; see the checkpoints and validation notes below.

## Delivery order and case decomposition

Complete and validate each phase before starting the next. Dependencies: 0 → 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8. File integrity is delivered against the existing pinned contracts first, so it does not wait for 50 new endpoints. API generation in phase 3 must preserve the download fix. A validated download fix may be released separately before later workflows when publication is authorized.

| Priority / phase | Proposed child-case title                                               | Story / workflows | Scope                                                                     |
| ---------------- | ----------------------------------------------------------------------- | ----------------- | ------------------------------------------------------------------------- |
| P0 / 0           | Reproduce Vanta artifact corruption and settle transfer contract        | S1–S3 / W1–W3     | Baseline, installed version, evidence, design decisions                   |
| P0 / 1           | Preserve file bytes and return hash-verified download receipts          | S1–S2 / W1–W2     | Client, generated media dispatch, local persistence, registered MCP tests |
| P1 / 2           | Resolve approved-policy artifacts without confusing document identities | S3 / W3           | Supported routes, explicit limitations, browser/manual handoff            |
| P1 / 3           | Refresh public Vanta contracts and preserve tool compatibility          | S4 / W4           | All 50 additions, all changed contracts, generation/help                  |
| P1 / 4           | Extend vendor triage with alerts, external findings, and relationships  | S5 / W5           | Focused plan/read/write workflows                                         |
| P2 / 5           | Extend risk mappings and issue review                                   | S6 / W6           | Accounts/assets/integrations/issues and richer issue context              |
| P2 / 6           | Add document evaluation and framework administration recipes            | S7 / W7           | Jobs, exports, lifecycle, variants                                        |
| P2 / 7           | Add personnel requirement-set administration recipes                    | S8 / W8           | Requirement sets, custom requirements, group consequences                 |
| Gate / 8         | Validate, release, and verify installed Vanta MCP                       | S9 / W9           | Live matrix, retained readback guard, installed acceptance                |

All proposed children: **no case yet**, parent 248793. Task IDs below are stable planning IDs, not FogBugz IDs. Tracker creation is optional follow-up; implementation does not depend on new case creation. Owners are roles until assigned: maintainer (code/contracts), compliance reviewer (artifact identity), tenant administrator (fixtures/permissions), release owner (publication/adoption).

## Phase 0 — Baseline and overall decisions

### Evidence and reproduction

- [x] 0.1 Capture [current behavior](baseline.md), [workflows](workflows.md), [CRCs](crcs.md), and [edge cases](edge-cases.md) before source changes (248793).
- [x] 0.2 Compare all official contracts and record 333 pinned versus 383 published operations, 50 additions, 44 existing operations with structural changes, no removals, timestamps, and hashes in [inventory](contract-review-2026-11-09.json) (248793).
- [ ] 0.3 Record installed MCP version, commit, transport, host filesystem, tool names, tenant, and failing route. Confirm whether the installed path matches this source (248793).
- [ ] 0.4 Obtain sanitized incident extracts or reproduce reported failures using known-byte PDF, XLSX, PNG, JPEG, and text fixtures. Compare direct REST, generated MCP tool, compatibility alias if present, and browser artifact where needed; retain hashes/byte counts, not sensitive contents (248793).
- [ ] 0.5 Map each current/new file endpoint to direct stream, JSON URL, redirect, or asynchronous job; identify actual policy-version routes without guessing (248793).

### Decisions needed — overall contract

- [ ] 0.D1 Confirm stream-to-local-file as default delivery, with compact receipt and optional host-supported resource link. Never embed unrestricted binary/base64 payloads in model text. For remote MCP hosts, require a usable client handoff before claiming caller delivery (248793).
- [x] 0.D2 Select download root, configurable maximum bytes/deadline, filename rules, overwrite default (reject), and temporary-file cleanup policy. Default root is `~/VantaMcpDownloads`, default limit 100 MiB and deadline two minutes; these are configurable. Local file output is distinct from a Vanta mutation (248793). Remaining write-disabled download coverage is tracked in 1.9.
- [ ] 0.D3 Finalize receipt shape and mismatch retention. Proposed: retain completed differing representation with explicit mismatch status; leave failed/incomplete transfer unpublished (248793).
- [ ] 0.D4 Assign fixture/tenant owners and agree which live reads and disposable mutations are authorized for later acceptance. This plan alone makes no tenant changes (248793).
- [ ] 0.D5 Choose release boundaries: early download fix versus later contract/workflow releases; preserve existing readback guard in either path (248793).

### Validation

Planning checks: source inspected and published contracts compared; supplied incident files unavailable locally. Exit gate: one failure reproduced through the active registered path, topology recorded, and 0.D1–0.D5 resolved in this document. Reproduction and design decisions: **not run / not finalized**.

## Phase 1 — Exact bytes and download receipts

Implementation checkpoint (November 9): the registered document-upload and Trust Center media endpoints stream to a server-local file and return SHA-256 receipts. Mock stdio tests verify XLSX, PDF, PNG, JPEG, and non-UTF-8 text bytes; focused tests cover identity mismatch, collision, size limit, and interrupted-stream cleanup. A review identified cancellation during publication as a race; the fix waits for cleanup and removes a destination published after cancellation, with a deterministic regression. Default directory is `~/VantaMcpDownloads`, configurable using `VANTA_MCP_DOWNLOAD_DIR`; maximum bytes and deadline use `VANTA_MCP_DOWNLOAD_MAX_BYTES` and `VANTA_MCP_DOWNLOAD_TIMEOUT_MS`. Redirects are rejected. Further failure scenarios, live read-only acceptance, and the remaining epic iterations are still open.

### Transport, schema, and persistence

- [ ] 1.1 Add an explicit binary response/stream path to `VantaApiClient`; keep authentication, retry, HTTP errors, and the request deadline active until body consumption completes. Never pass file bytes through `response.text()` (248793).
- [x] 1.2 Route both current media operations through shared download handling. Use a minimal reviewed operation policy; preserve normal JSON API and malformed-error handling (248793).
- [ ] 1.3 Validate destination/options in the operation schema and strip runtime-only fields before upstream dispatch. Decide how existing generated media calls migrate from text output to receipt output; document the output change (248793).
- [ ] 1.4 Stream into an exclusive temporary file under the allowed root, enforce byte limit/backpressure, compute SHA-256 from saved bytes, and publish atomically with default no-overwrite. Clean up on error/cancel; handle concurrent destinations and reparse/symlink escape (248793).
- [ ] 1.5 Return receipt fields: tenant; API family and operation; document/upload/resource/policy-version IDs as applicable; retrieval UTC; original filename and safe saved filename; response MIME and optional detected signature; measured byte length; saved SHA-256; expected hash if supplied; server-local destination; transfer status; identity status; warnings. Exclude bearer tokens and signed query strings (248793).
- [ ] 1.6 Keep `transferStatus` separate from `identityStatus` (`match`, `mismatch`, `unknown` proposed). A computed hash proves the saved bytes, not original identity; only a known matching baseline establishes that claim. Preserve source Markdown versus converted upload hashes (248793).

### MCP behavior and acceptance cases

- [x] 1.7 Test registered generated tools end to end through mock HTTP and local files; cover PDF/XLSX/PNG/JPEG/non-UTF-8 bytes and byte-exact text/BOM/newlines. No current compatibility alias performs media downloads (248793).
- [x] 1.8 Add failure coverage for missing/wrong MIME, suspicious HTML, expected-hash mismatch, unknown hash, truncated/chunked body, incorrect Content-Length, cancellation, limit, destination collision, permission denial, and clean temporary-file removal (248793).
- [x] 1.9 Verify rejected 429 reads retry cleanly, error responses are not published as files, redirects are rejected without contacting the target, and JSON/envelope/upload/write-disabled regressions still pass (248793).
- [x] 1.10 Update capabilities, help, recipes, and troubleshooting with download invocation, receipt semantics, local-host limitations, and preview behavior (248793).

### Decisions needed

- [ ] 1.D1 Finalize binary response type and streaming ownership, supported content types, operation classification, and compatibility output migration (248793).
- [ ] 1.D2 Confirm exact receipt fields/error codes and behavior for valid zero-byte artifacts, MIME mismatch, suspicious success bodies, and a different representation (248793).

### Validation

On November 9 a read-only live AST comparison fetched an existing non-sensitive PDF directly and through the local generated operation. Both contained exactly 42,093 bytes and SHA-256 `524b82609ab1d72a315cb945454d2d0e76f6cab10cef6dee226958863fec4f3b`; the temporary local file was removed. This verifies those two paths and that artifact, not original uploaded-byte identity or the installed MCP. Mock stdio fixtures cover the registered tool. The installed AST MCP was observed at 1.0.22 and does not yet contain the local change. Final local test counts and checks are recorded in the roadmap checkpoint.

## Phase 2 — Policy artifacts and truthful fallback

### Identifier and route handling

- [ ] 2.1 Inventory policy IDs, approved-version IDs, artifact IDs/slugs, evidence document IDs, and upload IDs from actual metadata; record each supported relationship and known 404 independently (248793).
- [ ] 2.2 Verify current official API coverage for approved policy artifacts. If a documented route exists, invoke it with explicit version identity through phase 1; otherwise retain a precise unsupported outcome. Do not guess private/UI endpoints or transform IDs into document IDs (248793).
- [ ] 2.3 Improve existing identifier diagnostics using available object context; retain slug heuristic as a limited guard, not a universal type detector. A legitimate missing evidence document still reports its actual 404 (248793).

### Operator handoff and provenance

- [ ] 2.4 Provide authenticated browser/manual download steps for the selected approved version; capture a file/hash receipt when actually downloaded. Preview-only, manually supplied, and API-retrieved artifacts have separate provenance (248793).
- [ ] 2.5 Add a version-aware policy retrieval recipe and tests for known policy/evidence mismatch, missing artifact, inaccessible policy, supported route if discovered, and fallback without false download success (248793).

### Decisions needed

- [ ] 2.D1 Record the supported route or confirmed public-API gap and whether vendor clarification is needed (248793).
- [ ] 2.D2 Choose whether a small typed policy-artifact helper is justified; prefer existing reads and a clear recipe if the API cannot retrieve bytes (248793).

### Validation

Required: relevant AAAA tests and `npm test`; approved-version identity/provenance review; authorized read or recorded API limitation with usable handoff. Exit gate: no policy artifact ID is silently treated as an evidence document ID, and no preview is reported as a downloaded file. **Not run**.

## Phase 3 — Full public contract refresh

### Source contracts and generation

- [ ] 3.1 Redownload Manage/Audit/Connectors; record timestamps/byte hashes; compare against pinned source and November 9 inventory. Review added/removed/renamed identities and input/output changes, resolving references (248793).
- [x] 3.2 Review all 44 observed changed operations in the [field-level comparison](contract-schema-review-2026-11-09.json) and [migration summary](contract-schema-review-2026-11-09.md). Distinguish request and response changes; preserve live compatibility uncertainty (248793).
- [x] 3.3 Pin exact source bytes/provenance, regenerate operations and manifest, preserve all 333 baseline tool identities, and verify every current published operation maps once. Current count is 383 (248793).
- [x] 3.4 Expose all 50 additions using shared generation; preserve phase 1 media routing and download options after regeneration. Framework export status returns a presigned URL, which the media downloader deliberately does not fetch (248793).

### Compatibility, help, and tests

- [x] 3.5 Group operation coverage by vendor (17), risk mappings/custom-asset discovery (14), personnel/group requirements (10), document evaluation (2), framework administration/export (6), and Trust Center video read (1). Exact identities are in the inventory (248793).
- [ ] 3.6 Add schema and mock HTTP coverage for changed contracts and new operations, including new mutations' confirmation/write-disabled paths, tenant scope denial, bounded pagination, and unchanged envelope behavior (248793).
- [x] 3.7 Regenerate catalog/help and document the vendor `category` to `categoryId` migration and observed request/response changes in the [migration summary](contract-schema-review-2026-11-09.md) (248793).
- [ ] 3.8 Review current vendor product announcements only as discovery leads; retain unsupported public REST boundaries unless the downloaded contract or authoritative endpoint documentation establishes support (248793).

### Decisions needed

- [ ] 3.D1 Approve migration notes for changed inputs/output contracts; settle aliases if upstream operation IDs changed (248793).
- [ ] 3.D2 Confirm operation group inventory and live scope requirements; record gaps without blocking verified unrelated surfaces (248793).

### Validation

Local follow-up: the full 44-operation structural review is recorded in the [migration summary](contract-schema-review-2026-11-09.md) and [field-level report](contract-schema-review-2026-11-09.json). `npm test` passed 239 tests, lint and 383-to-383 parity passed, generated help was refreshed, and regeneration preserved the operation and manifest hashes. All 333 earlier tool names retained source/method/path identity. Representative request changes and all generated mutation confirmation gates are covered; exhaustive per-operation live acceptance and tenant feature coverage remain open.

## Phase 4 — Vendor risk and alerts

### Read context and operator workflow

- [x] 4.1 Extend existing selected-vendor triage with external findings, vendor alerts, incident alerts, settings, categories, and selected vendor relationship fields. General alerts are explicitly labeled organization-wide, not assumed to belong to the selected vendor (248793).
- [x] 4.2 Give each inventory independent pagination, limits, cursors, and completeness; detail reads target selected IDs. Preserve existing assessment history (248793).

### Actions and readback

- [x] 4.3 Provide alert/status workflow and settings/category/engagement endpoint writes with confirmation, pre-read where available, and independent readback. Alert bulk results are inspected; category deletion requires complete fresh inventories (248793).
- [x] 4.4 Verify requested settings/relationships and categoryId semantics; warn about unrelated observed drift, permission limitations, concurrency and unverified outcomes (248793).

### Decisions needed

- [ ] 4.D1 Select triage actions needed in a workflow versus direct generated tools/recipes; define alert-to-vendor association and acknowledgment semantics from the contract (248793).
- [ ] 4.D2 Identify disposable vendor/category/relationship fixtures and owners before live mutations (248793).

### Validation

Local follow-up: vendor planning includes selected vendor details, settings, separately paginated categories, organization-wide alerts, vendor external findings and filtered incident alerts. `workflow_vendor_alerts` verifies each accepted alert update and checks the bulk response. Settings, category and engagement endpoint tools now independently verify accepted writes. Stateful mocks cover settings omission, category rename/null clearing/deletion, engagement attachment/conflict/no-op removal, 403 and mixed results. DG disposable vendor/category/engagement fixture acceptance and cleanup are recorded in [administrative write verification](administrative-write-verification.md); global settings remain mock-tested only.

## Phase 5 — Risk mappings and issues

### Risk context and issue review

- [x] 5.1 Add account, custom-asset, integration, and issue mapping reads/add/remove using existing generated dispatch; expose enterprise-risk mapping reads and custom-asset discovery. Verify the documented keys and request bounds in the generated schema; live mutation acceptance remains open (248793).
- [x] 5.2 Extend the existing issue/event review to accept current documented issue filters and return selected issue detail. Keep issue/event cursors independent and avoid inferred causation (248793).

### Actions and receipts

- [x] 5.3 Provide read → proposed mapping changes → confirm → bounded readback for accounts, custom assets, integrations and issues; preserve unrelated mappings and return per-item verification. Enterprise-risk mapping is read-only. Live mutation acceptance remains separately open (248793).
- [ ] 5.4 Document recipes for risk-to-issue traceability and multi-enterprise-risk reads without treating proprietary/Agent capabilities as public REST parity (248793).

### Decisions needed

- [ ] 5.D1 Decide whether direct tool recipes cover the need or a small risk workflow is warranted (248793).
- [ ] 5.D2 Define fixture mapping permissions, already-linked behavior, and readback completeness requirements (248793).

### Validation

Local follow-up: confirmed account, custom-asset, integration and issue mapping changes require a complete pre-read and an independent bounded post-read. Tests cover all add-body keys, unrelated mapping preservation, missing readback, incomplete inventories, confirmation and disabled writes. Issue planning accepts documented filters and independent cursors. Dedicated live mutation lifecycle acceptance remains open.

## Phase 6 — Evidence evaluation and frameworks

### Jobs, exports, and artifact integrity

- [x] 6.1 Provide a documented document-evaluation recipe with explicit confirmed POST and bounded manual polling; 404 does not distinguish pending from unavailable. A saved summary is not a compliance determination (248793).
- [x] 6.2 Provide a framework export request/status recipe with bounded manual polling. The completion payload exposes a short-lived presigned URL; the media downloader does not follow it or forward Vanta credentials (248793).

### Administration and interpretation

- [ ] 6.3 Cover framework deactivate/reactivate/snooze/variant updates with preconditions, impact preview, explicit confirmation, omission/empty semantics, and readback (248793).
- [ ] 6.4 Keep evaluation output separate from compliance disposition and artifact identity. Document new framework query/response changes and feature-denial behavior (248793).

### Decisions needed

- [ ] 6.D1 Define job timeout/resume behavior and whether any new framework export target requires a reviewed cross-origin download policy (248793).
- [ ] 6.D2 Assign owner and disposable framework/evaluation fixtures; decide which operations remain direct tools/recipes (248793).

### Validation

Local follow-up: operator recipes cover bounded manual polling and distinguish evaluation 404 from a definite job status. Framework variant, snooze and reactivate tools independently verify accepted writes. A snooze remains `write_unverified` when the framework read does not expose the requested end date. Mock stdio tests cover evaluation acceptance with no saved result, an export progressing from RUNNING to COMPLETED, variant replacement and empty-selection rejection, snooze readback, and 403 without replay. Framework export status returns an expiring presigned URL; it is not downloaded by the media tool. Automated polling, downloaded export-byte receipts, and live lifecycle/fixture validation remain open.

## Phase 7 — Personnel requirement sets

### Requirements and group scope

- [x] 7.1 Add recipes for listing/creating requirement sets, custom requirements, details edits, and requirement membership edits using the generated endpoints (248793).
- [ ] 7.2 Include group requirement-set read and deletion impact. Verify set/group membership effects, required permissions, and nullable/empty/omitted behavior from current documentation (248793).

### Review and execution

- [ ] 7.3 Show complete desired changes and affected scope, confirm writes, preserve unspecified state, and read back the selected requirement set/group. Keep destructive group deletion explicit (248793).
- [ ] 7.4 Add permission-denial and dependency/conflict handling without translating missing access into an empty set or success (248793).

### Decisions needed

- [ ] 7.D1 Choose direct tool recipes versus a minimal personnel workflow; verify whether group association writes are actually public (248793).
- [ ] 7.D2 Identify disposable fixtures and safe deletion scope before live acceptance (248793).

### Validation

Local follow-up: requirement-set detail and requirement update tools independently verify requested fields; pre-read drift produces warnings. Operator recipes describe group scope and per-requirement replacement versus omission. Stateful mock stdio tests verify replacement, preservation of omitted requirements, 403 without replay, and distinction between 204 no assignment and 403 denied. Broader personnel lifecycle and live mutation fixtures remain open.

## Phase 8 — Acceptance, release, and adoption

### Acceptance matrix and evidence

- [ ] 8.1 Record each family/operation group as local-pass, live-pass, permission-blocked, feature-unavailable, or untested. Complete authorized Audit/Connector acceptance and existing vendor/vulnerability/SLA lifecycle gates with dedicated fixtures; keep custom-control CMMC mapping separately open if unresolved (248793).
- [ ] 8.2 Rerun required local checks after the final implementation change; retain binary fixtures, receipts, exact pinned hashes, parity, deterministic artifacts, and generated help evidence. Do not copy historical test counts as current results (248793).
- [ ] 8.3 Keep the implementation-details exact-readback guard; its October 13 direct REST/UI success is evidence for the tested DG control, not all MCP tools or tenants. Exercise installed-tool write/readback only with authorized fixtures (248793).

### Release and installed runtime

- [ ] 8.4 Prepare release notes with download output migration, host-local paths, identity semantics, input migrations, and known live gaps. Release/push when authorized; record immutable version/SHA (248793).
- [ ] 8.5 Update/restart installed MCP; inspect capabilities version/SHA; smoke-download PDF/XLSX/image and compare saved hashes; check documented compatibility aliases and help from the installed runtime (248793).
- [ ] 8.6 Update the epic roadmap and handoff with delivered work, receipts, remaining permission/vendor blockers, owner, and next action. Close only the criteria actually demonstrated (248793).

### Decisions needed

- [ ] 8.D1 Determine which remaining live gaps block the particular release and identify the release owner (248793).
- [ ] 8.D2 Confirm versioning/output migration notice and installed client handoff support; decide release timing from concrete validated artifacts (248793).

### Validation

Required final checks: `npm test`, `npm run lint`, `npm run verify:spec-parity`, help generation/validation, deterministic generation, scoped formatting and diff checks; live tests only with appropriate fixture/permission gates. Exit gate: release identity and installed byte-integrity receipts, with remaining limitations explicitly reported. **Not run**.

## Decisions and questions log

| Date       | Decision / question                                                                             | Status                                             |
| ---------- | ----------------------------------------------------------------------------------------------- | -------------------------------------------------- |
| 2026-11-09 | Prioritize byte integrity on current contracts before full expansion                            | Adopted for this plan                              |
| 2026-11-09 | Address active shared client/generated dispatch; legacy-only edits are insufficient             | Supported by source inspection                     |
| 2026-11-09 | Separate transfer completion, source identity, media representation, and preview inspection     | Adopted acceptance requirement                     |
| 2026-11-09 | Keep policy artifact identity distinct from evidence documents; use only verified public routes | Adopted acceptance requirement                     |
| 2026-11-09 | Reuse existing services/workflows; add minimal download helper/types                            | Proposed design, settle phase 0/1 interfaces       |
| 2026-11-09 | Is the installed connector local or remote, and which host delivery surfaces work?              | Open: 0.3 / 0.D1                                   |
| 2026-11-09 | What limits, root, overwrite, mismatch retention, and release boundary should apply?            | Proposed defaults in phase 0; finalize before code |
| 2026-11-09 | Is approved-policy byte retrieval supported publicly, and what version route applies?           | Open investigation: phase 2                        |
| 2026-11-09 | Create the proposed child cases?                                                                | Optional follow-up; none created                   |
