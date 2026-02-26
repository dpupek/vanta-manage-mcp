# MCP Resources and Prompts

Quick reference for agents using the Vanta Manage MCP help surface.

## Usage Pattern

1. Read `resource://vanta-manage/help` first.
2. Pull `resource://vanta-manage/tool-catalog` to select exact tools.
3. Use a `playbook_*` prompt to produce deterministic execution steps.
4. Execute writes only with `confirm=true` and verify with readback calls.

## Resources

- `resource://vanta-manage/help`: onboarding, auth, safety, and discovery.
- `resource://vanta-manage/cheatsheet`: quick mapping from objective to tools.
- `resource://vanta-manage/tool-catalog`: live endpoint/compat/workflow catalog.
- `resource://vanta-manage/workflow-playbooks`: workflow-specific plan/execute runbooks.
- `resource://vanta-manage/safety`: mutation guardrails and confirmation contract.
- `resource://vanta-manage/troubleshooting`: common failures and corrective steps.

## Prompts

- `playbook_tool_selector(goal, scope?, constraints?)`
- `playbook_control_evidence(objective, controlId?, documentId?)`
- `playbook_failing_controls_triage(objective, controlId?)`
- `playbook_vendor_triage(objective, vendorId?)`
- `playbook_people_assets_vuln_triage(objective, vulnerabilityId?)`
- `playbook_information_request_triage(objective, auditId)`

## Notes

- Prompt arguments are strings.
- Prompts provide guidance only; they do not perform writes.
- Workflow tools support `mode=plan` and `mode=execute`.
- `mode=execute` always requires `confirm=true`.

## Smoke Validation

- Run `npm run smoke:help-surface` to validate live MCP discovery of all resources/prompts plus the fallback `help` tool.
- The smoke command requires Vanta credentials and skips if credentials are not configured.