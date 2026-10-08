# October 8 API capabilities iteration

Epic: [248793](https://darwin-global.fogbugz.com/f/cases/248793/).

## Baseline and success criteria

Before this iteration, HEAD e7efef3 and the installed v1.0.21 runtime expose 323 generated operations: Manage 241, Audit 57, Connectors 25. Seven workflows use shared generated schemas, envelopes, pagination, and confirmation gates. The pinned control metadata schema permits name, externalId, description, domain, note, and customFields, but rejects implementationDetails. Existing contract and workflow evidence is in [contract-refresh.md](contract-refresh.md) and [workflow-expansion.md](workflow-expansion.md).

The October 8 official Manage contract adds ten operations and changes five existing input contracts. Audit changes one input contract (linkedControlIds plus deprecations), and Connectors changes ten input contracts (nullable fields). Implement every new endpoint and changed input through the existing generator; preserve all existing tool names and safety contracts; publish current generated help with concrete usage examples. Compare all three current specifications before pinning them. Successful local implementation requires exact parity, source hashes, deterministic generation, lint, and tests that exercise the new HTTP contracts and confirmation boundaries.

## Workflows, CRCs, and tasks

| Workflow                                          | Developer/operator steps                                                                                                                                            | Existing responsibility and collaborators                                                       |
| ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| W1: Record implementation details                 | Read the control, patch implementationDetails with confirmation, read back the control.                                                                             | Generated UpdateControlMetadata; buildOperationSchema; invokeGeneratedOperation; VantaClient.   |
| W2: Discover scoped personnel                     | Read organization, business units, and program scopes; pass selected framework, program-scope, and business-unit IDs to list_people.                                | Generated reads and ListPeople; shared schema and query serialization.                          |
| W3: Manage personnel reminders                    | Read settings, review a partial update, confirm the write, read back settings.                                                                                      | Generated GetSettings/UpdateSettings; shared mutation gates and client.                         |
| W4: Map vendor findings to risks                  | List mappings, review finding IDs, confirm add/remove batches, read mappings again.                                                                                 | Generated mapping operations; shared request validator, mutation gates, and response envelopes. |
| W5: Maintain Trust Center requests and frameworks | Explicitly choose denial email behavior and supported framework values; confirm the selected update.                                                                | Existing generated Trust Center operations; shared request validator.                           |
| W6: Update audit control links                    | Read audit controls, review the complete desired linkedControlIds set, confirm replacement, and read back the request. Empty clears links; omission preserves them. | Existing UpdateInformationRequest; shared request validator and envelopes.                      |
| W7: Send connector fields with unknown values     | Provide required resource fields, use null only where the current contract permits it, confirm the upload.                                                          | Existing generated Connector PUT operations; buildInputSchema and shared dispatch.              |

No new service or workflow abstraction is needed. Tool naming remains deterministic snake_case; all new writes use confirm:true in safe mode. Implementation details are separate from description and note. Mapping results must preserve the API response; already-linked vendor findings reject an add batch and must not be translated into success. Feature-gated business-unit/program-scope permissions can return 403 and remain API errors.

## Iteration plan

- [x] Capture baseline, workflow/CRC decomposition, decisions, and acceptance criteria before changing source contracts (248793).
- [x] Record additions, schema deltas, retrieval timestamps, and exact source byte hashes (248793).
- [x] Pin current contracts and regenerate endpoint tools without changing existing names (248793).
- [x] Add AAAA regression coverage for changed inputs, new requests, mutation gates, and readback (248793).
- [x] Regenerate catalog/help and update current documentation and roadmap (248793).
- [x] Run required validation and audit the final patch against all new capabilities (248793).

## Decisions and remaining boundaries

- This is a focused implementation iteration in the existing epic, using its established shaping artifacts.
- Current specification downloads are the source of truth; the live API may require tenant-specific features and scopes.
- Use mock lifecycle/readback acceptance for new mutations; this request does not authorize changing existing Vanta tenant settings or mappings.
- The earlier Audit/Connector credential and dedicated lifecycle-fixture acceptance work remains separately tracked.
- The user subsequently authorized commit, synchronization, and release. Runtime adoption follows updating/restarting the installed MCP.

## Validation

- `npm test`: 188 passed, zero failed/skipped; 51 new unit/mock cases. The build regenerates the current endpoint surface and compiles the runtime and tests.
- `npm run lint`: passed. The final mock-response fixture refinement also passed scoped ESLint.
- `npm run verify:spec-parity`: 333 operations map to 333 unique tools; exact source/method/path/operationId identities and all three pinned byte hashes pass.
- `npm run generate:help`: regenerated the canonical reference. Saved help contains each of the 333 endpoint rows exactly once; runtime example payloads parse against registered schemas.
- Repeated `npm run generate` produced byte-identical operations and manifest. All 323 baseline names still map to the same source/method/path identities.
- Authored source/document formatting and `git diff --check` passed. Pinned upstream JSON retains its exact downloaded bytes.

| Requirement                    | Current evidence                                                                                                                                                                                                                     |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Every new endpoint             | Manifest has exactly one descriptor for each of the ten added identities in contract-diff-2026-10-08.json. Mock MCP/HTTP calls cover seven reads and all three writes.                                                               |
| Implementation details         | Mock MCP PATCH forwards only implementationDetails; GET readback preserves the exact multiline text, description, and note. Null input is rejected.                                                                                  |
| Scoped discovery and personnel | HTTP tests verify business-unit/program-scope paths, independent pagination values, and repeated array query parameters for scopes and people. Feature-gated 403 remains an API error.                                               |
| Reminder settings              | Partial request updates frequency while preserving channels in the published response shape. Schema tests cover empty channels, NEVER, and rejection of response-shaped or invalid input.                                            |
| Risk/finding mappings          | Add/remove use distinct input keys, preserve unrelated mappings on mock readback, and handle the documented 204 responses. Schemas enforce 100-ID bounds. Already-linked batch rejection remains an API error.                       |
| Changed Trust Center inputs    | Explicit sendEmail:false survives validation; a string is rejected. Create/update accept all three added framework enum values. Existing bodyless denial regression still passes.                                                    |
| Audit linkage                  | linkedControlIds passes shared validation and dispatch unchanged to the Audit PATCH endpoint. Docs explain complete-set replacement, clearing, omission, and upstream deprecations.                                                  |
| Connector nullability          | Explicit fixture calls for all ten changed PUT contracts preserve nullable fields, including nested device/occurrence values. Nullable required mfaEnabled still cannot be omitted.                                                  |
| Safety and conventions         | All 169 generated mutations require confirmation before HTTP; the three new mutations also return write_disabled without additional OAuth or API requests. Existing envelope, upload, retry, workflow, and logging regressions pass. |

Engineering implementation is locally verified. The independent delegated review found no actionable issues; its read-only checks included TypeScript, 76 focused tests, parity, deterministic artifacts, and preserved names. Release preparation adds explicit Prettier exclusions for the three raw pinned contracts and generated help; authored source/document formatting remains checked, and upstream source hashes remain intact. GitHub's main release workflow publishes the immutable release and updates stable after its validation gates pass. Existing Audit/Connector and dedicated vendor/vulnerability/SLA live acceptance remains separately open.
