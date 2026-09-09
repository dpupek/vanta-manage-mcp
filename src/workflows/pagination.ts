import { errorEnvelope, successEnvelope, ToolEnvelope } from "../envelope.js";

export interface CollectionOptions {
  pageSize?: number;
  pageCursor?: string;
  maxPages?: number;
}

const record = (value: unknown): Record<string, unknown> | undefined =>
  typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;

/** Collect a bounded inventory, preserving partial data and a resume cursor. */
export const collectInventory = async (
  readPage: (args: {
    pageSize: number;
    pageCursor?: string;
  }) => Promise<unknown>,
  options: CollectionOptions = {},
): Promise<ToolEnvelope> => {
  const pageSize = options.pageSize ?? 100;
  const maxPages = options.maxPages ?? 10;
  if (
    !Number.isInteger(pageSize) ||
    pageSize < 1 ||
    pageSize > 100 ||
    !Number.isInteger(maxPages) ||
    maxPages < 1 ||
    maxPages > 100
  ) {
    return errorEnvelope(
      "validation_error",
      "pageSize and maxPages must be integers from 1 to 100.",
    );
  }
  const data: unknown[] = [];
  let pagesFetched = 0;
  let cursor = options.pageCursor;
  const seen = new Set<string>(cursor ? [cursor] : []);
  const report = (complete: boolean, stopReason: string) => ({
    results: {
      data,
      pageInfo: { hasNextPage: !complete, endCursor: cursor ?? null },
    },
    collection: {
      complete,
      stopReason,
      pagesFetched,
      returnedCount: data.length,
      pageSize,
      maxPages,
      nextPageCursor: complete ? null : (cursor ?? null),
    },
  });
  while (pagesFetched < maxPages) {
    let envelope: Record<string, unknown> | undefined;
    try {
      envelope = record(await readPage({ pageSize, pageCursor: cursor }));
    } catch (error) {
      return errorEnvelope(
        "pagination_read_failed",
        "Inventory read failed.",
        "Resume from nextPageCursor after resolving the error.",
        {
          ...report(false, "read_failed"),
          cause: error instanceof Error ? error.message : String(error),
        },
      );
    }
    if (envelope?.success !== true)
      return errorEnvelope(
        "pagination_read_failed",
        "Inventory read failed.",
        "Inspect the page error before resuming.",
        { ...report(false, "read_failed"), cause: envelope },
      );
    const payload = record(envelope.data);
    const results = record(payload?.results);
    const items =
      results?.data ?? payload?.results ?? payload?.items ?? payload?.data;
    if (!Array.isArray(items))
      return errorEnvelope(
        "pagination_invalid",
        "Inventory page did not contain an item array.",
        undefined,
        report(false, "invalid_items"),
      );
    data.push(...(items as unknown[]));
    pagesFetched += 1;
    const pageInfo = record(results?.pageInfo ?? payload?.pageInfo);
    const hasMore =
      pageInfo?.hasNextPage ?? pageInfo?.hasMore ?? payload?.hasMore;
    if (hasMore === false)
      return successEnvelope(report(true, "complete"), "Inventory complete.");
    if (hasMore !== true)
      return errorEnvelope(
        "pagination_invalid",
        "Inventory page omitted its completion indicator.",
        undefined,
        report(false, "missing_page_info"),
      );
    const next =
      pageInfo?.endCursor ?? pageInfo?.nextCursor ?? payload?.nextPageCursor;
    if (typeof next !== "string" || next.length === 0)
      return errorEnvelope(
        "pagination_invalid",
        "Vanta reported more pages without a next cursor.",
        undefined,
        report(false, "missing_cursor"),
      );
    if (seen.has(next))
      return errorEnvelope(
        "pagination_invalid",
        "Vanta repeated a pagination cursor.",
        "Inspect the response before restarting pagination.",
        report(false, "repeated_cursor"),
      );
    seen.add(next);
    cursor = next;
  }
  return successEnvelope(
    report(false, "page_limit"),
    "Inventory stopped at the requested page limit.",
    undefined,
    {
      warnings: [
        "Inventory is incomplete. Resume with collection.nextPageCursor or increase maxPages.",
      ],
      pagination: { hasMore: true, pageCursor: cursor, pageSize },
    },
  );
};
