import { createHash, randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { tenantIdentity } from "../config.js";

const paths = new Set([
  "/documents/{documentId}/uploads/{uploadedFileId}/media",
  "/trust-centers/{slugId}/resources/{resourceId}/media",
]);

export const isDownloadOperation = (operation: {
  source: string;
  method: string;
  path: string;
}): boolean =>
  operation.source === "manage" &&
  operation.method.toLowerCase() === "get" &&
  paths.has(operation.path);

export async function saveDownload(
  response: Response,
  signal: AbortSignal,
  options: {
    fileName: string;
    expectedSha256?: string;
    operation: string;
    identifiers: Record<string, unknown>;
  },
): Promise<Record<string, unknown>> {
  const name = options.fileName;
  if (
    name !== path.basename(name) ||
    name === "." ||
    name === ".." ||
    /[<>:"/\\|?*]/u.test(name) ||
    [...name].some(character => character.charCodeAt(0) < 32) ||
    /[. ]$/u.test(name) ||
    /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/iu.test(name)
  ) {
    throw new Error(
      "downloadFileName must be a safe file name without a path.",
    );
  }
  const configuredLimit = Number(
    process.env.VANTA_MCP_DOWNLOAD_MAX_BYTES ?? 104857600,
  );
  if (!Number.isSafeInteger(configuredLimit) || configuredLimit < 1)
    throw new Error("Invalid VANTA_MCP_DOWNLOAD_MAX_BYTES.");
  const root = path.resolve(
    process.env.VANTA_MCP_DOWNLOAD_DIR ??
      path.join(os.homedir(), "VantaMcpDownloads"),
  );
  await fs.mkdir(root, { recursive: true });
  const resolvedRoot = await fs.realpath(root);
  const destination = path.join(resolvedRoot, name);
  const temporary = path.join(resolvedRoot, `.vanta-${randomUUID()}.part`);
  const file = await fs.open(temporary, "wx", 0o600);
  let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;
  let completed = false;
  let published = false;
  const cancelReader = () => {
    void reader?.cancel().catch(() => undefined);
  };
  signal.addEventListener("abort", cancelReader, { once: true });
  try {
    const type =
      response.headers.get("content-type") ?? "application/octet-stream";
    if (/text\/html/iu.test(type))
      throw new Error(
        "The server returned HTML instead of a downloadable artifact.",
      );
    const hash = createHash("sha256");
    let length = 0;
    if (!response.body) throw new Error("Download response has no body.");
    reader = response.body.getReader();
    for (;;) {
      signal.throwIfAborted();
      const { done, value } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > configuredLimit)
        throw new Error("Download exceeds configured size limit.");
      hash.update(value);
      await file.writeFile(value);
    }
    signal.throwIfAborted();
    await file.close();
    signal.throwIfAborted();
    await fs.link(temporary, destination);
    published = true;
    signal.throwIfAborted();
    completed = true;
    const sha256 = hash.digest("hex");
    const warnings: string[] = [];
    if (/\.png$/iu.test(name) && /image\/jpeg/iu.test(type))
      warnings.push("The filename suggests PNG but the response is JPEG.");
    return {
      tenant: tenantIdentity,
      operation: options.operation,
      identifiers: options.identifiers,
      retrievedAt: new Date().toISOString(),
      fileName: name,
      path: destination,
      contentType: type,
      byteLength: length,
      sha256,
      expectedSha256: options.expectedSha256 ?? null,
      transferStatus: "complete",
      identityStatus: options.expectedSha256
        ? sha256 === options.expectedSha256.toLowerCase()
          ? "match"
          : "mismatch"
        : "unknown",
      warnings,
    };
  } finally {
    signal.removeEventListener("abort", cancelReader);
    if (!completed) await reader?.cancel().catch(() => undefined);
    await file.close().catch(() => undefined);
    try {
      if (published && !completed) await fs.unlink(destination);
    } finally {
      await fs.unlink(temporary).catch(() => undefined);
    }
  }
}
