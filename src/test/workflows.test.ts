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

  public async request(input: Record<string, unknown>): Promise<VantaResponse> {
    void input;
    this.calls += 1;
    return {
      status: 200,
      ok: true,
      data: {
        items: [],
      },
      headers: {},
    };
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
