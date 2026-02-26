# Help Surface Reference

Canonical help-surface docs now live in this file.
The historical path `docs/vanta-mcp-help.md` is retained as a redirect stub.

Current model (from generated help metadata):
- Resources: 7
- Prompts: 11
- Fallback help tool: 1

## Resource URIs
- `resource://vanta-manage/help`
- `resource://vanta-manage/cheatsheet`
- `resource://vanta-manage/recipes`
- `resource://vanta-manage/tool-catalog`
- `resource://vanta-manage/workflow-playbooks`
- `resource://vanta-manage/safety`
- `resource://vanta-manage/troubleshooting`

## Prompt Names
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

## Guidance
- Run `npm run generate:help` whenever generated operations or help metadata changes.
- Keep this doc synchronized with runtime registration and generated help metadata.
