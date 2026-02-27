# Build and Test

## Prerequisites

- Node.js 20+
- npm
- Optional live Vanta credentials for live integration tests

## Standard Build

```bash
npm install
npm run build
```

## Quality Gates

```bash
npm run lint
npm test
npm run verify:spec-parity
npm run generate:help
```

## Debug Logging During Verification

Use higher log verbosity when diagnosing runtime issues:

```bash
VANTA_MCP_LOG_LEVEL=all npm test
```

## Integration Test Suites

- Deterministic unit + mock: `npm test`
- Mock integration only: `npm run test:integration:mock`
- Live integration: `npm run test:integration:live`

Live test guards:

- `VANTA_INTEGRATION_LIVE=true`
- `VANTA_INTEGRATION_ALLOW_MUTATIONS=true` for write tests
- `VANTA_INTEGRATION_REQUIRE_MUTATION=true|false` for fail vs skip behavior
