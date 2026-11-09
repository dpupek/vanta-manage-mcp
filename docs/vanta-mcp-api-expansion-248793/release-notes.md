# Download integrity and API expansion release notes

This release refreshes the public Vanta API contracts to 383 operations, adding 50 operations while preserving the identities of the 333 existing generated tools. It also expands vendor, risk, evidence, framework, and personnel workflows. Review the [contract migration details](contract-schema-review-2026-11-09.md) for changed inputs.

## Migration and behavior changes

- `get_uploadedfile_media` and `get_trust_center_resource_media` now require `downloadFileName`. They save bytes on the MCP server host and return a path, byte count, MIME type, SHA-256, and identity status. Set `VANTA_MCP_DOWNLOAD_DIR` to choose the directory; the defaults are 100 MiB and a 120-second deadline. Existing files are not overwritten and redirects are rejected.
- A saved file's hash establishes the bytes received. Matching an original requires a known source hash; Vanta can return a transformed representation. Policy versions without a supported public download route require the documented browser or manual handoff.
- Supported administrative writes now use independent readback. An accepted write may return `write_unverified` when its result cannot be established; inspect the result before retrying. Framework snooze status and its requested end date are verified separately, and an unavailable independent date leaves the write unverified. Vendor-category deletion requires a complete vendor inventory and may be refused when that inventory is unavailable.
- Uploads use `filePath` and optional `mimeType`; older `contentBase64` and `filename` inputs are unsupported.

Local validation passed 281 unit and mock integration tests, lint, and 383-operation specification parity. A direct API comparison with the local MCP established byte identity for one existing PDF. These checks do not establish live acceptance for every tenant, permission, or mutation lifecycle. See the [implementation plan](download-integrity-and-api-refresh-plan.md) and [operator recipes](../user/capabilities-and-recipes.md) for details and remaining limits.
