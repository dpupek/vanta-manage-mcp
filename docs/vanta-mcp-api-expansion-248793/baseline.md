# Baseline: downloads and API expansion

Captured November 9, 2026 before implementation. Repository HEAD: `71f187a`. Existing local edits to `roadmap.md` and `implementation-write-verification.md` predate this plan and must be preserved.

## Current implementation

- `src/registry.ts:registerAllTools` registers generated endpoints, compatibility reads, workflows, capabilities, and unsupported tools with a shared `VantaApiClient`.
- `src/client/vanta-client.ts:parseResponsePayload` calls `response.text()` for all nonempty responses, parses JSON when labeled JSON, and returns text otherwise. Binary bytes can therefore be irreversibly decoded before MCP serialization. This source inspection supports a likely cause; it does not establish which installed runtime produced each reported incident.
- `src/tools/endpoint-tools.ts:invokeGeneratedOperation` dispatches through that client and wraps results in the normal envelope. The generator models requests but does not currently model OpenAPI response content in its operation interface.
- The pinned Manage spec describes `GetUploadedfileMedia` at `GET /documents/{documentId}/uploads/{uploadedFileId}/media` and `GetTrustCenterResourceMedia` at `GET /trust-centers/{slugId}/resources/{resourceId}/media`, including stream responses.
- Legacy `src/operations/documents.ts:downloadDocumentFile` and Trust Center download code return text for readable MIME types and metadata for binary files. The current registry does not register these legacy modules. Updating them alone would not fix the active path.
- `validateDocumentIdArgs` rejects identifiers beginning with `policy-` or `policy_` and explains the policy/evidence boundary. This heuristic does not prove the type or validity of every approved-version artifact ID.
- Uploads require a server-local `filePath`; Markdown conversion defaults to PDF, with opt-in DOCX. A source Markdown hash and converted upload hash refer to different artifacts.
- Existing request deadlines, cancellation, operation-aware retries, envelopes, and tenant identity should be reused.

## Published contract comparison

The [November 9 inventory](contract-review-2026-11-09.json) records retrieval times, exact downloaded SHA-256 hashes, identities, and structural deltas after resolving references and excluding descriptive/example fields. It is a planning comparison, not a pinned-spec refresh.

| Family     | Pinned | Published | Added | Existing operations with structural changes |
| ---------- | -----: | --------: | ----: | ------------------------------------------: |
| Manage     |    251 |       301 |    50 |                                          30 |
| Audit      |     57 |        57 |     0 |                                          14 |
| Connectors |     25 |        25 |     0 |                                           0 |
| Total      |    333 |       383 |    50 |                                          44 |

No removed identities were found. Structural-change counts indicate operations needing review, not 44 breaking changes. Existing issue APIs need refreshed filters/detail schemas, not duplicate endpoints. Examples of changed requests include vendor `categoryId` with deprecated `category`, customer-trust `revenueOverrides`, and Trust Center video IDs. All enum, requiredness, nullability, deprecation, query, response, and operation-ID changes still require implementation-time classification.

Sources: [Manage](https://developer.vanta.com/reference/manage-vanta.json), [Audit](https://developer.vanta.com/reference/auditor-api.json), [Connectors](https://developer.vanta.com/reference/build-integrations.json).

## Reported operational evidence

The user supplied the following incident references. These paths were unavailable on this workstation on November 9; their contents and exact hashes have not been independently inspected here. Reproduction and receipt collection are phase 0 tasks.

| Reported observation                                                        | User-supplied reference                                                                                                                                     |
| --------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| XLSX response lost bytes through text decoding                              | `C:/Sandbox/sysops/docs/cmmc-program/Advanced-Systems-Technology/documents/system-boundaries/ast-lawton-authentication-review-2026-09-17.md:79`             |
| Policy approved-version identifiers fail as evidence document IDs           | `C:/Sandbox/sysops/docs/cmmc-program/vanta-mcp-known-gaps.md:26`                                                                                            |
| PNG-named upload served as JPEG; preview usable, original identity unproven | `C:/Sandbox/sysops/docs/cmmc-program/Advanced-Systems-Technology/documents/system-boundaries/ast-privileged-identity-readback-2026-09-30.md:124`            |
| Approved PDF supplied by a colleague after retrieval limitation             | `C:/Sandbox/sysops/docs/cmmc-program/Advanced-Systems-Technology/audit-readiness/ast-identification-and-authentication-procedure-review-2026-09-21.md:19`   |
| Image download limitation persisted                                         | `C:/Sandbox/sysops/docs/cmmc-program/Advanced-Systems-Technology/audit-readiness/ast-3-1-1-objective-sufficiency-readback-2026-11-02.json:39`               |
| Browser download established identity while connector remained limited      | `C:/Sandbox/sysops/docs/cmmc-program/Advanced-Systems-Technology/documents/system-boundaries/ssp-monitor-amendment-2026-11-03/publication-receipt.json:134` |

Reported working alternatives: direct documented API retrieval preserving bytes; authenticated browser download followed by hash comparison. Preview inspection alone establishes neither a local download nor original-file identity.

## Prior work and unresolved acceptance

See [October capabilities](capabilities-2026-10-08.md), [contract refresh](contract-refresh.md), [workflow expansion](workflow-expansion.md), and [DG validation](dg-validation-2026-09-09.md). Existing records report 199 unit/mock tests and 333-operation parity; these checks were not rerun for this documentation task.

The [October 13 persistence retest](implementation-write-verification.md) supersedes the earlier failure for the tested DG CMMC control; the locally committed exact-readback guard remains unreleased. Audit/Connector permissions, dedicated vendor/vulnerability/SLA lifecycle fixtures, and custom-control CMMC mapping remain separate open gates.
