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
import { generatedOperations } from "../generated/operations.generated.js";

test("every generated mutation requires confirmation before HTTP", async () => {
  // Arrange
  const mutations = generatedOperations.filter(
    operation => operation.isMutation,
  );
  const client = new FakeClient();
  // Initial Assert
  assert.equal(mutations.length, 166);
  assert.equal(client.calls.length, 0);
  // Act
  const results = await Promise.all(
    mutations.map(operation =>
      invokeGeneratedOperation(operation.toolName, {}, client as never),
    ),
  );
  // Assert
  for (const result of results) {
    const envelope = parseToolEnvelope(result);
    assert.equal(envelope.success, false);
    assert.equal(
      (envelope.error as Record<string, unknown>).code,
      "confirmation_required",
    );
  }
  assert.equal(client.calls.length, 0);
});

class FakeClient {
  public calls: Record<string, unknown>[] = [];
  public nextResponse: VantaResponse | null = null;
  public responseQueue: VantaResponse[] = [];

  public async request(input: Record<string, unknown>): Promise<VantaResponse> {
    this.calls.push(input);
    const queuedResponse = this.responseQueue.shift();
    if (queuedResponse) {
      return queuedResponse;
    }
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
    "CreateRiskScenarioControl",
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
        controlId: "AC-1",
        controlType: "TREATMENT_PLAN",
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
      body: {
        externalId: "AC-1",
        name: "Access Control",
        description: "Access management",
        effectiveDate: "2026-09-09T00:00:00Z",
        domain: "TECHNICAL",
      },
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

test("delete document 404 explains UI deactivation is not API delete", async () => {
  // Arrange
  const toolName = getGeneratedToolNameByOperationId(
    "DeleteDocument",
    "manage",
  );
  assert.ok(toolName);
  const fakeClient = new FakeClient();
  fakeClient.nextResponse = {
    status: 404,
    ok: false,
    data: {
      message:
        "document with id: nist-800-53-Information-security-program-plan not found",
    },
    headers: {},
  };

  // Initial Assert
  assert.equal(fakeClient.calls.length, 0);

  // Act
  const result = await invokeGeneratedOperation(
    toolName,
    {
      documentId: "nist-800-53-Information-security-program-plan",
      confirm: true,
    },
    fakeClient as never,
  );
  const envelope = parseToolEnvelope(result);
  const error = envelope.error as Record<string, unknown>;

  // Assert
  assert.equal(envelope.success, false);
  assert.equal(error.code, "api_error");
  assert.match(String(error.hint), /deactivate_document/i);
  assert.match(String(error.message), /cannot be deleted/i);
  assert.equal(fakeClient.calls.length, 1);
});

test("test endpoint 404 explains policy document UI slug alias", async () => {
  // Arrange
  const toolName = getGeneratedToolNameByOperationId("GetTest", "manage");
  assert.ok(toolName);
  const fakeClient = new FakeClient();
  fakeClient.responseQueue = [
    {
      status: 404,
      ok: false,
      data: {
        message: "Test with id: fedramp-access-control-policy not found",
      },
      headers: {},
    },
    {
      status: 200,
      ok: true,
      data: {
        id: "fedramp-access-control-policy",
        title: "Access Control Policy",
        url: "https://app.vanta.com/documents/fedramp-access-control-policy",
      },
      headers: {},
    },
  ];

  // Initial Assert
  assert.equal(fakeClient.calls.length, 0);

  // Act
  const result = await invokeGeneratedOperation(
    toolName,
    { testId: "fedramp-access-control-policy" },
    fakeClient as never,
  );
  const envelope = parseToolEnvelope(result);
  const error = envelope.error as Record<string, unknown>;

  // Assert
  assert.equal(envelope.success, false);
  assert.equal(error.code, "validation_error");
  assert.match(String(error.message), /document\/policy UI slug/i);
  assert.match(String(error.hint), /list_tests_for_control/i);
  assert.equal(fakeClient.calls.length, 2);
  assert.deepEqual(fakeClient.calls[1], {
    method: "GET",
    path: "/documents/fedramp-access-control-policy",
  });
});

test("deactivate test entity rejects deactivatedReason typo before API call", async () => {
  // Arrange
  const toolName = getGeneratedToolNameByOperationId(
    "DeactivateTestEntity",
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
      testId: "test-1",
      entityId: "entity-1",
      confirm: true,
      body: { deactivatedReason: "Not applicable" },
    },
    fakeClient as never,
  );
  const envelope = parseToolEnvelope(result);
  const error = envelope.error as Record<string, unknown>;

  // Assert
  assert.equal(envelope.success, false);
  assert.equal(error.code, "validation_error");
  assert.match(String(error.message), /deactivateReason/i);
  assert.equal(fakeClient.calls.length, 0);
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
