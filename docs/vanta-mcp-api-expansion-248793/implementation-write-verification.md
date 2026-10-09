# Implementation details write verification (248793)

## Baseline and workflow

Released v1.0.22 sends `implementationDetails` in `PATCH /controls/{controlId}` and returns success for any successful HTTP response. DG live tests on two disposable, unmapped custom controls returned HTTP 200, but subsequent GET and list responses omitted the field. A `note` write in the same request persisted. HTTP acceptance therefore does not prove persistence of implementation details.

The workflow is: confirm the intended control metadata patch, send it once, independently GET the control, compare the exact implementation details, and report verified success or `write_unverified`. A verification failure does not mean the PATCH was rolled back; other fields in the same request may have changed.

Existing responsibilities: `invokeGeneratedOperation` validates and dispatches the operation and verifies the targeted field; `VantaApiClient` performs HTTP requests and existing safe read retries; shared envelopes preserve the accepted-write and verification outcomes. No new service is needed.

## Plan and decisions

- [x] Record current behavior and the accepted-write/readback distinction before editing source (248793).
- [x] Verify exact readback for implementation-details updates, including clearing with an empty string (248793).
- [x] Cover missing/different values, failed reads, transport failures, ordinary metadata writes, and existing safety gates (248793).
- [x] Attempt CMMC fixture creation and verify that the rejected request left no active fixture (248793).
- [ ] Test a disposable custom control mapped to an existing CMMC requirement; verify its mapping before patching and deactivate it afterward (248793).
- [x] Validate the readback guard on a disposable DG custom control and verify deactivation/cleanup (248793).
- [x] Test an existing DG CMMC control through direct REST and the UI; verify restoration of its original value (248793).
- [x] Complete build, tests, lint, formatting, and parity checks; record live evidence and remaining limits (248793).

Vanta documents enhanced implementation details for CMMC, NIST, and FedRAMP controls in its [product updates](https://help.vanta.com/en/articles/11345422-product-updates). The user authorized the readback fix and subsequently testing an existing CMMC control. The existing-control test below demonstrates that the field is enabled and persists through the UI in DG, while direct public REST writes have no visible effect. Preserve this evidence for Vanta support rather than reporting HTTP acceptance as persistence.

## Validation

The runtime change is locally implemented; it is not part of the published v1.0.22 artifact. Successful implementation-details mutations now return the independent GET response with `metadata.verification.status: "verified"`. Missing/different values or failed reads return `write_unverified`, preserve the accepted PATCH response, and identify the verification failure. No verification failure replays PATCH. Ordinary control metadata updates retain their existing behavior.

- Build and 199 unit/mock tests passed (188 existing plus 11 regression cases). Coverage includes exact multiline/Unicode readback, empty-string clearing, missing/null/stale/whitespace-altered fields, failed HTTP and transport reads, no replay, rejected PATCH, ordinary metadata, and HTTP/MCP propagation. Existing confirmation and write-disabled gates also passed.
- Lint and exact parity passed: 333 operations map to 333 unique tools.
- Authored changes pass Prettier and `git diff --check`. The repository-wide `format:check` reports four existing, unchanged files: `docs/vanta-mcp-api-expansion-248793/contract-diff-2026-09-10.json`, `src/generated/manifest.generated.json`, `src/generated/operations.generated.ts`, and `src/version.ts`. Their diffs against HEAD are empty; they were not reformatted in this scoped fix.
- Runtime help documents the new outcome. Help reference generation/build and all five help-surface tests passed after the documentation change; scoped ESLint also passed.

### DG live evidence, October 8

At 17:37 UTC, `GET /frameworks/cmmc2` succeeded. Creating a temporary custom control with `sections: [{ frameworkId: "cmmc2", sectionId: "AC.L2-3.1.11" }]` returned HTTP 404: `framework with id: cmmc2 not found`. The rejected fixture's external ID was `MCPVER-MUZTJT7D`. All 400 active controls were read afterward; none had that external ID. The published `FrameworkId` enum also omits CMMC, although the input permits custom string IDs. This blocks the API-only mapped-fixture test; it does not establish that writes to existing CMMC controls fail.

At 17:39 UTC, the updated local MCP created an unmapped disposable custom control `6ac7d544e60f1cdc81430b83` (`MCPVER-MUZTMITX`). Both initial and replacement implementation-details PATCH requests returned HTTP 200 from Vanta. Their independent GETs returned HTTP 200 without `implementationDetails`; the new MCP correctly returned `write_unverified` with `mutationAccepted: true` and `verification.reason: "field_missing"`. The accompanying `note` values persisted on both reads. Clearing synthetic values was accepted but implementation-details clearing could not be verified. Deactivation succeeded; exhaustive active and CMMC control lists excluded the fixture, and the CMMC count remained 320.

Fixture evidence is retained in `C:/Users/dan.pupek/AppData/Local/Temp/vanta-cmmc-implementation-20261008.json`, `vanta-implementation-guard-live-20261008.json`, and `vanta-implementation-wire-20261008.jsonl`. Those fixture tests did not edit existing controls or tenant settings.

### Existing CMMC control: direct REST versus UI

The user explicitly authorized testing an existing CMMC control. Selected DG control `6oteid1n`, external ID `HRS-123`, name `03.01.04.a`, owned by Daniel Pupek and mapped to `CMMC 2.0 / AC.L2-3.1.4`. Its original implementation details were blank in the authenticated Vanta drawer. Control type was unset and implementation status was `Not Started`; these values were preserved throughout.

| Test                                                                   | Public API result                                           | Saved UI result                                              |
| ---------------------------------------------------------------------- | ----------------------------------------------------------- | ------------------------------------------------------------ |
| Direct PATCH with only `implementationDetails`, without the MCP header | HTTP 200; PATCH response and independent GET omit the field | Still blank after full page reload                           |
| Direct PATCH with `x-vanta-is-mcp: true` and a distinct marker         | HTTP 200; PATCH response and GET omit the field             | Still blank after closing and reopening the drawer           |
| Save a temporary marker through Vanta's implementation-details editor  | Subsequent GET still omits the field                        | Success toast; marker survives full page reload              |
| Direct PATCH with `implementationDetails: ""` after UI save            | HTTP 200; PATCH response and GET omit the field             | UI marker remains after full page reload                     |
| Restore blank value through Vanta's editor                             | Not inferred from API responses                             | Original blank value verified after another full page reload |

The direct REST experiment bypassed MCP schemas, response envelopes, serialization, and the local readback guard. Only this field was supplied; no control name, note, owner, mapping, status, or type was changed. All 320 controls from the CMMC API list also omitted `implementationDetails`. Temporary UI text was explicitly labelled as verification only and not compliance evidence. UI edits may remain in Vanta history even though the original content was restored.

These observations isolate two public-API gaps in DG: writes do not change the UI-visible implementation details, and reads omit even values demonstrably saved through the UI. An absent GET field alone would not prove a failed write; the independent UI comparisons establish the additional write problem. Unset control type, `Not Started` status, and CMMC feature eligibility did not prevent the UI save. Exact server-side cause remains unconfirmed: a public-API handler/serializer or rollout mismatch is a hypothesis requiring Vanta confirmation, not an inspected backend finding.

Research checked Vanta's current [PATCH contract](https://developer.vanta.com/api-reference/controls/update-a-controls-metadata), [GET contract](https://developer.vanta.com/api-reference/controls/get-control-by-an-id), [authentication guidance](https://developer.vanta.com/docs/concepts/authentication), and [product updates](https://help.vanta.com/en/articles/11345422-product-updates). PATCH documents the top-level string; GET documents an optional nullable field; product updates explicitly include CMMC. The checked contracts do not specify a prerequisite implementation status or control type. No documented workaround was found in these sources. Do not substitute the `note` field, invent payload aliases, or use private browser endpoints as an API fix. Use the UI for this field pending Vanta confirmation; keep `write_unverified` to prevent false MCP success.

Raw HTTP evidence, excluding authorization and tokens: `C:/Users/dan.pupek/AppData/Local/Temp/vanta-existing-cmmc-20261008.json`. The readback guard remains local and unreleased; this investigation added documentation only.

### Other metadata comparison: baseline and plan

The user authorized comparing other control metadata on the same existing CMMC control. Before any comparison write, GET returned name `03.01.04.a`, external ID `HRS-123`, description `The duties of individuals requiring separation are defined`, domains `["HUMAN_RESOURCES_SECURITY"]`, note `null`, and custom fields `[]`.

- [x] Test note, description, name, external ID, domain, and a temporary custom-field value independently through direct REST.
- [x] GET after every write and verify the requested value rather than relying on HTTP acceptance.
- [x] Restore each field before the next test; verify original values and record any null/empty normalization or unsupported custom-field behavior.
- [x] Record results and update the support reproduction with the successful comparison fields.

The comparison changed no owner, framework mappings, evidence, implementation status, or control type. At 18:06:44-18:06:57 UTC on October 8, direct public REST tests produced these results:

| Field          | Write status | Independent GET                | Restoration                                   |
| -------------- | ------------ | ------------------------------ | --------------------------------------------- |
| `note`         | 200          | Exact temporary string         | Blank-equivalent: original `null`, final `""` |
| `description`  | 200          | Exact temporary string         | Exact original                                |
| `name`         | 200          | Exact temporary string         | Exact original                                |
| `externalId`   | 200          | Exact temporary identifier     | Exact original                                |
| `domain`       | 200          | `domains: ["COMPLIANCE"]`      | Exact original `["HUMAN_RESOURCES_SECURITY"]` |
| `customFields` | 422          | Original empty array unchanged | Already original                              |

The custom-field response was `Invalid fields (customFieldValues). MCP metadata verification temporary isn't a valid custom field for controls`. This checks unconfigured-label validation, not valid configured-custom-field persistence; no global field definition was created. Restoring `note: null` returned 400 with `body.note: invalid string value`. Restoring `note: ""` returned 200 and GET confirmed the blank string. The note therefore remains blank but its API representation is not identical to the original null. Final GET confirmed exact restoration of the other five tested fields.

Five independently persisted fields on this same existing CMMC control establish that ordinary metadata write authorization and the PATCH endpoint work. They strengthen the evidence for a field-specific public-API gap involving `implementationDetails`; they do not identify Vanta's internal handler, serializer, or rollout cause. Raw HTTP evidence, including original values and all restoration requests, is retained without credentials in `C:/Users/dan.pupek/AppData/Local/Temp/vanta-metadata-compare-20261008.json`.

### October 9 vendor-fix retest: completed results

The user reported that Vanta implemented a fix and authorized a fresh implementation-details test. Initial direct GET of the same existing DG CMMC control `6oteid1n` returned 200 but still omitted `implementationDetails`. Existing content must be inspected in the current UI before any overwrite because API omission does not establish that its original value is blank. The prior day's UI observation is not a current backup.

- [x] Refresh the existing-control API baseline and retain the full response before testing.
- [x] Test write, replacement, and clearing through the local MCP readback guard on a new disposable DG custom control; deactivate it and verify absence from active controls.
- [x] Capture current implementation content for the existing CMMC control through the authenticated UI.
- [x] Retest the existing CMMC control with independent API and UI readback, then restore and verify its current original value.
- [x] Record October 9 API-only and existing-control results separately from October 8.

The new unmapped fixture `6ac9188641c34e7b1c7645dd` returned HTTP 200 for write, replacement, and clearing, but independent GET omitted the field each time. The local MCP returned `write_unverified` / `field_missing` for all three requests. Deactivation succeeded, and exhaustive active-control pagination excluded the fixture. This remains an unmapped-fixture result and does not by itself demonstrate current behavior of writes to an eligible existing CMMC control. Evidence: `C:/Users/dan.pupek/AppData/Local/Temp/vanta-implementation-baseline-20261009.json` and `vanta-implementation-retest-20261009.json`.

The fixture test ran at 16:38:28-16:38:34 UTC (11:38 AM America/Chicago). `get_organization` confirmed Darwin Global, organization ID `62a8ab6572eb9d1f26511457`, region `us-east-1`. Existing-control mutation was initially deferred at the Google password prompt until the user completed sign-in. Current public PATCH/GET documentation was checked and continues to describe the same `implementationDetails` field.

The user also requested reading the Nexport Gmail support reply. [Shehbaaz's October 9 reply](https://mail.google.com/mail/u/?authuser=dpupek%40nexportengineering.com#all/1a1216ff00759489), received at 16:12:25 UTC (11:12 AM CDT), says Vanta made an update for Darwin Global to allow Controls API reads and writes of `implementationDetails`. It requests precisely `PATCH /v1/controls/6oteid1n`, independent GET, and UI refresh. No alternative payload, scope, or rollout condition is specified. The support conversation ID is `215476304656505`.

After sign-in, the current authenticated UI showed the original implementation details still blank on `6oteid1n` (`HRS-123`, `03.01.04.a`). A direct public REST test, bypassing MCP and its local guard, produced the following results:

| Request / observation                          | UTC timestamp         | Result                                                                                     |
| ---------------------------------------------- | --------------------- | ------------------------------------------------------------------------------------------ |
| Baseline GET                                   | 17:47:26.231          | HTTP 200; `implementationDetails` absent                                                   |
| PATCH temporary implementation text            | 17:47:26.407          | HTTP 200; `implementationDetails` absent from response                                     |
| Independent GET                                | 17:47:26.663          | HTTP 200; `implementationDetails` absent                                                   |
| Full Vanta page reload                         | After independent GET | Existing CMMC drawer still shows `Add implementation details...`; temporary text is absent |
| Restore PATCH with `implementationDetails: ""` | 17:47:54.475          | HTTP 200; `implementationDetails` absent                                                   |
| Independent restoration GET                    | 17:47:54.740          | HTTP 200; `implementationDetails` absent                                                   |
| Another full Vanta page reload                 | After restoration GET | Original blank value confirmed in the drawer                                               |

Sanitized temporary request body:

```json
{
  "implementationDetails": "Temporary API persistence verification 2026-10-09. Not compliance evidence.\nExact read-back check: duties and separation – restore original blank after test."
}
```

The PATCH at 12:47:26 PM CDT and independent UI comparison demonstrate that the reported fix still does not persist this field on the exact existing CMMC control named by support. GET continues to omit the field. The internal cause remains unknown; these results do not establish whether the vendor update was applied to the correct API path or whether another rollout condition exists. No other metadata was supplied in these requests. The original blank implementation content is verified through the UI, since API clearing cannot be verified from an absent response field.

Full sanitized request/response bodies and timestamps are saved in `C:/Users/dan.pupek/AppData/Local/Temp/vanta-existing-cmmc-retest-20261009.json`. Final UI proof is `C:/Users/dan.pupek/AppData/Local/Temp/vanta-existing-cmmc-restored-20261009.jpg`. The guard remains local and unreleased; no code change or release was made for this retest.

### October 9 support follow-up and commit checkpoint

- [x] Send the failed retest to Vanta support in the existing email thread, as explicitly requested by the user.
- [x] Include exact UTC/CDT request timing, sanitized PATCH body, complete matching PATCH/GET response bodies, full UI reload result, and verified restoration.
- [x] Request confirmation that the public Controls endpoint has the change enabled for the affected workspace and investigation of the remaining read/write discrepancy.
- [x] Revalidate the pending guard before commit: `npm test` passed all 199 unit/mock tests, including the build; lint, exact spec parity, and scoped formatting passed.
- [ ] Confirm a corrected vendor rollout with independent GET and UI readback before reporting public-API persistence as verified.
- [ ] Publish the local readback guard in a separately authorized release.

The [sent support reply](https://mail.google.com/mail/u/?authuser=dpupek%40nexportengineering.com#all/1a121c98228f1b91) was sent from the Nexport account to `support@vanta.com`; Gmail returned the `SENT` label and the original thread ID. Vendor follow-up is pending. This checkpoint commits the local guard, regression coverage, help guidance, and investigation/progress documentation; it does not establish production acceptance of implementation-details writes or create a release.

### Vanta support request draft

Subject: DG existing CMMC implementationDetails: REST writes silently ineffective and reads omit UI-saved content

Additional comparison: direct REST writes to `note`, `description`, `name`, `externalId`, and `domain` on this same control each returned 200 and their exact values were confirmed by independent GETs. Each was restored before the next test; the original null note was restored as a blank string because the API rejects null input. An unconfigured custom-field label correctly returned 422. Ordinary metadata writes therefore work on the affected existing control, while implementation-details writes and reads exhibit the discrepancy below.

On October 8, 2026, we tested existing DG CMMC control `6oteid1n` (`HRS-123`, `03.01.04.a`, requirement `AC.L2-3.1.4`). Direct `PATCH /v1/controls/6oteid1n` with only `implementationDetails` returned 200 without changing the UI-visible field after full reload. Both ordinary REST headers and the MCP header were tested. Saving temporary text through Vanta's own editor persisted after full reload, yet GET still omitted the field. An API PATCH to clear this UI-saved text returned 200 but left it intact after reload. We restored the original blank value through the UI and verified it after reload. Please confirm whether the public handler persists this field and whether the response serializer exposes it for DG CMMC controls, including any required tenant rollout or feature flag. Earlier disposable-control tests also confirmed that accompanying note writes persist.

We attempted to test CMMC eligibility using a disposable mapped control. `GET /v1/frameworks/cmmc2` succeeds, but `POST /v1/controls` with `sections: [{ frameworkId: "cmmc2", sectionId: "AC.L2-3.1.11" }]` returns 404 with `framework with id: cmmc2 not found`. Please provide the supported CMMC mapping identifier or confirm whether custom-control mapping to CMMC is available through this API. Once an eligible fixture can be created, we will repeat PATCH, independent GET, replacement PATCH/readback, and cleanup.
