# November 9 contract and migration review

Baseline is the prior HEAD-pinned contract. The exact field-level comparison is in [contract-schema-review-2026-11-09.json](contract-schema-review-2026-11-09.json); source URLs, retrieved byte hashes, and the 50 added operations are in [contract-review-2026-11-09.json](contract-review-2026-11-09.json). The current pinned source hashes are in `openapi/sources.json`. This review resolves local schema references and excludes descriptions and examples. It identifies 44 existing operations with 112 structural differences: 30 Manage and 14 Audit; Connectors has none in this comparison. Arrays are recorded as whole values, so one structural difference can contain several enum or parameter changes.

## Request compatibility

- Vendor create/update add nullable `categoryId` while deprecating `category`. Vanta's description prohibits supplying both, so generated dispatch rejects that combination before HTTP. On update, `categoryId: null` clears the category; omission preserves it. The vendor list adds `websiteUrl`.
- Customer-trust account create/update add `revenueOverrides`, whose entries require `fieldMappingId` and a nullable numeric `value`. Existing callers that omit this optional input remain compatible.
- Framework list adds `includeStatus`, `purchasedOnly`, and `includeProgress`; detail adds `includeStatus`, `includeRequirements`, `requirementsScope`, and `variants`. Audit control listing adds `segmentIdsMatchesAny`.
- Existing issue `sourceMatchesAny` gains seven source enum values. Trust Center framework create/update gain five standard values: `aiuc1_26q4`, `cps230`, `fedramp20x_classBC`, `iso27017_2026`, and `nydfs500_2023`. These additions do not require existing callers to change inputs.
- Trust Center video upsert accepts an optional ID on each video. The corresponding response now documents the ID as required. Preserve existing IDs when editing existing videos instead of assuming positional identity.

## Response compatibility

- Customer-trust responses add required `customRevenueMetrics`; answer-library responses add `createdAt`; assessment type and assessment responses add `audience`.
- Vendor and audit vendor responses add category IDs and relationship information, while old category fields are deprecated. Vendor-risk attributes add category IDs.
- Framework responses expose status, selected variants, purchase state, or requirements depending on operation and requested fields. Policy approved-version and issue response structures change; no policy artifact download operation is implied by a response change.
- Audit responses add audit-view and segment-related fields across affected inventories and evidence. These response-schema requiredness changes describe upstream output; the shared client does not reject a valid response merely because it lacks a newly documented field.
- Discovered-vendor source responses add `OFFICE_GCC_HIGH` and `TORII`. Callers should tolerate newly introduced response enum values.

No operation identity was removed in this snapshot. Existing 333 tool names retained the same source, method, and path after regeneration. New mutations inherit the shared confirmation gate; explicit tenant feature and permission restrictions still apply. Live compatibility of all 44 changed operations is not established by this static review and local mocks.
