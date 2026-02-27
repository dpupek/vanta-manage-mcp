import assert from "node:assert/strict";
import test from "node:test";
import { errorEnvelope } from "../envelope.js";

test("api_error with rate_limit_exceeded includes actionable agentHint", () => {
  // Arrange
  const code = "api_error";
  const message = "Vanta API request failed with status 429.";
  const details = {
    error: "rate_limit_exceeded",
    error_description: "Too Many Requests",
  };

  // Initial Assert
  assert.equal(code, "api_error");

  // Act
  const envelope = errorEnvelope(code, message, undefined, details);

  // Assert
  assert.equal(envelope.success, false);
  assert.match(envelope.error.agentHint ?? "", /Rate limited\./u);
  assert.match(
    envelope.error.agentHint ?? "",
    /resource:\/\/vanta-manage\/troubleshooting/u,
  );
});

test("confirmation_required includes compact agent guidance", () => {
  // Arrange
  const code = "confirmation_required";

  // Initial Assert
  assert.equal(code, "confirmation_required");

  // Act
  const envelope = errorEnvelope(code, "confirm required");

  // Assert
  assert.equal(envelope.success, false);
  assert.match(envelope.error.agentHint ?? "", /confirm=true/u);
  assert.match(
    envelope.error.agentHint ?? "",
    /resource:\/\/vanta-manage\/safety/u,
  );
});

test("explicit agentHint overrides derived hint", () => {
  // Arrange
  const explicitHint = "Use playbook_vendor_triage.";

  // Initial Assert
  assert.equal(explicitHint.length > 0, true);

  // Act
  const envelope = errorEnvelope(
    "api_error",
    "Vanta API request failed with status 429.",
    undefined,
    { error: "rate_limit_exceeded" },
    undefined,
    explicitHint,
  );

  // Assert
  assert.equal(envelope.error.agentHint, explicitHint);
});

test("file upload preflight errors include actionable agentHint", () => {
  // Arrange
  const code = "file_not_found";

  // Initial Assert
  assert.equal(code, "file_not_found");

  // Act
  const envelope = errorEnvelope(code, "File does not exist.");

  // Assert
  assert.equal(envelope.success, false);
  assert.match(
    envelope.error.agentHint ?? "",
    /Correct filePath to an existing local file/u,
  );
  assert.match(
    envelope.error.agentHint ?? "",
    /resource:\/\/vanta-manage\/troubleshooting/u,
  );
});
