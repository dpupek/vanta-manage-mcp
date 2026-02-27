import assert from "node:assert/strict";
import test from "node:test";
import { generatedOperations } from "../generated/operations.generated.js";
import { uploadPolicyByToolName } from "../uploads/policy.js";

test("multipart upload tools with file fields have explicit endpoint policies", () => {
  // Arrange
  const fileUploadTools = generatedOperations
    .filter(
      operation =>
        operation.requestBody?.kind === "multipart" &&
        Boolean(operation.requestBody.fileFieldName),
    )
    .map(operation => operation.toolName);

  // Initial Assert
  assert.ok(fileUploadTools.length > 0);

  // Act
  const missingPolicies = fileUploadTools.filter(
    toolName => !Object.hasOwn(uploadPolicyByToolName, toolName),
  );

  // Assert
  assert.deepEqual(missingPolicies, []);
});
