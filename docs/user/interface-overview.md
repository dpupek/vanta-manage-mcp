# Interface Overview

## Tool Families

- Generated endpoint tools: full OpenAPI parity.
- Compatibility read tools: familiar aliases (`controls`, `documents`, `tests`, etc.).
- Workflow tools: multi-step orchestration with plan/execute controls.

## Response Envelope

All tools return JSON envelopes:

- Success: `{ "success": true, "data": ..., "warnings": [], "correlationId": ..., "tenant": ..., "pagination"?: ..., "metadata"?: ... }`
- Error: `{ "success": false, "error": { "code": ..., "message": ..., "hint"?: ..., "agentHint"?: ..., "details"?: ... }, "warnings": [], "correlationId": ..., "tenant": ... }`

Use the `capabilities` tool to inspect MCP version, tenant label, write/safe-mode flags, available tools, upload support, and unsupported API surfaces.

## Safe Mutation Contract

- Safe mode default: `VANTA_MCP_SAFE_MODE=true`
- Mutating endpoint calls require `confirm:true`
- Workflow execution requires `mode:"execute"` and `confirm:true`
- Missing confirmation returns `error.code = "confirmation_required"`

## Upload Contract

- Multipart upload tools require `filePath` to a local readable file.
- Optional `mimeType` may be provided, but must match supported file types.
- Markdown files are not uploaded raw. When `filePath` points to `.md` or `.markdown`, the MCP converts the file before upload.
- Markdown conversion defaults to PDF with a footer: document name on the left and page numbering on the right.
- Optional Markdown args: `markdownConversionTarget`, `markdownFooterDocumentName`, `markdownConversionRenderer`, and `markdownReferenceDocPath`.
- Upload preflight failures return structured errors such as `file_path_required`, `file_not_found`, `file_not_readable`, `file_not_regular`, and `unsupported_file_type`.

## Unsupported Public API Surfaces

- Policy-control linkage read/write tools return `unsupported_operation` with a Vanta UI fallback because current public docs do not expose official policy-control endpoints.
- Direct Manage test comments return `unsupported_operation`; use a control note that references the test ID.
- Control-test remapping tools only change control-test mappings. They do not relink policies to controls.

## Logging Modes

- Logs are emitted to `stderr` as structured JSON lines.
- Control verbosity with `VANTA_MCP_LOG_LEVEL`:
  - `quiet`
  - `minimal` (default)
  - `verbose`
  - `all`
- Backward-compatible alias: `VANTA_MCP_VERBOSE=true` maps to `verbose` when `VANTA_MCP_LOG_LEVEL` is not set.

## Discovery Pattern

1. Read `resource://vanta-manage/help`.
2. Read `resource://vanta-manage/tool-catalog`.
3. Use relevant `playbook_*` prompt.
4. Execute read -> plan -> execute -> verify sequence.
