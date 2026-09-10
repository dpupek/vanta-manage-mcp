import assert from "node:assert/strict";
import test from "node:test";
import { generatedOperations } from "../generated/operations.generated.js";
import { uploadPolicyByToolName } from "../uploads/policy.js";
import { extensionToMimeType } from "../uploads/file-validation.js";

test("contract uploads restrict evidence to PDF and favicon uploads support ICO", () => {
  // Arrange
  const contract = uploadPolicyByToolName.upload_contract;
  const favicon = uploadPolicyByToolName.upload_trust_center_favicon;
  // Initial Assert
  assert.ok(contract);
  assert.ok(favicon);
  // Act
  const contractTypes = contract.allowedExtensions;
  const iconSupported = favicon.allowedExtensions.includes(".ico");
  // Assert
  assert.deepEqual(contractTypes, [".pdf"]);
  assert.deepEqual(contract.allowedMimeTypes, ["application/pdf"]);
  assert.equal(iconSupported, true);
  assert.equal(extensionToMimeType[".ico"], "image/vnd.microsoft.icon");
});

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
