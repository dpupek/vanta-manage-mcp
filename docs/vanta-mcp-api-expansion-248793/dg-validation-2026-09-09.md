# DG live validation — September 9, 2026

Target: the local `b9591fb` build, using the credential file configured for the Codex `vanta_dg` server. API base: `https://api.vanta.com/v1`. Validation used local MCP stdio processes, not the installed stable server. Window: 20:51–20:55 UTC.

## Verified

- OAuth token caching, concurrent reads, forced refresh, and subsequent control reads passed. The filtered live runner executed three substantive tests (plus two file-level runner entries with no matching tests).
- MCP registration exposed 251 tools. Live control/document reads passed.
- Failing-test, vendor, and people/assets/vulnerability plans fetched two pages per inventory with pageSize=2/maxPages=2. Each returned incomplete metadata, page-limit warnings, and a resume cursor.
- Vendor resume returned a distinct next page. A complete vendor plan returned 43 items in one page with complete=true.
- Invalid pageSize=101 was rejected by the MCP input schema.
- Disposable document creation and get-by-ID readback passed. Markdown converted to PDF, uploaded successfully, and appeared in list_files_for_document as one application/pdf file named validation.pdf.
- Source Markdown survived the upload. The converted temporary directory was absent after completion.
- Both disposable documents were deleted successfully and subsequent get_document calls returned 404: `6aa1c730c1a215f2163bf571` (initial conversion-preflight attempt) and `6aa1c781bdafc763d35c0275` (successful PDF upload).
- A random vulnerability ID was first confirmed absent with a 404. Deactivate/reactivate workflow calls for that absent ID returned HTTP 422 per-item errors and correctly reported workflow_failed with succeeded=0, failed=1, skipped=0. No existing vulnerability was changed.

## Environment remediation

The first PDF attempt returned markdown_converter_unavailable because Playwright's matching Chromium headless shell was missing. Its disposable document was cleaned up. Installed the matching runtime with `npx playwright install chromium --only-shell`. The download initially failed certificate validation; rerunning with process-local `NODE_USE_SYSTEM_CA=1` used the Windows trust store successfully, without disabling TLS verification. The subsequent PDF lifecycle passed.

## Boundaries and remaining findings

- Audit `list_audits` returned HTTP 403 with an authorization error. Audit acceptance requires suitable credentials/scopes; it is not verified by this run.
- Connector routing used exactly `/v1/resources/user_account` (no duplicated /v1). The read-only probe used an explicitly nonexistent resource ID because no connector fixture was configured. It returned HTTP 403. A permitted connector app/resource fixture is still needed for successful connector readback.
- The connector 403 response declared application/json but contained plain text `Forbidden`. The client threw a JSON parse error, exposing request_failed instead of the underlying HTTP 403. Resolved in the follow-up below; the authorization requirement remains.
- No existing vendor findings, SLA acknowledgements, control mappings, or resource ownership were changed. There are no configured dedicated vendor/vulnerability/remediation fixtures for successful lifecycle tests.
- HTTP-200 mixed bulk outcomes remain covered by the 15 mock regression cases; the safe live absent-ID probes returned 422 and do not replace that coverage.
- No forced timeout, transport failure, or retry was injected against DG. Those behaviors remain covered locally.

## Result

Manage reads, bounded pagination, local schema rejection, disposable PDF evidence writes/readback/cleanup, and live failure reporting passed. Audit/connector acceptance and successful vulnerability/SLA lifecycle mutation tests remain outstanding. This is partial live acceptance, not full cross-family acceptance or deployment.

## HTTP error handling follow-up

At 2026-09-10 02:39 UTC, repeated the same read-only connector probe through the updated local MCP build. The response now reports `api_error`, HTTP 403 in the message, and `error.details.value: "Forbidden"`. Malformed JSON on unsuccessful responses retains the raw body and HTTP result; malformed successful JSON still throws a parse error.

TypeScript compilation and all 22 focused response-parsing/reliability tests passed, including new malformed 403/502 and connector-envelope regressions. The existing invalid-successful-JSON test remains strict. No DG writes were performed for this recheck. Audit/Connector authorization and dedicated lifecycle fixtures remain outstanding.
