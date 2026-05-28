import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { parseToolEnvelope } from "../../helpers.js";
import { FakeVantaServer } from "./fake-vanta-server.js";
import { McpStdioHarness } from "./mcp-stdio-harness.js";

const successfulControlsPayload = {
  results: {
    data: [{ id: "control-1", name: "Sample Control" }],
    pageInfo: {
      hasNextPage: false,
      hasPreviousPage: false,
      startCursor: null,
      endCursor: null,
    },
  },
};

const createHarnessEnv = (
  baseUrl: string,
): Record<string, string | undefined> => ({
  VANTA_API_BASE_URL: baseUrl,
  VANTA_CLIENT_ID: "fake-client-id",
  VANTA_CLIENT_SECRET: "fake-client-secret",
  VANTA_ENV_FILE: undefined,
  VANTA_MCP_ENABLE_WRITE: "true",
  VANTA_MCP_SAFE_MODE: "true",
});

test("api 4xx/5xx responses return api_error envelopes and keep MCP session alive", async () => {
  // Arrange
  const fakeServer = new FakeVantaServer();
  fakeServer.queueRoute("GET", "/controls", [
    { status: 403, body: { error: "forbidden" } },
    { status: 500, body: { error: "internal_failure" } },
    { status: 500, body: { error: "internal_failure_retry_1" } },
    { status: 500, body: { error: "internal_failure_retry_2" } },
    { status: 200, body: successfulControlsPayload },
  ]);
  await fakeServer.start();
  const harness = new McpStdioHarness({
    envOverrides: createHarnessEnv(fakeServer.baseUrl),
  });
  await harness.start();

  try {
    // Initial Assert
    assert.ok((await harness.listTools()).includes("list_controls"));

    // Act
    const firstResult = await harness.callTool("list_controls", {});
    const secondResult = await harness.callTool("list_controls", {});
    const thirdResult = await harness.callTool("list_controls", {});

    // Assert
    const firstEnvelope = parseToolEnvelope(firstResult);
    assert.equal(firstEnvelope.success, false);
    assert.equal(
      (firstEnvelope.error as Record<string, unknown>).code,
      "api_error",
    );

    const secondEnvelope = parseToolEnvelope(secondResult);
    assert.equal(secondEnvelope.success, false);
    assert.equal(
      (secondEnvelope.error as Record<string, unknown>).code,
      "api_error",
    );

    const thirdEnvelope = parseToolEnvelope(thirdResult);
    assert.equal(thirdEnvelope.success, true);
    assert.equal(fakeServer.getCallCount("GET", "/controls"), 5);
  } finally {
    await harness.stop();
    await fakeServer.stop();
  }
});

test("transport failures return request_failed envelopes and do not crash MCP tool interface", async () => {
  // Arrange
  const fakeServer = new FakeVantaServer();
  fakeServer.queueRoute("GET", "/controls", [
    { status: 200, closeConnection: true },
    { status: 200, body: successfulControlsPayload },
  ]);
  await fakeServer.start();
  const harness = new McpStdioHarness({
    envOverrides: createHarnessEnv(fakeServer.baseUrl),
  });
  await harness.start();

  try {
    // Initial Assert
    assert.equal(fakeServer.getCallCount("GET", "/controls"), 0);

    // Act
    const failureResult = await harness.callTool("list_controls", {});
    const recoveryResult = await harness.callTool("list_controls", {});

    // Assert
    const failureEnvelope = parseToolEnvelope(failureResult);
    assert.equal(failureEnvelope.success, false);
    assert.equal(
      (failureEnvelope.error as Record<string, unknown>).code,
      "request_failed",
    );

    const recoveryEnvelope = parseToolEnvelope(recoveryResult);
    assert.equal(recoveryEnvelope.success, true);
    assert.equal(fakeServer.getCallCount("GET", "/controls"), 2);
  } finally {
    await harness.stop();
    await fakeServer.stop();
  }
});

test("upload preflight errors return envelopes and do not call OAuth or API", async () => {
  // Arrange
  const fakeServer = new FakeVantaServer();
  await fakeServer.start();
  const harness = new McpStdioHarness({
    envOverrides: createHarnessEnv(fakeServer.baseUrl),
  });
  await harness.start();
  const missingFilePath = path.join(
    os.tmpdir(),
    `vanta-mcp-missing-${Date.now().toString()}.pdf`,
  );
  fs.rmSync(missingFilePath, { force: true });

  try {
    // Initial Assert
    const oauthCallsBefore = fakeServer.getCallCount("POST", "/oauth/token");
    const uploadCallsBefore = fakeServer.getCallCount(
      "POST",
      "/documents/document-1/uploads",
    );

    // Act
    const result = await harness.callTool("upload_file_for_document", {
      documentId: "document-1",
      filePath: missingFilePath,
      confirm: true,
    });
    const envelope = parseToolEnvelope(result);

    // Assert
    assert.equal(envelope.success, false);
    assert.equal(
      (envelope.error as Record<string, unknown>).code,
      "file_not_found",
    );
    assert.equal(
      fakeServer.getCallCount("POST", "/oauth/token"),
      oauthCallsBefore,
    );
    assert.equal(
      fakeServer.getCallCount("POST", "/documents/document-1/uploads"),
      uploadCallsBefore,
    );
  } finally {
    await harness.stop();
    await fakeServer.stop();
  }
});

test("capabilities and unsupported tools return agent-safe envelopes", async () => {
  // Arrange
  const fakeServer = new FakeVantaServer();
  await fakeServer.start();
  const harness = new McpStdioHarness({
    envOverrides: createHarnessEnv(fakeServer.baseUrl),
  });
  await harness.start();

  try {
    // Initial Assert
    const tools = await harness.listTools();
    assert.ok(tools.includes("capabilities"));
    assert.ok(tools.includes("add_policy_to_control"));

    // Act
    const capabilities = parseToolEnvelope(
      await harness.callTool("capabilities", {}),
    );
    const unsupported = parseToolEnvelope(
      await harness.callTool("add_policy_to_control", {
        controlId: "control-1",
        policyId: "policy-1",
      }),
    );

    // Assert
    assert.equal(capabilities.success, true);
    assert.equal(typeof capabilities.correlationId, "string");
    assert.equal(unsupported.success, false);
    assert.equal(
      (unsupported.error as Record<string, unknown>).code,
      "unsupported_operation",
    );
    assert.equal(typeof unsupported.correlationId, "string");
  } finally {
    await harness.stop();
    await fakeServer.stop();
  }
});

test("markdown upload path is converted or fails before raw markdown upload", async () => {
  // Arrange
  const fakeServer = new FakeVantaServer();
  fakeServer.setRoute("POST", "/documents/document-1/uploads", () => ({
    status: 200,
    body: { uploadId: "upload-1" },
  }));
  await fakeServer.start();
  const harness = new McpStdioHarness({
    envOverrides: createHarnessEnv(fakeServer.baseUrl),
    timeoutMs: 30_000,
  });
  await harness.start();
  const markdownPath = path.join(
    os.tmpdir(),
    `vanta-mcp-upload-${Date.now().toString()}.md`,
  );
  fs.writeFileSync(markdownPath, "# Evidence\n\nFormatted **body**.", "utf8");

  try {
    // Initial Assert
    assert.equal(
      fakeServer.getCallCount("POST", "/documents/document-1/uploads"),
      0,
    );

    // Act
    const result = await harness.callTool("upload_file_for_document", {
      documentId: "document-1",
      filePath: markdownPath,
      markdownFooterDocumentName: "Evidence",
      confirm: true,
    });
    const envelope = parseToolEnvelope(result);

    // Assert
    if (envelope.success) {
      assert.equal(
        fakeServer.getCallCount("POST", "/documents/document-1/uploads"),
        1,
      );
      assert.match(
        fakeServer.getCalls("POST", "/documents/document-1/uploads")[0].rawBody,
        /filename="[^"]+\.pdf"/,
      );
      assert.equal(
        (
          (envelope.metadata as Record<string, unknown>).conversion as Record<
            string,
            unknown
          >
        ).convertedFrom,
        "markdown",
      );
    } else {
      assert.equal(
        (envelope.error as Record<string, unknown>).code,
        "markdown_converter_unavailable",
      );
      assert.equal(
        fakeServer.getCallCount("POST", "/documents/document-1/uploads"),
        0,
      );
    }
  } finally {
    fs.rmSync(markdownPath, { force: true });
    await harness.stop();
    await fakeServer.stop();
  }
});
