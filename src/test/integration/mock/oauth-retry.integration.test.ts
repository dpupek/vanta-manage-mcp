import assert from "node:assert/strict";
import test from "node:test";
import { parseToolEnvelope } from "../../helpers.js";
import { FakeVantaServer } from "./fake-vanta-server.js";
import { McpStdioHarness } from "./mcp-stdio-harness.js";

const controlsPayload = {
  results: {
    data: [{ id: "control-1", name: "Control For OAuth Retry" }],
    pageInfo: {
      hasNextPage: false,
      hasPreviousPage: false,
      startCursor: null,
      endCursor: null,
    },
  },
};

test("client refreshes OAuth token on 401 and returns a success envelope", async () => {
  // Arrange
  const fakeServer = new FakeVantaServer(["token-a", "token-b"]);
  fakeServer.queueRoute("GET", "/controls", [
    { status: 401, body: { error: "expired_token" } },
    { status: 200, body: controlsPayload },
    { status: 200, body: controlsPayload },
  ]);
  await fakeServer.start();
  const harness = new McpStdioHarness({
    envOverrides: {
      VANTA_API_BASE_URL: fakeServer.baseUrl,
      VANTA_CLIENT_ID: "fake-client-id",
      VANTA_CLIENT_SECRET: "fake-client-secret",
      VANTA_ENV_FILE: undefined,
    },
  });
  await harness.start();

  try {
    // Initial Assert
    assert.equal(fakeServer.getCallCount("POST", "/oauth/token"), 1);

    // Act
    const firstCall = await harness.callTool("list_controls", {});
    const secondCall = await harness.callTool("list_controls", {});

    // Assert
    const firstEnvelope = parseToolEnvelope(firstCall);
    assert.equal(firstEnvelope.success, true);
    const secondEnvelope = parseToolEnvelope(secondCall);
    assert.equal(secondEnvelope.success, true);
    assert.equal(fakeServer.getCallCount("POST", "/oauth/token"), 2);
    assert.equal(fakeServer.getCallCount("GET", "/controls"), 3);
  } finally {
    await harness.stop();
    await fakeServer.stop();
  }
});
