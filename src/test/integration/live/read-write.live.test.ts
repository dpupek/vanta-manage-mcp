import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import type { TestContext } from "node:test";
import { McpStdioHarness } from "../mock/mcp-stdio-harness.js";
import {
  callToolWithRateLimitRetry,
  guardLiveTest,
  isRateLimitedEnvelope,
  readLiveIntegrationEnv,
  skipOnLiveRateLimit,
  startLiveWithRetry,
} from "../shared/env.js";

const liveEnv = readLiveIntegrationEnv();

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

const extractDocumentId = (envelope: Record<string, unknown>): string => {
  const data = envelope.data as Record<string, unknown> | undefined;
  const id = data?.id;
  if (typeof id !== "string" || id.length === 0) {
    throw new Error("Create document response did not include a document id.");
  }
  return id;
};

test(
  "live integration reads controls and documents",
  { timeout: liveEnv.timeoutMs },
  async t => {
    // Arrange
    if (!guardLiveTest(t, liveEnv, false)) {
      return;
    }
    const harness = new McpStdioHarness({ timeoutMs: liveEnv.timeoutMs });
    try {
      await startLiveWithRetry(async () => harness.start());
    } catch (error) {
      if (skipOnLiveRateLimit(t, error, "controls/documents read")) {
        return;
      }
      throw error;
    }

    try {
      // Initial Assert
      const tools = await harness.listTools();
      assert.ok(tools.includes("list_controls"));
      assert.ok(tools.includes("list_documents"));

      // Act
      const controlsEnvelope = await callLiveTool(t, harness, "list_controls", {
        pageSize: 5,
      });
      const documentsEnvelope = await callLiveTool(
        t,
        harness,
        "list_documents",
        {
          pageSize: 5,
        },
      );

      // Assert
      assert.equal(controlsEnvelope.success, true);
      assert.equal(documentsEnvelope.success, true);
    } finally {
      await harness.stop();
    }
  },
);

test(
  "live integration can create/upload/delete evidence document and return envelopes",
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
      if (skipOnLiveRateLimit(t, error, "document write lifecycle")) {
        return;
      }
      throw error;
    }
    const correlationId = `mcp-int-${Date.now().toString()}`;
    const fileBody = `integration evidence ${correlationId}`;
    const tempFilePath = path.join(os.tmpdir(), `${correlationId}.txt`);
    fs.writeFileSync(tempFilePath, fileBody, "utf8");

    let createdDocumentId: string | null = null;
    let cleanupError: Error | null = null;

    try {
      // Initial Assert
      assert.ok((await harness.listTools()).includes("create_document"));

      // Act
      const createdEnvelope = await callLiveTool(
        t,
        harness,
        "create_document",
        {
          body: {
            title: `MCP Integration ${correlationId}`,
            description: `Automated integration test artifact ${correlationId}`,
            timeSensitivity: "MOST_RECENT",
            cadence: "P1Y",
            reminderWindow: "P1M",
            isSensitive: false,
          },
          confirm: true,
        },
      );
      assert.equal(createdEnvelope.success, true);
      createdDocumentId = extractDocumentId(createdEnvelope);

      const fetchedEnvelope = await callLiveTool(t, harness, "get_document", {
        documentId: createdDocumentId,
      });
      assert.equal(fetchedEnvelope.success, true);

      const uploadedEnvelope = await callLiveTool(
        t,
        harness,
        "upload_file_for_document",
        {
          documentId: createdDocumentId,
          filePath: tempFilePath,
          mimeType: "text/plain",
          description: `Evidence upload ${correlationId}`,
          confirm: true,
        },
      );
      assert.equal(uploadedEnvelope.success, true);

      const uploadsEnvelope = await callLiveTool(
        t,
        harness,
        "list_files_for_document",
        {
          documentId: createdDocumentId,
          pageSize: 5,
        },
      );
      assert.equal(uploadsEnvelope.success, true);

      if (liveEnv.controlId) {
        const allTools = await harness.listTools();
        if (
          allTools.includes("add_document_to_control") &&
          allTools.includes("list_documents_for_control")
        ) {
          const linkedEnvelope = await callLiveTool(
            t,
            harness,
            "add_document_to_control",
            {
              controlId: liveEnv.controlId,
              body: { documentId: createdDocumentId },
              confirm: true,
            },
          );
          assert.equal(linkedEnvelope.success, true);

          const controlDocsEnvelope = await callLiveTool(
            t,
            harness,
            "list_documents_for_control",
            {
              controlId: liveEnv.controlId,
              pageSize: 20,
            },
          );
          assert.equal(controlDocsEnvelope.success, true);
        }
      }
    } finally {
      fs.rmSync(tempFilePath, { force: true });
      if (createdDocumentId) {
        try {
          await harness.callTool("delete_document", {
            documentId: createdDocumentId,
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
      throw new Error(
        `Cleanup failed for document ${String(createdDocumentId)}: ${cleanupError.message}`,
      );
    }
    assert.ok(createdDocumentId, "Expected createdDocumentId to be populated.");

    const verifyHarness = new McpStdioHarness({ timeoutMs: liveEnv.timeoutMs });
    try {
      await startLiveWithRetry(async () => verifyHarness.start());
    } catch (error) {
      if (skipOnLiveRateLimit(t, error, "post-delete readback verification")) {
        return;
      }
      throw error;
    }
    try {
      const deletedLookup = await callLiveTool(
        t,
        verifyHarness,
        "get_document",
        {
          documentId: createdDocumentId,
        },
      );
      const deletedEnvelope = deletedLookup;
      assert.equal(deletedEnvelope.success, false);
      assert.equal(
        (deletedEnvelope.error as Record<string, unknown>).code,
        "api_error",
      );
    } finally {
      await verifyHarness.stop();
    }
  },
);
