import assert from "node:assert/strict";
import test from "node:test";
import { collectInventory } from "../workflows/pagination.js";
import { successEnvelope, errorEnvelope } from "../envelope.js";

const page = (data: unknown[], hasNextPage: boolean, endCursor?: string) =>
  successEnvelope({ results: { data, pageInfo: { hasNextPage, endCursor } } });

test("inventory collects multiple pages and preserves the requested cursor", async () => {
  // Arrange
  const calls: unknown[] = [];
  const pages = [page([1], true, "next"), page([2], false)];
  // Initial Assert
  assert.equal(calls.length, 0);
  // Act
  const result = await collectInventory(
    async args => {
      calls.push(args);
      return pages.shift();
    },
    { pageSize: 25, pageCursor: "start" },
  );
  // Assert
  assert.equal(result.success, true);
  assert.deepEqual(calls, [
    { pageSize: 25, pageCursor: "start" },
    { pageSize: 25, pageCursor: "next" },
  ]);
  const data = result.data as {
    results: { data: unknown[] };
    collection: { complete: boolean };
  };
  assert.deepEqual(data.results.data, [1, 2]);
  assert.equal(data.collection.complete, true);
});

for (const scenario of [
  "limit",
  "missing_cursor",
  "repeated_cursor",
  "missing_page_info",
  "read_failed",
] as const) {
  test(`inventory exposes partial results on ${scenario}`, async () => {
    // Arrange
    let calls = 0;
    const second =
      scenario === "missing_cursor"
        ? page([2], true)
        : scenario === "repeated_cursor"
          ? page([2], true, "next")
          : scenario === "missing_page_info"
            ? successEnvelope({ results: { data: [2] } })
            : errorEnvelope("api_error", "Forbidden");
    // Initial Assert
    assert.equal(calls, 0);
    // Act
    const result = await collectInventory(
      async () => (++calls === 1 ? page([1], true, "next") : second),
      { maxPages: scenario === "limit" ? 1 : 10 },
    );
    // Assert
    assert.equal(result.success, scenario === "limit");
    const data = (result.success ? result.data : result.error.details) as {
      results: { data: unknown[] };
      collection: {
        complete: boolean;
        stopReason: string;
        nextPageCursor: string;
      };
    };
    assert.equal(data.collection.complete, false);
    assert.equal(
      data.collection.stopReason,
      scenario === "limit" ? "page_limit" : scenario,
    );
    assert.equal(data.results.data[0], 1);
    assert.equal(calls, scenario === "limit" ? 1 : 2);
    if (scenario === "limit") {
      assert.equal(data.collection.nextPageCursor, "next");
      assert.ok(result.warnings.length);
    }
  });
}
