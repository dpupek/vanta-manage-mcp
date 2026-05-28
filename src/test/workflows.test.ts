import assert from "node:assert/strict";
import test from "node:test";
import { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { VantaResponse } from "../client/vanta-client.js";
import { registerWorkflowTools } from "../workflows/index.js";
import { parseToolEnvelope } from "./helpers.js";

type ToolHandler = (args: Record<string, unknown>) => Promise<CallToolResult>;

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
          items: [],
        },
        headers: {},
      }
    );
  }
}

const getHandler = (server: FakeServer, name: string): ToolHandler => {
  const handler = server.handlers.get(name);
  assert.ok(handler, `Missing tool handler for ${name}`);
  return handler;
};

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
    employmentStatusMatchesAny: "CURRENT",
  });
  assert.deepEqual(client.requests[1].query, {
    hasOwner: false,
    hasDescription: false,
    isInScope: true,
    pageSize: 50,
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
    employmentStatusMatchesAny: "CURRENT",
  });
  assert.deepEqual(client.requests[1].query, {
    pageSize: 100,
    employmentStatusMatchesAny: "CURRENT",
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
          results: [{ id: "resource-1", status: "SUCCESS" }],
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
  const data = envelope.data as Record<string, unknown>;
  const failed = data.failed as Record<string, unknown>[];

  // Assert
  assert.equal(envelope.success, true);
  assert.equal((data.batches as unknown[]).length, 2);
  assert.equal(failed.length, 1);
  assert.equal(failed[0].id, "resource-51");
  assert.equal((envelope.warnings as string[]).length, 1);
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
