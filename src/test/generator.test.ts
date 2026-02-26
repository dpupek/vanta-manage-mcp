import assert from "node:assert/strict";
import test from "node:test";
import {
  generatedOperationCount,
  generatedOperations,
  generatedStats,
} from "../generated/operations.generated.js";

test("generated parity count matches per-spec totals", () => {
  // Arrange
  const expectedTotal =
    generatedStats.manage.operations +
    generatedStats.audit.operations +
    generatedStats.connectors.operations;

  // Initial Assert
  assert.equal(generatedStats.manage.operations, 164);
  assert.equal(generatedStats.audit.operations, 31);
  assert.equal(generatedStats.connectors.operations, 24);

  // Act
  const actualTotal = generatedOperationCount;

  // Assert
  assert.equal(actualTotal, expectedTotal);
  assert.equal(actualTotal, 219);
});

test("collision operationIds map to deterministic names", () => {
  // Arrange
  const auditCreateCustom = generatedOperations.find(
    operation =>
      operation.source === "audit" &&
      operation.operationId === "CreateCustomControl",
  );
  const manageCreateCustom = generatedOperations.find(
    operation =>
      operation.source === "manage" &&
      operation.operationId === "CreateCustomControl",
  );
  const auditListVulnerabilities = generatedOperations.find(
    operation =>
      operation.source === "audit" &&
      operation.operationId === "ListVulnerabilities",
  );
  const manageListVulnerabilities = generatedOperations.find(
    operation =>
      operation.source === "manage" &&
      operation.operationId === "ListVulnerabilities",
  );

  // Initial Assert
  assert.ok(auditCreateCustom);
  assert.ok(manageCreateCustom);
  assert.ok(auditListVulnerabilities);
  assert.ok(manageListVulnerabilities);

  // Act
  const names = {
    auditCreateCustom: auditCreateCustom.toolName,
    manageCreateCustom: manageCreateCustom.toolName,
    auditListVulnerabilities: auditListVulnerabilities.toolName,
    manageListVulnerabilities: manageListVulnerabilities.toolName,
  };

  // Assert
  assert.equal(names.manageCreateCustom, "create_custom_control");
  assert.equal(names.auditCreateCustom, "audit_create_custom_control");
  assert.equal(names.manageListVulnerabilities, "list_vulnerabilities");
  assert.equal(names.auditListVulnerabilities, "audit_list_vulnerabilities");
});

test("all generated tool names are unique and MCP-safe", () => {
  // Arrange
  const seen = new Set<string>();

  // Initial Assert
  assert.equal(seen.size, 0);

  // Act + Assert
  for (const operation of generatedOperations) {
    assert.ok(/^[a-z0-9_]+$/.test(operation.toolName));
    assert.ok(!operation.toolName.includes("."));
    assert.ok(!seen.has(operation.toolName));
    seen.add(operation.toolName);
  }
});

