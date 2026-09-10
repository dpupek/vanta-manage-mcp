# Capabilities and Recipes

## What You Can Do

- Controls and evidence operations.
- Failing controls/tests/documents triage.
- Vendor and finding lifecycle management.
- People, assets, and vulnerability triage.
- Integration resource owner and description assignment.
- Audit information-request operations.
- Capability discovery with the `capabilities` tool.
- Agent-safe unsupported-operation fallbacks for API surfaces Vanta does not publicly expose.

## Built-in Recipes and Prompts

Use MCP resources:

- `resource://vanta-manage/cheatsheet`
- `resource://vanta-manage/recipes`
- `resource://vanta-manage/workflow-playbooks`

Use prompts:

- `playbook_tool_selector`
- `playbook_control_evidence`
- `playbook_failing_controls_triage`
- `playbook_vendor_triage`
- `playbook_people_assets_vuln_triage`
- `playbook_resource_owner_assignment`
- `playbook_information_request_triage`
- `playbook_vulnerability_due_soon_triage`
- `playbook_employee_onboarding_verification`
- `playbook_employee_offboarding_tracker`
- `playbook_vendor_risk_assessment`
- `playbook_policy_document_evidence_linkage`

## Ask Patterns for Agents

- "Plan a control evidence update for control `<id>` and show only read calls first."
- "Triage vulnerabilities due in 14 days and propose prioritized actions."
- "Tell me the top 5 vulnerable devices according to Vanta and show ranking inputs."
- "Generate a vendor risk triage plan for vendor `<id>` and include readback verification."
- "Assign missing Snowflake database resource owners to `<owner@example.com>` and add a description."
- "Show onboarding status for person `<id>` and list blockers."
- "Cross-reference policy `<policyId>` with document evidence and propose linkage steps."

## Execution Pattern

1. Read current state.
2. Run a `playbook_*` prompt.
3. Run workflow tool in `mode:"plan"`.
4. Execute approved writes with `confirm:true`.
5. Verify updates with readback endpoints.

## Upload Notes

- For evidence/document uploads, pass `filePath` to a local readable file.
- Use supported file types (`.pdf`, `.docx`, `.xlsx`, `.csv`, `.txt`, `.png`, `.jpg`, `.jpeg`, `.webp`, `.zip`, `.ps`).
- `.md` and `.markdown` inputs are converted before upload; raw Markdown is never silently sent to Vanta.
- Default conversion is PDF. The generated PDF footer includes the document name on the left and `Page X of Y` on the right.
- Use `markdownConversionTarget:"docx"` for editable evidence. Use `markdownReferenceDocPath` to provide a Pandoc reference document.

## Object Boundary Notes

- Policy objects and policy approval tests are not Vanta Document objects.
- `latestApprovedVersion.documents[*].slugId` policy slugs cannot be used with `get_document` or `add_document_to_control`.
- Some Vanta UI `/tests/{slug}` routes alias to policy/document pages. Public API test endpoints still require API test IDs; use `document_resources` and `list_tests_for_control` to find generated test IDs.
- Integration resource owners are assigned through resource metadata (`ownerId`) and must be CURRENT Vanta employees.
- Integration resources support one owner field. Use descriptions/notes outside the resource owner field for business owner, reviewer, coordinator, or support-department context.
- Control-test mappings are not policy-control mappings.
- True policy-control linkage, direct Manage test comments, and document deactivation/reactivation writes are unsupported by the current public API; unsupported tools return Vanta UI/control-note fallback batches.
- Document `deactivatedStatus` is readable through `get_document`, but deactivation/reactivation must be performed in the Vanta UI and verified with readback.

## Workflow validation and partial results

Execute mode validates the entire action batch before its first write. Test entity deactivation requires `deactivateReason` (and optionally an ISO timestamp `deactivateUntilDate`). Payload requirements follow the pinned API schema, including nested fields. An evidence upload is skipped if linking its document to the control fails.

On batch success, `data` contains action outcomes and succeeded/failed/skipped counts. On failure, `success:false` and `isError:true` accompany `error.details` containing those outcomes and counts. Inspect individual outcomes and re-plan before retrying. Resource batches retain confirmed successes and flag missing API results for verification.

Plan inventories accept `pageSize` (default 100), `maxPages` (default 10), and `pageCursor`. Both numeric limits are 1–100. Plans that reach a limit carry a top-level warning and `metadata.complete:false`; each affected inventory includes `collection.nextPageCursor`. Resume the affected inventory, or increase maxPages. Cursors belong to their own inventory; for workflows with several lists, use the corresponding endpoint tool to resume each independently. Missing/repeated cursors or page failures return an error with partial results. Resource owner lookup requires complete people results; resource execution requires complete discovery or explicit reviewed resourceIds.

Requests time out after 60 seconds by default, including authentication waits and retry backoff. Configure `VANTA_REQUEST_TIMEOUT_MS` up to 300000 ms. Cancelling a request stops further workflow actions. After a write times out or loses its connection, read back Vanta state before retrying: the server may have applied the write even though no response arrived.

## Issue, event-log, and vendor assessment plans

Use `workflow_issue_event_triage` with `mode:"plan"` to retrieve issues and event logs as separate evidence inventories. Optional `search` filters issues; `eventStartDate` filters events using an ISO timestamp. `issuePageCursor` and `eventPageCursor` resume their own inventories. `pageSize` and `maxPages` bound each collection; inspect completeness and warnings before treating a plan as exhaustive. The tool rejects execute mode and does not infer that an event caused an issue.

Use `workflow_vendor_triage` with `mode:"plan"` and `vendorId` to include that vendor's assessment history. `assessmentPageCursor` resumes assessments independently of the vendor list's `pageCursor`. Omitting vendorId retains the existing vendor inventory plan. Assessment-read failures make the plan fail; execution still uses the existing explicitly confirmed vendor actions.
