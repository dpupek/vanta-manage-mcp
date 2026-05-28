import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { VantaResponse } from "../client/vanta-client.js";
import {
  getGeneratedToolNameByOperationId,
  invokeGeneratedOperation,
} from "../tools/endpoint-tools.js";
import { parseToolEnvelope } from "./helpers.js";

class FakeClient {
  public calls: Record<string, unknown>[] = [];
  public nextResponse: VantaResponse | null = null;

  public async request(input: Record<string, unknown>): Promise<VantaResponse> {
    this.calls.push(input);
    if (this.nextResponse) {
      return this.nextResponse;
    }
    return {
      status: 200,
      ok: true,
      data: { echoed: true },
      headers: {},
    };
  }
}

test("mutating endpoint requires confirmation in safe mode", async () => {
  // Arrange
  const toolName = getGeneratedToolNameByOperationId(
    "CreateCustomControl",
    "manage",
  );
  assert.ok(toolName);
  const fakeClient = new FakeClient();

  // Initial Assert
  assert.equal(fakeClient.calls.length, 0);

  // Act
  const result = await invokeGeneratedOperation(
    toolName,
    { body: { name: "control" } },
    fakeClient as never,
  );
  const envelope = parseToolEnvelope(result);

  // Assert
  assert.equal(envelope.success, false);
  assert.equal(
    (envelope.error as Record<string, unknown>).code,
    "confirmation_required",
  );
  assert.equal(fakeClient.calls.length, 0);
});

test("add document to control rejects policy document slugs before API call", async () => {
  // Arrange
  const toolName = getGeneratedToolNameByOperationId(
    "AddDocumentToControl",
    "manage",
  );
  assert.ok(toolName);
  const fakeClient = new FakeClient();

  // Initial Assert
  assert.equal(fakeClient.calls.length, 0);

  // Act
  const result = await invokeGeneratedOperation(
    toolName,
    {
      controlId: "control-1",
      body: { documentId: "Policy-a1b2c3d4e5" },
      confirm: true,
    },
    fakeClient as never,
  );
  const envelope = parseToolEnvelope(result);

  // Assert
  assert.equal(envelope.success, false);
  assert.equal(
    (envelope.error as Record<string, unknown>).code,
    "validation_error",
  );
  assert.match(
    String((envelope.error as Record<string, unknown>).message),
    /policy document slug/i,
  );
  assert.equal(fakeClient.calls.length, 0);
});

test("already mapped API responses are translated to idempotent success", async () => {
  // Arrange
  const toolName = getGeneratedToolNameByOperationId(
    "AddTestToControl",
    "manage",
  );
  assert.ok(toolName);
  const fakeClient = new FakeClient();
  fakeClient.nextResponse = {
    status: 422,
    ok: false,
    data: {
      error: "already_mapped",
      message: "Test is already mapped to this control.",
    },
    headers: {},
  };

  // Initial Assert
  assert.equal(fakeClient.calls.length, 0);

  // Act
  const result = await invokeGeneratedOperation(
    toolName,
    {
      controlId: "control-1",
      body: { testId: "test-1" },
      confirm: true,
    },
    fakeClient as never,
  );
  const envelope = parseToolEnvelope(result);

  // Assert
  assert.equal(envelope.success, true);
  assert.equal((envelope.data as Record<string, unknown>).alreadyExisted, true);
  assert.equal(fakeClient.calls.length, 1);
});

test("risk scenario control links use idempotent mapping behavior", async () => {
  // Arrange
  const toolName = getGeneratedToolNameByOperationId(
    "LinkControlsToRiskScenario",
    "manage",
  );
  assert.ok(toolName);
  const fakeClient = new FakeClient();
  fakeClient.nextResponse = {
    status: 422,
    ok: false,
    data: {
      error: "already_linked",
      message: "Control is already linked to this risk scenario.",
    },
    headers: {},
  };

  // Initial Assert
  assert.equal(fakeClient.calls.length, 0);

  // Act
  const result = await invokeGeneratedOperation(
    toolName,
    {
      riskScenarioId: "risk-1",
      body: {
        controlLinks: [{ controlId: "AC-1", linkType: "TREATMENT" }],
      },
      confirm: true,
    },
    fakeClient as never,
  );
  const envelope = parseToolEnvelope(result);

  // Assert
  assert.equal(envelope.success, true);
  assert.equal((envelope.data as Record<string, unknown>).alreadyExisted, true);
  assert.equal(fakeClient.calls.length, 1);
});

test("already exists API responses stay errors for non-mapping operations", async () => {
  // Arrange
  const toolName = getGeneratedToolNameByOperationId(
    "CreateCustomControl",
    "manage",
  );
  assert.ok(toolName);
  const fakeClient = new FakeClient();
  fakeClient.nextResponse = {
    status: 422,
    ok: false,
    data: {
      error: "already_exists",
      message: "A control with this external ID already exists.",
    },
    headers: {},
  };

  // Initial Assert
  assert.equal(fakeClient.calls.length, 0);

  // Act
  const result = await invokeGeneratedOperation(
    toolName,
    {
      body: { externalId: "AC-1", name: "Access Control" },
      confirm: true,
    },
    fakeClient as never,
  );
  const envelope = parseToolEnvelope(result);

  // Assert
  assert.equal(envelope.success, false);
  assert.equal((envelope.error as Record<string, unknown>).code, "api_error");
  assert.equal(fakeClient.calls.length, 1);
});

test("multipart endpoint maps filePath payload to form data", async () => {
  // Arrange
  const toolName = getGeneratedToolNameByOperationId(
    "UploadFileForDocument",
    "manage",
  );
  assert.ok(toolName);
  const fakeClient = new FakeClient();
  const tempFilePath = path.join(
    os.tmpdir(),
    `vanta-mcp-upload-${Date.now().toString()}.txt`,
  );
  fs.writeFileSync(tempFilePath, "evidence-body", "utf8");

  try {
    // Initial Assert
    assert.equal(fakeClient.calls.length, 0);

    // Act
    const result = await invokeGeneratedOperation(
      toolName,
      {
        documentId: "document-1",
        filePath: tempFilePath,
        description: "uploaded by test",
        confirm: true,
      },
      fakeClient as never,
    );
    const envelope = parseToolEnvelope(result);

    // Assert
    assert.equal(envelope.success, true);
    assert.equal(fakeClient.calls.length, 1);
    const request = fakeClient.calls[0];
    assert.ok(request.formData instanceof FormData);
    const fileValue = request.formData.get("file");
    assert.ok(fileValue instanceof File);
    assert.equal(await fileValue.text(), "evidence-body");
  } finally {
    fs.rmSync(tempFilePath, { force: true });
  }
});

test("multipart endpoint requires filePath", async () => {
  // Arrange
  const toolName = getGeneratedToolNameByOperationId(
    "UploadFileForDocument",
    "manage",
  );
  assert.ok(toolName);
  const fakeClient = new FakeClient();

  // Initial Assert
  assert.equal(fakeClient.calls.length, 0);

  // Act
  const result = await invokeGeneratedOperation(
    toolName,
    {
      documentId: "document-1",
      confirm: true,
    },
    fakeClient as never,
  );
  const envelope = parseToolEnvelope(result);

  // Assert
  assert.equal(envelope.success, false);
  assert.equal(
    (envelope.error as Record<string, unknown>).code,
    "file_path_required",
  );
  assert.equal(fakeClient.calls.length, 0);
});

test("multipart endpoint rejects unsupported file types", async () => {
  // Arrange
  const toolName = getGeneratedToolNameByOperationId(
    "UploadFileForDocument",
    "manage",
  );
  assert.ok(toolName);
  const fakeClient = new FakeClient();
  const tempFilePath = path.join(
    os.tmpdir(),
    `vanta-mcp-upload-${Date.now().toString()}.exe`,
  );
  fs.writeFileSync(tempFilePath, "not-allowed", "utf8");

  try {
    // Initial Assert
    assert.equal(fakeClient.calls.length, 0);

    // Act
    const result = await invokeGeneratedOperation(
      toolName,
      {
        documentId: "document-1",
        filePath: tempFilePath,
        confirm: true,
      },
      fakeClient as never,
    );
    const envelope = parseToolEnvelope(result);

    // Assert
    assert.equal(envelope.success, false);
    assert.equal(
      (envelope.error as Record<string, unknown>).code,
      "unsupported_file_type",
    );
    assert.equal(fakeClient.calls.length, 0);
  } finally {
    fs.rmSync(tempFilePath, { force: true });
  }
});

test("multipart endpoint rejects directory paths", async () => {
  // Arrange
  const toolName = getGeneratedToolNameByOperationId(
    "UploadFileForDocument",
    "manage",
  );
  assert.ok(toolName);
  const fakeClient = new FakeClient();
  const tempDirPath = fs.mkdtempSync(path.join(os.tmpdir(), "vanta-mcp-dir-"));

  try {
    // Initial Assert
    assert.equal(fakeClient.calls.length, 0);

    // Act
    const result = await invokeGeneratedOperation(
      toolName,
      {
        documentId: "document-1",
        filePath: tempDirPath,
        confirm: true,
      },
      fakeClient as never,
    );
    const envelope = parseToolEnvelope(result);

    // Assert
    assert.equal(envelope.success, false);
    assert.equal(
      (envelope.error as Record<string, unknown>).code,
      "file_not_regular",
    );
    assert.equal(fakeClient.calls.length, 0);
  } finally {
    fs.rmSync(tempDirPath, { recursive: true, force: true });
  }
});
