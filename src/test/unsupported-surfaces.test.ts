import assert from "node:assert/strict";
import test from "node:test";
import {
  buildUnsupportedOperationEnvelope,
  unsupportedToolMetadata,
} from "../tools/unsupported-tools.js";

test("unsupported policy-control tools return executable UI fallback batches", () => {
  // Arrange
  const tool = unsupportedToolMetadata.find(
    candidate => candidate.name === "add_policy_to_control",
  );
  assert.ok(tool);

  // Initial Assert
  assert.equal(tool.surfaceId, "policy-control-linking");

  // Act
  const envelope = buildUnsupportedOperationEnvelope(tool, {
    controlId: "control-1",
    policyId: "policy-1",
  });

  // Assert
  assert.equal(envelope.success, false);
  assert.equal(envelope.error.code, "unsupported_operation");
  assert.ok(Array.isArray(envelope.error.details?.fallbackActionBatch));
  assert.match(envelope.error.agentHint ?? "", /Vanta UI/i);
});

test("unsupported test comments recommend the control-note fallback", () => {
  // Arrange
  const tool = unsupportedToolMetadata.find(
    candidate => candidate.name === "add_test_comment",
  );
  assert.ok(tool);

  // Initial Assert
  assert.equal(tool.surfaceId, "test-comments");

  // Act
  const envelope = buildUnsupportedOperationEnvelope(tool, {
    testId: "test-1",
    comment: "Progress note",
  });

  // Assert
  assert.equal(envelope.success, false);
  assert.equal(envelope.error.code, "unsupported_operation");
  assert.match(envelope.error.hint ?? "", /control note/i);
});
