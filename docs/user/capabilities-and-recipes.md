# Capabilities and Recipes

## What You Can Do

- Controls and evidence operations.
- Failing controls/tests/documents triage.
- Vendor and finding lifecycle management.
- People, assets, and vulnerability triage.
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
- Control-test mappings are not policy-control mappings.
- True policy-control linkage and direct Manage test comments are unsupported by the current public API; unsupported tools return Vanta UI/control-note fallback batches.
