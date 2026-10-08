import assert from "node:assert/strict";
import test from "node:test";
import { generatedOperations } from "../generated/operations.generated.js";
import { buildOperationSchema } from "../tools/operation-schema.js";
import { invokeGeneratedOperation } from "../tools/endpoint-tools.js";
import { parseToolEnvelope } from "./helpers.js";
import { buildHelpCatalog } from "../help/catalog.js";
import { buildHelpResourceMarkdown } from "../help/content.js";

const schemaFor = (name: string) => {
  const operation = generatedOperations.find(
    candidate => candidate.toolName === name,
  );
  assert.ok(operation);
  return buildOperationSchema(operation);
};

const contractCases = [
  {
    name: "control details accept text",
    tool: "update_control_metadata",
    input: {
      controlId: "c-1",
      body: { implementationDetails: "Quarterly review" },
    },
    valid: true,
  },
  {
    name: "control details reject null",
    tool: "update_control_metadata",
    input: { controlId: "c-1", body: { implementationDetails: null } },
    valid: false,
  },
  {
    name: "notification channels allow an explicit empty set",
    tool: "update_settings",
    input: { body: { channels: [] } },
    valid: true,
  },
  {
    name: "notification frequency allows NEVER",
    tool: "update_settings",
    input: { body: { frequency: "NEVER" } },
    valid: true,
  },
  {
    name: "notification channels reject unknown names",
    tool: "update_settings",
    input: { body: { channels: ["TEAMS"] } },
    valid: false,
  },
  {
    name: "notification settings reject response-shaped input",
    tool: "update_settings",
    input: { body: { enabled: true, employeeDigestFrequency: "WEEKLY" } },
    valid: false,
  },
  {
    name: "risk mappings accept 100 IDs",
    tool: "add_vendor_finding_mappings",
    input: {
      riskScenarioId: "r-1",
      body: {
        vendorFindingIdsToLink: Array.from(
          { length: 100 },
          (_, i) => `finding-${i.toString()}`,
        ),
      },
    },
    valid: true,
  },
  {
    name: "risk mapping add rejects 101 IDs",
    tool: "add_vendor_finding_mappings",
    input: {
      riskScenarioId: "r-1",
      body: {
        vendorFindingIdsToLink: Array.from(
          { length: 101 },
          (_, i) => `finding-${i.toString()}`,
        ),
      },
    },
    valid: false,
  },
  {
    name: "risk mapping remove rejects 101 IDs",
    tool: "remove_vendor_finding_mappings",
    input: {
      riskScenarioId: "r-1",
      body: {
        vendorFindingIdsToUnlink: Array.from(
          { length: 101 },
          (_, i) => `finding-${i.toString()}`,
        ),
      },
    },
    valid: false,
  },
  {
    name: "risk mapping add rejects the unlink key",
    tool: "add_vendor_finding_mappings",
    input: {
      riskScenarioId: "r-1",
      body: { vendorFindingIdsToUnlink: ["f-1"] },
    },
    valid: false,
  },
  {
    name: "risk mapping remove rejects the link key",
    tool: "remove_vendor_finding_mappings",
    input: { riskScenarioId: "r-1", body: { vendorFindingIdsToLink: ["f-1"] } },
    valid: false,
  },
  {
    name: "denial preserves explicit sendEmail false",
    tool: "deny_trust_center_access_request",
    input: { slugId: "tc", accessRequestId: "a-1", body: { sendEmail: false } },
    valid: true,
  },
  {
    name: "denial rejects a string sendEmail",
    tool: "deny_trust_center_access_request",
    input: {
      slugId: "tc",
      accessRequestId: "a-1",
      body: { sendEmail: "false" },
    },
    valid: false,
  },
  {
    name: "people scope filters require ID arrays",
    tool: "list_people",
    input: { businessUnitIdMatchesAny: "bu-1" },
    valid: false,
  },
];

for (const fixture of contractCases) {
  test(fixture.name, () => {
    // Arrange
    const schema = schemaFor(fixture.tool);
    // Initial Assert
    assert.ok(Object.keys(schema.shape).length > 0);
    // Act
    const result = schema.safeParse(fixture.input);
    // Assert
    assert.equal(result.success, fixture.valid);
    if (result.success) assert.deepEqual(result.data, fixture.input);
  });
}

for (const tool of [
  "create_compliance_framework",
  "update_compliance_framework",
]) {
  for (const standard of ["aiuc1_26q3", "atc", "fedramp20x_classA"]) {
    test(`${tool} accepts ${standard}`, () => {
      // Arrange
      const schema = schemaFor(tool);
      const input = {
        slugId: "tc",
        frameworkId: "f-1",
        body: { name: "Framework", standard },
      };
      // Initial Assert
      assert.ok("body" in schema.shape);
      // Act
      const result = schema.safeParse(input);
      // Assert
      assert.equal(result.success, true);
      assert.equal(
        (result.data.body as Record<string, unknown>).standard,
        standard,
      );
    });
  }
}

test("audit request linkedControlIds is forwarded independently of deprecated fields", async () => {
  // Arrange
  const calls: unknown[] = [];
  const client = {
    request: async (request: unknown) => {
      calls.push(request);
      return { status: 200, ok: true, data: { id: "request-1" }, headers: {} };
    },
  };
  // Initial Assert
  assert.equal(calls.length, 0);
  // Act
  const result = await invokeGeneratedOperation(
    "update_information_request",
    {
      auditId: "audit-1",
      requestId: "request-1",
      body: { linkedControlIds: ["control-1", "control-2"] },
      confirm: true,
    },
    client as never,
  );
  // Assert
  assert.equal(parseToolEnvelope(result).success, true);
  assert.deepEqual(calls, [
    {
      source: "audit",
      method: "patch",
      path: "/audits/audit-1/information-requests/request-1",
      query: {},
      body: { linkedControlIds: ["control-1", "control-2"] },
      formData: undefined,
    },
  ]);
});

const timestamp = "2026-10-08T12:00:00Z";
const resourceBase = {
  displayName: "Fixture",
  uniqueId: "fixture-1",
  externalUrl: "https://example.com/fixture",
};
const vulnerabilityBase = {
  severity: 5,
  vulnerableComponentUniqueId: "component-1",
  description: "Fixture finding",
  remediationInstructions: "Apply patch",
  cveId: null,
  cvss3Vector: null,
  cvss3Score: null,
};
const deviceBase = {
  collectedTimestamp: timestamp,
  osName: "Fixture OS",
  osVersion: "1",
  hardwareUuid: "hardware-1",
  serialNumber: "serial-1",
  browserExtensions: [],
  systemScreenlockPolicies: [],
  isManaged: true,
  autoUpdatesEnabled: true,
  owner: null,
  passwordPolicy: null,
  lastEnrolledTimestamp: null,
};
const deviceUser = {
  username: "fixture",
  lastLoginTimestamp: null,
  screenlockPolicies: [],
  screenlockSettings: { requiresPassword: true, screenSleepTimeoutMs: 60000 },
};
const connectorCases = [
  {
    kind: "api_endpoint_vulnerability_connectors",
    resource: {
      ...vulnerabilityBase,
      url: "https://example.com/api",
      httpMethod: "GET",
      occurrences: [
        {
          description: "Occurrence",
          fromUrl: null,
          queryParams: null,
          headers: null,
          body: null,
        },
      ],
    },
  },
  {
    kind: "background_check_connector",
    resource: {
      fullName: "Fixture Person",
      email: "fixture@example.com",
      status: "COMPLETE",
      completionDate: null,
    },
  },
  {
    kind: "macos_user_computer",
    resource: {
      ...deviceBase,
      isXProtectEnabled: null,
      applications: [
        { name: "App", bundleId: "example.app", lastOpenedTimestamp: null },
      ],
      drives: [
        {
          name: "Disk",
          encrypted: true,
          filevaultEnabled: true,
          isBootVolume: null,
        },
      ],
      users: [deviceUser],
    },
  },
  {
    kind: "package_vulnerability_connectors",
    resource: {
      ...vulnerabilityBase,
      packageName: "fixture",
      packageVersion: "1",
      isResolvable: true,
      isReachable: null,
    },
  },
  {
    kind: "secret",
    resource: {
      name: "Synthetic fixture",
      description: "No credential content",
      createdTimestamp: timestamp,
      creator: "fixture",
      owner: "fixture",
      updatedTimestamp: null,
      lastAccessedTimestamp: null,
      expiresTimestamp: null,
    },
  },
  {
    kind: "security_task",
    resource: {
      taskId: "task-1",
      taskTitle: "Fixture task",
      createdTimestamp: timestamp,
      taskState: "OPEN",
      priority: "P1",
      assignees: [],
      creator: "fixture",
      labels: [],
      closedTimestamp: null,
      updatedTimestamp: null,
    },
  },
  {
    kind: "static_analysis_code_vulnerability_connectors",
    resource: {
      ...vulnerabilityBase,
      occurrences: [],
      confidence: 5,
      isResolvable: true,
    },
  },
  {
    kind: "user_account",
    resource: {
      fullName: "Fixture Person",
      accountName: "fixture",
      email: "fixture@example.com",
      permissionLevel: "BASE",
      createdTimestamp: timestamp,
      status: "ACTIVE",
      mfaEnabled: null,
      mfaMethods: [],
      authMethod: "SSO",
      roleDescription: null,
      updatedTimestamp: null,
      deactivatedTimestamp: null,
      lastLoginTimestamp: null,
      lastPasswordResetTimestamp: null,
      groupIds: null,
    },
  },
  {
    kind: "user_security_training_status",
    resource: {
      trainingId: "training-1",
      trainingName: "Fixture training",
      frameworksFulfilled: [],
      traineeFullName: "Fixture Person",
      traineeAccountName: "fixture",
      traineeEmail: "fixture@example.com",
      status: "COMPLETE",
      trainingCreatedTimestamp: timestamp,
      trainingDueTimestamp: timestamp,
      trainingCompletedTimestamp: null,
    },
  },
  {
    kind: "windows_user_computer",
    resource: {
      ...deviceBase,
      windowsSecurityProducts: null,
      windowsSecurityCenter: null,
      programs: [{ name: "App", lastOpenedTimestamp: null }],
      drives: [{ name: "Disk", encrypted: true, isBootVolume: null }],
      users: [deviceUser],
    },
  },
];

for (const fixture of connectorCases) {
  test(`${fixture.kind} preserves nullable fields during connector dispatch`, async () => {
    // Arrange
    const calls: Record<string, unknown>[] = [];
    const client = {
      request: async (request: Record<string, unknown>) => {
        calls.push(request);
        return { status: 200, ok: true, data: {}, headers: {} };
      },
    };
    const body = {
      resourceId: "resource-1",
      resources: [{ ...resourceBase, ...fixture.resource }],
    };
    // Initial Assert
    assert.equal(calls.length, 0);
    assert.ok(Object.values(fixture.resource).includes(null));
    // Act
    const result = await invokeGeneratedOperation(
      `connector_put_${fixture.kind}`,
      { body, confirm: true },
      client as never,
    );
    // Assert
    assert.equal(
      parseToolEnvelope(result).success,
      true,
      JSON.stringify(parseToolEnvelope(result)),
    );
    assert.equal(calls.length, 1);
    assert.equal(calls[0].method, "put");
    assert.equal(calls[0].path, `/v1/resources/${fixture.kind}`);
    assert.deepEqual(calls[0].body, body);
  });
}

test("nullable connector mfaEnabled remains required", () => {
  // Arrange
  const fixture = connectorCases.find(
    candidate => candidate.kind === "user_account",
  );
  assert.ok(fixture);
  const resource: Record<string, unknown> = {
    ...resourceBase,
    ...fixture.resource,
  };
  delete resource.mfaEnabled;
  const schema = schemaFor("connector_put_user_account");
  // Initial Assert
  assert.equal("mfaEnabled" in resource, false);
  // Act
  const result = schema.safeParse({
    body: { resourceId: "resource-1", resources: [resource] },
  });
  // Assert
  assert.equal(result.success, false);
});

const helpContext = () => ({
  catalog: buildHelpCatalog(),
  safeModeEnabled: true,
  writeEnabled: true,
  hasEnabledToolFilter: false,
  enabledToolNames: [],
});

test("generated help lists every endpoint exactly once", () => {
  // Arrange
  const context = helpContext();
  // Initial Assert
  assert.equal(context.catalog.summary.byCategory.generated_endpoint, 333);
  // Act
  const text = buildHelpResourceMarkdown(
    "resource://vanta-manage/tool-catalog",
    context,
  );
  // Assert
  const rows = [
    ...text.matchAll(/^\| `([^`]+)` \| (manage|audit|connectors) \|/gm),
  ].map(match => match[1]);
  assert.equal(rows.length, 333);
  assert.deepEqual(
    new Set(rows),
    new Set(generatedOperations.map(operation => operation.toolName)),
  );
});

test("new generated help examples match registered schemas and confirmation requirements", () => {
  // Arrange
  const text = buildHelpResourceMarkdown(
    "resource://vanta-manage/cheatsheet",
    helpContext(),
  );
  const examples = [...text.matchAll(/```json\n([\s\S]*?)\n```/g)].map(
    match =>
      JSON.parse(match[1]) as { tool: string; input: Record<string, unknown> },
  );
  const names = [
    "update_control_metadata",
    "update_settings",
    "add_vendor_finding_mappings",
  ];
  const selected = examples.filter(example => names.includes(example.tool));
  // Initial Assert
  assert.equal(selected.length, names.length);
  // Act
  const parsed = selected.map(example =>
    schemaFor(example.tool).parse(example.input),
  );
  // Assert
  assert.deepEqual(
    parsed,
    selected.map(example => example.input),
  );
  assert.ok(parsed.every(input => input.confirm === true));
});
