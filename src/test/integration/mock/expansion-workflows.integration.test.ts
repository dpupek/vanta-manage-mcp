import assert from "node:assert/strict";
import test from "node:test";
import { parseToolEnvelope } from "../../helpers.js";
import { FakeVantaServer } from "./fake-vanta-server.js";
import { McpStdioHarness } from "./mcp-stdio-harness.js";

for (const fixture of [
  {
    tool: "workflow_vendor_alerts",
    input: { kind: "vendor", alertIds: ["alert-1"], status: "RESOLVED" },
    read: "/vendor-alerts/alert-1",
    write: "/vendor-alerts",
    method: "PATCH",
  },
  {
    tool: "workflow_risk_mappings",
    input: {
      riskScenarioId: "risk-1",
      kind: "issues",
      change: "add",
      items: ["issue-1"],
    },
    read: "/risk-scenarios/risk-1/mappings/issues",
    write: "/risk-scenarios/risk-1/mappings/issues",
    method: "POST",
  },
]) {
  test(`${fixture.tool} rejects execution when writes are disabled`, async t => {
    // Arrange
    const server = new FakeVantaServer();
    await server.start();
    const harness = new McpStdioHarness({
      envOverrides: {
        VANTA_API_BASE_URL: server.baseUrl,
        VANTA_CLIENT_ID: "fake",
        VANTA_CLIENT_SECRET: "fake",
        VANTA_ENV_FILE: undefined,
        VANTA_MCP_ENABLE_WRITE: "false",
      },
    });
    t.after(async () => {
      await harness.stop();
      await server.stop();
    });
    await harness.start();
    // Initial assert
    assert.ok((await harness.listTools()).includes(fixture.tool));
    assert.equal(server.getCallCount("GET", fixture.read), 0);
    // Act
    const result = parseToolEnvelope(
      await harness.callTool(fixture.tool, {
        mode: "execute",
        confirm: true,
        ...fixture.input,
      }),
    );
    // Assert
    assert.equal(result.success, false);
    assert.equal(
      (result.error as Record<string, unknown>).code,
      "write_disabled",
    );
    assert.equal(server.getCallCount("GET", fixture.read), 0);
    assert.equal(server.getCallCount(fixture.method, fixture.write), 0);
  });
}

test("document evaluation acceptance does not imply a saved result", async t => {
  // Arrange
  const server = new FakeVantaServer();
  server.queueRoute("POST", "/documents/doc-1/evaluate", [{ status: 202 }]);
  server.queueRoute("GET", "/documents/doc-1/evaluation", [
    { status: 404, body: { message: "No saved evaluation" } },
  ]);
  await server.start();
  const harness = new McpStdioHarness({
    envOverrides: {
      VANTA_API_BASE_URL: server.baseUrl,
      VANTA_CLIENT_ID: "fake",
      VANTA_CLIENT_SECRET: "fake",
      VANTA_ENV_FILE: undefined,
      VANTA_MCP_ENABLE_WRITE: "true",
    },
  });
  t.after(async () => {
    await harness.stop();
    await server.stop();
  });
  await harness.start();
  // Initial assert
  assert.equal(server.getCallCount("POST", "/documents/doc-1/evaluate"), 0);
  // Act
  const accepted = parseToolEnvelope(
    await harness.callTool("evaluate_document", {
      documentId: "doc-1",
      confirm: true,
    }),
  );
  const readback = parseToolEnvelope(
    await harness.callTool("get_document_draft_evaluation", {
      documentId: "doc-1",
    }),
  );
  // Assert
  assert.equal(accepted.success, true);
  assert.equal(readback.success, false);
  assert.equal((readback.error as Record<string, unknown>).code, "api_error");
  assert.equal(server.getCallCount("POST", "/documents/doc-1/evaluate"), 1);
});

test("personnel requirement update preserves omitted requirement fields in request and readback", async t => {
  // Arrange
  const server = new FakeVantaServer();
  const route = "/task-requirement-sets/set-1/requirements";
  const body = {
    onboarding: { policyAcceptance: { required: true, acceptAll: true } },
  };
  let taskRequirements = {
    onboarding: { policyAcceptance: { required: false } },
    offboarding: { custom: { required: false } },
  };
  server.setRoute("PATCH", route, request => {
    taskRequirements = {
      ...taskRequirements,
      ...(request.jsonBody as typeof body),
    };
    return { status: 200, body: { id: "set-1", taskRequirements } };
  });
  server.setRoute("GET", "/task-requirement-sets/set-1", () => ({
    status: 200,
    body: { id: "set-1", taskRequirements },
  }));
  await server.start();
  const harness = new McpStdioHarness({
    envOverrides: {
      VANTA_API_BASE_URL: server.baseUrl,
      VANTA_CLIENT_ID: "fake",
      VANTA_CLIENT_SECRET: "fake",
      VANTA_ENV_FILE: undefined,
      VANTA_MCP_ENABLE_WRITE: "true",
    },
  });
  t.after(async () => {
    await harness.stop();
    await server.stop();
  });
  await harness.start();
  // Initial assert
  assert.equal(server.getCallCount("PATCH", route), 0);
  // Act
  const updated = parseToolEnvelope(
    await harness.callTool("update_task_requirement_set_requirements", {
      requirementSetId: "set-1",
      body,
      confirm: true,
    }),
  );
  const readback = parseToolEnvelope(
    await harness.callTool("get_task_requirement_set", {
      requirementSetId: "set-1",
    }),
  );
  // Assert
  assert.equal(updated.success, true);
  assert.equal(readback.success, true);
  assert.deepEqual(server.getCalls("PATCH", route)[0].jsonBody, body);
  assert.deepEqual(
    (
      (readback.data as Record<string, unknown>).taskRequirements as Record<
        string,
        unknown
      >
    ).offboarding,
    { custom: { required: false } },
  );
});

test("framework export reports RUNNING until a completed status returns its URL", async t => {
  // Arrange
  const server = new FakeVantaServer();
  const exportId = "4b0e7c9e-2f1d-4c1a-9a55-0d6f3c2e8b71";
  server.queueRoute("POST", "/frameworks/exports", [
    { status: 202, body: { exportId, status: "RUNNING" } },
  ]);
  server.queueRoute("GET", `/frameworks/exports/${exportId}`, [
    { status: 200, body: { exportId, status: "RUNNING" } },
    {
      status: 200,
      body: {
        exportId,
        status: "COMPLETED",
        downloadUrl: "https://example.invalid/export",
      },
    },
  ]);
  await server.start();
  const harness = new McpStdioHarness({
    envOverrides: {
      VANTA_API_BASE_URL: server.baseUrl,
      VANTA_CLIENT_ID: "fake",
      VANTA_CLIENT_SECRET: "fake",
      VANTA_ENV_FILE: undefined,
      VANTA_MCP_ENABLE_WRITE: "true",
    },
  });
  t.after(async () => {
    await harness.stop();
    await server.stop();
  });
  await harness.start();
  // Initial assert
  assert.equal(server.getCallCount("POST", "/frameworks/exports"), 0);
  // Act
  const created = parseToolEnvelope(
    await harness.callTool("create_framework_controls_export", {
      body: { frameworkId: "soc2" },
      confirm: true,
    }),
  );
  const running = parseToolEnvelope(
    await harness.callTool("get_framework_controls_export", { exportId }),
  );
  const complete = parseToolEnvelope(
    await harness.callTool("get_framework_controls_export", { exportId }),
  );
  // Assert
  assert.equal((created.data as Record<string, unknown>).status, "RUNNING");
  assert.equal((running.data as Record<string, unknown>).status, "RUNNING");
  assert.equal((complete.data as Record<string, unknown>).status, "COMPLETED");
  assert.equal(server.getCallCount("POST", "/frameworks/exports"), 1);
});
