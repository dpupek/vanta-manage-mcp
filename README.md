# Vanta Manage MCP

Vanta Manage MCP is a full-capability Model Context Protocol server for operating and automating your Vanta program. It combines complete API coverage (manage, audit, and connectors) with safe-write controls and workflow guidance so AI agents can execute compliance operations reliably.

## Why Vanta Manage MCP
- Full Vanta API parity across Manage, Audit, and Connectors.
- Safety-first writes with explicit confirmation requirements.
- Workflow tools for high-value triage and evidence operations.
- Built-in MCP resources, prompts, and recipes for agent guidance.
- Git-tagged releases for deterministic `npx` usage.

## Feature Snapshot
- `219` generated endpoint tools (current generated baseline).
- Safe mutation contract with `confirm=true` gating.
- Multipart uploads use local `filePath` preflight validation (readability + supported type checks).
- Workflow tools with `mode=plan|execute`.
- Help surface with resources and playbook prompts.
- Env-controlled structured logging: `quiet`, `minimal` (default), `verbose`, `all`.
- Standard JSON envelope responses for success and error handling.

## Quickstart
Run from GitHub with a pinned release tag:

```bash
npx -y github:dpupek/vanta-manage-mcp#v1.0.<buildnumber>
```

Full setup steps:
- [Codex Getting Started](docs/user/get-started-codex.md)
- [Claude Getting Started](docs/user/get-started-claude.md)

## Interface Overview
The server exposes generated endpoint tools, compatibility read tools, and workflow tools using a common response envelope and safe-write model.

See: [Interface Overview](docs/user/interface-overview.md)

## Documentation TOC

### User Docs
- [User Docs Index](docs/user/README.md)
- [Capabilities and Recipes](docs/user/capabilities-and-recipes.md)
- [User Troubleshooting](docs/user/troubleshooting.md)

### Developer Docs
- [Developer Docs Index](docs/dev/README.md)
- [Conventions](docs/dev/conventions.md)
- [Build and Test](docs/dev/build-and-test.md)
- [Developer Troubleshooting](docs/dev/troubleshooting.md)

### Projects
- [Projects Index](projects/README.md)
- [Epic: vanta-mcp-0000](projects/vanta-mcp-0000/roadmap.md)

## Release Versioning
Main-branch CI publishes immutable tags in `v1.0.<buildnumber>` format and also moves a `stable` tag to the latest successful main release commit.

- Use `#v1.0.<buildnumber>` for deterministic installs.
- Use `#stable` for latest successful release on main.
