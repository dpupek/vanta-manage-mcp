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
- MCP help surface with resources + prompts:
- `resource://vanta-manage/help`
- `resource://vanta-manage/tool-catalog`
- `playbook_tool_selector` and 5 workflow playbook prompts
- JSON envelope responses for all tools.

## Credentials
Provide one of:
1. Direct env vars:
- `VANTA_CLIENT_ID`
- `VANTA_CLIENT_SECRET`
2. `VANTA_ENV_FILE` pointing to JSON:
```json
{
  "client_id": "YOUR_CLIENT_ID",
  "client_secret": "YOUR_CLIENT_SECRET"
}
```
3. `VANTA_ENV_FILE` pointing to dotenv key/value pairs:
```bash
VANTA_CLIENT_ID=YOUR_CLIENT_ID
VANTA_CLIENT_SECRET=YOUR_CLIENT_SECRET
```

Credential precedence is deterministic:
1. Direct env vars (`VANTA_CLIENT_ID` + `VANTA_CLIENT_SECRET`)
2. `VANTA_ENV_FILE` (JSON or dotenv format)

## Config Flags
- `VANTA_MCP_SAFE_MODE=true` (default)
- `VANTA_MCP_ENABLE_WRITE=true` (default)
- `VANTA_MCP_ENABLED_TOOLS=comma,separated,allowlist` (optional)
- `VANTA_API_BASE_URL` (default: `https://api.vanta.com/v1`)
- `VANTA_OAUTH_BASE_URL` (default: origin derived from `VANTA_API_BASE_URL`, usually `https://api.vanta.com`)
- `VANTA_OAUTH_SCOPE` (default: `vanta-api.all:read vanta-api.all:write`)

## Build and Verify
```bash
npm install
npm run build
npm test
npm run lint
npm run verify:spec-parity
npm run smoke:help-surface
npm run test:integration:mock
```

`smoke:help-surface` starts the built MCP server over stdio and validates discovery/readability of help resources/prompts. It is credential-gated and skips when Vanta credentials are not configured.

## Integration Tests
- `npm run test` runs deterministic unit + mock integration tests.
- `npm run test:integration:mock` runs only mocked MCP end-to-end integration tests.
- `npm run test:integration:live` runs live Vanta integration tests and is opt-in.

Live integration env flags:
- `VANTA_INTEGRATION_LIVE=true` enables live tests.
- `VANTA_INTEGRATION_ALLOW_MUTATIONS=true` enables mutating live cases.
- `VANTA_INTEGRATION_REQUIRE_MUTATION=true|false` controls skip vs fail if mutation permission is missing.
- `VANTA_INTEGRATION_TEST_CONTROL_ID=<control-id>` optionally enables control-evidence linkage verification.
- `VANTA_INTEGRATION_TEST_VENDOR_ID=<vendor-id>` optionally targets an existing vendor fixture for vendor/finding write tests.
- `VANTA_INTEGRATION_TEST_VULNERABILITY_ID=<vulnerability-id>` optionally targets a specific vulnerability for lifecycle write tests.
- `VANTA_INTEGRATION_TEST_REMEDIATION_ID=<remediation-id>` optionally targets a remediation for SLA-acknowledgement verification.
- `VANTA_INTEGRATION_TEST_TIMEOUT_MS=<ms>` overrides live test timeout.

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

## Versioned npx via Tag
Main-branch CI creates release tags using `v1.0.<buildnumber>` (with `<buildnumber>` = GitHub run number).  
Use the tag suffix for deterministic installs:

```bash
npx github:dpupek/vanta-manage-mcp#v1.0.<buildnumber>
```

or

```bash
npx git+https://github.com/dpupek/vanta-manage-mcp.git#v1.0.<buildnumber>
```

## Generated Artifacts
- `openapi/manage-v1.json`
- `openapi/audit-v1.json`
- `openapi/connectors-v1.json`
- `src/generated/operations.generated.ts`
- `src/generated/manifest.generated.json`

## Documentation
- Tool catalog: `docs/vanta-mcp-help.md`
- MCP resources/prompt reference: `docs/mcp-resources-prompts.md`
- Migration: `docs/migration-read-only-to-full-management.md`
- MCP config examples: `docs/mcp-config-examples.md`
- Security guidance: `docs/security.md`
- OpenAPI generation contract: `docs/openapi-generation-contract.md`
- Release checklist: `docs/release-checklist.md`
- Troubleshooting: `docs/troubleshooting.md`
- Epic shaping docs: `docs/vanta-mcp-0000/`
