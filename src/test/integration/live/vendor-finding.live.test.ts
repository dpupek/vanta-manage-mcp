import assert from "node:assert/strict";
import test from "node:test";
import { parseToolEnvelope } from "../../helpers.js";
import { McpStdioHarness } from "../mock/mcp-stdio-harness.js";
import {
  guardLiveTest,
  requireLiveFixture,
  readLiveIntegrationEnv,
  skipOnLiveRateLimit,
  startLiveWithRetry,
} from "../shared/env.js";

const liveEnv = readLiveIntegrationEnv();

const readPaginatedData = (envelope: Record<string, unknown>): Record<string, unknown>[] => {
  const data = envelope.data as
    | { results?: { data?: Record<string, unknown>[] } }
    | undefined;
  return data?.results?.data ?? [];
};

const discoverVendorId = async (harness: McpStdioHarness): Promise<string | null> => {
  const listed = await harness.callTool("list_vendors", {
    pageSize: 25,
  });
  const listedEnvelope = parseToolEnvelope(listed);
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

      const currentVendor = await harness.callTool("get_vendor", { vendorId });
      const currentVendorEnvelope = parseToolEnvelope(currentVendor);
      assert.equal(currentVendorEnvelope.success, true);

      const updatedNote = `Updated by integration test ${correlationId}`;
      const updateVendor = await harness.callTool("update_vendor", {
        vendorId,
        body: {
          additionalNotes: updatedNote,
        },
        confirm: true,
      });
      const updateVendorEnvelope = parseToolEnvelope(updateVendor);
      assert.equal(updateVendorEnvelope.success, true);

      const updatedVendorRead = await harness.callTool("get_vendor", { vendorId });
      const updatedVendorEnvelope = parseToolEnvelope(updatedVendorRead);
      assert.equal(updatedVendorEnvelope.success, true);
      const updatedVendorData = updatedVendorEnvelope.data as
        | Record<string, unknown>
        | undefined;
      assert.equal(updatedVendorData?.additionalNotes, updatedNote);

      const createFinding = await harness.callTool("create_vendor_finding", {
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
      });
      const createFindingEnvelope = parseToolEnvelope(createFinding);
      assert.equal(createFindingEnvelope.success, true);
      const createFindingData = createFindingEnvelope.data as
        | Record<string, unknown>
        | undefined;
      const createdFindingId = createFindingData?.id;
      if (typeof createdFindingId !== "string" || createdFindingId.length === 0) {
        throw new Error("Create vendor finding response did not include an id.");
      }
      findingId = createdFindingId;

      const findingsRead = await harness.callTool("list_vendor_findings", {
        vendorId,
        pageSize: 50,
      });
      const findingsReadEnvelope = parseToolEnvelope(findingsRead);
      assert.equal(findingsReadEnvelope.success, true);
      const createdFinding = readPaginatedData(findingsReadEnvelope).find(
        item => item.id === findingId,
      );
      assert.ok(createdFinding);

      const updatedContent = `Updated finding ${correlationId}`;
      const updateFinding = await harness.callTool("update_vendor_finding", {
        vendorId,
        findingId,
        body: {
          content: updatedContent,
          riskStatus: "ACCEPT",
        },
        confirm: true,
      });
      const updateFindingEnvelope = parseToolEnvelope(updateFinding);
      assert.equal(updateFindingEnvelope.success, true);

      const findingsReadAfterUpdate = await harness.callTool("list_vendor_findings", {
        vendorId,
        pageSize: 50,
      });
      const findingsAfterUpdateEnvelope = parseToolEnvelope(findingsReadAfterUpdate);
      assert.equal(findingsAfterUpdateEnvelope.success, true);
      const updatedFinding = readPaginatedData(findingsAfterUpdateEnvelope).find(
        item => item.id === findingId,
      );
      assert.ok(updatedFinding);
      assert.equal(updatedFinding.content, updatedContent);
      assert.equal(updatedFinding.riskStatus, "ACCEPT");

      const deletedFindingId = findingId;
      const deleteFinding = await harness.callTool("delete_finding_by_id", {
        vendorId,
        findingId,
        confirm: true,
      });
      const deleteFindingEnvelope = parseToolEnvelope(deleteFinding);
      assert.equal(deleteFindingEnvelope.success, true);
      findingId = null;

      const findingsReadAfterDelete = await harness.callTool("list_vendor_findings", {
        vendorId,
        pageSize: 50,
      });
      const findingsAfterDeleteEnvelope = parseToolEnvelope(findingsReadAfterDelete);
      assert.equal(findingsAfterDeleteEnvelope.success, true);
      const deletedFinding = readPaginatedData(findingsAfterDeleteEnvelope).find(
        item => item.id === deletedFindingId,
      );
      assert.equal(deletedFinding, undefined);
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
