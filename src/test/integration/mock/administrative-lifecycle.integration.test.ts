import assert from "node:assert/strict";
import test, { TestContext } from "node:test";
import { parseToolEnvelope } from "../../helpers.js";
import { FakeVantaServer } from "./fake-vanta-server.js";
import { McpStdioHarness } from "./mcp-stdio-harness.js";

const start = async (t: TestContext, server: FakeVantaServer) => {
  await server.start();
  const harness = new McpStdioHarness({
    envOverrides: {
      VANTA_API_BASE_URL: server.baseUrl,
      VANTA_CLIENT_ID: "fake",
      VANTA_CLIENT_SECRET: "fake",
      VANTA_ENV_FILE: undefined,
      VANTA_MCP_ENABLE_WRITE: "true",
      VANTA_MCP_SAFE_MODE: "true",
    },
  });
  t.after(async () => {
    await harness.stop();
    await server.stop();
  });
  await harness.start();
  return harness;
};

test("vendor alert settings update preserves omitted settings and other categories", async t => {
  // Arrange
  const server = new FakeVantaServer();
  const route = "/vendor-alert-settings";
  let items = [
    {
      category: "Vulnerabilities",
      isEnabled: true,
      severitySetting: "HIGH_CRITICAL",
      riskLevelSetting: "ANY",
    },
    {
      category: "Security incidents",
      isEnabled: true,
      severitySetting: "HIGH_CRITICAL",
      riskLevelSetting: "ANY",
    },
  ];
  server.setRoute("GET", route, () => ({ status: 200, body: { items } }));
  server.setRoute("PATCH", route, request => {
    const changes = (
      request.jsonBody as {
        changes: { category: string; isEnabled?: boolean }[];
      }
    ).changes;
    items = items.map(item => ({
      ...item,
      ...changes.find(change => change.category === item.category),
    }));
    return { status: 200, body: { items } };
  });
  const harness = await start(t, server);
  const before = parseToolEnvelope(
    await harness.callTool("get_vendor_alert_settings", {}),
  );
  // Initial assert
  assert.deepEqual((before.data as { items: unknown[] }).items, items);
  assert.equal(server.getCallCount("PATCH", route), 0);
  // Act
  const result = parseToolEnvelope(
    await harness.callTool("update_vendor_alert_settings", {
      body: { changes: [{ category: "Vulnerabilities", isEnabled: false }] },
      confirm: true,
    }),
  );
  // Assert
  assert.equal(result.success, true);
  assert.deepEqual(server.getCalls("PATCH", route)[0].jsonBody, {
    changes: [{ category: "Vulnerabilities", isEnabled: false }],
  });
  const after = parseToolEnvelope(
    await harness.callTool("get_vendor_alert_settings", {}),
  );
  assert.deepEqual((after.data as { items: unknown[] }).items, [
    {
      category: "Vulnerabilities",
      isEnabled: false,
      severitySetting: "HIGH_CRITICAL",
      riskLevelSetting: "ANY",
    },
    {
      category: "Security incidents",
      isEnabled: true,
      severitySetting: "HIGH_CRITICAL",
      riskLevelSetting: "ANY",
    },
  ]);
});

for (const change of [
  {
    label: "rename",
    body: { label: "New label" },
    expected: { label: "New label", description: "Keep me" },
  },
  {
    label: "clear description",
    body: { description: null },
    expected: { label: "Old label", description: null },
  },
]) {
  test(`vendor category ${change.label} honors omitted versus null fields`, async t => {
    // Arrange
    const server = new FakeVantaServer();
    const route = "/vendor-categories/category-1";
    let state = {
      id: "category-1",
      label: "Old label",
      description: "Keep me" as string | null,
      isSystem: false,
    };
    server.setRoute("GET", route, () => ({ status: 200, body: { ...state } }));
    server.setRoute("PATCH", route, request => {
      state = { ...state, ...(request.jsonBody as typeof change.body) };
      return { status: 200, body: { ...state } };
    });
    const harness = await start(t, server);
    const before = parseToolEnvelope(
      await harness.callTool("get_vendor_category_by_id", {
        categoryId: "category-1",
      }),
    );
    // Initial assert
    assert.equal((before.data as typeof state).description, "Keep me");
    assert.equal(server.getCallCount("PATCH", route), 0);
    // Act
    const result = parseToolEnvelope(
      await harness.callTool("update_vendor_category", {
        categoryId: "category-1",
        body: change.body,
        confirm: true,
      }),
    );
    // Assert
    assert.equal(result.success, true);
    assert.deepEqual(server.getCalls("PATCH", route)[0].jsonBody, change.body);
    const after = parseToolEnvelope(
      await harness.callTool("get_vendor_category_by_id", {
        categoryId: "category-1",
      }),
    );
    assert.equal((after.data as typeof state).label, change.expected.label);
    assert.equal(
      (after.data as typeof state).description,
      change.expected.description,
    );
  });
}

test("engagement attachment preserves an unrelated engagement on both vendor readbacks", async t => {
  // Arrange
  const server = new FakeVantaServer();
  const route = "/vendors/parent-1/engagement-relationship/child-1";
  const existing = {
    id: "child-2",
    name: "Existing",
    status: "MANAGED",
    websiteUrl: null,
  };
  const added = {
    id: "child-1",
    name: "Added",
    status: "MANAGED",
    websiteUrl: null,
  };
  const parentSummary = {
    id: "parent-1",
    name: "Parent",
    status: "MANAGED",
    websiteUrl: null,
  };
  let parent = { id: "parent-1", engagements: [existing] };
  let child = {
    id: "child-1",
    parentVendor: null as typeof parentSummary | null,
  };
  server.setRoute("GET", "/vendors/parent-1", () => ({
    status: 200,
    body: { ...parent },
  }));
  server.setRoute("GET", "/vendors/child-1", () => ({
    status: 200,
    body: { ...child },
  }));
  server.setRoute("PUT", route, () => {
    parent = {
      ...parent,
      engagements: [...parent.engagements, added],
    };
    child = { ...child, parentVendor: parentSummary };
    return { status: 200, body: { ...child } };
  });
  const harness = await start(t, server);
  const before = parseToolEnvelope(
    await harness.callTool("get_vendor", { vendorId: "parent-1" }),
  );
  // Initial assert
  assert.deepEqual((before.data as typeof parent).engagements, [existing]);
  assert.equal(server.getCallCount("PUT", route), 0);
  // Act
  const result = parseToolEnvelope(
    await harness.callTool("set_engagement", {
      parentVendorId: "parent-1",
      engagementVendorId: "child-1",
      confirm: true,
    }),
  );
  // Assert
  assert.equal(result.success, true);
  const parentAfter = parseToolEnvelope(
    await harness.callTool("get_vendor", { vendorId: "parent-1" }),
  );
  const childAfter = parseToolEnvelope(
    await harness.callTool("get_vendor", { vendorId: "child-1" }),
  );
  assert.deepEqual((parentAfter.data as typeof parent).engagements, [
    existing,
    added,
  ]);
  assert.deepEqual(
    (childAfter.data as typeof child).parentVendor,
    parentSummary,
  );
});

test("category deletion explicitly uncategorizes vendors and independently reads back deletion", async t => {
  // Arrange
  const server = new FakeVantaServer();
  const route = "/vendor-categories/category-1";
  let exists = true;
  let vendor = { id: "vendor-1", categoryId: "category-1" as string | null };
  server.setRoute("GET", route, () =>
    exists
      ? {
          status: 200,
          body: {
            id: "category-1",
            label: "Custom",
            description: null,
            isSystem: false,
          },
        }
      : { status: 404, body: { message: "not found" } },
  );
  server.setRoute("GET", "/vendors/vendor-1", () => ({
    status: 200,
    body: { ...vendor },
  }));
  server.setRoute("GET", "/vendors", () => ({
    status: 200,
    body: { results: { data: [vendor], pageInfo: { hasNextPage: false } } },
  }));
  server.setRoute("DELETE", route, request => {
    const body = request.jsonBody as { replacementCategoryId: string | null };
    exists = false;
    vendor = { ...vendor, categoryId: body.replacementCategoryId };
    return { status: 204 };
  });
  const harness = await start(t, server);
  const before = parseToolEnvelope(
    await harness.callTool("get_vendor", { vendorId: "vendor-1" }),
  );
  // Initial assert
  assert.equal((before.data as typeof vendor).categoryId, "category-1");
  assert.equal(server.getCallCount("DELETE", route), 0);
  // Act
  const result = parseToolEnvelope(
    await harness.callTool("delete_vendor_category", {
      categoryId: "category-1",
      body: { replacementCategoryId: null },
      confirm: true,
    }),
  );
  // Assert
  assert.equal(result.success, true);
  assert.deepEqual(server.getCalls("DELETE", route)[0].jsonBody, {
    replacementCategoryId: null,
  });
  const categoryAfter = parseToolEnvelope(
    await harness.callTool("get_vendor_category_by_id", {
      categoryId: "category-1",
    }),
  );
  const vendorAfter = parseToolEnvelope(
    await harness.callTool("get_vendor", { vendorId: "vendor-1" }),
  );
  assert.equal(categoryAfter.success, false);
  assert.equal(
    (categoryAfter.error as Record<string, unknown>).code,
    "api_error",
  );
  assert.equal((vendorAfter.data as typeof vendor).categoryId, null);
});

test("engagement conflict does not alter an existing parent or replay the request", async t => {
  // Arrange
  const server = new FakeVantaServer();
  const route = "/vendors/parent-1/engagement-relationship/child-1";
  const child = { id: "child-1", parentVendor: { id: "other-parent" } };
  server.setRoute("GET", "/vendors/child-1", () => ({
    status: 200,
    body: child,
  }));
  server.queueRoute("PUT", route, [
    { status: 409, body: { message: "already attached to another parent" } },
  ]);
  const harness = await start(t, server);
  const before = parseToolEnvelope(
    await harness.callTool("get_vendor", { vendorId: "child-1" }),
  );
  // Initial assert
  assert.deepEqual((before.data as typeof child).parentVendor, {
    id: "other-parent",
  });
  assert.equal(server.getCallCount("PUT", route), 0);
  // Act
  const result = parseToolEnvelope(
    await harness.callTool("set_engagement", {
      parentVendorId: "parent-1",
      engagementVendorId: "child-1",
      confirm: true,
    }),
  );
  // Assert
  assert.equal(result.success, false);
  assert.equal((result.error as Record<string, unknown>).code, "api_error");
  assert.equal(server.getCallCount("PUT", route), 1);
  const after = parseToolEnvelope(
    await harness.callTool("get_vendor", { vendorId: "child-1" }),
  );
  assert.deepEqual((after.data as typeof child).parentVendor, {
    id: "other-parent",
  });
});

test("a successful no-op engagement removal is distinguished by vendor readback", async t => {
  // Arrange
  const server = new FakeVantaServer();
  const route = "/vendors/parent-1/engagement-relationship/child-1";
  const child = { id: "child-1", parentVendor: { id: "other-parent" } };
  server.setRoute("GET", "/vendors/child-1", () => ({
    status: 200,
    body: child,
  }));
  server.queueRoute("DELETE", route, [{ status: 200, body: child }]);
  const harness = await start(t, server);
  const before = parseToolEnvelope(
    await harness.callTool("get_vendor", { vendorId: "child-1" }),
  );
  // Initial assert
  assert.deepEqual((before.data as typeof child).parentVendor, {
    id: "other-parent",
  });
  assert.equal(server.getCallCount("DELETE", route), 0);
  // Act
  const result = parseToolEnvelope(
    await harness.callTool("remove_engagement", {
      parentVendorId: "parent-1",
      engagementVendorId: "child-1",
      confirm: true,
    }),
  );
  // Assert
  assert.equal(result.success, true);
  assert.equal(server.getCallCount("DELETE", route), 1);
  const after = parseToolEnvelope(
    await harness.callTool("get_vendor", { vendorId: "child-1" }),
  );
  assert.deepEqual((after.data as typeof child).parentVendor, {
    id: "other-parent",
  });
});

test("framework variant update replaces the selected set and is independently readable", async t => {
  // Arrange
  const server = new FakeVantaServer();
  let selected = ["old-variant", "other-variant"];
  server.setRoute("GET", "/frameworks/framework-1", () => ({
    status: 200,
    body: { id: "framework-1", activeVariants: selected.map(id => ({ id })) },
  }));
  server.setRoute("PUT", "/frameworks/framework-1/variants", request => {
    selected = (request.jsonBody as { variantIds: string[] }).variantIds;
    return {
      status: 200,
      body: { frameworkId: "framework-1", variantIds: selected },
    };
  });
  const harness = await start(t, server);
  const before = parseToolEnvelope(
    await harness.callTool("get_framework", { frameworkId: "framework-1" }),
  );
  // Initial assert
  assert.deepEqual(
    (before.data as { activeVariants: { id: string }[] }).activeVariants.map(
      item => item.id,
    ),
    ["old-variant", "other-variant"],
  );
  assert.equal(
    server.getCallCount("PUT", "/frameworks/framework-1/variants"),
    0,
  );
  // Act
  const result = parseToolEnvelope(
    await harness.callTool("set_framework_variant", {
      frameworkId: "framework-1",
      body: { variantIds: ["new-variant"] },
      confirm: true,
    }),
  );
  // Assert
  assert.equal(result.success, true);
  assert.deepEqual(
    server.getCalls("PUT", "/frameworks/framework-1/variants")[0].jsonBody,
    { variantIds: ["new-variant"] },
  );
  const after = parseToolEnvelope(
    await harness.callTool("get_framework", { frameworkId: "framework-1" }),
  );
  assert.deepEqual(
    (after.data as { activeVariants: { id: string }[] }).activeVariants.map(
      item => item.id,
    ),
    ["new-variant"],
  );
});

test("framework snooze is unverified when readback cannot expose the requested date", async t => {
  // Arrange
  const server = new FakeVantaServer();
  let framework = {
    id: "framework-1",
    status: "ACTIVE",
    activeVariants: [{ id: "variant-1" }],
  };
  server.setRoute("GET", "/frameworks/framework-1", () => ({
    status: 200,
    body: { ...framework },
  }));
  server.setRoute("POST", "/frameworks/framework-1/snooze", request => {
    framework = { ...framework, status: "SNOOZED" };
    return {
      status: 200,
      body: {
        ...framework,
        snoozedUntilDate: (request.jsonBody as { snoozedUntilDate: string })
          .snoozedUntilDate,
      },
    };
  });
  const harness = await start(t, server);
  const before = parseToolEnvelope(
    await harness.callTool("get_framework", { frameworkId: "framework-1" }),
  );
  // Initial assert
  assert.equal((before.data as typeof framework).status, "ACTIVE");
  assert.equal(
    server.getCallCount("POST", "/frameworks/framework-1/snooze"),
    0,
  );
  // Act
  const result = parseToolEnvelope(
    await harness.callTool("snooze_framework", {
      frameworkId: "framework-1",
      body: { snoozedUntilDate: "2099-12-01" },
      confirm: true,
    }),
  );
  // Assert
  assert.equal(result.success, false);
  assert.equal(
    (result.error as Record<string, unknown>).code,
    "write_unverified",
  );
  assert.equal(
    server.getCallCount("POST", "/frameworks/framework-1/snooze"),
    1,
  );
  const after = parseToolEnvelope(
    await harness.callTool("get_framework", { frameworkId: "framework-1" }),
  );
  assert.equal((after.data as typeof framework).status, "SNOOZED");
  assert.deepEqual((after.data as typeof framework).activeVariants, [
    { id: "variant-1" },
  ]);
});

test("empty framework variant selection remains an API error and leaves the previous set intact", async t => {
  // Arrange
  const server = new FakeVantaServer();
  const route = "/frameworks/framework-1/variants";
  const framework = {
    id: "framework-1",
    activeVariants: [{ id: "variant-1" }],
  };
  server.setRoute("GET", "/frameworks/framework-1", () => ({
    status: 200,
    body: framework,
  }));
  server.queueRoute("PUT", route, [
    { status: 422, body: { message: "empty selection not allowed" } },
  ]);
  const harness = await start(t, server);
  const before = parseToolEnvelope(
    await harness.callTool("get_framework", { frameworkId: "framework-1" }),
  );
  // Initial assert
  assert.deepEqual((before.data as typeof framework).activeVariants, [
    { id: "variant-1" },
  ]);
  assert.equal(server.getCallCount("PUT", route), 0);
  // Act
  const result = parseToolEnvelope(
    await harness.callTool("set_framework_variant", {
      frameworkId: "framework-1",
      body: { variantIds: [] },
      confirm: true,
    }),
  );
  // Assert
  assert.equal(result.success, false);
  assert.equal((result.error as Record<string, unknown>).code, "api_error");
  assert.match(
    String((result.error as Record<string, unknown>).message),
    /422/u,
  );
  assert.equal(server.getCallCount("PUT", route), 1);
  const after = parseToolEnvelope(
    await harness.callTool("get_framework", { frameworkId: "framework-1" }),
  );
  assert.deepEqual((after.data as typeof framework).activeVariants, [
    { id: "variant-1" },
  ]);
});

test("personnel requirement updates replace supplied requirements and preserve omitted requirements", async t => {
  // Arrange
  const server = new FakeVantaServer();
  const route = "/task-requirement-sets/set-1/requirements";
  let requirements = {
    onboarding: {
      policyAcceptance: { required: false },
      backgroundCheck: { required: false },
    },
    offboarding: { custom: { required: false } },
  };
  const body = {
    onboarding: { policyAcceptance: { required: true, acceptAll: true } },
  };
  server.setRoute("GET", "/task-requirement-sets/set-1", () => ({
    status: 200,
    body: { id: "set-1", taskRequirements: requirements },
  }));
  server.setRoute("PATCH", route, request => {
    const updates = request.jsonBody as typeof body;
    requirements = {
      ...requirements,
      onboarding: { ...requirements.onboarding, ...updates.onboarding },
    };
    return {
      status: 200,
      body: { id: "set-1", taskRequirements: requirements },
    };
  });
  const harness = await start(t, server);
  const before = parseToolEnvelope(
    await harness.callTool("get_task_requirement_set", {
      requirementSetId: "set-1",
    }),
  );
  // Initial assert
  assert.deepEqual(
    (before.data as { taskRequirements: typeof requirements }).taskRequirements
      .onboarding.policyAcceptance,
    { required: false },
  );
  assert.equal(server.getCallCount("PATCH", route), 0);
  // Act
  const result = parseToolEnvelope(
    await harness.callTool("update_task_requirement_set_requirements", {
      requirementSetId: "set-1",
      body,
      confirm: true,
    }),
  );
  // Assert
  assert.equal(result.success, true);
  assert.deepEqual(server.getCalls("PATCH", route)[0].jsonBody, body);
  const after = parseToolEnvelope(
    await harness.callTool("get_task_requirement_set", {
      requirementSetId: "set-1",
    }),
  );
  assert.deepEqual(
    (after.data as { taskRequirements: typeof requirements }).taskRequirements,
    {
      onboarding: {
        policyAcceptance: { required: true, acceptAll: true },
        backgroundCheck: { required: false },
      },
      offboarding: { custom: { required: false } },
    },
  );
});

for (const scenario of [
  {
    name: "vendor settings",
    tool: "update_vendor_alert_settings",
    method: "PATCH",
    route: "/vendor-alert-settings",
    args: {
      body: { changes: [{ category: "Vulnerabilities", isEnabled: false }] },
    },
  },
  {
    name: "category",
    tool: "update_vendor_category",
    method: "PATCH",
    route: "/vendor-categories/category-1",
    args: { categoryId: "category-1", body: { description: null } },
  },
  {
    name: "engagement",
    tool: "set_engagement",
    method: "PUT",
    route: "/vendors/parent-1/engagement-relationship/child-1",
    args: { parentVendorId: "parent-1", engagementVendorId: "child-1" },
  },
  {
    name: "framework",
    tool: "set_framework_variant",
    method: "PUT",
    route: "/frameworks/framework-1/variants",
    args: { frameworkId: "framework-1", body: { variantIds: ["variant-1"] } },
  },
  {
    name: "personnel",
    tool: "update_task_requirement_set_details",
    method: "PATCH",
    route: "/task-requirement-sets/set-1/details",
    args: { requirementSetId: "set-1", body: { name: "New name" } },
  },
]) {
  test(`${scenario.name} permission denial remains an API error without replay`, async t => {
    // Arrange
    const server = new FakeVantaServer();
    server.queueRoute(scenario.method, scenario.route, [
      { status: 403, body: { message: "scope denied" } },
    ]);
    const harness = await start(t, server);
    // Initial assert
    assert.equal(server.getCallCount(scenario.method, scenario.route), 0);
    // Act
    const result = parseToolEnvelope(
      await harness.callTool(scenario.tool, {
        ...scenario.args,
        confirm: true,
      }),
    );
    // Assert
    assert.equal(result.success, false);
    assert.equal((result.error as Record<string, unknown>).code, "api_error");
    assert.match(
      String((result.error as Record<string, unknown>).message),
      /403/u,
    );
    assert.equal(server.getCallCount(scenario.method, scenario.route), 1);
  });
}

for (const fixture of [
  { status: 204, success: true, body: undefined },
  { status: 403, success: false, body: { message: "scope denied" } },
]) {
  test(`group requirement-set HTTP ${fixture.status.toString()} preserves access versus no-assignment distinction`, async t => {
    // Arrange
    const server = new FakeVantaServer();
    const route = "/groups/group-1/task-requirement-set";
    server.queueRoute("GET", route, [
      { status: fixture.status, body: fixture.body },
    ]);
    const harness = await start(t, server);
    // Initial assert
    assert.equal(server.getCallCount("GET", route), 0);
    // Act
    const result = parseToolEnvelope(
      await harness.callTool("get_group_task_requirement_set", {
        groupId: "group-1",
      }),
    );
    // Assert
    assert.equal(result.success, fixture.success);
    if (fixture.success) assert.equal(result.data, null);
    else {
      assert.equal((result.error as Record<string, unknown>).code, "api_error");
      assert.match(
        String((result.error as Record<string, unknown>).message),
        /403/u,
      );
    }
    assert.equal(server.getCallCount("GET", route), 1);
  });
}
