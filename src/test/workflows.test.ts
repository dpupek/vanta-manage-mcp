import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { VantaResponse } from "../client/vanta-client.js";
import { registerWorkflowTools } from "../workflows/index.js";
import { parseToolEnvelope } from "./helpers.js";

type ToolHandler = (
  args: Record<string, unknown>,
  extra: { signal: AbortSignal },
) => Promise<CallToolResult>;

class FakeServer {
  public handlers = new Map<string, ToolHandler>();

  public tool(
    name: string,
    _description: string,
    _schema: Record<string, unknown>,
    handler: ToolHandler,
  ): void {
    this.handlers.set(name, handler);
  }
}

class FakeClient {
  public calls = 0;
  public readonly requests: Record<string, unknown>[] = [];
  private readonly routes = new Map<string, VantaResponse[]>();

  public setResponse(
    method: string,
    path: string,
    response: VantaResponse,
  ): void {
    this.routes.set(`${method.toUpperCase()} ${path}`, [response]);
  }

  public queueResponses(
    method: string,
    path: string,
    responses: VantaResponse[],
  ): void {
    this.routes.set(`${method.toUpperCase()} ${path}`, [...responses]);
  }

  public async request(input: Record<string, unknown>): Promise<VantaResponse> {
    this.calls += 1;
    this.requests.push(input);
    const route = this.routes.get(
      `${String(input.method).toUpperCase()} ${String(input.path)}`,
    );
    const response =
      route && route.length > 1 ? route.shift() : (route?.[0] ?? null);
    return (
      response ?? {
        status: 200,
        ok: true,
        data: {
          results: { data: [], pageInfo: { hasNextPage: false } },
        },
        headers: {},
      }
    );
  }
}

const getHandler = (
  server: FakeServer,
  name: string,
): ((args: Record<string, unknown>) => Promise<CallToolResult>) => {
  const handler = server.handlers.get(name);
  assert.ok(handler, `Missing tool handler for ${name}`);
  return args => handler(args, { signal: new AbortController().signal });
};

for (const operation of [
  {
    type: "deactivate_vulnerabilities",
    path: "/vulnerabilities/deactivate",
    fields: {
      deactivateReason: "Accepted risk",
      shouldReactivateWhenFixable: false,
    },
  },
  {
    type: "reactivate_vulnerabilities",
    path: "/vulnerabilities/reactivate",
    fields: {},
  },
  {
    type: "acknowledge_sla_miss",
    path: "/vulnerability-remediations/acknowledge-sla-miss",
    fields: { slaViolationComment: "Reviewed exception" },
  },
]) {
  for (const scenario of [
    "success",
    "failure",
    "mixed",
    "missing",
    "mismatched",
  ] as const) {
    test(`${operation.type} reports ${scenario} bulk outcomes`, async () => {
      // Arrange
      const server = new FakeServer();
      const client = new FakeClient();
      const results = [
        {
          id: "item-1",
          status: scenario === "failure" ? "ERROR" : "SUCCESS",
          message: "First result",
        },
        {
          id: scenario === "mismatched" ? "unexpected" : "item-2",
          status:
            scenario === "failure" || scenario === "mixed"
              ? "ERROR"
              : "SUCCESS",
          message: "Second result",
        },
      ];
      if (scenario === "missing") results.pop();
      client.setResponse("POST", operation.path, {
        ok: true,
        status: 200,
        headers: {},
        data: { results },
      });
      registerWorkflowTools(server as never, client as never);
      // Initial Assert
      assert.equal(client.calls, 0);
      // Act
      const result = await getHandler(
        server,
        "workflow_people_assets_vuln_triage",
      )({
        mode: "execute",
        confirm: true,
        actions: [
          {
            type: operation.type,
            payload: {
              updates: ["item-1", "item-2"].map(id => ({
                id,
                ...operation.fields,
              })),
            },
          },
        ],
      });
      // Assert
      const envelope = parseToolEnvelope(result);
      const success = scenario === "success";
      assert.equal(client.calls, 1);
      assert.equal(envelope.success, success);
      assert.equal(result.isError, !success);
      const report = (
        success
          ? envelope.data
          : (envelope.error as Record<string, unknown>).details
      ) as Record<string, unknown>;
      assert.deepEqual(report.counts, {
        succeeded: success ? 1 : 0,
        failed: success ? 0 : 1,
        skipped: 0,
      });
      const executed = report.executed as {
        status: string;
        result: {
          error: {
            code: string;
            details: {
              succeeded: unknown[];
              failed: unknown[];
              apiResponse: unknown;
            };
          };
        };
      }[];
      assert.equal(executed[0].status, success ? "succeeded" : "failed");
      if (!success) {
        const error = executed[0].result.error;
        assert.equal(error.code, "bulk_update_failed");
        assert.deepEqual(error.details.apiResponse, { results });
        assert.equal(
          error.details.succeeded.length,
          scenario === "failure" ? 0 : 1,
        );
        assert.equal(
          error.details.failed.length,
          scenario === "failure" ? 2 : 1,
        );
      }
    });
  }
}

test("vendor status workflow sends multipart fields without requiring a file", async () => {
  // Arrange
  const server = new FakeServer();
  const client = new FakeClient();
  registerWorkflowTools(server as never, client as never);
  // Initial Assert
  assert.equal(client.calls, 0);
  // Act
  const result = await getHandler(
    server,
    "workflow_vendor_triage",
  )({
    mode: "execute",
    confirm: true,
    actions: [
      {
        type: "set_vendor_status",
        vendorId: "vendor-1",
        payload: { status: "ACTIVE" },
      },
    ],
  });
  // Assert
  assert.equal(parseToolEnvelope(result).success, true);
  assert.equal(client.calls, 1);
  assert.equal(
    (client.requests[0].formData as FormData).get("status"),
    "ACTIVE",
  );
});

test("partial vendor plan exposes top-level warning and resume cursor", async () => {
  // Arrange
  const server = new FakeServer();
  const client = new FakeClient();
  client.setResponse("GET", "/vendors", {
    ok: true,
    status: 200,
    headers: {},
    data: {
      results: {
        data: [{ id: "vendor-1" }],
        pageInfo: { hasNextPage: true, endCursor: "next-vendor" },
      },
    },
  });
  registerWorkflowTools(server as never, client as never);
  // Initial Assert
  assert.equal(client.calls, 0);
  // Act
  const result = await getHandler(
    server,
    "workflow_vendor_triage",
  )({ mode: "plan", maxPages: 1 });
  // Assert
  const envelope = parseToolEnvelope(result);
  assert.equal(envelope.success, true);
  assert.equal((envelope.metadata as Record<string, unknown>).complete, false);
  assert.ok((envelope.warnings as string[]).length);
  assert.match(JSON.stringify(envelope.data), /next-vendor/u);
  assert.equal(client.calls, 1);
});

test("incomplete resource discovery prevents bulk updates", async () => {
  // Arrange
  const server = new FakeServer();
  const client = new FakeClient();
  client.setResponse("GET", "/people/person-1", {
    ok: true,
    status: 200,
    headers: {},
    data: { id: "person-1", employment: { status: "CURRENT" } },
  });
  client.setResponse(
    "GET",
    "/integrations/snowflake/resource-kinds/Database/resources",
    {
      ok: true,
      status: 200,
      headers: {},
      data: {
        results: {
          data: [{ resourceId: "resource-1" }],
          pageInfo: { hasNextPage: true, endCursor: "next" },
        },
      },
    },
  );
  registerWorkflowTools(server as never, client as never);
  // Initial Assert
  assert.equal(client.calls, 0);
  // Act
  const result = await getHandler(
    server,
    "workflow_resource_owner_assignment",
  )({
    mode: "execute",
    confirm: true,
    integrationId: "snowflake",
    resourceKind: "Database",
    ownerId: "person-1",
    maxPages: 1,
  });
  // Assert
  const envelope = parseToolEnvelope(result);
  assert.equal(envelope.success, false);
  assert.equal(
    (envelope.error as Record<string, unknown>).code,
    "workflow_read_incomplete",
  );
  assert.ok(
    client.requests.every(
      request => request.method === "get" || request.method === "GET",
    ),
  );
  assert.equal(client.calls, 2);
});

test("deactivation workflow passes the reason and reports failed actions", async () => {
  // Arrange
  const server = new FakeServer();
  const client = new FakeClient();
  client.setResponse("POST", "/tests/test-1/entities/entity-2/deactivate", {
    ok: false,
    status: 403,
    data: {},
    headers: {},
  });
  registerWorkflowTools(server as never, client as never);
  const actions = ["entity-1", "entity-2"].map(entityId => ({
    type: "deactivate_test_entity",
    testId: "test-1",
    entityId,
    deactivateReason: "Documented exception",
  }));
  // Initial Assert
  assert.equal(client.calls, 0);
  // Act
  const result = await getHandler(
    server,
    "workflow_triage_failing_controls",
  )({ mode: "execute", confirm: true, actions });
  // Assert
  const envelope = parseToolEnvelope(result);
  assert.equal(result.isError, true);
  assert.equal(envelope.success, false);
  assert.deepEqual(
    (
      (envelope.error as Record<string, unknown>).details as Record<
        string,
        unknown
      >
    ).counts,
    { succeeded: 1, failed: 1, skipped: 0 },
  );
  assert.deepEqual(client.requests[0].body, {
    deactivateReason: "Documented exception",
  });
});

test("invalid later action prevents all workflow writes", async () => {
  // Arrange
  const server = new FakeServer();
  const client = new FakeClient();
  registerWorkflowTools(server as never, client as never);
  // Initial Assert
  assert.equal(client.calls, 0);
  // Act
  const result = await getHandler(
    server,
    "workflow_triage_failing_controls",
  )({
    mode: "execute",
    confirm: true,
    actions: [
      {
        type: "reactivate_test_entity",
        testId: "test-1",
        entityId: "entity-1",
      },
      {
        type: "deactivate_test_entity",
        testId: "test-1",
        entityId: "entity-2",
      },
    ],
  });
  // Assert
  assert.equal(parseToolEnvelope(result).success, false);
  assert.equal(client.calls, 0);
});

test("evidence upload is skipped when document linkage fails", async () => {
  // Arrange
  const server = new FakeServer();
  const client = new FakeClient();
  client.setResponse("POST", "/controls/control-1/add-document-to-control", {
    ok: false,
    status: 403,
    data: {},
    headers: {},
  });
  registerWorkflowTools(server as never, client as never);
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "vanta-workflow-"));
  const filePath = path.join(directory, "evidence.txt");
  fs.writeFileSync(filePath, "Evidence");
  try {
    // Initial Assert
    assert.equal(client.calls, 0);
    // Act
    const result = await getHandler(
      server,
      "workflow_control_evidence",
    )({
      mode: "execute",
      confirm: true,
      controlId: "control-1",
      documentId: "document-1",
      filePath,
    });
    // Assert
    const envelope = parseToolEnvelope(result);
    assert.equal(envelope.success, false);
    assert.deepEqual(
      (
        (envelope.error as Record<string, unknown>).details as Record<
          string,
          unknown
        >
      ).counts,
      { succeeded: 0, failed: 1, skipped: 1 },
    );
    assert.equal(client.calls, 1);
    assert.equal(fs.existsSync(filePath), true);
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test("failed planning read is not reported as a successful plan", async () => {
  // Arrange
  const server = new FakeServer();
  const client = new FakeClient();
  client.setResponse("GET", "/vendors", {
    ok: false,
    status: 403,
    data: {},
    headers: {},
  });
  registerWorkflowTools(server as never, client as never);
  // Initial Assert
  assert.equal(client.calls, 0);
  // Act
  const result = await getHandler(
    server,
    "workflow_vendor_triage",
  )({ mode: "plan" });
  // Assert
  assert.equal(parseToolEnvelope(result).success, false);
  assert.equal(client.calls, 1);
});

test("workflow execute requires confirmation", async () => {
  // Arrange
  const server = new FakeServer();
  const client = new FakeClient();
  registerWorkflowTools(server as unknown as McpServer, client as never);
  const handler = getHandler(server, "workflow_triage_failing_controls");

  // Initial Assert
  assert.equal(client.calls, 0);

  // Act
  const result = await handler({
    mode: "execute",
  });
  const envelope = parseToolEnvelope(result);

  // Assert
  assert.equal(envelope.success, false);
  assert.equal(
    (envelope.error as Record<string, unknown>).code,
    "confirmation_required",
  );
  assert.equal(client.calls, 0);
});

test("workflow plan is deterministic and non-mutating", async () => {
  // Arrange
  const server = new FakeServer();
  const client = new FakeClient();
  registerWorkflowTools(server as unknown as McpServer, client as never);
  const handler = getHandler(server, "workflow_information_request_triage");

  // Initial Assert
  assert.equal(client.calls, 0);

  // Act
  const result = await handler({
    mode: "plan",
    auditId: "audit-1",
  });
  const envelope = parseToolEnvelope(result);

  // Assert
  assert.equal(envelope.success, true);
  assert.equal(envelope.message, "Plan generated. No mutations were executed.");
  assert.notEqual(client.calls, 0);
});

test("resource owner assignment workflow plans missing owner updates for current owner", async () => {
  // Arrange
  const server = new FakeServer();
  const client = new FakeClient();
  client.setResponse("GET", "/people", {
    status: 200,
    ok: true,
    data: {
      results: {
        data: [
          {
            id: "person-current",
            emailAddress: "owner@example.com",
            name: { display: "Owner Example" },
            employment: { status: "CURRENT" },
          },
        ],
        pageInfo: { hasNextPage: false },
      },
    },
    headers: {},
  });
  client.setResponse(
    "GET",
    "/integrations/snowflake/resource-kinds/SnowflakeDatabase/resources",
    {
      status: 200,
      ok: true,
      data: {
        results: {
          data: [
            {
              resourceId: "resource-1",
              displayName: "Warehouse",
              owner: null,
              description: null,
              inScope: true,
            },
          ],
          pageInfo: { hasNextPage: false },
        },
      },
      headers: {},
    },
  );
  registerWorkflowTools(server as unknown as McpServer, client as never);
  const handler = getHandler(server, "workflow_resource_owner_assignment");

  // Initial Assert
  assert.equal(client.calls, 0);

  // Act
  const result = await handler({
    mode: "plan",
    integrationId: "snowflake",
    resourceKind: "SnowflakeDatabase",
    ownerEmail: "owner@example.com",
    hasOwner: false,
    hasDescription: false,
    isInScope: true,
    description: "Primary Snowflake warehouse for analytics",
  });
  const envelope = parseToolEnvelope(result);
  const data = envelope.data as Record<string, unknown>;
  const actions = data.actions as Record<string, unknown>[];

  // Assert
  assert.equal(envelope.success, true);
  assert.equal(envelope.message, "Plan generated. No mutations were executed.");
  assert.equal(actions.length, 1);
  assert.deepEqual(actions[0], {
    id: "resource-1",
    ownerId: "person-current",
    description: "Primary Snowflake warehouse for analytics",
  });
  assert.equal(client.requests.length, 2);
  assert.deepEqual(client.requests[0].query, {
    pageSize: 100,
  });
  assert.deepEqual(client.requests[1].query, {
    hasOwner: false,
    hasDescription: false,
    isInScope: true,
    pageSize: 100,
  });
});

test("resource owner assignment workflow resolves owner email across people pages", async () => {
  // Arrange
  const server = new FakeServer();
  const client = new FakeClient();
  client.queueResponses("GET", "/people", [
    {
      status: 200,
      ok: true,
      data: {
        results: {
          data: [
            {
              id: "person-other",
              emailAddress: "other@example.com",
              employment: { status: "CURRENT" },
            },
          ],
          pageInfo: { hasNextPage: true, endCursor: "cursor-1" },
        },
      },
      headers: {},
    },
    {
      status: 200,
      ok: true,
      data: {
        results: {
          data: [
            {
              id: "person-current",
              emailAddress: "owner@example.com",
              employment: { status: "CURRENT" },
            },
          ],
          pageInfo: { hasNextPage: false },
        },
      },
      headers: {},
    },
  ]);
  client.setResponse(
    "GET",
    "/integrations/snowflake/resource-kinds/SnowflakeDatabase/resources",
    {
      status: 200,
      ok: true,
      data: {
        results: {
          data: [{ resourceId: "resource-1" }],
          pageInfo: { hasNextPage: false },
        },
      },
      headers: {},
    },
  );
  registerWorkflowTools(server as unknown as McpServer, client as never);
  const handler = getHandler(server, "workflow_resource_owner_assignment");

  // Initial Assert
  assert.equal(client.calls, 0);

  // Act
  const result = await handler({
    mode: "plan",
    integrationId: "snowflake",
    resourceKind: "SnowflakeDatabase",
    ownerEmail: "owner@example.com",
  });
  const envelope = parseToolEnvelope(result);

  // Assert
  assert.equal(envelope.success, true);
  const data = envelope.data as Record<string, unknown>;
  const actions = data.actions as Record<string, unknown>[];
  assert.equal(actions[0].ownerId, "person-current");
  assert.deepEqual(client.requests[0].query, {
    pageSize: 100,
  });
  assert.deepEqual(client.requests[1].query, {
    pageSize: 100,
    pageCursor: "cursor-1",
  });
});

test("resource owner assignment workflow rejects former owners before mutation", async () => {
  // Arrange
  const server = new FakeServer();
  const client = new FakeClient();
  client.setResponse("GET", "/people/person-former", {
    status: 200,
    ok: true,
    data: {
      id: "person-former",
      emailAddress: "former@example.com",
      employment: { status: "FORMER" },
    },
    headers: {},
  });
  registerWorkflowTools(server as unknown as McpServer, client as never);
  const handler = getHandler(server, "workflow_resource_owner_assignment");

  // Initial Assert
  assert.equal(client.calls, 0);

  // Act
  const result = await handler({
    mode: "execute",
    confirm: true,
    integrationId: "snowflake",
    resourceKind: "SnowflakeDatabase",
    ownerId: "person-former",
    resourceIds: ["resource-1"],
  });
  const envelope = parseToolEnvelope(result);

  // Assert
  assert.equal(envelope.success, false);
  assert.equal(
    (envelope.error as Record<string, unknown>).code,
    "validation_error",
  );
  assert.equal(client.calls, 1);
  assert.equal(
    client.requests.some(
      request =>
        request.method === "patch" &&
        request.path ===
          "/integrations/snowflake/resource-kinds/SnowflakeDatabase/resources",
    ),
    false,
  );
});

test("resource owner assignment workflow executes bulk updates in batches and reports partial failures", async () => {
  // Arrange
  const server = new FakeServer();
  const client = new FakeClient();
  client.setResponse("GET", "/people/person-current", {
    status: 200,
    ok: true,
    data: {
      id: "person-current",
      emailAddress: "owner@example.com",
      employment: { status: "CURRENT" },
    },
    headers: {},
  });
  client.queueResponses(
    "PATCH",
    "/integrations/snowflake/resource-kinds/SnowflakeDatabase/resources",
    [
      {
        status: 200,
        ok: true,
        data: {
          results: Array.from({ length: 50 }, (_, index) => ({
            id: `resource-${(index + 1).toString()}`,
            status: "SUCCESS",
          })),
        },
        headers: {},
      },
      {
        status: 200,
        ok: true,
        data: {
          results: [
            { id: "resource-51", status: "ERROR", message: "Invalid Input" },
          ],
        },
        headers: {},
      },
    ],
  );
  registerWorkflowTools(server as unknown as McpServer, client as never);
  const handler = getHandler(server, "workflow_resource_owner_assignment");
  const resourceIds = Array.from(
    { length: 51 },
    (_value, index) => `resource-${(index + 1).toString()}`,
  );

  // Initial Assert
  assert.equal(client.calls, 0);

  // Act
  const result = await handler({
    mode: "execute",
    confirm: true,
    integrationId: "snowflake",
    resourceKind: "SnowflakeDatabase",
    ownerId: "person-current",
    resourceIds,
    description: "Owned resource",
  });
  const envelope = parseToolEnvelope(result);
  const data = (envelope.error as Record<string, unknown>).details as Record<
    string,
    unknown
  >;
  const failed = data.failed as Record<string, unknown>[];

  // Assert
  assert.equal(envelope.success, false);
  assert.equal((data.batches as unknown[]).length, 2);
  assert.equal(failed.length, 1);
  assert.equal(failed[0].id, "resource-51");
  assert.deepEqual(data.counts, { succeeded: 50, failed: 1, skipped: 0 });
  const patchRequests = client.requests.filter(
    request =>
      request.method === "patch" &&
      request.path ===
        "/integrations/snowflake/resource-kinds/SnowflakeDatabase/resources",
  );
  assert.equal(patchRequests.length, 2);
  assert.equal(
    ((patchRequests[0].body as Record<string, unknown>).updates as unknown[])
      .length,
    50,
  );
  assert.equal(
    ((patchRequests[1].body as Record<string, unknown>).updates as unknown[])
      .length,
    1,
  );
});
