# Vanta API expansion and reliable artifact retrieval

Epic: [248793](https://darwin-global.fogbugz.com/f/cases/248793/). Planning revision: November 9, 2026.

## Outcome

An operator can retrieve a Vanta attachment as an intact local file, identify its source and version, and verify its SHA-256 without reconstructing bytes from model-visible text. The MCP also exposes the current public API contracts and supports focused vendor, risk, issue, evidence, framework, and personnel workflows.

## Success criteria

- Binary PDF, XLSX, PNG, and JPEG fixtures survive API client, MCP dispatch, and local persistence with exact expected bytes and hashes.
- Every completed download returns a receipt with tenant/object identity, media type, measured byte length, SHA-256, destination, and provenance status. Metadata-only access and previews never imply file retrieval.
- Original-file identity is claimed only when the retrieved hash matches a known source hash. A valid JPEG returned for a PNG upload is recorded as a different representation.
- Policy IDs, approved-version artifact identifiers, evidence document IDs, and upload IDs remain distinct. Unsupported policy retrieval returns a precise limitation and an actionable fallback.
- All current public operations and changed inputs are represented after a reviewed contract refresh. November 9 discovery found 383 operations, including 50 additions; implementation rechecks the source before pinning.
- Existing names, confirmations, write-disabled behavior, pagination, and implementation-details readback remain covered.
- Each iteration passes its stated acceptance gate before the next begins; live coverage and release adoption are reported independently.

## Boundaries

This revision authorizes planning artifacts. Implementation, tenant mutations, tracker creation, commits, and publication are subsequent work. Do not infer a public REST endpoint from functionality advertised for Vanta's own Agent, MCP, GraphQL, or UI. Browser retrieval is a documented fallback rather than an automatic substitution for an API download.

## Planning artifacts

- [Baseline](baseline.md), [workflows and stories](workflows.md), [edge cases](edge-cases.md), [responsibilities](crcs.md), and [stakeholder summary](stakeholder-summary.md).
- [Implementation plan and phase gates](download-integrity-and-api-refresh-plan.md).
- [Living epic roadmap](roadmap.md) and [November 9 contract inventory](contract-review-2026-11-09.json).
