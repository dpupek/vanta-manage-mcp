import assert from "node:assert/strict";
import test from "node:test";
import { parseToolEnvelope } from "../../helpers.js";
import { McpStdioHarness } from "../mock/mcp-stdio-harness.js";
import { guardLiveTest, readLiveIntegrationEnv } from "../shared/env.js";

const liveEnv = readLiveIntegrationEnv();

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
    await harness.start();

    try {
      // Initial Assert
      const tools = await harness.listTools();
      assert.ok(tools.includes("list_controls"));
      assert.ok(tools.includes("list_documents"));

      // Act
      const controlsResult = await harness.callTool("list_controls", { pageSize: 5 });
      const documentsResult = await harness.callTool("list_documents", { pageSize: 5 });

      // Assert
      const controlsEnvelope = parseToolEnvelope(controlsResult);
      assert.equal(controlsEnvelope.success, true);
      const documentsEnvelope = parseToolEnvelope(documentsResult);
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
    await harness.start();
    const correlationId = `mcp-int-${Date.now().toString()}`;
    const fileBody = `integration evidence ${correlationId}`;
    const contentBase64 = Buffer.from(fileBody, "utf8").toString("base64");

    let createdDocumentId: string | null = null;
    let cleanupError: Error | null = null;

    try {
      // Initial Assert
      assert.ok((await harness.listTools()).includes("create_document"));

      // Act
      const created = await harness.callTool("create_document", {
        body: {
          title: `MCP Integration ${correlationId}`,
          description: `Automated integration test artifact ${correlationId}`,
          timeSensitivity: "MOST_RECENT",
          cadence: "P1Y",
          reminderWindow: "P1M",
          isSensitive: false,
        },
        confirm: true,
      });
      const createdEnvelope = parseToolEnvelope(created);
      assert.equal(createdEnvelope.success, true);
      createdDocumentId = extractDocumentId(createdEnvelope);

      const fetched = await harness.callTool("get_document", {
        documentId: createdDocumentId,
      });
      const fetchedEnvelope = parseToolEnvelope(fetched);
      assert.equal(fetchedEnvelope.success, true);

      const uploaded = await harness.callTool("upload_file_for_document", {
        documentId: createdDocumentId,
        filename: `${correlationId}.txt`,
        contentBase64,
        mimeType: "text/plain",
        description: `Evidence upload ${correlationId}`,
        confirm: true,
      });
      const uploadedEnvelope = parseToolEnvelope(uploaded);
      assert.equal(uploadedEnvelope.success, true);

      const uploads = await harness.callTool("list_files_for_document", {
        documentId: createdDocumentId,
        pageSize: 5,
      });
      const uploadsEnvelope = parseToolEnvelope(uploads);
      assert.equal(uploadsEnvelope.success, true);

      if (liveEnv.controlId) {
        const allTools = await harness.listTools();
        if (
          allTools.includes("add_document_to_control") &&
          allTools.includes("list_documents_for_control")
        ) {
          const linked = await harness.callTool("add_document_to_control", {
            controlId: liveEnv.controlId,
            body: { documentId: createdDocumentId },
            confirm: true,
          });
          const linkedEnvelope = parseToolEnvelope(linked);
          assert.equal(linkedEnvelope.success, true);

          const controlDocuments = await harness.callTool("list_documents_for_control", {
            controlId: liveEnv.controlId,
            pageSize: 20,
          });
          const controlDocsEnvelope = parseToolEnvelope(controlDocuments);
          assert.equal(controlDocsEnvelope.success, true);
        }
      }
    } finally {
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
    await verifyHarness.start();
    try {
      const deletedLookup = await verifyHarness.callTool("get_document", {
        documentId: createdDocumentId,
      });
      const deletedEnvelope = parseToolEnvelope(deletedLookup);
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
