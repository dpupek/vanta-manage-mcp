# Focused workflow expansion

Baseline: ef9c294 exposes 323 endpoint tools and six workflows. Issue/event-log endpoints have no combined planning workflow; vendor triage ignores the selected vendorId during planning. Audit/Connector credentials and dedicated vendor/vulnerability fixtures remain unavailable for successful lifecycle acceptance.

## Workflows and responsibilities

- W1: Operator reviews issues and recent events with independent cursors, bounded pagination, and explicit completeness. The existing workflow registrar and inventory collector supply validation/cancellation/error handling. Results are separate evidence inventories, not inferred causal links. This workflow is plan-only because the pinned Manage issues/event-log APIs are reads.
- W2: Operator selects vendorId to review its assessment history alongside the vendor list. Reuse vendor triage, generated GetAssessmentsByVendorId, and the inventory collector. An independent assessmentPageCursor prevents a vendor-list cursor from being sent to assessments. Existing execute actions are unchanged.
- W3: Validate a newly added mutation family using a disposable private Knowledge Base document, excluded from questionnaire automation. Create, read, update, read, delete, and verify 404; no existing customer content is edited.

## Plan

- [x] Implement W1 and W2 with existing services and accurate read-only help metadata.
- [x] Test independent cursors, partial results, failed reads, selected vendor scope, and execute rejection.
- [x] Run local tests/lint and live DG plan checks; attempt W3 with cleanup/readback.
- [x] Record acceptance limits and regenerate help.

## Validation checkpoint

- Lint, exact spec parity, scoped formatting, diff checks, and the DG help-surface smoke test passed.
- Full unit/mock suite: 137 passed, zero failed/skipped. Six new regressions cover independent cursors/filters, execute rejection, partial and failed event reads, vendor scoping, and failed assessment reads. Catalog coverage verifies the new workflow is plan_only and isMutation=false.
- DG live checks at 2026-09-10 03:00 UTC: issue/event workflow returned zero issues (complete) and two events (page limit, incomplete); selected-vendor plan loaded one assessment (complete) while correctly flagging the separate vendor inventory as incomplete.
- DG Knowledge Base lifecycle at 02:59 UTC: created disposable resource 6aa21d0e0b3940b26d2be872, verified PRIVATE visibility and questionnaire use=false, updated its description, read back the new value while retaining PRIVATE visibility, deleted it, and confirmed 404. Source contained only synthetic validation text. No existing customer resource was modified.
- Successful mutation acceptance here covers create_document_resource, update_document_resource, and delete_knowledge_base_resource. Other new writes remain unvalidated live. Audit/Connector permissions and dedicated vendor/vulnerability/SLA fixtures remain open.

The runtime now exposes 323 generated endpoints and seven workflows (353 tools overall). Next: collect operator feedback on the plans and extend only the workflows needed; complete remaining permission/fixture-specific acceptance separately.
