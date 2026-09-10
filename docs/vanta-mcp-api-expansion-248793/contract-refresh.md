# Public contract refresh

Baseline: 48ab1eb, 222 operations. Refreshed September 10, 2026: Manage 241, Audit 57, Connectors 25, total 323. No removed method/path pairs; 101 additions and 31 existing operations with changed inputs. Sources and byte hashes are pinned in openapi/sources.json; detailed comparison is in contract-diff-2026-09-10.json.

## Workflows and responsibilities

- Refresh contracts: maintainer downloads official specs; pinned source metadata records provenance; generator emits operation descriptors and nested validators; parity verifier compares exact identities.
- Invoke existing tools: preserve names when upstream operation IDs change; validate new request payloads before any HTTP write. No implicit batch fanout or guessed enum translations.
- Discover additions: regenerate tools/help; explicit upload policies describe supported local files. Confirmation gates continue to cover every new write.

## Decisions and migration

- Preserve link_controls_to_risk_scenario for renamed CreateRiskScenarioControl and initiate_export for renamed CreateQuestionnaireExport.
- Risk-control requests now require body.controlId with optional body.controlType (EXISTING or TREATMENT_PLAN). The old body.controlLinks array and linkType=TREATMENT are rejected. Call once per link with explicit confirmation.
- Risk likelihood/impact fields now require integers; vendor account-manager email gains a length limit. Other changes largely add optional fields, query filters, or enum values; UpdateTrustCenterControlCategory no longer requires name.
- Keep current runtime architecture and existing workflow set. Broader workflow expansion follows this contract refresh.

## Plan

- [x] Capture baseline, exact operation additions, input deltas, and source provenance.
- [x] Pin specs; preserve stable tool names and deterministic generated artifacts.
- [x] Validate new multipart policies, renamed operations, and changed request contracts.
- [x] Verify exact source/method/path/operationId parity, source hashes, tests, and lint.
- [x] Regenerate help and record final validation and remaining tenant acceptance limits.

## Validation and remaining work

- Full compiled unit/mock suite: 131 tests passed, zero failures/skips. All 323 schemas register in the MCP server (352 tools overall); all 166 generated mutations require confirmation before HTTP.
- All 222 pre-refresh tool names match their previous source/method/path identities. Both upstream operation renames retain the old MCP names.
- Exact parity and source hashes passed. Deliberate equal-count operation substitution and incorrect source hash were rejected; fixtures were restored afterward.
- Repeated generation produced byte-identical operation and manifest files. Help artifacts were regenerated into docs/dev/help-surface-reference.md; the generator now preserves the historical redirect stubs.
- Full lint and diff checks passed. The MCP help-surface smoke test passed against DG with writes disabled.
- Four new read tools passed against DG on September 10 at 02:49 UTC: list_issues (empty inventory), list_event_logs, list_deactivated_controls, and list_vendor_assessment_types. No tenant writes were performed during the refresh.
- Audit and Connector successful acceptance still requires permitted credentials and a connector fixture, as recorded in the DG validation report. New mutation contracts are locally schema/safety tested; their live lifecycle acceptance remains open.

Next: review the documented breaking input migrations, validate newly used writes with dedicated fixtures, and then expand workflows around issues/event logs and vendor assessments. No deployment or push is part of this refresh.
