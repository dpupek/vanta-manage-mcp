## Quick Memory Usage

- Default endpoint for this repo: `vanta-manage`.
- Start every session by calling `listRecentEntries` with `endpoint: "vanta-manage"` and `maxResults: 10-20`.
- Before creating new memory entries, call `searchEntries` on `vanta-manage` to avoid duplicates.
- Store new context with `upsertEntry`; use stable ids like `vanta-manage:<slug>`.
- Prefer `patchEntry` for updates to existing entries instead of creating parallel notes.
- Keep most entries non-permanent (`isPermanent=false`) unless the user explicitly asks to lock an entry.
- Use `bodyTypeHint: "markdown"` for most memories and include concise validation notes (commands + outcomes).
- Suggested tags: `progress`, `decision`, `openapi`, `safety`, `workflow`, `release`.
