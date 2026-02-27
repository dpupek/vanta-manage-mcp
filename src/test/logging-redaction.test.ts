import assert from "node:assert/strict";
import test from "node:test";
import { redactFields, shouldRedactKey } from "../logging/redaction.js";

test("redaction hides sensitive keys recursively and preserves safe values", () => {
  // Arrange
  const input = {
    token: "abc",
    nested: {
      Authorization: "Bearer 123",
      password: "pw",
      plain: "keep",
      deeper: {
        apiKey: "123",
        ok: true,
      },
    },
    contentBase64: "YQ==",
    metadata: {
      count: 3,
      enabled: true,
    },
  };

  // Initial Assert
  assert.equal(input.nested.plain, "keep");

  // Act
  const redacted = redactFields(input);

  // Assert
  assert.equal(redacted.token, "[REDACTED]");
  assert.equal(
    (redacted.nested as Record<string, unknown>).Authorization,
    "[REDACTED]",
  );
  assert.equal(
    (redacted.nested as Record<string, unknown>).password,
    "[REDACTED]",
  );
  assert.equal((redacted.nested as Record<string, unknown>).plain, "keep");
  const deeper = (redacted.nested as Record<string, unknown>).deeper as Record<
    string,
    unknown
  >;
  assert.equal(deeper.apiKey, "[REDACTED]");
  assert.equal(deeper.ok, true);
  assert.equal(redacted.contentBase64, "[REDACTED]");
  assert.equal((redacted.metadata as Record<string, unknown>).count, 3);
});

test("sensitive-key matcher covers expected fragments", () => {
  // Arrange + Initial Assert
  assert.equal(shouldRedactKey("token"), true);

  // Act + Assert
  assert.equal(shouldRedactKey("authorization"), true);
  assert.equal(shouldRedactKey("client_secret"), true);
  assert.equal(shouldRedactKey("cookie"), true);
  assert.equal(shouldRedactKey("safe_key"), false);
});
