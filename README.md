# Vanta Full-Capability MCP Server

TypeScript MCP server for Vanta with full endpoint parity across:
- Manage Vanta API
- Conduct an audit API
- Build integrations API

This project extends the upstream `VantaInc/vanta-mcp-server` baseline to include complete management coverage, compatibility read tools, and specialized workflow tools.

## Highlights
- Full generated endpoint tool parity from pinned OpenAPI specs (`219` operations).
- Deterministic naming + collision rules:
- `create_custom_control` (manage)
- `audit_create_custom_control` (audit)
- `list_vulnerabilities` (manage)
- `audit_list_vulnerabilities` (audit)
- `connector_*` tool prefix for connectors API operations.
- Safe-by-default mutation behavior (`confirm=true` required in safe mode).
- Workflow tools with plan/execute model:
- `workflow_control_evidence`
- `workflow_triage_failing_controls`
- `workflow_vendor_triage`
- `workflow_people_assets_vuln_triage`
- `workflow_information_request_triage`
- JSON envelope responses for all tools.

## Credentials
Provide one of:
1. `VANTA_ENV_FILE` pointing to JSON:
```json
{
  "client_id": "YOUR_CLIENT_ID",
  "client_secret": "YOUR_CLIENT_SECRET"
}
```
2. Direct env vars:
- `VANTA_CLIENT_ID`
- `VANTA_CLIENT_SECRET`

## Config Flags
- `VANTA_MCP_SAFE_MODE=true` (default)
- `VANTA_MCP_ENABLE_WRITE=true` (default)
- `VANTA_MCP_ENABLED_TOOLS=comma,separated,allowlist` (optional)
- `VANTA_OAUTH_SCOPE` (default: `vanta-api.all:read vanta-api.all:write`)

## Build and Verify
```bash
npm install
npm run build
npm test
npm run lint
npm run verify:spec-parity
```

## Bootstrap Cleanup
After importing/upgrading from upstream:
1. Remove temporary import folders (for example `_upstream/`) so lint/type tooling stays scoped.
2. Confirm repository state is initialized and clean (`git status`) before continuing implementation.
3. Re-run:
```bash
npm run build
npm run lint
npm test
```

## Run via npx (Git Repo)
Git-based `npx` is supported through the `prepare` script (`prepare -> npm run build`), so the `build/index.js` bin is compiled during install.

```bash
npx github:<org>/<repo>
```

or

```bash
npx git+https://github.com/<org>/<repo>.git
```

## Generated Artifacts
- `openapi/manage-v1.json`
- `openapi/audit-v1.json`
- `openapi/connectors-v1.json`
- `src/generated/operations.generated.ts`
- `src/generated/manifest.generated.json`

## Documentation
- Tool catalog: `docs/vanta-mcp-help.md`
- Migration: `docs/migration-read-only-to-full-management.md`
- MCP config examples: `docs/mcp-config-examples.md`
- Security guidance: `docs/security.md`
- OpenAPI generation contract: `docs/openapi-generation-contract.md`
- Release checklist: `docs/release-checklist.md`
- Troubleshooting: `docs/troubleshooting.md`
- Epic shaping docs: `docs/vanta-mcp-0000/`
