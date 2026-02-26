# Interface Overview

## Tool Families
- Generated endpoint tools: full OpenAPI parity.
- Compatibility read tools: familiar aliases (`controls`, `documents`, `tests`, etc.).
- Workflow tools: multi-step orchestration with plan/execute controls.

## Response Envelope
All tools return JSON envelopes:

- Success: `{ "success": true, "data": ..., "message"?: ..., "notes"?: ... }`
- Error: `{ "success": false, "error": { "code": ..., "message": ..., "hint"?: ..., "details"?: ... }, "notes"?: ... }`

## Safe Mutation Contract
- Safe mode default: `VANTA_MCP_SAFE_MODE=true`
- Mutating endpoint calls require `confirm:true`
- Workflow execution requires `mode:"execute"` and `confirm:true`
- Missing confirmation returns `error.code = "confirmation_required"`

## Discovery Pattern
1. Read `resource://vanta-manage/help`.
2. Read `resource://vanta-manage/tool-catalog`.
3. Use relevant `playbook_*` prompt.
4. Execute read -> plan -> execute -> verify sequence.
