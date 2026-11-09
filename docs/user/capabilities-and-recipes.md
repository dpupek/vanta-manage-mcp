# Capabilities and Recipes

## November API workflows

### Vendor and risk review

Run `workflow_vendor_triage` in plan mode with `includeExtendedContext: true` and a `vendorId` to retrieve the selected vendor, assessments, external findings, and filtered security incident alerts. Category and general alert inventories are organization-wide; do not assume every alert belongs to the selected vendor. Each inventory has its own cursor and completeness indicator. Read `get_vendor_alert_settings` to review alert settings.

Use `workflow_vendor_alerts` with `mode: "plan"`, `kind: "vendor"` or `"incident"`, `alertIds`, and target `status`. Execute the same selection with `mode: "execute"` and `confirm: true`. Each alert is independently read before and after the update; an unverified result requires inspection before retrying.

Use `workflow_risk_mappings` with `mode: "plan"`, `riskScenarioId`, `kind` (`accounts`, `customAssets`, `integrations`, or `issues`), `change` (`add` or `remove`), and `items`. Accounts are objects with `serviceId`, `accountId`, and optional `subunitId`; other kinds use IDs. Execute the reviewed change with `mode: "execute"` and `confirm: true`. The workflow requires a complete pre-read and verifies the requested changes and preservation of unrelated mappings. `write_unverified` means the API accepted the change but readback did not establish the intended state; inspect before retrying.

Use `list_custom_assets` to discover assets and `list_enterprise_risk_mappings` to read enterprise-risk relationships. These reads do not establish a public enterprise-risk mapping write. `workflow_issue_event_triage` accepts documented issue filters and an optional `issueId` for detail; issue and event inventories remain separate and independently paginated.

Category and engagement tools independently verify the requested state after an accepted write. For category deletion, the tool requires two complete pre-delete vendor inventories, then checks that the category is no longer visible and every captured vendor has the selected replacement; it warns that concurrent assignments cannot be ruled out. The request is not sent if the preflight cannot complete. Engagement removal may be a successful no-op when the child has no parent or belongs to a different parent; the tool reports that case. A category deletion requires the explicitly reviewed `replacementCategoryId`; null leaves vendors uncategorized. The vendor `category` input is deprecated. Use `categoryId`; the two fields cannot be sent together. A null `categoryId` clears the category on update, while omission preserves it.

### Document evaluation and framework controls

Read the current draft, then call `evaluate_document` with its `documentId` and `confirm: true`. A 202 response means the request was accepted; 204 means an equivalent successful evaluation already exists. Poll `get_document_draft_evaluation` at a bounded interval for up to two minutes. A 404 can mean pending or no saved result, so report an unresolved outcome at timeout; do not claim failure, compliance, or automatically replay the POST. Sensitive documents and organizations without the required AI feature cannot be evaluated.

For a framework export, call `create_framework_controls_export` with `body.frameworkId` and `confirm: true`, then read `get_framework_controls_export` with the returned export ID until `COMPLETED`, `FAILED`, or a two-minute timeout. A completed response contains a presigned CSV URL valid for one hour; read status again to refresh it. Treat the URL as a secret and do not send Vanta OAuth credentials to it. The media downloader does not fetch this cross-origin URL.

`snooze_framework`, `reactivate_framework`, and `set_framework_variant` independently read the framework after an accepted write. Snoozing hides tests/documents and affects policy activity until the specified UTC date. The documented framework read does not expose that date, so snoozing returns `write_unverified` if independent readback cannot establish it, even if the mutation response includes it. Its verification details separately show whether status was verified and the requested, write-response, and independently read end dates. Once status is confirmed, the tool does not repeat reads solely for an absent date. Variant selection replaces the entire set and cannot be empty; review the complete desired set and use `confirm: true`.

### Personnel requirements

Read `get_group_task_requirement_set`, `list_task_requirement_sets`, and `list_custom_requirements` before changing obligations. Requirement-set detail and requirement updates independently verify the requested fields after acceptance; create operations remain direct tools. When updating requirements, each supplied requirement replaces its prior value; omitted requirements stay unchanged. Review the full replacement before execution. A group deletion is a separate destructive action: inspect its members and requirements before using `delete_group` and verify the outcome independently.

Administrative verification performs at most three readback attempts and never automatically repeats the write. A `write_unverified` result includes the accepted mutation context and requires inspection before retrying. When a pre-write read is available, unrelated changes are reported as warnings; an unavailable pre-read is also reported. API permissions may allow a write but prevent verification.

API permissions and feature availability vary by tenant. Preserve API permission errors and record readback or scope limitations instead of interpreting them as empty inventories or verified updates.

## What You Can Do

- Controls and evidence operations.
- Control implementation-details editing through `update_control_metadata`.
- Organization, business-unit, and program-scope discovery and scoped personnel filtering.
- Personnel reminder settings and vendor-finding mappings to risks.
- Failing controls/tests/documents triage.
- Vendor and finding lifecycle management.
- People, assets, and vulnerability triage.
- Integration resource owner and description assignment.
- Audit information-request operations.
- Capability discovery with the `capabilities` tool.
- Runtime identity from `capabilities.data.mcp`: semantic version, immutable release tag when available, and commit SHA.
- Agent-safe unsupported-operation fallbacks for API surfaces Vanta does not publicly expose.

## October 8 API additions

Read a control with `get_control`, then edit its Implementation details with:

```json
{
  "tool": "update_control_metadata",
  "input": {
    "controlId": "control-123",
    "body": {
      "implementationDetails": "Managers review access quarterly and document exceptions."
    },
    "confirm": true
  }
}
```

Read back `get_control` to verify the saved text. Implementation details are separate from the control description and note. The write accepts a string; the response field may be null for controls without details.

| Goal                                    | Tools and inputs                                                                                                                                                                                                                                                                                                                                                     |
| --------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Identify the authenticated organization | `get_organization`; the token chooses the organization, without an organization selector.                                                                                                                                                                                                                                                                            |
| Discover business units                 | `list_business_units`, `get_business_unit` with businessUnitId. A tenant without business-unit scoping may return 403.                                                                                                                                                                                                                                               |
| Discover program scopes                 | `list_program_scopes`, `get_program_scope` with programScopeId. List filters include businessUnitIdMatchesAny and frameworkIdMatchesAny arrays.                                                                                                                                                                                                                      |
| Filter personnel                        | `list_people` accepts frameworkIdMatchesAny, programScopeIdMatchesAny, and businessUnitIdMatchesAny arrays. Use this endpoint tool for scoped filters.                                                                                                                                                                                                               |
| Change personnel reminders              | Read `get_settings`, then `update_settings` with body.frequency (DAILY, WEEKLY, NEVER) and/or body.channels (EMAIL, SLACK), plus confirm:true. Omitted fields stay unchanged; channels replaces the complete set. An empty channel array or NEVER disables reminders. Read back get_settings.                                                                        |
| Link vendor findings to risks           | Read `list_vendor_finding_mappings`; add with `add_vendor_finding_mappings` and body.vendorFindingIdsToLink; remove with `remove_vendor_finding_mappings` and body.vendorFindingIdsToUnlink. Supply riskScenarioId and confirm:true for writes. Each batch permits at most 100 finding IDs. Add rejects already-linked findings; read back mappings before retrying. |
| Control denial emails                   | `deny_trust_center_access_request` accepts optional body.sendEmail. Explicit false is preserved; bodyless calls remain supported.                                                                                                                                                                                                                                    |
| Use new Trust Center framework values   | `create_compliance_framework` and `update_compliance_framework` accept aiuc1_26q3, atc, and fedramp20x_classA.                                                                                                                                                                                                                                                       |

Audit `update_information_request` now accepts body.linkedControlIds as the complete desired set of control links. Send the full list to replace the set, an empty array to clear it, or omit the property to preserve links. The older additionalControlIds and frameworkCodes write fields remain accepted but are deprecated upstream; use the audit controls endpoint to obtain control IDs. Connector resource uploads now accept explicit null for the fields marked nullable in the current contract; required fields remain required even when nullable.

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
