# Get Started with Codex

## 1. Add MCP Server Config
Codex MCP config uses `mcp_servers` sections (YAML/TOML-style config), not JSON.
Use either a pinned GitHub tag or the moving `stable` tag with `npx`.

```toml
[mcp_servers.vanta_manage]
command = "npx"
args = ["-y", "github:dpupek/vanta-manage-mcp#stable"]
startup_timeout_sec = 45.0
tool_timeout_sec = 45.0

[mcp_servers.vanta_manage.env]
VANTA_ENV_FILE = "C:\\Users\\dan.pupek\\.vanta\\vanta-credentials-ast.env"
VANTA_MCP_SAFE_MODE = "true"
```

Pinned release example:

```toml
[mcp_servers.vanta_manage]
command = "npx"
args = ["-y", "github:dpupek/vanta-manage-mcp#v1.0.123"]
startup_timeout_sec = 45.0
tool_timeout_sec = 45.0
```

Version guidance:
- Use `#stable` for latest successful release on `main`.
- Use `#v1.0.<buildnumber>` for deterministic, reproducible behavior.

## 2. Credentials
You can provide credentials either way:
- Direct env vars: `VANTA_CLIENT_ID`, `VANTA_CLIENT_SECRET`
- `VANTA_ENV_FILE` path to JSON or dotenv credentials

Direct env vars override `VANTA_ENV_FILE` when both are set.

## 3. First Verification
Ask your agent to:
1. List tools.
2. List resources.
3. Call `help`.
4. Read `resource://vanta-manage/help`.

## 4. First Safe Write Pattern
1. Run a read call.
2. Run workflow with `mode:"plan"`.
3. Execute with `mode:"execute"` and `confirm:true`.
4. Verify with readback call.

## 5. Next Steps
- [Interface Overview](interface-overview.md)
- [Capabilities and Recipes](capabilities-and-recipes.md)
- [Troubleshooting](troubleshooting.md)
