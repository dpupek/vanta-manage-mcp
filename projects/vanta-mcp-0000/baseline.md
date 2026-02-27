# Baseline

## Current Repository State

- [x] Repository started effectively empty for product code (only temporary files and downloaded specs were present).
- [x] Upstream `VantaInc/vanta-mcp-server` source has now been imported as the baseline architecture.

## External Baselines

- Upstream official MCP server: primarily read-focused endpoint exposure with constrained tool set defaults.
- Community PoC (`securityfortech/vanta-mcp`): minimal subset; not full parity and not suitable as full-management baseline.
- Vanta public APIs to cover in v1:
- Manage Vanta OpenAPI
- Conduct an audit OpenAPI
- Build integrations OpenAPI

## Gap Summary

- Missing full endpoint parity across all 3 specs.
- Missing explicit mutation confirmation contracts for every write endpoint.
- Missing workflow-level tools for high-frequency compliance/security operations.
- Missing committed build-time code generation and drift checks.
