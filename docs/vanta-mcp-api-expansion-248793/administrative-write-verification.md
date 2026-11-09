# Administrative write verification: baseline and slice

Case 248793. Baseline captured before this slice: generated endpoint tools send mutations through `invokeGeneratedOperation`; the only endpoint-specific independent write verification is control `implementationDetails`. Vendor alerts and risk mappings have separate verification workflows. Settings, category, engagement, framework and personnel endpoint tools currently return the upstream mutation response without independent verification. `list_vendors` offers no category filter, so category-deletion verification must inspect every page and filter client-side.

## Decisions and tasks

- [x] The user selected verification inside existing tools, with up to three bounded reads, no mutation replay, and warnings for unrelated observed drift. Category deletion requires a complete inventory and a fresh pre-delete inventory; concurrent assignments cannot be ruled out.
- [x] Add preflight and independent readback for vendor settings; category creation, updates, deletion and affected vendors; category assignment; and engagement attach/remove.
- [x] Add independent readback for framework variant selection and status, and personnel requirement-set details and requirements. Where the public read shape cannot expose a requested field, return accepted-but-unverified instead of inferring success.
- [x] Preserve accepted mutation response and errors, requested values, unrelated-field drift warnings, cancellation, and existing write/confirmation gates. Do not replay a write on failed verification.
- [x] Add deterministic mock tests covering all operation classes, three-attempt convergence, read failures, incomplete inventory, post-read uncertainty, drift, concurrency warning, and no replay. Update help and run the required checks.
- [x] With user authorization, use only disposable DG vendor, category and engagement fixtures; verify cleanup. No organization-wide settings or non-deletable personnel/framework fixtures were mutated.

User-selected bounds: three read attempts; a short bounded delay between attempts. Capture and restore no existing records. The historical implementation-details guard remains in force. Live acceptance remains specific to the tested operations and tenant.

## DG disposable fixture evidence

On November 9, 2026 at approximately 21:23 UTC, a local stdio MCP using DG credentials created one unique temporary category and two uniquely named temporary vendors. Independent readback verified category creation and update, assigning the child vendor to that category, and attaching then removing its engagement with the temporary parent. The category deletion preflight stopped without sending the delete; its exact transient cause was not captured. Both vendors were deleted and individually returned 404. The category remained after the first cleanup attempt; a subsequent ownership-checked, empty-inventory preflight and delete succeeded, and an independent GET returned 404. No original tenant objects were changed.

A deterministic mock test was then added for a 429 during the read-only deletion inventory, and preflight reads were allowed the existing bounded safe-read retries. This is a robustness improvement; the first failure cannot be attributed to rate limiting without its missing diagnostic.

At approximately 21:26 UTC, a fresh disposable category and vendor were created. Category creation, vendor category assignment, and category deletion all returned independently verified results. Before deletion, an independent complete inventory contained exactly the one fixture vendor in that category. After deletion, a direct vendor GET returned `categoryId: null`. The temporary vendor was deleted and both the vendor and category returned 404 in independent cleanup checks. The test cannot exclude concurrent assignments outside its captured inventory or establish behavior across all DG objects.

Framework snooze readback has a documented limitation: the public framework detail schema exposes lifecycle status but does not document the requested `snoozedUntilDate`. An accepted snooze is reported `write_unverified` when the date cannot be independently observed; the mutation response alone is not treated as proof. Verification details separate status from end-date evidence and show the requested, write-response and readback values. When status is confirmed but the readback omits the date, verification stops rather than repeating reads solely for the undocumented field. A [support request](vanta-snooze-support-draft.md) is prepared as a draft and has not been sent.
