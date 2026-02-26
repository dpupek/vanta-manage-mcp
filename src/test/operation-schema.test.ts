import assert from "node:assert/strict";
import test from "node:test";
import { generatedOperations } from "../generated/operations.generated.js";
import { buildOperationSchema } from "../tools/operation-schema.js";

test("mutating operations include optional confirm in schema", () => {
  // Arrange
  const operation = generatedOperations.find(
    candidate =>
      candidate.source === "manage" &&
      candidate.operationId === "CreateCustomControl",
  );
  assert.ok(operation);

  // Initial Assert
  assert.equal(operation.isMutation, true);

  // Act
  const schema = buildOperationSchema(operation);
  const result = schema.safeParse({
    body: {},
  });

  // Assert
  assert.equal(result.success, true);
  assert.ok("confirm" in schema.shape);
});

test("multipart operations expose MCP-friendly file fields", () => {
  // Arrange
  const operation = generatedOperations.find(
    candidate =>
      candidate.source === "manage" &&
      candidate.operationId === "UploadFileForDocument",
  );
  assert.ok(operation);

  // Initial Assert
  assert.equal(operation.requestBody?.kind, "multipart");

  // Act
  const schema = buildOperationSchema(operation);
  const result = schema.safeParse({
    documentId: "doc-1",
    filename: "evidence.txt",
    contentBase64: Buffer.from("hello", "utf8").toString("base64"),
  });

  // Assert
  assert.equal(result.success, true);
  assert.ok("filename" in schema.shape);
  assert.ok("contentBase64" in schema.shape);
});

