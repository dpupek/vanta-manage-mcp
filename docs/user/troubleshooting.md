# User Troubleshooting

## `confirmation_required`

Cause:

- A mutating call was made without required confirmation.

Fix:

- Endpoint tools: set `confirm:true`.
- Workflow tools: set `mode:"execute"` and `confirm:true`.

## Authentication Errors

Cause:

- Missing/invalid credentials.

Fix:

- Set `VANTA_CLIENT_ID` and `VANTA_CLIENT_SECRET`, or
- Set `VANTA_ENV_FILE` to JSON/dotenv credentials.

## Base URL Errors

Cause:

- API base URL missing `/v1`.

Fix:

- `VANTA_API_BASE_URL=https://api.vanta.com/v1`
- `VANTA_OAUTH_BASE_URL=https://api.vanta.com`

## MCP Client Config Errors

Cause:

- Invalid JSON config or wrong `npx` args.

Fix:

- Reuse the exact templates from:
  - [Get Started with Codex](get-started-codex.md)
  - [Get Started with Claude Desktop](get-started-claude.md)

## Prompt/Resource Discovery Issues

Cause:

- Client not refreshing MCP capabilities.

Fix:

1. Restart MCP client.
2. Re-list tools/resources.
3. Call `help` and read `resource://vanta-manage/help`.

## Upload Preflight Errors

Cause:

- `filePath` is missing/invalid, not readable, or file type is unsupported.

Fix:

- Provide `filePath` to an existing readable local file.
- Ensure the path points to a regular file (not a directory).
- Use supported file types (`.pdf`, `.docx`, `.xlsx`, `.csv`, `.txt`, `.png`, `.jpg`, `.jpeg`, `.webp`, `.zip`, `.ps`).
- If set, ensure `mimeType` aligns with the file extension and endpoint policy.
- For Markdown evidence, install Pandoc and a Playwright/Chromium renderer, or convert to PDF/DOCX before upload.
- If `markdown_converter_unavailable` is returned, retry with `markdownConversionTarget:"docx"` when Pandoc is available, or upload an already converted PDF.

## Policy Slug Versus Document ID

Cause:

- A policy-derived slug was passed to a Document endpoint or control-document mapping endpoint.

Fix:

- Use a real Vanta Document ID for `get_document` and `add_document_to_control`.
- For policy-control linkage, use the unsupported tool fallback batch and complete the action in the Vanta UI.
- Do not treat control-test remaps as policy relinks.

## Unsupported Operation

Cause:

- The requested Vanta UI behavior is not exposed by the current public Vanta API.

Fix:

- Follow the returned `fallbackActionBatch`.
- For direct Manage test progress comments, add a control note that references the test ID.

## Need More Diagnostic Detail

Cause:

- An issue is not reproducible from normal user logs.

Fix:

- Increase log verbosity temporarily:
  - `VANTA_MCP_LOG_LEVEL=verbose` for request/retry diagnostics
  - `VANTA_MCP_LOG_LEVEL=all` for full trace metadata
- Return to `minimal` after troubleshooting.
