# Edge Cases and Risks

## Safety and Mutation Controls

- Accidental writes when a tool is called without user intent.
  Mitigation: enforce `confirm=true` on all mutating endpoint tools; workflows require `mode=execute` and `confirm=true`.

- Workflow execute mode called without prior plan visibility.
  Mitigation: deterministic plan output format and explicit execute gate.

## Idempotency / Retry

- Retries on transient errors can duplicate non-idempotent writes.
  Mitigation: bounded retry policy on safe status codes; avoid automatic retry for unsafe operations unless clearly transient and safe.

## Partial Failures

- Batch-style workflow execution may partially succeed.
  Mitigation: return per-step outcomes and summary of failed actions; avoid silent rollback claims.

## Auth/Token Churn

- Expired token mid-operation or concurrent refresh race.
  Mitigation: centralized token manager with refresh lock and one retry on 401.

## Pagination and Result Size

- Large collections can hide required records if only first page is fetched.
  Mitigation: standard `pageCursor`/`pageSize` plus optional auto-pagination helpers.

## Multipart / Large Uploads

- Large base64 payloads can exceed process/tool limits.
  Mitigation: clear error envelopes, strict payload validation, and endpoint-specific upload notes.

## Schema Variance

- `oneOf`/`anyOf`/nullable schema shapes may be hard to represent with strict generation.
  Mitigation: strict where possible, permissive fallback + validation envelopes where needed.
