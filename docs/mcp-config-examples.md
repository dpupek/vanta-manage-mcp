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
        "VANTA_MCP_SAFE_MODE": "true",
        "VANTA_MCP_ENABLE_WRITE": "true"
      }
    }
  }
}
```

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

## Optional Tool Allowlist
```json
{
  "VANTA_MCP_ENABLED_TOOLS": "controls,documents,workflow_control_evidence"
}
```
