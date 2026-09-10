import assert from "node:assert/strict";
import test from "node:test";
import { buildInputSchema } from "../tools/input-schema.js";
import { buildOperationSchema } from "../tools/operation-schema.js";
import { generatedOperations } from "../generated/operations.generated.js";
import { invokeGeneratedOperation } from "../tools/endpoint-tools.js";
import { parseToolEnvelope } from "./helpers.js";

const findOperation = (name: string) => {
  const operation = generatedOperations.find(op => op.toolName === name);
  assert.ok(operation);
  return operation;
};

test("refreshed risk-control contract retains tool name and rejects legacy batch payload", () => {
  // Arrange
  const operation = findOperation("link_controls_to_risk_scenario");
  const schema = buildOperationSchema(operation);
  // Initial Assert
  assert.equal(operation.operationId, "CreateRiskScenarioControl");
  // Act
  const current = schema.safeParse({
    riskScenarioId: "risk-1",
    body: { controlId: "control-1", controlType: "TREATMENT_PLAN" },
  });
  const legacy = schema.safeParse({
    riskScenarioId: "risk-1",
    body: { controlLinks: [{ controlId: "control-1", linkType: "TREATMENT" }] },
  });
  // Assert
  assert.equal(current.success, true);
  assert.equal(legacy.success, false);
});

test("new optional denial body preserves bodyless calls", () => {
  // Arrange
  const operation = findOperation("deny_trust_center_access_request");
  const schema = buildOperationSchema(operation);
  const ids = Object.fromEntries(
    operation.parameters
      .filter(p => p.required)
      .map(p => [p.name, "fixture-id"]),
  );
  // Initial Assert
  assert.equal(operation.requestBody?.required, false);
  // Act
  const results = [
    schema.safeParse(ids),
    schema.safeParse({ ...ids, body: { reason: "Reviewed denial" } }),
  ];
  // Assert
  assert.ok(results.every(result => result.success));
});

test("generated list schemas reject invalid enums and page limits", () => {
  // Arrange
  const operation = findOperation("list_tests");
  const schema = buildOperationSchema(operation);
  // Initial Assert
  assert.ok(
    operation.parameters.some(parameter => parameter.name === "statusFilter"),
  );
  // Act
  const results = [
    { pageSize: 100, statusFilter: "NEEDS_ATTENTION" },
    { pageSize: 200 },
    { pageSize: 0 },
    { statusFilter: "BANANA" },
  ].map(args => schema.safeParse(args).success);
  // Assert
  assert.deepEqual(results, [true, false, false, false]);
});

test("generated nested request contracts preserve required fields and array limits", () => {
  // Arrange
  const schema = buildOperationSchema(
    findOperation("deactivate_vulnerabilities"),
  );
  const update = {
    id: "vuln-1",
    deactivateReason: "Accepted exception",
    shouldReactivateWhenFixable: true,
  };
  // Initial Assert
  assert.equal(update.shouldReactivateWhenFixable, true);
  // Act
  const results = [
    { updates: [update] },
    { updates: [{ id: "vuln-1" }] },
    { updates: [] },
    { updates: Array.from({ length: 51 }, () => update) },
    { updates: [{ ...update, deactivateReason: "" }] },
    { updates: [{ ...update, accidentalField: true }] },
  ].map(body => schema.safeParse({ body }).success);
  // Assert
  assert.deepEqual(results, [true, false, false, false, false, false]);
});

test("nullable referenced fields retain values without stripping nested data", () => {
  // Arrange
  const schema = buildOperationSchema(findOperation("update_vendor"));
  const args = {
    vendorId: "vendor-1",
    body: {
      websiteUrl: null,
      authDetails: { method: null, passwordRequiresSymbol: true },
    },
  };
  // Initial Assert
  assert.equal(args.body.authDetails.method, null);
  // Act
  const result = schema.parse(args);
  // Assert
  assert.deepEqual(result, args);
});

test("schema compositions enforce oneOf, anyOf, allOf, and recursive references", () => {
  // Arrange
  const one = buildInputSchema(
    { oneOf: [{ type: "number" }, { type: "integer" }] },
    {},
  );
  const any = buildInputSchema(
    { anyOf: [{ type: "string", minLength: 2 }, { type: "boolean" }] },
    {},
  );
  const all = buildInputSchema(
    {
      allOf: [
        { type: "number", minimum: 1 },
        { type: "number", maximum: 3 },
      ],
    },
    {},
  );
  const tree = buildInputSchema(
    { $ref: "#/components/schemas/Tree" },
    {
      Tree: {
        type: "object",
        required: ["name"],
        properties: {
          name: { type: "string" },
          child: { $ref: "#/components/schemas/Tree", nullable: true },
        },
      },
    },
  );
  // Initial Assert
  assert.equal(typeof tree.safeParse, "function");
  // Act
  const results = [
    one.safeParse(1).success,
    one.safeParse(1.5).success,
    any.safeParse(true).success,
    any.safeParse("x").success,
    all.safeParse(2).success,
    all.safeParse(4).success,
    tree.safeParse({ name: "a", child: { name: "b", child: null } }).success,
    tree.safeParse({ name: "a", child: {} }).success,
  ];
  // Assert
  assert.deepEqual(results, [
    false,
    true,
    true,
    false,
    true,
    false,
    true,
    false,
  ]);
});

test("internal endpoint dispatch rejects nested invalid payload before HTTP", async () => {
  // Arrange
  let calls = 0;
  const client = {
    request: async () => {
      calls += 1;
      throw new Error("HTTP must not run");
    },
  };
  // Initial Assert
  assert.equal(calls, 0);
  // Act
  const result = await invokeGeneratedOperation(
    "deactivate_vulnerabilities",
    { body: { updates: [{ id: "vuln-1" }] }, confirm: true },
    client as never,
  );
  // Assert
  assert.equal(parseToolEnvelope(result).success, false);
  assert.equal(calls, 0);
  assert.match(
    result.content[0].type === "text" ? result.content[0].text : "",
    /deactivateReason/u,
  );
});

test("all generated schemas construct successfully", () => {
  // Arrange
  const operations = generatedOperations;
  // Initial Assert
  assert.equal(operations.length, 323);
  // Act
  const schemas = operations.map(buildOperationSchema);
  // Assert
  assert.equal(schemas.length, 323);
  assert.ok(schemas.every(schema => typeof schema.safeParse === "function"));
});
