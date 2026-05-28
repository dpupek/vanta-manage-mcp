import assert from "node:assert/strict";
import test from "node:test";
import { errorEnvelope, successEnvelope } from "../envelope.js";

test("success envelopes include agent-safe common metadata", () => {
  // Arrange
  const data = {
    results: {
      pageInfo: {
        hasNextPage: true,
        endCursor: "cursor-2",
      },
    },
  };

  // Initial Assert
  assert.equal(data.results.pageInfo.hasNextPage, true);

  // Act
  const envelope = successEnvelope(data, "listed");

  // Assert
  assert.equal(envelope.success, true);
  assert.deepEqual(envelope.warnings, []);
  assert.equal(typeof envelope.correlationId, "string");
  assert.equal(typeof envelope.tenant.label, "string");
  assert.deepEqual(envelope.pagination, {
    hasMore: true,
    pageCursor: "cursor-2",
  });
});

test("error envelopes include hints, warnings, correlation, and tenant identity", () => {
  // Arrange
  const details = {
    surface: "policy-control-linking",
  };

  // Initial Assert
  assert.equal(details.surface, "policy-control-linking");

  // Act
  const envelope = errorEnvelope(
    "unsupported_operation",
    "Policy-control linking is not exposed by the public Vanta API.",
    "Use the Vanta UI fallback.",
    details,
  );

  // Assert
  assert.equal(envelope.success, false);
  assert.deepEqual(envelope.warnings, []);
  assert.equal(typeof envelope.correlationId, "string");
  assert.equal(typeof envelope.tenant.label, "string");
  assert.equal(envelope.error.code, "unsupported_operation");
  assert.match(envelope.error.agentHint ?? "", /fallback/i);
});
