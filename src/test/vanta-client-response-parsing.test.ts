import assert from "node:assert/strict";
import test from "node:test";
import { getTokenManager } from "../auth.js";
import { VantaApiClient } from "../client/vanta-client.js";
import { invokeGeneratedOperation } from "../tools/endpoint-tools.js";
import { parseToolEnvelope } from "./helpers.js";

for (const status of [403, 502]) {
  test(`malformed JSON HTTP ${status.toString()} retains status and raw body`, async () => {
    // Arrange
    const body = status === 403 ? "Forbidden" : "<html>Bad gateway</html>";
    const client = new VantaApiClient({
      tokenManager: {
        getValidToken: async () => "test-token",
        refreshToken: async () => "refreshed-token",
      },
      fetch: async () =>
        new Response(body, {
          status,
          headers: { "content-type": "application/json" },
        }),
    });
    // Initial Assert
    assert.throws(() => JSON.parse(body));
    // Act: a write avoids transient read retries and exercises the final response.
    const result = await client.request({ method: "POST", path: "/fixture" });
    // Assert
    assert.equal(result.ok, false);
    assert.equal(result.status, status);
    assert.equal(result.data, body);
  });
}

test("connector malformed JSON denial becomes api_error with HTTP status and raw text", async () => {
  // Arrange
  let calls = 0;
  const client = new VantaApiClient({
    tokenManager: {
      getValidToken: async () => "test-token",
      refreshToken: async () => "refreshed-token",
    },
    fetch: async () => {
      calls += 1;
      return new Response("Forbidden", {
        status: 403,
        headers: { "content-type": "application/json" },
      });
    },
  });
  // Initial Assert
  assert.equal(calls, 0);
  // Act
  const result = await invokeGeneratedOperation(
    "connector_get_user_account",
    { resourceId: "missing-fixture" },
    client,
  );
  // Assert
  const envelope = parseToolEnvelope(result);
  assert.equal(result.isError, true);
  assert.equal(envelope.success, false);
  const error = envelope.error as Record<string, unknown>;
  assert.equal(error.code, "api_error");
  assert.equal(error.message, "Vanta API request failed with status 403.");
  assert.deepEqual(error.details, { value: "Forbidden" });
  assert.equal(calls, 1);
});

const withMockedAuth = async (run: () => Promise<void>): Promise<void> => {
  const tokenManager = getTokenManager() as {
    getValidToken: () => Promise<string>;
    refreshToken: () => Promise<string>;
  };
  const originalGetValidToken = tokenManager.getValidToken;
  const originalRefreshToken = tokenManager.refreshToken;

  tokenManager.getValidToken = async () => "test-token";
  tokenManager.refreshToken = async () => "refreshed-test-token";

  try {
    await run();
  } finally {
    tokenManager.getValidToken = originalGetValidToken;
    tokenManager.refreshToken = originalRefreshToken;
  }
};

const withMockedFetch = async (
  fetchImpl: typeof fetch,
  run: () => Promise<void>,
): Promise<void> => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = fetchImpl;
  try {
    await run();
  } finally {
    globalThis.fetch = originalFetch;
  }
};

test("vanta client parses 204 response as null payload", async () => {
  // Arrange
  const client = new VantaApiClient();

  // Initial Assert
  assert.equal(typeof globalThis.fetch, "function");

  // Act
  let responseStatus = -1;
  await withMockedAuth(async () => {
    await withMockedFetch(
      async () => {
        const response = new Response(null, {
          status: 204,
          headers: { "content-type": "application/json" },
        });
        responseStatus = response.status;
        return response;
      },
      async () => {
        const result = await client.request({
          method: "get",
          path: "/controls",
        });

        // Assert
        assert.equal(responseStatus, 204);
        assert.equal(result.ok, true);
        assert.equal(result.status, 204);
        assert.equal(result.data, null);
      },
    );
  });
});

test("vanta client parses empty json response body as null payload", async () => {
  // Arrange
  const client = new VantaApiClient();

  // Initial Assert
  assert.equal(typeof globalThis.fetch, "function");

  // Act
  await withMockedAuth(async () => {
    await withMockedFetch(
      async () => {
        return new Response("", {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      },
      async () => {
        const result = await client.request({
          method: "get",
          path: "/controls",
        });

        // Assert
        assert.equal(result.ok, true);
        assert.equal(result.status, 200);
        assert.equal(result.data, null);
      },
    );
  });
});

test("vanta client parses non-json response body as raw text", async () => {
  // Arrange
  const client = new VantaApiClient();

  // Initial Assert
  assert.equal(typeof globalThis.fetch, "function");

  // Act
  await withMockedAuth(async () => {
    await withMockedFetch(
      async () => {
        return new Response("plain-body", {
          status: 200,
          headers: { "content-type": "text/plain" },
        });
      },
      async () => {
        const result = await client.request({
          method: "get",
          path: "/controls",
        });

        // Assert
        assert.equal(result.ok, true);
        assert.equal(result.status, 200);
        assert.equal(result.data, "plain-body");
      },
    );
  });
});

test("vanta client returns parse error for invalid json response body", async () => {
  // Arrange
  const client = new VantaApiClient();

  // Initial Assert
  assert.equal(typeof globalThis.fetch, "function");

  // Act
  await withMockedAuth(async () => {
    await withMockedFetch(
      async () => {
        return new Response("{not-json", {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      },
      async () => {
        const request = client.request({
          method: "get",
          path: "/controls",
        });

        // Assert
        await assert.rejects(request, error => {
          assert.equal(error instanceof Error, true);
          assert.match(
            (error as Error).message,
            /Failed to parse JSON response:/u,
          );
          return true;
        });
      },
    );
  });
});
