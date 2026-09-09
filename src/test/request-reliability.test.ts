import assert from "node:assert/strict";
import test from "node:test";
import { VantaApiClient, VantaClientOptions } from "../client/vanta-client.js";
import { retryDelayMs } from "../client/request-context.js";

const tokens = {
  getValidToken: async () => "fixture-token",
  refreshToken: async () => "refreshed-token",
};

for (const [method, status, expectedCalls] of [
  ["GET", 500, 3],
  ["GET", 409, 1],
  ["POST", 500, 1],
  ["PATCH", 503, 1],
  ["PUT", 408, 1],
  ["DELETE", 409, 1],
  ["POST", 429, 3],
] as const) {
  test(`${method} ${status.toString()} obeys replay policy`, async () => {
    // Arrange
    let calls = 0;
    const waits: number[] = [];
    const client = new VantaApiClient({
      tokenManager: tokens,
      fetch: async () => {
        calls += 1;
        return Response.json({}, { status, headers: { "retry-after": "0" } });
      },
      wait: async ms => {
        waits.push(ms);
      },
    });
    // Initial Assert
    assert.equal(calls, 0);
    // Act
    const result = await client.request({
      method,
      path: "/fixture",
      body: method === "GET" ? undefined : { name: "new item" },
    });
    // Assert
    assert.equal(result.status, status);
    assert.equal(calls, expectedCalls);
    assert.equal(waits.length, expectedCalls - 1);
  });
}

test("transport failures retry reads but do not replay uploads", async () => {
  // Arrange
  const counts = { GET: 0, POST: 0 };
  const client = new VantaApiClient({
    tokenManager: tokens,
    fetch: async (_url, init) => {
      counts[init?.method as keyof typeof counts] += 1;
      throw new Error("connection lost");
    },
    wait: async () => {
      return;
    },
  });
  // Initial Assert
  assert.deepEqual(counts, { GET: 0, POST: 0 });
  // Act
  const results = await Promise.allSettled([
    client.request({ method: "GET", path: "/fixture" }),
    client.request({
      method: "POST",
      path: "/fixture",
      formData: new FormData(),
    }),
  ]);
  // Assert
  assert.ok(results.every(result => result.status === "rejected"));
  assert.deepEqual(counts, { GET: 3, POST: 1 });
});

test("401 refresh is bounded and reuses the replacement token", async () => {
  // Arrange
  let refreshes = 0;
  const authorization: string[] = [];
  const client = new VantaApiClient({
    tokenManager: {
      ...tokens,
      refreshToken: async () => {
        refreshes += 1;
        return "replacement";
      },
    },
    fetch: async (_url, init) => {
      authorization.push(new Headers(init?.headers).get("Authorization") ?? "");
      return Response.json({}, { status: 401 });
    },
  });
  // Initial Assert
  assert.equal(refreshes, 0);
  // Act
  const result = await client.request({ method: "POST", path: "/fixture" });
  // Assert
  assert.equal(result.status, 401);
  assert.equal(refreshes, 1);
  assert.deepEqual(authorization, [
    "Bearer fixture-token",
    "Bearer replacement",
  ]);
});

test("Retry-After supports seconds and HTTP dates without shortening server delays", () => {
  // Arrange
  const now = Date.parse("2026-09-09T00:00:00Z");
  // Initial Assert
  assert.ok(Number.isFinite(now));
  // Act
  const actual = [
    retryDelayMs("2", 0, now, 0),
    retryDelayMs("Wed, 09 Sep 2026 00:00:03 GMT", 0, now, 0),
    retryDelayMs("-1", 1, now, 0),
    retryDelayMs("invalid", 0, now, 0),
    retryDelayMs("3600", 0, now, 0),
  ];
  // Assert
  assert.deepEqual(actual, [2000, 3000, 1000, 500, 3600000]);
});

for (const stage of ["oauth", "fetch", "body", "backoff"] as const) {
  test(`request deadline bounds ${stage}`, async context => {
    // Arrange
    context.mock.timers.enable({ apis: ["setTimeout"] });
    let entered!: () => void;
    const started = new Promise<void>(resolve => {
      entered = resolve;
    });
    const never = <T>(): Promise<T> => {
      entered();
      return new Promise<T>(() => {
        /* Intentionally pending until the deadline. */
      });
    };
    const options: VantaClientOptions = {
      timeoutMs: 100,
      tokenManager: tokens,
      fetch: async () => Response.json({}),
    };
    if (stage === "oauth")
      options.tokenManager = {
        ...tokens,
        getValidToken: () => never<string>(),
      };
    if (stage === "fetch") options.fetch = () => never<Response>();
    if (stage === "body")
      options.fetch = async () =>
        Object.assign(Response.json({}), { text: () => never<string>() });
    if (stage === "backoff") {
      options.fetch = async () =>
        Response.json({}, { status: 429, headers: { "retry-after": "3600" } });
      options.wait = () => never<undefined>();
    }
    const client = new VantaApiClient(options);
    // Initial Assert
    assert.equal(options.timeoutMs, 100);
    // Act
    const request = client.request({ method: "GET", path: "/fixture" });
    const rejected = assert.rejects(
      request,
      (error: Error) => error.name === "TimeoutError",
    );
    await started;
    context.mock.timers.tick(100);
    // Assert
    await rejected;
  });
}

test("caller cancellation aborts an in-flight request", async () => {
  // Arrange
  const controller = new AbortController();
  let observed: AbortSignal | undefined;
  let entered!: () => void;
  const started = new Promise<void>(resolve => {
    entered = resolve;
  });
  const client = new VantaApiClient({
    tokenManager: tokens,
    fetch: async (_url, init) => {
      observed = init?.signal ?? undefined;
      entered();
      return new Promise<Response>(() => {
        /* Intentionally pending until cancellation. */
      });
    },
  });
  // Initial Assert
  assert.equal(controller.signal.aborted, false);
  // Act
  const request = client.request({
    method: "GET",
    path: "/fixture",
    signal: controller.signal,
  });
  const rejected = assert.rejects(
    request,
    (error: Error) => error.name === "AbortError",
  );
  await started;
  controller.abort();
  // Assert
  await rejected;
  assert.equal(observed?.aborted, true);
});
