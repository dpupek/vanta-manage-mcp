# Get Started with Claude Desktop

## 1. Add MCP Server Config
Add a server entry using `npx` and either `#stable` or a pinned version tag:

```json
{
  "mcpServers": {
    "vanta-manage": {
      "command": "npx",
      "args": ["-y", "github:dpupek/vanta-manage-mcp#stable"],
      "env": {
        "VANTA_CLIENT_ID": "YOUR_CLIENT_ID",
        "VANTA_CLIENT_SECRET": "YOUR_CLIENT_SECRET",
        "VANTA_MCP_SAFE_MODE": "true"
      }
    }
  }
}
```

Pinned release example:

```json
{
  "mcpServers": {
    "vanta-manage": {
      "command": "npx",
      "args": ["-y", "github:dpupek/vanta-manage-mcp#v1.0.123"]
    }
  }
}
```

Version guidance:
- Use `#stable` for latest successful release on `main`.
- Use `#v1.0.<buildnumber>` for deterministic, reproducible behavior.

## 2. Credentials
Supported input:
- `VANTA_CLIENT_ID` + `VANTA_CLIENT_SECRET`
- or `VANTA_ENV_FILE` (JSON or dotenv)

## 3. Verify Setup
After restart, ask Claude to:
1. Discover MCP tools and resources.
2. Read `resource://vanta-manage/help`.
3. Run `playbook_tool_selector` for your first objective.

## 4. Safe Execution Rule
Mutating operations require confirmation in safe mode:
- Endpoint tools: `confirm:true`
- Workflow tools: `mode:"execute"` plus `confirm:true`

## 5. Next Steps
- [Interface Overview](interface-overview.md)
- [Capabilities and Recipes](capabilities-and-recipes.md)
- [Troubleshooting](troubleshooting.md)
