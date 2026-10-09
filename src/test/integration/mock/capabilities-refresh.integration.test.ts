import assert from "node:assert/strict";
import test, { TestContext } from "node:test";
import { parseToolEnvelope } from "../../helpers.js";
import { FakeVantaServer } from "./fake-vanta-server.js";
import { McpStdioHarness } from "./mcp-stdio-harness.js";

const startHarness = async (
  server: FakeVantaServer,
  t: TestContext,
  writeEnabled = true,
) => {
  await server.start();
  const harness = new McpStdioHarness({
    envOverrides: {
      VANTA_API_BASE_URL: server.baseUrl,
      VANTA_CLIENT_ID: "fake-client-id",
      VANTA_CLIENT_SECRET: "fake-client-secret",
      VANTA_ENV_FILE: undefined,
      VANTA_MCP_ENABLE_WRITE: String(writeEnabled),
      VANTA_MCP_SAFE_MODE: "true",
    },
  });
  t.after(async () => {
    await harness.stop();
    await server.stop();
  });
  await harness.start();
  return harness;
};

const readCases = [
  {
    tool: "list_business_units",
    path: "/business-units",
    input: { pageSize: 25, pageCursor: "bu-cursor" },
    query: { pageSize: ["25"], pageCursor: ["bu-cursor"] },
  },
  {
    tool: "get_business_unit",
    path: "/business-units/bu-1",
    input: { businessUnitId: "bu-1" },
  },
  { tool: "get_organization", path: "/organization", input: {} },
  { tool: "get_settings", path: "/personnel-notification-settings", input: {} },
  {
    tool: "list_program_scopes",
    path: "/program-scopes",
    input: {
      businessUnitIdMatchesAny: ["bu-1", "bu-2"],
      frameworkIdMatchesAny: ["soc2"],
      pageCursor: "scope-cursor",
    },
    query: {
      businessUnitIdMatchesAny: ["bu-1", "bu-2"],
      frameworkIdMatchesAny: ["soc2"],
      pageCursor: ["scope-cursor"],
    },
  },
  {
    tool: "get_program_scope",
    path: "/program-scopes/scope-1",
    input: { programScopeId: "scope-1" },
  },
  {
    tool: "list_vendor_finding_mappings",
    path: "/risk-scenarios/risk-1/mappings/vendor-findings",
    input: { riskScenarioId: "risk-1", pageSize: 100 },
    query: { pageSize: ["100"] },
  },
  {
    tool: "list_people",
    path: "/people",
    input: {
      frameworkIdMatchesAny: ["soc2", "iso27001"],
      programScopeIdMatchesAny: ["scope-1"],
      businessUnitIdMatchesAny: ["bu-1"],
    },
    query: {
      frameworkIdMatchesAny: ["soc2", "iso27001"],
      programScopeIdMatchesAny: ["scope-1"],
      businessUnitIdMatchesAny: ["bu-1"],
    },
  },
];

for (const fixture of readCases) {
  test(`${fixture.tool} sends scoped IDs and pagination over MCP and HTTP`, async t => {
    // Arrange
    const server = new FakeVantaServer();
    const payload = {
      results: {
        data: [{ id: "fixture-1" }],
        pageInfo: { hasNextPage: true, endCursor: "next-cursor" },
      },
    };
    server.queueRoute("GET", fixture.path, [{ status: 200, body: payload }]);
    const harness = await startHarness(server, t);
    // Initial Assert
    assert.ok((await harness.listTools()).includes(fixture.tool));
    assert.equal(server.getCallCount("GET", fixture.path), 0);
    // Act
    const result = parseToolEnvelope(
      await harness.callTool(fixture.tool, fixture.input),
    );
    // Assert
    assert.equal(result.success, true);
    assert.deepEqual(result.data, payload);
    assert.equal(server.getCallCount("GET", fixture.path), 1);
    const request = server.getCalls("GET", fixture.path)[0];
    for (const [key, values] of Object.entries(fixture.query ?? {})) {
      assert.deepEqual(request.query.getAll(key), values);
    }
    assert.equal(request.rawBody, "");
  });
}

test("control implementation update preserves description and note on readback", async t => {
  // Arrange
  const server = new FakeVantaServer();
  const control = {
    id: "control-1",
    description: "Access is reviewed.",
    note: "Review quarterly.",
    implementationDetails: "Old details",
  };
  const details =
    "Managers review access quarterly.\nExceptions require approval.";
  server.setRoute("GET", "/controls/control-1", () => ({
    status: 200,
    body: control,
  }));
  server.setRoute("PATCH", "/controls/control-1", request => {
    Object.assign(control, request.jsonBody);
    return { status: 200, body: control };
  });
  const harness = await startHarness(server, t);
  // Initial Assert
  assert.equal(
    (
      parseToolEnvelope(
        await harness.callTool("get_control", { controlId: "control-1" }),
      ).data as typeof control
    ).implementationDetails,
    "Old details",
  );
  assert.equal(server.getCallCount("PATCH", "/controls/control-1"), 0);
  // Act
  const result = parseToolEnvelope(
    await harness.callTool("update_control_metadata", {
      controlId: "control-1",
      body: { implementationDetails: details },
      confirm: true,
    }),
  );
  // Assert
  assert.equal(result.success, true);
  assert.deepEqual(result.metadata, {
    verification: { field: "implementationDetails", status: "verified" },
  });
  assert.equal(server.getCallCount("GET", "/controls/control-1"), 2);
  const readback = parseToolEnvelope(
    await harness.callTool("get_control", { controlId: "control-1" }),
  );
  assert.deepEqual(readback.data, {
    id: "control-1",
    description: "Access is reviewed.",
    note: "Review quarterly.",
    implementationDetails: details,
  });
  assert.deepEqual(
    server.getCalls("PATCH", "/controls/control-1")[0].jsonBody,
    { implementationDetails: details },
  );
});

test("control implementation write accepted over HTTP with missing readback is unverified", async t => {
  // Arrange
  const server = new FakeVantaServer();
  const control = { id: "control-1", note: "Other metadata changed" };
  server.setRoute("PATCH", "/controls/control-1", () => ({
    status: 200,
    body: control,
  }));
  server.setRoute("GET", "/controls/control-1", () => ({
    status: 200,
    body: control,
  }));
  const harness = await startHarness(server, t);
  // Initial Assert
  assert.equal(server.getCallCount("PATCH", "/controls/control-1"), 0);
  assert.equal(server.getCallCount("GET", "/controls/control-1"), 0);
  // Act
  const result = await harness.callTool("update_control_metadata", {
    controlId: "control-1",
    body: {
      implementationDetails: "Requested details",
      note: "Other metadata changed",
    },
    confirm: true,
  });
  // Assert
  const envelope = parseToolEnvelope(result);
  const error = envelope.error as {
    code: string;
    details: { mutationAccepted: boolean; verification: { reason: string } };
  };
  assert.equal(result.isError, true);
  assert.equal(envelope.success, false);
  assert.equal(error.code, "write_unverified");
  assert.equal(error.details.mutationAccepted, true);
  assert.equal(error.details.verification.reason, "field_missing");
  assert.equal(server.getCallCount("PATCH", "/controls/control-1"), 1);
  assert.equal(server.getCallCount("GET", "/controls/control-1"), 1);
  assert.deepEqual(
    server.getCalls("PATCH", "/controls/control-1")[0].jsonBody,
    {
      implementationDetails: "Requested details",
      note: "Other metadata changed",
    },
  );
});

test("notification settings partial update preserves omitted channels", async t => {
  // Arrange
  const server = new FakeVantaServer();
  const settings = {
    enabled: true,
    employeeDigestFrequency: "DAILY",
    enabledChannels: ["EMAIL", "SLACK"],
    nextReminderAt: "2026-10-09T12:00:00Z",
  };
  server.setRoute("GET", "/personnel-notification-settings", () => ({
    status: 200,
    body: settings,
  }));
  server.setRoute("PATCH", "/personnel-notification-settings", request => {
    const body = request.jsonBody as {
      frequency?: string;
      channels?: string[];
    };
    if (body.frequency !== undefined)
      settings.employeeDigestFrequency = body.frequency;
    if (body.channels !== undefined) settings.enabledChannels = body.channels;
    return { status: 200, body: settings };
  });
  const harness = await startHarness(server, t);
  // Initial Assert
  assert.deepEqual(
    parseToolEnvelope(await harness.callTool("get_settings", {})).data,
    {
      enabled: true,
      employeeDigestFrequency: "DAILY",
      enabledChannels: ["EMAIL", "SLACK"],
      nextReminderAt: "2026-10-09T12:00:00Z",
    },
  );
  // Act
  const result = parseToolEnvelope(
    await harness.callTool("update_settings", {
      body: { frequency: "WEEKLY" },
      confirm: true,
    }),
  );
  // Assert
  assert.equal(result.success, true);
  assert.deepEqual(
    server.getCalls("PATCH", "/personnel-notification-settings")[0].jsonBody,
    { frequency: "WEEKLY" },
  );
  assert.deepEqual(
    parseToolEnvelope(await harness.callTool("get_settings", {})).data,
    {
      enabled: true,
      employeeDigestFrequency: "WEEKLY",
      enabledChannels: ["EMAIL", "SLACK"],
      nextReminderAt: "2026-10-09T12:00:00Z",
    },
  );
});

for (const method of ["POST", "DELETE"] as const) {
  test(`vendor finding ${method} mappings use the correct body and read back changes`, async t => {
    // Arrange
    const server = new FakeVantaServer();
    const path = "/risk-scenarios/risk-1/mappings/vendor-findings";
    const ids = new Set(
      method === "POST"
        ? ["unrelated-finding"]
        : ["unrelated-finding", "finding-1"],
    );
    const key =
      method === "POST" ? "vendorFindingIdsToLink" : "vendorFindingIdsToUnlink";
    server.setRoute("GET", path, () => ({
      status: 200,
      body: {
        results: {
          data: [...ids].map(vendorFindingId => ({ vendorFindingId })),
          pageInfo: { hasNextPage: false, endCursor: null },
        },
      },
    }));
    server.setRoute(method, path, request => {
      for (const id of (request.jsonBody as Record<string, string[]>)[key]) {
        if (method === "POST") ids.add(id);
        else ids.delete(id);
      }
      return { status: 204 };
    });
    const harness = await startHarness(server, t);
    // Initial Assert
    assert.equal(ids.has("finding-1"), method === "DELETE");
    assert.equal(server.getCallCount(method, path), 0);
    // Act
    const result = parseToolEnvelope(
      await harness.callTool(
        method === "POST"
          ? "add_vendor_finding_mappings"
          : "remove_vendor_finding_mappings",
        {
          riskScenarioId: "risk-1",
          body: { [key]: ["finding-1"] },
          confirm: true,
        },
      ),
    );
    // Assert
    assert.equal(result.success, true);
    assert.deepEqual(server.getCalls(method, path)[0].jsonBody, {
      [key]: ["finding-1"],
    });
    const expected =
      method === "POST"
        ? ["unrelated-finding", "finding-1"]
        : ["unrelated-finding"];
    assert.deepEqual(
      parseToolEnvelope(
        await harness.callTool("list_vendor_finding_mappings", {
          riskScenarioId: "risk-1",
        }),
      ).data,
      {
        results: {
          data: expected.map(vendorFindingId => ({ vendorFindingId })),
          pageInfo: { hasNextPage: false, endCursor: null },
        },
      },
    );
  });
}

test("already-linked vendor finding batches remain API errors", async t => {
  // Arrange
  const server = new FakeVantaServer();
  const path = "/risk-scenarios/risk-1/mappings/vendor-findings";
  server.queueRoute("POST", path, [
    { status: 422, body: { message: "A vendor finding is already linked" } },
  ]);
  const harness = await startHarness(server, t);
  // Initial Assert
  assert.equal(server.getCallCount("POST", path), 0);
  // Act
  const result = parseToolEnvelope(
    await harness.callTool("add_vendor_finding_mappings", {
      riskScenarioId: "risk-1",
      body: { vendorFindingIdsToLink: ["finding-1", "finding-2"] },
      confirm: true,
    }),
  );
  // Assert
  assert.equal(result.success, false);
  assert.equal((result.error as Record<string, unknown>).code, "api_error");
  assert.equal(server.getCallCount("POST", path), 1);
});

test("business-unit permission failure remains a structured API error", async t => {
  // Arrange
  const server = new FakeVantaServer();
  server.queueRoute("GET", "/business-units", [
    { status: 403, body: { message: "Business unit scoping is disabled" } },
  ]);
  const harness = await startHarness(server, t);
  // Initial Assert
  assert.equal(server.getCallCount("GET", "/business-units"), 0);
  // Act
  const result = parseToolEnvelope(
    await harness.callTool("list_business_units", {}),
  );
  // Assert
  assert.equal(result.success, false);
  assert.equal((result.error as Record<string, unknown>).code, "api_error");
  assert.equal(server.getCallCount("GET", "/business-units"), 1);
});

for (const fixture of [
  {
    tool: "update_settings",
    input: { body: { frequency: "WEEKLY" }, confirm: true },
    method: "PATCH",
    path: "/personnel-notification-settings",
  },
  {
    tool: "add_vendor_finding_mappings",
    input: {
      riskScenarioId: "risk-1",
      body: { vendorFindingIdsToLink: ["finding-1"] },
      confirm: true,
    },
    method: "POST",
    path: "/risk-scenarios/risk-1/mappings/vendor-findings",
  },
  {
    tool: "remove_vendor_finding_mappings",
    input: {
      riskScenarioId: "risk-1",
      body: { vendorFindingIdsToUnlink: ["finding-1"] },
      confirm: true,
    },
    method: "DELETE",
    path: "/risk-scenarios/risk-1/mappings/vendor-findings",
  },
]) {
  test(`${fixture.tool} respects write-disabled mode without additional OAuth or HTTP`, async t => {
    // Arrange
    const server = new FakeVantaServer();
    const harness = await startHarness(server, t, false);
    // Initial Assert
    // The MCP server authenticates once during startup.
    assert.equal(server.getCallCount("POST", "/oauth/token"), 1);
    // Act
    const result = parseToolEnvelope(
      await harness.callTool(fixture.tool, fixture.input),
    );
    // Assert
    assert.equal(result.success, false);
    assert.equal(
      (result.error as Record<string, unknown>).code,
      "write_disabled",
    );
    assert.equal(server.getCallCount(fixture.method, fixture.path), 0);
    assert.equal(server.getCallCount("POST", "/oauth/token"), 1);
  });
}
