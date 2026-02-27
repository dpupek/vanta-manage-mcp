# Workflows

## Persona: Compliance Admin

Motivation: keep controls current and audit-ready with minimal manual API choreography.

### Workflow: Controls -> Evidence

1. Discover control(s) by framework/status.
2. Inspect mapped documents/tests and evidence gaps.
3. Plan proposed evidence actions.
4. Execute (only with `mode=execute` + `confirm=true`) to upload/attach evidence.
5. Read back linked resources for verification.

Linked cases:

- TEMP-0000-1: `workflow_control_evidence`

## Persona: Security Operations

Motivation: quickly resolve failing tests/controls and reduce remediation lead time.

### Workflow: Failing Controls / Tests / Documents Triage

1. List failing controls and associated tests/entities/documents.
2. Produce a deterministic triage plan (owners, statuses, evidence follow-ups).
3. Execute approved actions with explicit confirmation.
4. Re-read status to validate transitions.

Linked cases:

- TEMP-0000-2: `workflow_triage_failing_controls`

## Persona: Third-Party Risk Manager

Motivation: manage vendor risk lifecycle and findings with traceable evidence.

### Workflow: Vendor Lifecycle + Findings

1. Enumerate vendors with open findings or review gaps.
2. Plan status/metadata/finding updates.
3. Execute approved updates + upload review artifacts.
4. Verify via vendor/finding readback.

Linked cases:

- TEMP-0000-3: `workflow_vendor_triage`

## Persona: Security Analyst

Motivation: correlate ownership, assets, and vulnerabilities for SLA-driven remediation.

### Workflow: People + Assets + Vulnerabilities Triage

1. Pull vulnerable assets + vulnerabilities + people/task context.
2. Plan remediation actions and SLA acknowledgements.
3. Execute selected actions with confirmation.
4. Validate updated status and remaining backlog.

Linked cases:

- TEMP-0000-4: `workflow_people_assets_vuln_triage`

## Persona: Integration Engineer

Motivation: keep external system data synchronized via connector APIs.

### Workflow: Connector Resource Sync

1. Identify target connector resource kinds and entities.
2. Plan read/put operations per account/asset/group.
3. Execute sync calls with explicit confirmation for writes.
4. Verify synchronization by immediate readback.

Linked cases:

- TEMP-0000-5: connector endpoint parity + helper workflow

## Persona: Auditor Liaison

Motivation: close information requests quickly with clear evidence trail.

### Workflow: Information Request Triage (Audit scope)

1. List open information requests and current evidence state.
2. Plan comments, evidence flag/accept decisions, and status changes.
3. Execute approved actions with confirmation.
4. Verify updated request history/status.

Linked cases:

- TEMP-0000-6: `workflow_information_request_triage`
