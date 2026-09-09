import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { invokeGeneratedOperation } from "../tools/endpoint-tools.js";
import { parseToolEnvelope } from "./helpers.js";

for (const outcome of ["success", "api_error", "throw"] as const) {
  test(`converted upload survives body consumption and cleans after ${outcome}`, async () => {
    // Arrange: deterministic converter output, real file-backed multipart body.
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "vanta-lifetime-"));
    const outputDirectory = path.join(directory, "converted");
    fs.mkdirSync(outputDirectory);
    const source = path.join(directory, "evidence.md");
    const output = path.join(outputDirectory, "evidence.pdf");
    fs.writeFileSync(source, "# Evidence");
    fs.writeFileSync(output, "%PDF-test-payload");
    let reads = 0;
    const client = {
      request: async (input: { formData: FormData }) => {
        assert.equal(fs.existsSync(output), true);
        // Consume twice to model retries without a converter/browser dependency.
        for (let i = 0; i < 2; i += 1) {
          const body = await new Response(input.formData).text();
          assert.match(body, /%PDF-test-payload/u);
          reads += 1;
        }
        if (outcome === "throw") throw new Error("connection lost");
        return {
          ok: outcome === "success",
          status: outcome === "success" ? 200 : 500,
          data: {},
          headers: {},
        };
      },
    };
    try {
      // Initial Assert
      assert.equal(reads, 0);
      assert.equal(fs.existsSync(output), true);
      // Act
      const result = await invokeGeneratedOperation(
        "upload_file_for_document",
        {
          documentId: "document-1",
          filePath: source,
          confirm: true,
        },
        client as never,
        async () => ({
          success: true,
          file: {
            absolutePath: output,
            fileName: "evidence.pdf",
            extension: ".pdf",
            mimeType: "application/pdf",
          },
          cleanupPaths: [outputDirectory],
        }),
      );
      // Assert
      assert.equal(parseToolEnvelope(result).success, outcome === "success");
      assert.equal(reads, 2);
      assert.equal(fs.existsSync(outputDirectory), false);
      assert.equal(fs.readFileSync(source, "utf8"), "# Evidence");
    } finally {
      fs.rmSync(directory, { recursive: true, force: true });
    }
  });
}
