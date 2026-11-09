# Progress Log

## 2026-11-09 — Case 248793 download and API expansion

Snooze follow-up: accepted writes now report status and snooze-end-date verification separately, including the requested date and write-response date. Once independent status matches, an omitted end date returns `write_unverified` without redundant reads; stale status remains bounded to three attempts. `npm test` passed 281 tests; no live framework mutation was performed. A [Vanta support request](../../docs/vanta-mcp-api-expansion-248793/vanta-snooze-support-draft.md) is drafted but not sent.

Administrative endpoint verification: existing vendor settings, category/assignment, engagement, framework variants/status and personnel requirement-set update tools now independently read back requested state after accepted writes. Category deletion requires two complete pre-delete vendor inventories and verifies the captured vendors; concurrent changes cannot be ruled out. Up to three readbacks are attempted, with no write replay; missing framework snooze dates produce `write_unverified`. DG disposable fixture runs verified category creation/update/assignment/deletion and engagement attach/removal; every temporary vendor and category was confirmed absent, including cleanup after an initial stopped preflight. `npm test` passed 278 tests, lint and 383-operation parity passed. See [evidence](../../docs/vanta-mcp-api-expansion-248793/administrative-write-verification.md). Live global settings, personnel and framework mutations and release remain outside the approved scope.

Administrative mock-coverage slice: stateful stdio/HTTP tests now cover partial vendor settings changes, category rename/clear/deletion, engagement attach/conflict/no-op removal, framework variants/snoozing, personnel requirement replacement/omission, group 204 versus 403, five permission-denied mutation paths, and mixed vendor-alert outcomes without replay. Updated the engagement recipe to require readback after HTTP 200. `npm test` passed 258 tests; lint and 383-operation parity passed. These are mock results; live mutations, release and installed-runtime acceptance remain separately open.

Follow-up: the local generated download operation matched an authorized direct AST PDF retrieval byte-for-byte (42,093 bytes; SHA-256 `524b82609ab1d72a315cb945454d2d0e76f6cab10cef6dee226958863fec4f3b`); temporary output was removed. The 44 changed operations have a field-level migration review. Vendor-alert and risk-mapping workflows now verify accepted writes through independent readback, and framework/evaluation/personnel operations have direct-tool recipes with operator readback and representative mock integration tests. `npm test` passed 239 tests, lint and 383-to-383 parity passed, generated help was refreshed, and regenerated operation/manifest hashes were unchanged. Live mutation fixtures, broader lifecycle coverage, release and installed-runtime verification remain open.

- Implemented local byte-preserving document and Trust Center downloads with SHA-256 receipts and explicit source identity status; no-overwrite and configurable server-local limits apply.
- Refreshed the three public API contracts to 383 generated operations, retaining all 333 prior tool identities. Added partial extended vendor and issue planning context; remaining workflow phases are open.
- Fixed the review finding in which cancellation during publication could leave an unreceipted file. Cancellation waits for cleanup; a deterministic regression exercises that race.
- Validation: after the review fix, `npm test` passed 212 tests; the later follow-up above passed 239 tests, lint, 383-to-383 parity, and diff checks. One read-only live PDF comparison passed; installed-runtime acceptance remains open.
- The connected AST MCP was observed at v1.0.22 with 333 operations; this work has not been released or installed. Preserve the control implementation-write guard and its October 13 evidence.
- Next: review the remaining direct-tool and workflow safety gaps and select dedicated fixtures for separately authorized live lifecycle acceptance. Release and installed-runtime verification remain separate. See the [epic roadmap](../../docs/vanta-mcp-api-expansion-248793/roadmap.md).

## 2026-10-09 — Case 248793 implementation-details verification

- [x] Require exact independent GET readback for implementation-details PATCH requests, including clearing. Missing or different values and failed reads return `write_unverified` while preserving the accepted mutation context; verification does not replay PATCH.
- [x] Add 11 regression cases and update help/troubleshooting guidance. Before commit, `npm test` passed 199 tests including the build; lint, 333-operation exact spec parity, scoped Prettier, and diff whitespace checks passed.
- [x] Compare direct REST and UI behavior on an existing CMMC control. October 9 retest after Vanta's reported fix still returned HTTP 200 with no field in GET and no UI-visible text after full reload. Original blank content was verified after restoration and another reload.
- [x] Send the sanitized retest to Vanta support in the existing thread under explicit user authorization. Request timestamps, request/response bodies, UI results, and restoration were included; vendor response is pending.
- [x] Verify public-API persistence after the vendor correction on the tested existing DG control, with independent REST and UI readback on October 13.
- [ ] Publish the guard in a separately authorized release. The local commit is engineering progress; it does not establish acceptance across all controls or workspaces.

Evidence, workflow, remaining mapping questions, and support links: [implementation write verification](../../docs/vanta-mcp-api-expansion-248793/implementation-write-verification.md). Living plan: [case 248793 roadmap](../../docs/vanta-mcp-api-expansion-248793/roadmap.md).

## 2026-02-26

- [x] Implemented full OpenAPI parity generation (Manage + Audit + Connectors, 219 operations).
- [x] Added safe-mode mutation confirmation and workflow plan/execute gating.
- [x] Added compatibility read tools and specialized workflow tools.
- [x] Added test suite for parity, safety, multipart, and workflows.
- [x] Added docs bundle (`vanta-mcp-help`, migration, config examples, security).
- [x] Enabled Git-based `npx` execution via package `prepare` script (`npm run build`).
- [x] Added MCP help surface resources:
  - `resource://vanta-manage/help`
  - `resource://vanta-manage/cheatsheet`
  - `resource://vanta-manage/tool-catalog`
  - `resource://vanta-manage/workflow-playbooks`
  - `resource://vanta-manage/safety`
  - `resource://vanta-manage/troubleshooting`
- [x] Added playbook prompts:
  - `playbook_tool_selector`
  - `playbook_control_evidence`
  - `playbook_failing_controls_triage`
  - `playbook_vendor_triage`
  - `playbook_people_assets_vuln_triage`
  - `playbook_information_request_triage`
- [x] Added fallback `help` tool with resource/prompt index.
- [x] Refactored help generation so runtime help content and `docs/vanta-mcp-help.md` share one content model.
- [x] Added `npm run smoke:help-surface` to validate live MCP help-surface discovery/readability over stdio.
- [x] Ran credentialed smoke validation with:
  - `VANTA_ENV_FILE=C:\Users\dan.pupek\.vanta\vanta-credentials-ast.env`
  - Result: `PASS: MCP help surface smoke check succeeded.`
- [x] Added CI main release workflow (`.github/workflows/release-main-tag.yml`) to auto-tag on each `main` push.
- [x] Locked auto-release versioning contract:
  - `VERSION=1.0.${{ github.run_number }}`
  - `TAG=v1.0.<buildnumber>`
- [x] Added idempotency guard so existing tags skip release creation and exit successfully.
- [x] Added GitHub Release publication (`softprops/action-gh-release@v2`) for newly created tags.
- [x] Updated docs/config examples for tag-pinned Git `npx` usage:
  - `npx github:dpupek/vanta-manage-mcp#v1.0.<buildnumber>`
  - `npx git+https://github.com/dpupek/vanta-manage-mcp.git#v1.0.<buildnumber>`
- [x] Added credential loader support for both `VANTA_ENV_FILE` JSON and dotenv formats.
- [x] Enforced credential precedence: direct env vars override `VANTA_ENV_FILE`.
- [x] Added integration test gating helpers for live runs:
  - `VANTA_INTEGRATION_LIVE`
  - `VANTA_INTEGRATION_ALLOW_MUTATIONS`
  - `VANTA_INTEGRATION_REQUIRE_MUTATION`
  - `VANTA_INTEGRATION_TEST_CONTROL_ID`
  - `VANTA_INTEGRATION_TEST_TIMEOUT_MS`
- [x] Added mocked MCP end-to-end integration tests:
  - API error envelope resilience
  - OAuth 401 refresh/retry behavior
  - transport failure envelope behavior (`request_failed`)
- [x] Added live integration test suites for:
  - read + write document lifecycle (create/upload/read/delete)
  - optional control-evidence linkage verification
  - OAuth stability (repeat, concurrent, forced refresh)
- [x] Added live integration write-verification suites for:
  - vendor/finding lifecycle writes with readback assertions
  - vulnerability lifecycle writes (deactivate/reactivate/SLA acknowledgement) with readback assertions
- [x] Added mock integration write-verification suites for:
  - vendor/finding lifecycle write + readback flow
  - vulnerability lifecycle write + readback flow
- [x] Added manual CI workflow for live integration tests:
  - `.github/workflows/integration-live.yml`
  - `workflow_dispatch` only (no auto-run on push)
- [x] Added agent-centric error guidance contract:
  - error envelopes now support `error.agentHint`
  - compact actionable hints added for common error codes
  - explicit `rate_limit_exceeded` guidance points agents to retry/backoff + troubleshooting resource
  - new unit tests validate hint derivation and override behavior

## Gotchas (Carry Forward)

- Keep `_upstream/` and other temporary import folders out of lint/build scope.
- Keep `scripts/*.ts` covered by a dedicated TypeScript config (`tsconfig.scripts.json`) and ESLint project references.
- Always run `npm run verify:spec-parity` after OpenAPI or generator changes.
- Prefer script files over inline `node -e` for large generated markdown/docs to avoid escaping errors.
- For Git-based `npx`, keep `prepare` aligned with build output and `bin` path.
- `npm run build` rewrites `src/generated/manifest.generated.json` `generatedAt`; avoid committing timestamp-only churn unless intended.
- For new/updated MCP error surfaces, always include compact `agentHint` guidance when actionable next steps exist.

## 2026-02-27

- [x] Implemented breaking multipart upload contract migration:
  - Removed `contentBase64`/`filename` upload execution path.
  - Multipart upload tools now require local `filePath` (+ optional `mimeType`).
- [x] Added centralized upload validation and endpoint policy modules:
  - `src/uploads/types.ts`
  - `src/uploads/policy.ts`
  - `src/uploads/file-validation.ts`
  - `src/uploads/multipart.ts`
- [x] Enforced strict preflight checks before multipart writes:
  - path required (`file_path_required`)
  - file exists (`file_not_found`)
  - file readable (`file_not_readable`)
  - regular file only (`file_not_regular`)
  - allowed extension/MIME policy (`unsupported_file_type`)
- [x] Updated workflow upload interfaces to `filePath`:
  - `workflow_control_evidence`
  - `workflow_vendor_triage`
- [x] Updated help/prompts/user+dev docs to remove base64 guidance and document `filePath` behavior.
- [x] Added/updated tests for upload migration:
  - schema contract (`filePath` required for multipart file tools)
  - endpoint preflight error envelope tests
  - endpoint policy coverage (`upload-policy.test.ts`)
  - live read/write upload test moved to temp file `filePath` usage
- [x] Diagnosed and fixed live vendor/finding lifecycle failure:
  - Root cause: empty-body `204` responses with `application/json` caused JSON parse failure (`Unexpected end of JSON input`).
  - Fix: `parseResponsePayload` now treats `204/205` as `null` and parses JSON only when body text is non-empty.
  - Added regression in mock vendor/finding lifecycle for `204` + JSON content-type delete.
- [x] Validation results:
  - `npm run lint` passed.
  - `npm test` passed.
  - `npm run test:integration:mock` passed.
  - `npm run test:integration:live` passed (6/6), with transient OAuth 429 retries observed but recovered.
- [x] Additional hardening and verification updates:
  - Added per-call live 429 envelope retry helper and integrated it into live integration suites.
  - Added vendor/finding convergence polling with paginated readback to reduce eventual-consistency flake.
  - Added vulnerability remediation pagination discovery for live lifecycle tests.
  - Added parser-focused Vanta client tests for `204/205`, empty JSON body, text payload, and invalid JSON behavior.
  - Added explicit release/user-doc breaking-change callouts for upload migration (`filePath` only, no `contentBase64`/`filename`).
  - Re-ran validations:
    - `npm run lint` passed.
    - `npm test` passed (45/45).
    - `npm run test:integration:live` passed (6/6) using `C:\Users\dan.pupek\.vanta\vanta-credentials-ast.env`.
