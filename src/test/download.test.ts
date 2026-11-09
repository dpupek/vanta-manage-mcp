import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { saveDownload } from "../downloads/download.js";
import { VantaApiClient } from "../client/vanta-client.js";

test("a mismatch retains the downloaded bytes with an explicit mismatch receipt", async t => {
  // Arrange
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "vanta-download-"));
  const old = process.env.VANTA_MCP_DOWNLOAD_DIR;
  process.env.VANTA_MCP_DOWNLOAD_DIR = dir;
  t.after(async () => {
    if (old === undefined) delete process.env.VANTA_MCP_DOWNLOAD_DIR;
    else process.env.VANTA_MCP_DOWNLOAD_DIR = old;
    await fs.rm(dir, { recursive: true, force: true });
  });
  const bytes = Buffer.from([255, 0, 128]);
  const response = new Response(bytes, {
    headers: { "content-type": "image/jpeg" },
  });
  // Initial assert
  assert.deepEqual(await fs.readdir(dir), []);
  // Act
  const receipt = await saveDownload(response, new AbortController().signal, {
    fileName: "image.png",
    expectedSha256: "0".repeat(64),
    operation: "test",
    identifiers: {},
  });
  // Assert
  assert.equal(receipt.identityStatus, "mismatch");
  assert.deepEqual(await fs.readFile(path.join(dir, "image.png")), bytes);
  assert.equal((receipt.warnings as string[]).length, 1);
});

test("an existing destination is not overwritten and the temporary file is removed", async t => {
  // Arrange
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "vanta-download-"));
  const old = process.env.VANTA_MCP_DOWNLOAD_DIR;
  process.env.VANTA_MCP_DOWNLOAD_DIR = dir;
  t.after(async () => {
    if (old === undefined) delete process.env.VANTA_MCP_DOWNLOAD_DIR;
    else process.env.VANTA_MCP_DOWNLOAD_DIR = old;
    await fs.rm(dir, { recursive: true, force: true });
  });
  await fs.writeFile(path.join(dir, "existing.pdf"), "original");
  // Initial assert
  assert.equal(
    await fs.readFile(path.join(dir, "existing.pdf"), "utf8"),
    "original",
  );
  // Act
  await assert.rejects(
    saveDownload(new Response("replacement"), new AbortController().signal, {
      fileName: "existing.pdf",
      operation: "test",
      identifiers: {},
    }),
  );
  // Assert
  assert.equal(
    await fs.readFile(path.join(dir, "existing.pdf"), "utf8"),
    "original",
  );
  assert.deepEqual(await fs.readdir(dir), ["existing.pdf"]);
});

test("an interrupted response removes its partial file", async t => {
  // Arrange
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "vanta-download-"));
  const old = process.env.VANTA_MCP_DOWNLOAD_DIR;
  process.env.VANTA_MCP_DOWNLOAD_DIR = dir;
  t.after(async () => {
    if (old === undefined) delete process.env.VANTA_MCP_DOWNLOAD_DIR;
    else process.env.VANTA_MCP_DOWNLOAD_DIR = old;
    await fs.rm(dir, { recursive: true, force: true });
  });
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(new Uint8Array([1, 2]));
      controller.error(new Error("connection lost"));
    },
  });
  // Initial assert
  assert.deepEqual(await fs.readdir(dir), []);
  // Act
  await assert.rejects(
    saveDownload(new Response(stream), new AbortController().signal, {
      fileName: "partial.pdf",
      operation: "test",
      identifiers: {},
    }),
    /connection lost/u,
  );
  // Assert
  assert.deepEqual(await fs.readdir(dir), []);
});

test("a download exceeding its configured byte limit leaves no file", async t => {
  // Arrange
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "vanta-download-"));
  const oldDir = process.env.VANTA_MCP_DOWNLOAD_DIR;
  const oldLimit = process.env.VANTA_MCP_DOWNLOAD_MAX_BYTES;
  process.env.VANTA_MCP_DOWNLOAD_DIR = dir;
  process.env.VANTA_MCP_DOWNLOAD_MAX_BYTES = "2";
  t.after(async () => {
    if (oldDir === undefined) delete process.env.VANTA_MCP_DOWNLOAD_DIR;
    else process.env.VANTA_MCP_DOWNLOAD_DIR = oldDir;
    if (oldLimit === undefined) delete process.env.VANTA_MCP_DOWNLOAD_MAX_BYTES;
    else process.env.VANTA_MCP_DOWNLOAD_MAX_BYTES = oldLimit;
    await fs.rm(dir, { recursive: true, force: true });
  });
  const response = new Response(new Uint8Array([1, 2, 3]));
  // Initial assert
  assert.deepEqual(await fs.readdir(dir), []);
  // Act
  await assert.rejects(
    saveDownload(response, new AbortController().signal, {
      fileName: "large.pdf",
      operation: "test",
      identifiers: {},
    }),
    /size limit/u,
  );
  // Assert
  assert.deepEqual(await fs.readdir(dir), []);
});

test("a cancelled transfer leaves no artifact", async t => {
  // Arrange
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "vanta-download-"));
  const old = process.env.VANTA_MCP_DOWNLOAD_DIR;
  process.env.VANTA_MCP_DOWNLOAD_DIR = dir;
  t.after(async () => {
    if (old === undefined) delete process.env.VANTA_MCP_DOWNLOAD_DIR;
    else process.env.VANTA_MCP_DOWNLOAD_DIR = old;
    await fs.rm(dir, { recursive: true, force: true });
  });
  const controller = new AbortController();
  controller.abort(new Error("cancelled"));
  // Initial assert
  assert.deepEqual(await fs.readdir(dir), []);
  // Act
  await assert.rejects(
    saveDownload(new Response("bytes"), controller.signal, {
      fileName: "cancelled.pdf",
      operation: "test",
      identifiers: {},
    }),
    /cancelled/u,
  );
  // Assert
  assert.deepEqual(await fs.readdir(dir), []);
});

test("cancellation during publication waits for cleanup before returning", async t => {
  // Arrange
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "vanta-download-"));
  const old = process.env.VANTA_MCP_DOWNLOAD_DIR;
  process.env.VANTA_MCP_DOWNLOAD_DIR = dir;
  t.after(async () => {
    if (old === undefined) delete process.env.VANTA_MCP_DOWNLOAD_DIR;
    else process.env.VANTA_MCP_DOWNLOAD_DIR = old;
    await fs.rm(dir, { recursive: true, force: true });
  });
  const link = fs.link.bind(fs);
  let started!: () => void;
  const linkStarted = new Promise<void>(resolve => {
    started = resolve;
  });
  let release!: () => void;
  const linkReleased = new Promise<void>(resolve => {
    release = resolve;
  });
  t.mock.method(fs, "link", async (...args: Parameters<typeof fs.link>) => {
    started();
    await linkReleased;
    return link(...args);
  });
  const controller = new AbortController();
  const client = new VantaApiClient({
    fetch: async () => new Response("file bytes"),
    tokenManager: {
      getValidToken: async () => "token",
      refreshToken: async () => "token",
    },
  });
  // Initial assert
  assert.deepEqual(await fs.readdir(dir), []);
  assert.equal(controller.signal.aborted, false);
  // Act
  const request = client.request({
    method: "GET",
    path: "/media",
    signal: controller.signal,
    download: (response, signal) =>
      saveDownload(response, signal, {
        fileName: "file.pdf",
        operation: "test",
        identifiers: {},
      }),
  });
  await linkStarted;
  let settled = false;
  void request.then(
    () => {
      settled = true;
    },
    () => {
      settled = true;
    },
  );
  controller.abort(new Error("cancelled during publication"));
  await new Promise<void>(resolve => setImmediate(resolve));
  const settledBeforeRelease = settled;
  release();
  // Assert
  await assert.rejects(request, /cancelled during publication/u);
  assert.equal(settledBeforeRelease, false);
  assert.deepEqual(await fs.readdir(dir), []);
});

test("cancellation while a response body is pending interrupts the read and removes the file", async t => {
  // Arrange
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "vanta-download-"));
  const old = process.env.VANTA_MCP_DOWNLOAD_DIR;
  process.env.VANTA_MCP_DOWNLOAD_DIR = dir;
  t.after(async () => {
    if (old === undefined) delete process.env.VANTA_MCP_DOWNLOAD_DIR;
    else process.env.VANTA_MCP_DOWNLOAD_DIR = old;
    await fs.rm(dir, { recursive: true, force: true });
  });
  let started!: () => void;
  const reading = new Promise<void>(resolve => {
    started = resolve;
  });
  let releasePull!: () => void;
  const pendingPull = new Promise<void>(resolve => {
    releasePull = resolve;
  });
  const stream = new ReadableStream<Uint8Array>({
    pull() {
      started();
      return pendingPull;
    },
    cancel() {
      releasePull();
    },
  });
  const controller = new AbortController();
  const client = new VantaApiClient({
    fetch: async () => new Response(stream),
    tokenManager: {
      getValidToken: async () => "token",
      refreshToken: async () => "token",
    },
  });
  // Initial assert
  assert.deepEqual(await fs.readdir(dir), []);
  // Act
  const request = client.request({
    method: "GET",
    path: "/media",
    signal: controller.signal,
    download: (response, signal) =>
      saveDownload(response, signal, {
        fileName: "pending.pdf",
        operation: "test",
        identifiers: {},
      }),
  });
  await reading;
  controller.abort(new Error("cancelled during read"));
  // Assert
  await assert.rejects(request, /cancelled during read/u);
  assert.deepEqual(await fs.readdir(dir), []);
});

test("a chunked response without MIME metadata saves the exact entity bytes", async t => {
  // Arrange
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "vanta-download-"));
  const old = process.env.VANTA_MCP_DOWNLOAD_DIR;
  process.env.VANTA_MCP_DOWNLOAD_DIR = dir;
  t.after(async () => {
    if (old === undefined) delete process.env.VANTA_MCP_DOWNLOAD_DIR;
    else process.env.VANTA_MCP_DOWNLOAD_DIR = old;
    await fs.rm(dir, { recursive: true, force: true });
  });
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(new Uint8Array([0, 255]));
      controller.enqueue(new Uint8Array([128, 1]));
      controller.close();
    },
  });
  const response = new Response(stream);
  // Initial assert
  assert.equal(response.headers.get("content-type"), null);
  assert.deepEqual(await fs.readdir(dir), []);
  // Act
  const receipt = await saveDownload(response, new AbortController().signal, {
    fileName: "chunks.bin",
    operation: "test",
    identifiers: {},
  });
  // Assert
  assert.equal(receipt.contentType, "application/octet-stream");
  assert.equal(receipt.byteLength, 4);
  assert.deepEqual(
    await fs.readFile(path.join(dir, "chunks.bin")),
    Buffer.from([0, 255, 128, 1]),
  );
});
