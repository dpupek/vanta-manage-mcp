# MCP Config Examples

## Codex CLI / Local Stdio
```json
{
  "mcpServers": {
    "vanta-full": {
      "command": "node",
      "args": ["E:/Sandbox/VantaMcp/build/index.js"],
      "env": {
        "VANTA_ENV_FILE": "E:/Secrets/vanta-credentials.json",
        "VANTA_API_BASE_URL": "https://api.vanta.com/v1",
        "VANTA_OAUTH_BASE_URL": "https://api.vanta.com",
        "VANTA_MCP_SAFE_MODE": "true",
        "VANTA_MCP_ENABLE_WRITE": "true"
      }
    }
  }
}
```

`VANTA_ENV_FILE` can point to JSON credentials (`client_id` / `client_secret`) or dotenv credentials (`VANTA_CLIENT_ID` / `VANTA_CLIENT_SECRET`).
If both direct env vars and `VANTA_ENV_FILE` are set, direct env vars are used.

## Cursor / Claude Desktop Style
```json
{
  "mcpServers": {
    "vanta-full": {
      "command": "node",
      "args": ["E:/Sandbox/VantaMcp/build/index.js"],
      "env": {
        "VANTA_CLIENT_ID": "YOUR_CLIENT_ID",
        "VANTA_CLIENT_SECRET": "YOUR_CLIENT_SECRET",
        "VANTA_API_BASE_URL": "https://api.vanta.com/v1",
        "VANTA_OAUTH_BASE_URL": "https://api.vanta.com",
        "VANTA_MCP_SAFE_MODE": "true"
      }
    }
  }
}
```

## Git Repo via npx
Use this when you want to run directly from the Git repository instead of a local built path.

```json
{
  "mcpServers": {
    "vanta-full": {
      "command": "npx",
      "args": ["-y", "github:<org>/<repo>"],
      "env": {
        "VANTA_CLIENT_ID": "YOUR_CLIENT_ID",
        "VANTA_CLIENT_SECRET": "YOUR_CLIENT_SECRET",
        "VANTA_MCP_SAFE_MODE": "true"
      }
    }
  }
}
```

The package uses `prepare` to run `npm run build` during Git-based installs so the executable bin is available to `npx`.

## Git Repo via npx (Version-Pinned Tag)
Use this for deterministic installs tied to CI release tags (`v1.0.<buildnumber>`).

```json
{
  "mcpServers": {
    "vanta-full": {
      "command": "npx",
      "args": ["-y", "github:dpupek/vanta-manage-mcp#v1.0.123"],
      "env": {
        "VANTA_CLIENT_ID": "YOUR_CLIENT_ID",
        "VANTA_CLIENT_SECRET": "YOUR_CLIENT_SECRET",
        "VANTA_MCP_SAFE_MODE": "true"
      }
    }
  }
}
```

Equivalent URL form:

```json
{
  "mcpServers": {
    "vanta-full": {
      "command": "npx",
      "args": ["-y", "git+https://github.com/dpupek/vanta-manage-mcp.git#v1.0.123"]
    }
  }
}
```

## Optional Tool Allowlist
```json
{
  "VANTA_MCP_ENABLED_TOOLS": "controls,documents,workflow_control_evidence"
}
```

## Live Integration Test Env Example
```bash
VANTA_CLIENT_ID=YOUR_CLIENT_ID
VANTA_CLIENT_SECRET=YOUR_CLIENT_SECRET
VANTA_INTEGRATION_LIVE=true
VANTA_INTEGRATION_ALLOW_MUTATIONS=true
VANTA_INTEGRATION_REQUIRE_MUTATION=false
VANTA_INTEGRATION_TEST_CONTROL_ID=control-123
VANTA_INTEGRATION_TEST_VENDOR_ID=vendor-123
VANTA_INTEGRATION_TEST_VULNERABILITY_ID=vulnerability-123
VANTA_INTEGRATION_TEST_REMEDIATION_ID=remediation-123
VANTA_INTEGRATION_TEST_TIMEOUT_MS=180000
```
