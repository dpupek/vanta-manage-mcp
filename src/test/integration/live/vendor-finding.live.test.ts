import assert from "node:assert/strict";
import test from "node:test";
import type { TestContext } from "node:test";
import { McpStdioHarness } from "../mock/mcp-stdio-harness.js";
import {
  callToolWithRateLimitRetry,
  guardLiveTest,
  isRateLimitedEnvelope,
  requireLiveFixture,
  readLiveIntegrationEnv,
  skipOnLiveRateLimit,
  startLiveWithRetry,
} from "../shared/env.js";

const liveEnv = readLiveIntegrationEnv();

const sleep = async (ms: number): Promise<void> =>
  new Promise(resolve => setTimeout(resolve, ms));

const readPaginatedData = (
  envelope: Record<string, unknown>,
): Record<string, unknown>[] => {
  const data = envelope.data as
    | { results?: { data?: Record<string, unknown>[] } }
    | undefined;
  return data?.results?.data ?? [];
};

const readEndCursor = (envelope: Record<string, unknown>): string | null => {
  const data = envelope.data as
    | { results?: { pageInfo?: { endCursor?: unknown } } }
    | undefined;
  const cursor = data?.results?.pageInfo?.endCursor;
  if (typeof cursor !== "string" || cursor.length === 0) {
    return null;
  }
  return cursor;
};

const hasNextPage = (envelope: Record<string, unknown>): boolean => {
  const data = envelope.data as
    | { results?: { pageInfo?: { hasNextPage?: unknown } } }
    | undefined;
  return data?.results?.pageInfo?.hasNextPage === true;
};

const callLiveTool = async (
  t: TestContext,
  harness: McpStdioHarness,
  toolName: string,
  args: Record<string, unknown>,
): Promise<Record<string, unknown>> => {
  const envelope = await callToolWithRateLimitRetry(harness, toolName, args);
  if (isRateLimitedEnvelope(envelope)) {
    t.skip(`${toolName} was rate-limited after retries.`);
  }
  return envelope;
};

const listAllVendorFindings = async (
  t: TestContext,
  harness: McpStdioHarness,
  vendorId: string,
): Promise<Record<string, unknown>[]> => {
  const results: Record<string, unknown>[] = [];
  let cursor: string | null = null;

  for (let page = 0; page < 25; page += 1) {
    const envelope = await callLiveTool(t, harness, "list_vendor_findings", {
      vendorId,
      pageSize: 100,
      ...(cursor ? { pageCursor: cursor } : {}),
    });
    assert.equal(envelope.success, true);
    results.push(...readPaginatedData(envelope));

    if (!hasNextPage(envelope)) {
      return results;
    }
    cursor = readEndCursor(envelope);
    if (!cursor) {
      return results;
    }
  }

  return results;
};

const waitForFindingState = async (
  t: TestContext,
  harness: McpStdioHarness,
  vendorId: string,
  findingId: string,
  expected: {
    exists: boolean;
    content?: string;
    riskStatus?: string;
  },
): Promise<void> => {
  for (let attempt = 0; attempt < 12; attempt += 1) {
    const findings = await listAllVendorFindings(t, harness, vendorId);
    const finding = findings.find(item => item.id === findingId);
    const exists = finding !== undefined;
    const contentMatches =
      expected.content === undefined || finding?.content === expected.content;
    const riskStatusMatches =
      expected.riskStatus === undefined ||
      finding?.riskStatus === expected.riskStatus;

    if (exists === expected.exists && contentMatches && riskStatusMatches) {
      return;
    }

    await sleep(1_000);
  }

  throw new Error(
    `Timed out waiting for finding ${findingId} to reach expected state exists=${expected.exists.toString()}.`,
  );
};

const discoverVendorId = async (
  harness: McpStdioHarness,
): Promise<string | null> => {
  const listed = await callToolWithRateLimitRetry(harness, "list_vendors", {
    pageSize: 25,
  });
  const listedEnvelope = listed;
  if (listedEnvelope.success !== true) {
    return null;
  }
  const candidate = readPaginatedData(listedEnvelope).find(
    item => typeof item.id === "string" && item.id.length > 0,
  );
  const id = candidate?.id;
  if (typeof id !== "string") {
    return null;
  }
  return id;
};

test(
  "live integration verifies vendor + finding write lifecycle with readback assertions",
  { timeout: liveEnv.timeoutMs },
  async t => {
    // Arrange
    if (!guardLiveTest(t, liveEnv, true)) {
      return;
    }

    const harness = new McpStdioHarness({ timeoutMs: liveEnv.timeoutMs });
    try {
      await startLiveWithRetry(async () => harness.start());
    } catch (error) {
      if (skipOnLiveRateLimit(t, error, "vendor/finding write lifecycle")) {
        return;
      }
      throw error;
    }

    const correlationId = `mcp-vendor-${Date.now().toString()}`;
    let vendorId: string | null = liveEnv.vendorId;
    let findingId: string | null = null;
    let cleanupError: Error | null = null;

    try {
      // Initial Assert
      const tools = await harness.listTools();
      assert.ok(tools.includes("get_vendor"));
      assert.ok(tools.includes("list_vendors"));
      assert.ok(tools.includes("update_vendor"));
      assert.ok(tools.includes("create_vendor_finding"));
      assert.ok(tools.includes("update_vendor_finding"));
      assert.ok(tools.includes("delete_finding_by_id"));

      // Act
      if (!vendorId) {
        vendorId = await discoverVendorId(harness);
      }
      if (!vendorId) {
        vendorId = requireLiveFixture(
          t,
          liveEnv,
          null,
          "VANTA_INTEGRATION_TEST_VENDOR_ID",
          "No vendor was discovered for vendor/finding lifecycle verification.",
        );
      }
      if (!vendorId) {
        return;
      }

      const currentVendorEnvelope = await callLiveTool(
        t,
        harness,
        "get_vendor",
        {
          vendorId,
        },
      );
      assert.equal(currentVendorEnvelope.success, true);

      const updatedNote = `Updated by integration test ${correlationId}`;
      const updateVendorEnvelope = await callLiveTool(
        t,
        harness,
        "update_vendor",
        {
          vendorId,
          body: {
            additionalNotes: updatedNote,
          },
          confirm: true,
        },
      );
      assert.equal(updateVendorEnvelope.success, true);

      const updatedVendorEnvelope = await callLiveTool(
        t,
        harness,
        "get_vendor",
        {
          vendorId,
        },
      );
      assert.equal(updatedVendorEnvelope.success, true);
      const updatedVendorData = updatedVendorEnvelope.data as
        | Record<string, unknown>
        | undefined;
      assert.equal(updatedVendorData?.additionalNotes, updatedNote);

      const createFindingEnvelope = await callLiveTool(
        t,
        harness,
        "create_vendor_finding",
        {
          vendorId,
          body: {
            content: `Missing evidence ${correlationId}`,
            riskStatus: "REMEDIATE",
            remediation: {
              state: "OPEN",
              requirementNotes: `Follow-up ${correlationId}`,
            },
          },
          confirm: true,
        },
      );
      assert.equal(createFindingEnvelope.success, true);
      const createFindingData = createFindingEnvelope.data as
        | Record<string, unknown>
        | undefined;
      const createdFindingId = createFindingData?.id;
      if (
        typeof createdFindingId !== "string" ||
        createdFindingId.length === 0
      ) {
        throw new Error(
          "Create vendor finding response did not include an id.",
        );
      }
      findingId = createdFindingId;

      await waitForFindingState(t, harness, vendorId, findingId, {
        exists: true,
      });

      const updatedContent = `Updated finding ${correlationId}`;
      const updateFindingEnvelope = await callLiveTool(
        t,
        harness,
        "update_vendor_finding",
        {
          vendorId,
          findingId,
          body: {
            content: updatedContent,
            riskStatus: "ACCEPT",
          },
          confirm: true,
        },
      );
      assert.equal(updateFindingEnvelope.success, true);

      await waitForFindingState(t, harness, vendorId, findingId, {
        exists: true,
        content: updatedContent,
        riskStatus: "ACCEPT",
      });

      const deletedFindingId = findingId;
      const deleteFindingEnvelope = await callLiveTool(
        t,
        harness,
        "delete_finding_by_id",
        {
          vendorId,
          findingId,
          confirm: true,
        },
      );
      assert.equal(deleteFindingEnvelope.success, true);
      findingId = null;

      await waitForFindingState(t, harness, vendorId, deletedFindingId, {
        exists: false,
      });
    } finally {
      if (findingId && vendorId) {
        try {
          await harness.callTool("delete_finding_by_id", {
            vendorId,
            findingId,
            confirm: true,
          });
        } catch (error) {
          cleanupError =
            error instanceof Error ? error : new Error(String(error));
        }
      }

      await harness.stop();
    }

    // Assert
    if (cleanupError) {
      throw cleanupError;
    }
  },
);
