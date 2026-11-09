import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { parseToolEnvelope } from "../../helpers.js";
import { FakeVantaServer } from "./fake-vanta-server.js";
import { McpStdioHarness } from "./mcp-stdio-harness.js";

test("registered media tools save exact binary bytes and report source identity", async t => {
  // Arrange
  const directory = await fs.mkdtemp(
    path.join(os.tmpdir(), "vanta-download-test-"),
  );
  const server = new FakeVantaServer();
  const bytes = Buffer.from([0x50, 0x4b, 0, 255, 254, 128, 10]);
  const hash = createHash("sha256").update(bytes).digest("hex");
  server.queueRoute("GET", "/documents/doc-1/uploads/upload-1/media", [
    {
      status: 200,
      headers: {
        "content-type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      },
      body: bytes,
    },
  ]);
  await server.start();
  const harness = new McpStdioHarness({
    envOverrides: {
      VANTA_API_BASE_URL: server.baseUrl,
      VANTA_CLIENT_ID: "fake",
      VANTA_CLIENT_SECRET: "fake",
      VANTA_ENV_FILE: undefined,
      VANTA_MCP_DOWNLOAD_DIR: directory,
    },
  });
  t.after(async () => {
    await harness.stop();
    await server.stop();
    await fs.rm(directory, { recursive: true, force: true });
  });
  await harness.start();
  // Initial assert
  assert.ok((await harness.listTools()).includes("get_uploadedfile_media"));
  assert.deepEqual(await fs.readdir(directory), []);
  // Act
  const result = parseToolEnvelope(
    await harness.callTool("get_uploadedfile_media", {
      documentId: "doc-1",
      uploadedFileId: "upload-1",
      downloadFileName: "file.xlsx",
      expectedSha256: hash,
    }),
  );
  // Assert
  assert.equal(result.success, true);
  const receipt = result.data as Record<string, unknown>;
  assert.equal(receipt.sha256, hash);
  assert.equal(receipt.identityStatus, "match");
  assert.deepEqual(await fs.readFile(path.join(directory, "file.xlsx")), bytes);
  assert.deepEqual(await fs.readdir(directory), ["file.xlsx"]);
});

for (const fixture of [
  {
    name: "sample.pdf",
    type: "application/pdf",
    bytes: [37, 80, 68, 70, 255, 0],
  },
  { name: "sample.png", type: "image/png", bytes: [137, 80, 78, 71, 0, 255] },
  { name: "sample.jpg", type: "image/jpeg", bytes: [255, 216, 255, 0, 254] },
  {
    name: "sample.txt",
    type: "text/plain",
    bytes: [239, 187, 191, 65, 13, 10, 255],
  },
]) {
  test(`Trust Center media preserves ${fixture.name} bytes`, async t => {
    // Arrange
    const directory = await fs.mkdtemp(
      path.join(os.tmpdir(), "vanta-download-test-"),
    );
    const server = new FakeVantaServer();
    const bytes = Buffer.from(fixture.bytes);
    server.queueRoute("GET", "/trust-centers/center/resources/resource/media", [
      { status: 200, headers: { "content-type": fixture.type }, body: bytes },
    ]);
    await server.start();
    const harness = new McpStdioHarness({
      envOverrides: {
        VANTA_API_BASE_URL: server.baseUrl,
        VANTA_CLIENT_ID: "fake",
        VANTA_CLIENT_SECRET: "fake",
        VANTA_ENV_FILE: undefined,
        VANTA_MCP_DOWNLOAD_DIR: directory,
      },
    });
    t.after(async () => {
      await harness.stop();
      await server.stop();
      await fs.rm(directory, { recursive: true, force: true });
    });
    await harness.start();
    // Initial assert
    assert.ok(
      (await harness.listTools()).includes("get_trust_center_resource_media"),
    );
    assert.deepEqual(await fs.readdir(directory), []);
    // Act
    const result = parseToolEnvelope(
      await harness.callTool("get_trust_center_resource_media", {
        slugId: "center",
        resourceId: "resource",
        downloadFileName: fixture.name,
      }),
    );
    // Assert
    assert.equal(result.success, true);
    assert.equal(
      (result.data as Record<string, unknown>).identityStatus,
      "unknown",
    );
    assert.deepEqual(
      await fs.readFile(path.join(directory, fixture.name)),
      bytes,
    );
  });
}

const failureScenarios: {
  name: string;
  status: number;
  headers: Record<string, string>;
  body: string;
  error: string;
}[] = [
  {
    name: "permission denial",
    status: 403,
    headers: { "content-type": "application/json" },
    body: '{"error":"forbidden"}',
    error: "api_error",
  },
  {
    name: "HTML login page",
    status: 200,
    headers: { "content-type": "text/html" },
    body: "<html>login</html>",
    error: "request_failed",
  },
  {
    name: "truncated content length",
    status: 200,
    headers: {
      "content-type": "application/pdf",
      "content-length": "6",
      "connection": "close",
    },
    body: "abc",
    error: "request_failed",
  },
  {
    name: "redirect",
    status: 302,
    headers: { location: "http://127.0.0.1:1/secret" },
    body: "",
    error: "request_failed",
  },
];
for (const scenario of failureScenarios) {
  test(`download rejects ${scenario.name} without writing a file`, async t => {
    // Arrange
    const directory = await fs.mkdtemp(
      path.join(os.tmpdir(), "vanta-download-test-"),
    );
    const server = new FakeVantaServer();
    server.queueRoute(
      "GET",
      "/documents/doc-1/uploads/upload-1/media",
      Array.from({ length: 3 }, () => ({
        status: scenario.status,
        headers: scenario.headers,
        body: scenario.body,
      })),
    );
    await server.start();
    const harness = new McpStdioHarness({
      envOverrides: {
        VANTA_API_BASE_URL: server.baseUrl,
        VANTA_CLIENT_ID: "fake",
        VANTA_CLIENT_SECRET: "fake",
        VANTA_ENV_FILE: undefined,
        VANTA_MCP_DOWNLOAD_DIR: directory,
        VANTA_MCP_ENABLE_WRITE: "false",
      },
    });
    t.after(async () => {
      await harness.stop();
      await server.stop();
      await fs.rm(directory, { recursive: true, force: true });
    });
    await harness.start();
    // Initial assert
    assert.deepEqual(await fs.readdir(directory), []);
    // Act
    const result = parseToolEnvelope(
      await harness.callTool("get_uploadedfile_media", {
        documentId: "doc-1",
        uploadedFileId: "upload-1",
        downloadFileName: "failure.pdf",
      }),
    );
    // Assert
    assert.equal(result.success, false);
    assert.equal(
      (result.error as Record<string, unknown>).code,
      scenario.error,
    );
    assert.deepEqual(await fs.readdir(directory), []);
  });
}

test("download reads remain available with Vanta writes disabled", async t => {
  // Arrange
  const directory = await fs.mkdtemp(
    path.join(os.tmpdir(), "vanta-download-test-"),
  );
  const server = new FakeVantaServer();
  server.queueRoute("GET", "/documents/doc-1/uploads/upload-1/media", [
    { status: 200, body: Buffer.from([0, 255, 128]) },
  ]);
  await server.start();
  const harness = new McpStdioHarness({
    envOverrides: {
      VANTA_API_BASE_URL: server.baseUrl,
      VANTA_CLIENT_ID: "fake",
      VANTA_CLIENT_SECRET: "fake",
      VANTA_ENV_FILE: undefined,
      VANTA_MCP_DOWNLOAD_DIR: directory,
      VANTA_MCP_ENABLE_WRITE: "false",
    },
  });
  t.after(async () => {
    await harness.stop();
    await server.stop();
    await fs.rm(directory, { recursive: true, force: true });
  });
  await harness.start();
  // Initial assert
  assert.deepEqual(await fs.readdir(directory), []);
  // Act
  const result = parseToolEnvelope(
    await harness.callTool("get_uploadedfile_media", {
      documentId: "doc-1",
      uploadedFileId: "upload-1",
      downloadFileName: "sample.bin",
    }),
  );
  // Assert
  assert.equal(result.success, true);
  assert.deepEqual(
    await fs.readFile(path.join(directory, "sample.bin")),
    Buffer.from([0, 255, 128]),
  );
});

test("media redirects never send credentials to the redirect target", async t => {
  // Arrange
  const directory = await fs.mkdtemp(
    path.join(os.tmpdir(), "vanta-download-test-"),
  );
  const server = new FakeVantaServer();
  await server.start();
  server.queueRoute(
    "GET",
    "/documents/doc-1/uploads/upload-1/media",
    Array.from({ length: 3 }, () => ({
      status: 302,
      headers: { location: `${server.baseUrl}/redirect-target` },
      body: "",
    })),
  );
  server.queueRoute("GET", "/redirect-target", [
    { status: 200, body: "unexpected" },
  ]);
  const harness = new McpStdioHarness({
    envOverrides: {
      VANTA_API_BASE_URL: server.baseUrl,
      VANTA_CLIENT_ID: "fake",
      VANTA_CLIENT_SECRET: "fake",
      VANTA_ENV_FILE: undefined,
      VANTA_MCP_DOWNLOAD_DIR: directory,
    },
  });
  t.after(async () => {
    await harness.stop();
    await server.stop();
    await fs.rm(directory, { recursive: true, force: true });
  });
  await harness.start();
  // Initial assert
  assert.equal(server.getCallCount("GET", "/redirect-target"), 0);
  // Act
  const result = parseToolEnvelope(
    await harness.callTool("get_uploadedfile_media", {
      documentId: "doc-1",
      uploadedFileId: "upload-1",
      downloadFileName: "file.pdf",
    }),
  );
  // Assert
  assert.equal(result.success, false);
  assert.equal(server.getCallCount("GET", "/redirect-target"), 0);
  assert.deepEqual(await fs.readdir(directory), []);
});

test("a rejected rate-limited read retries and produces one intact file", async t => {
  // Arrange
  const directory = await fs.mkdtemp(
    path.join(os.tmpdir(), "vanta-download-test-"),
  );
  const server = new FakeVantaServer();
  const route = "/documents/doc-1/uploads/upload-1/media";
  server.queueRoute("GET", route, [
    {
      status: 429,
      headers: { "retry-after": "0", "content-type": "application/json" },
      body: { error: "rate limited" },
    },
    {
      status: 200,
      headers: { "content-type": "application/pdf" },
      body: Buffer.from([0, 255, 42]),
    },
  ]);
  await server.start();
  const harness = new McpStdioHarness({
    envOverrides: {
      VANTA_API_BASE_URL: server.baseUrl,
      VANTA_CLIENT_ID: "fake",
      VANTA_CLIENT_SECRET: "fake",
      VANTA_ENV_FILE: undefined,
      VANTA_MCP_DOWNLOAD_DIR: directory,
    },
  });
  t.after(async () => {
    await harness.stop();
    await server.stop();
    await fs.rm(directory, { recursive: true, force: true });
  });
  await harness.start();
  // Initial assert
  assert.equal(server.getCallCount("GET", route), 0);
  assert.deepEqual(await fs.readdir(directory), []);
  // Act
  const result = parseToolEnvelope(
    await harness.callTool("get_uploadedfile_media", {
      documentId: "doc-1",
      uploadedFileId: "upload-1",
      downloadFileName: "retry.pdf",
    }),
  );
  // Assert
  assert.equal(result.success, true);
  assert.equal(server.getCallCount("GET", route), 2);
  assert.deepEqual(
    await fs.readFile(path.join(directory, "retry.pdf")),
    Buffer.from([0, 255, 42]),
  );
  assert.deepEqual(await fs.readdir(directory), ["retry.pdf"]);
});
