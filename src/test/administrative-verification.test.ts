import assert from "node:assert/strict";
import test from "node:test";
import { VantaApiClient, VantaResponse } from "../client/vanta-client.js";
import { invokeGeneratedOperation } from "../tools/endpoint-tools.js";
import { parseToolEnvelope } from "./helpers.js";

class FakeClient {
  public calls: {
    method: string;
    path: string;
    body?: unknown;
    query?: unknown;
    maxRetries?: number;
  }[] = [];
  private routes = new Map<string, VantaResponse[]>();
  public queue(method: string, path: string, responses: VantaResponse[]): void {
    this.routes.set(`${method.toUpperCase()} ${path}`, [...responses]);
  }
  public async request(input: {
    method: string;
    path: string;
    body?: unknown;
    query?: unknown;
    maxRetries?: number;
  }): Promise<VantaResponse> {
    this.calls.push(input);
    const queue = this.routes.get(
      `${input.method.toUpperCase()} ${input.path}`,
    );
    const response = queue && queue.length > 1 ? queue.shift() : queue?.[0];
    if (!response)
      throw new Error(`Unexpected request ${input.method} ${input.path}`);
    return response;
  }
}
const ok = (data: unknown, status = 200): VantaResponse => ({
  status,
  ok: true,
  data,
  headers: {},
});
const failure = (status: number): VantaResponse => ({
  status,
  ok: false,
  data: { message: "denied" },
  headers: {},
});
const invoke = async (
  name: string,
  args: Record<string, unknown>,
  client: FakeClient,
) =>
  parseToolEnvelope(
    await invokeGeneratedOperation(name, args, client as never, undefined, () =>
      Promise.resolve(),
    ),
  );
const inventory = (data: unknown[], hasNextPage = false, endCursor?: string) =>
  ok({ results: { data, pageInfo: { hasNextPage, endCursor } } });

test("category update retries only readback and warns on unrelated drift", async () => {
  // Arrange
  const client = new FakeClient();
  client.queue("GET", "/vendor-categories/c1", [
    ok({ id: "c1", label: "old", description: "before" }),
    ok({ id: "c1", label: "old", description: "before" }),
    ok({ id: "c1", label: "old", description: "before" }),
    ok({ id: "c1", label: "new", description: "concurrent" }),
  ]);
  client.queue("PATCH", "/vendor-categories/c1", [
    ok({ id: "c1", label: "new", description: "before" }),
  ]);
  // Initial assert
  assert.equal(client.calls.length, 0);
  // Act
  const result = await invoke(
    "update_vendor_category",
    { categoryId: "c1", body: { label: "new" }, confirm: true },
    client,
  );
  // Assert
  assert.equal(result.success, true);
  assert.equal(
    (result.metadata as { verification: { attempts: number } }).verification
      .attempts,
    3,
  );
  assert.match(
    (result.warnings as string[]).join(" "),
    /Unrequested fields changed/u,
  );
  assert.equal(
    client.calls.filter(call => call.method.toUpperCase() === "PATCH").length,
    1,
  );
  assert.ok(
    client.calls
      .filter(call => call.method.toUpperCase() === "GET")
      .every(call => call.maxRetries === 0),
  );
});

test("accepted settings write reports unverified after three denied readbacks without replay", async () => {
  // Arrange
  const client = new FakeClient();
  client.queue("GET", "/vendor-alert-settings", [
    ok({ items: [{ category: "Vulnerabilities", isEnabled: true }] }),
    failure(403),
  ]);
  client.queue("PATCH", "/vendor-alert-settings", [
    ok({ items: [{ category: "Vulnerabilities", isEnabled: false }] }),
  ]);
  // Initial assert
  assert.equal(client.calls.length, 0);
  // Act
  const result = await invoke(
    "update_vendor_alert_settings",
    {
      body: { changes: [{ category: "Vulnerabilities", isEnabled: false }] },
      confirm: true,
    },
    client,
  );
  // Assert
  assert.equal(result.success, false);
  const error = result.error as {
    code: string;
    details: {
      mutationAccepted: boolean;
      writeStatus: number;
      verification: { attempts: number };
    };
  };
  assert.equal(error.code, "write_unverified");
  assert.equal(error.details.mutationAccepted, true);
  assert.equal(error.details.writeStatus, 200);
  assert.equal(error.details.verification.attempts, 3);
  assert.equal(
    client.calls.filter(call => call.method.toUpperCase() === "PATCH").length,
    1,
  );
});

test("category deletion refuses an incomplete vendor inventory before mutation", async () => {
  // Arrange
  const client = new FakeClient();
  client.queue("GET", "/vendor-categories/c1", [ok({ id: "c1" })]);
  client.queue("GET", "/vendors", [
    inventory([{ id: "v1", categoryId: "c1" }], true),
  ]);
  // Initial assert
  assert.equal(client.calls.length, 0);
  // Act
  const result = await invoke(
    "delete_vendor_category",
    { categoryId: "c1", body: { replacementCategoryId: null }, confirm: true },
    client,
  );
  // Assert
  assert.equal(result.success, false);
  assert.equal((result.error as { code: string }).code, "precondition_failed");
  assert.equal(
    client.calls.some(call => call.method.toUpperCase() === "DELETE"),
    false,
  );
});

test("category deletion refuses to write when the fresh inventory is denied", async () => {
  // Arrange
  const client = new FakeClient();
  client.queue("GET", "/vendor-categories/c1", [ok({ id: "c1" })]);
  client.queue("GET", "/vendors", [
    inventory([{ id: "v1", categoryId: "c1" }]),
    failure(403),
  ]);
  // Initial assert
  assert.equal(client.calls.length, 0);
  // Act
  const result = await invoke(
    "delete_vendor_category",
    { categoryId: "c1", body: { replacementCategoryId: null }, confirm: true },
    client,
  );
  // Assert
  assert.equal(result.success, false);
  const error = result.error as {
    code: string;
    details: { mutationAccepted: boolean; reason: string };
  };
  assert.equal(error.code, "precondition_failed");
  assert.equal(error.details.mutationAccepted, false);
  assert.match(error.details.reason, /403/u);
  assert.equal(
    client.calls.some(call => call.method.toUpperCase() === "DELETE"),
    false,
  );
});

test("category preflight retries a rejected 429 read and never repeats deletion", async () => {
  // Arrange
  const calls: string[] = [];
  let inventoryCalls = 0;
  let categoryCalls = 0;
  const client = new VantaApiClient({
    tokenManager: {
      getValidToken: async () => "token",
      refreshToken: async () => "token",
    },
    wait: () => Promise.resolve(),
    fetch: async (url, init) => {
      const path = new URL(String(url)).pathname.replace(/^\/v1/u, "");
      const method = String(init?.method).toUpperCase();
      calls.push(`${method} ${path}`);
      if (path === "/vendor-categories/c1" && method === "GET") {
        categoryCalls += 1;
        return categoryCalls === 1
          ? Response.json({ id: "c1" })
          : Response.json({ message: "not found" }, { status: 404 });
      }
      if (path === "/vendors" && method === "GET") {
        inventoryCalls += 1;
        if (inventoryCalls === 1)
          return Response.json(
            { error: "rate limit" },
            { status: 429, headers: { "retry-after": "0" } },
          );
        return Response.json({
          results: { data: [], pageInfo: { hasNextPage: false } },
        });
      }
      if (path === "/vendor-categories/c1" && method === "DELETE")
        return new Response(null, { status: 204 });
      throw new Error(`Unexpected request ${method} ${path}`);
    },
  });
  // Initial assert
  assert.deepEqual(calls, []);
  // Act
  const result = parseToolEnvelope(
    await invokeGeneratedOperation(
      "delete_vendor_category",
      {
        categoryId: "c1",
        body: { replacementCategoryId: null },
        confirm: true,
      },
      client,
      undefined,
      () => Promise.resolve(),
    ),
  );
  // Assert
  assert.equal(result.success, true);
  assert.equal(inventoryCalls, 3);
  assert.equal(
    calls.filter(call => call === "DELETE /vendor-categories/c1").length,
    1,
  );
});

test("category deletion checks fresh complete inventories and every captured vendor", async () => {
  // Arrange
  const client = new FakeClient();
  client.queue("GET", "/vendor-categories/c1", [
    ok({ id: "c1" }),
    failure(404),
  ]);
  client.queue("GET", "/vendors", [
    inventory([{ id: "v1", categoryId: "c1" }]),
    inventory([
      { id: "v1", categoryId: "c1", name: "before" },
      { id: "v2", categoryId: "c1" },
    ]),
  ]);
  client.queue("DELETE", "/vendor-categories/c1", [ok(null, 204)]);
  client.queue("GET", "/vendors/v1", [
    ok({ id: "v1", categoryId: null, name: "concurrent" }),
  ]);
  client.queue("GET", "/vendors/v2", [ok({ id: "v2", categoryId: null })]);
  // Initial assert
  assert.equal(client.calls.length, 0);
  // Act
  const result = await invoke(
    "delete_vendor_category",
    { categoryId: "c1", body: { replacementCategoryId: null }, confirm: true },
    client,
  );
  // Assert
  assert.equal(result.success, true);
  assert.match(
    (result.warnings as string[]).join(" "),
    /Concurrent vendor-category assignments/u,
  );
  assert.match(
    (result.warnings as string[]).join(" "),
    /changed between pre-delete inventories/u,
  );
  assert.match(
    (result.warnings as string[]).join(" "),
    /Unrequested fields changed/u,
  );
  assert.equal(
    client.calls.filter(
      call => call.path === "/vendors" && call.method.toUpperCase() === "GET",
    ).length,
    2,
  );
  assert.ok(client.calls.some(call => call.path === "/vendors/v1"));
  assert.ok(client.calls.some(call => call.path === "/vendors/v2"));
  assert.equal(
    client.calls.filter(call => call.method.toUpperCase() === "DELETE").length,
    1,
  );
});

test("category deletion returns unverified when an affected vendor did not move", async () => {
  // Arrange
  const client = new FakeClient();
  client.queue("GET", "/vendor-categories/c1", [
    ok({ id: "c1" }),
    failure(404),
  ]);
  client.queue("GET", "/vendors", [
    inventory([{ id: "v1", categoryId: "c1" }]),
  ]);
  client.queue("DELETE", "/vendor-categories/c1", [ok(null, 204)]);
  client.queue("GET", "/vendors/v1", [ok({ id: "v1", categoryId: "c1" })]);
  // Initial assert
  assert.equal(client.calls.length, 0);
  // Act
  const result = await invoke(
    "delete_vendor_category",
    { categoryId: "c1", body: { replacementCategoryId: null }, confirm: true },
    client,
  );
  // Assert
  assert.equal(result.success, false);
  const error = result.error as {
    code: string;
    details: { mutationAccepted: boolean; verification: { attempts: number } };
  };
  assert.equal(error.code, "write_unverified");
  assert.equal(error.details.mutationAccepted, true);
  assert.equal(error.details.verification.attempts, 3);
  assert.equal(
    client.calls.filter(call => call.method.toUpperCase() === "DELETE").length,
    1,
  );
});

test("vendor category verification also checks other fields in the same update", async () => {
  // Arrange
  const client = new FakeClient();
  client.queue("GET", "/vendors/v1", [
    ok({ id: "v1", name: "old", categoryId: "c1" }),
    ok({ id: "v1", name: "old", categoryId: "c2" }),
  ]);
  client.queue("PATCH", "/vendors/v1", [
    ok({ id: "v1", name: "new", categoryId: "c2" }),
  ]);
  // Initial assert
  assert.equal(client.calls.length, 0);
  // Act
  const result = await invoke(
    "update_vendor",
    { vendorId: "v1", body: { name: "new", categoryId: "c2" }, confirm: true },
    client,
  );
  // Assert
  assert.equal(result.success, false);
  assert.equal((result.error as { code: string }).code, "write_unverified");
  assert.equal(
    client.calls.filter(call => call.method.toUpperCase() === "PATCH").length,
    1,
  );
});

test("matching fields from a different object cannot verify a category update", async () => {
  // Arrange
  const client = new FakeClient();
  client.queue("GET", "/vendor-categories/c1", [
    ok({ id: "c1", label: "old" }),
    ok({ id: "other", label: "new" }),
  ]);
  client.queue("PATCH", "/vendor-categories/c1", [
    ok({ id: "c1", label: "new" }),
  ]);
  // Initial assert
  assert.equal(client.calls.length, 0);
  // Act
  const result = await invoke(
    "update_vendor_category",
    { categoryId: "c1", body: { label: "new" }, confirm: true },
    client,
  );
  // Assert
  assert.equal(result.success, false);
  const error = result.error as {
    code: string;
    details: { verification: { reason: string } };
  };
  assert.equal(error.code, "write_unverified");
  assert.match(error.details.verification.reason, /object ID/u);
  assert.equal(
    client.calls.filter(call => call.method.toUpperCase() === "PATCH").length,
    1,
  );
});

test("unrelated nested personnel requirements trigger a warning rather than failure", async () => {
  // Arrange
  const client = new FakeClient();
  client.queue("GET", "/task-requirement-sets/s1", [
    ok({
      id: "s1",
      taskRequirements: {
        onboarding: {
          policyAcceptance: { required: true, acceptAll: true },
          backgroundCheck: { required: true },
        },
      },
    }),
    ok({
      id: "s1",
      taskRequirements: {
        onboarding: {
          policyAcceptance: { required: false },
          backgroundCheck: { required: false },
        },
      },
    }),
  ]);
  client.queue("PATCH", "/task-requirement-sets/s1/requirements", [
    ok({ id: "s1" }),
  ]);
  // Initial assert
  assert.equal(client.calls.length, 0);
  // Act
  const result = await invoke(
    "update_task_requirement_set_requirements",
    {
      requirementSetId: "s1",
      body: { onboarding: { policyAcceptance: { required: false } } },
      confirm: true,
    },
    client,
  );
  // Assert
  assert.equal(result.success, true);
  assert.match(
    (result.warnings as string[]).join(" "),
    /Unrequested fields changed/u,
  );
});

test("snooze remains unverified if independent framework read omits the requested date", async () => {
  // Arrange
  const client = new FakeClient();
  client.queue("GET", "/frameworks/f1", [
    ok({ id: "f1", status: "ACTIVE" }),
    ok({ id: "f1", status: "SNOOZED" }),
  ]);
  client.queue("POST", "/frameworks/f1/snooze", [
    ok({
      frameworkId: "f1",
      status: "SNOOZED",
      snoozedUntilDate: "2099-01-01",
      hasChanged: true,
    }),
  ]);
  // Initial assert
  assert.equal(client.calls.length, 0);
  // Act
  const result = await invoke(
    "snooze_framework",
    {
      frameworkId: "f1",
      body: { snoozedUntilDate: "2099-01-01" },
      confirm: true,
    },
    client,
  );
  // Assert
  assert.equal(result.success, false);
  const error = result.error as {
    code: string;
    details: {
      verification: {
        reason: string;
        attempts: number;
        fields: {
          status: { verification: string; readbackValue: string };
          snoozedUntilDate: {
            verification: string;
            requested: string;
            writeResponseValue: string;
            writeResponseMatchesRequest: boolean;
            readbackPresent: boolean;
            readbackValue: null;
          };
        };
      };
    };
  };
  assert.equal(error.code, "write_unverified");
  assert.match(error.details.verification.reason, /does not expose/u);
  assert.equal(error.details.verification.attempts, 1);
  assert.deepEqual(error.details.verification.fields, {
    status: {
      verification: "verified",
      requested: "SNOOZED",
      readbackValue: "SNOOZED",
    },
    snoozedUntilDate: {
      verification: "unverified",
      requested: "2099-01-01",
      writeResponseValue: "2099-01-01",
      writeResponseMatchesRequest: true,
      readbackPresent: false,
      readbackValue: null,
    },
  });
  assert.equal(
    client.calls.filter(call => call.method.toUpperCase() === "POST").length,
    1,
  );
});

test("snooze retries a stale status then stops when the status is confirmed without a date", async () => {
  // Arrange
  const client = new FakeClient();
  client.queue("GET", "/frameworks/f1", [
    ok({ id: "f1", status: "ACTIVE" }),
    ok({ id: "f1", status: "ACTIVE" }),
    ok({ id: "f1", status: "SNOOZED" }),
  ]);
  client.queue("POST", "/frameworks/f1/snooze", [
    ok({
      frameworkId: "f1",
      status: "SNOOZED",
      snoozedUntilDate: "2099-02-01",
      hasChanged: true,
    }),
  ]);
  // Initial assert
  assert.equal(client.calls.length, 0);
  // Act
  const result = await invoke(
    "snooze_framework",
    {
      frameworkId: "f1",
      body: { snoozedUntilDate: "2099-01-01" },
      confirm: true,
    },
    client,
  );
  // Assert
  assert.equal(result.success, false);
  const verification = (
    result.error as {
      details: {
        verification: {
          attempts: number;
          fields: {
            status: { verification: string };
            snoozedUntilDate: {
              writeResponseValue: string;
              writeResponseMatchesRequest: boolean;
            };
          };
        };
      };
    }
  ).details.verification;
  assert.equal(verification.attempts, 2);
  assert.equal(verification.fields.status.verification, "verified");
  assert.equal(
    verification.fields.snoozedUntilDate.writeResponseValue,
    "2099-02-01",
  );
  assert.equal(
    verification.fields.snoozedUntilDate.writeResponseMatchesRequest,
    false,
  );
  assert.equal(
    client.calls.filter(call => call.method.toUpperCase() === "POST").length,
    1,
  );
});

test("snooze succeeds only when status and end date independently match", async () => {
  // Arrange
  const client = new FakeClient();
  client.queue("GET", "/frameworks/f1", [
    ok({ id: "f1", status: "ACTIVE" }),
    ok({ id: "f1", status: "SNOOZED", snoozedUntilDate: "2099-01-01" }),
  ]);
  client.queue("POST", "/frameworks/f1/snooze", [
    ok({
      frameworkId: "f1",
      status: "SNOOZED",
      snoozedUntilDate: "2099-01-01",
      hasChanged: true,
    }),
  ]);
  // Initial assert
  assert.equal(client.calls.length, 0);
  // Act
  const result = await invoke(
    "snooze_framework",
    {
      frameworkId: "f1",
      body: { snoozedUntilDate: "2099-01-01" },
      confirm: true,
    },
    client,
  );
  // Assert
  assert.equal(result.success, true);
  const verification = (
    result.metadata as {
      verification: {
        fields: {
          status: { verification: string };
          snoozedUntilDate: { verification: string; readbackValue: string };
        };
      };
    }
  ).verification;
  assert.equal(verification.fields.status.verification, "verified");
  assert.equal(verification.fields.snoozedUntilDate.verification, "verified");
  assert.equal(
    verification.fields.snoozedUntilDate.readbackValue,
    "2099-01-01",
  );
});

test("snooze stops after three stale status reads without replaying the write", async () => {
  // Arrange
  const client = new FakeClient();
  client.queue("GET", "/frameworks/f1", [ok({ id: "f1", status: "ACTIVE" })]);
  client.queue("POST", "/frameworks/f1/snooze", [
    ok({
      frameworkId: "f1",
      status: "SNOOZED",
      snoozedUntilDate: "2099-01-01",
      hasChanged: true,
    }),
  ]);
  // Initial assert
  assert.equal(client.calls.length, 0);
  // Act
  const result = await invoke(
    "snooze_framework",
    {
      frameworkId: "f1",
      body: { snoozedUntilDate: "2099-01-01" },
      confirm: true,
    },
    client,
  );
  // Assert
  assert.equal(result.success, false);
  const verification = (
    result.error as {
      details: {
        verification: {
          attempts: number;
          reason: string;
          fields: { status: { verification: string } };
        };
      };
    }
  ).details.verification;
  assert.equal(verification.attempts, 3);
  assert.match(verification.reason, /status/u);
  assert.equal(verification.fields.status.verification, "unverified");
  assert.equal(
    client.calls.filter(call => call.method.toUpperCase() === "POST").length,
    1,
  );
});

for (const fixture of [
  {
    tool: "create_vendor_category",
    method: "POST",
    path: "/vendor-categories",
    read: "/vendor-categories/c1",
    input: { body: { label: "new" }, confirm: true },
    before: undefined,
    after: { id: "c1", label: "new" },
    response: { id: "c1", label: "new" },
  },
  {
    tool: "create_vendor",
    method: "POST",
    path: "/vendors",
    read: "/vendors/v1",
    input: { body: { name: "vendor", categoryId: "c1" }, confirm: true },
    before: undefined,
    after: { id: "v1", name: "vendor", categoryId: "c1" },
    response: { id: "v1", name: "vendor", categoryId: "c1" },
  },
  {
    tool: "update_vendor",
    method: "PATCH",
    path: "/vendors/v1",
    read: "/vendors/v1",
    input: { vendorId: "v1", body: { categoryId: null }, confirm: true },
    before: { id: "v1", categoryId: "c1" },
    after: { id: "v1", categoryId: null },
    response: { id: "v1", categoryId: null },
  },
  {
    tool: "set_engagement",
    method: "PUT",
    path: "/vendors/p1/engagement-relationship/v1",
    read: "/vendors/v1",
    input: { parentVendorId: "p1", engagementVendorId: "v1", confirm: true },
    before: { id: "v1", parentVendor: null },
    after: { id: "v1", parentVendor: { id: "p1" } },
    response: { id: "v1" },
  },
  {
    tool: "remove_engagement",
    method: "DELETE",
    path: "/vendors/p1/engagement-relationship/v1",
    read: "/vendors/v1",
    input: { parentVendorId: "p1", engagementVendorId: "v1", confirm: true },
    before: { id: "v1", parentVendor: { id: "p1" } },
    after: { id: "v1", parentVendor: null },
    response: { id: "v1" },
  },
  {
    tool: "set_framework_variant",
    method: "PUT",
    path: "/frameworks/f1/variants",
    read: "/frameworks/f1",
    input: {
      frameworkId: "f1",
      body: { variantIds: ["v2", "v1"] },
      confirm: true,
    },
    before: { id: "f1", activeVariants: [{ id: "v1" }] },
    after: { id: "f1", activeVariants: [{ id: "v1" }, { id: "v2" }] },
    response: { frameworkId: "f1", variantIds: ["v2", "v1"] },
  },
  {
    tool: "reactivate_framework",
    method: "POST",
    path: "/frameworks/f1/reactivate",
    read: "/frameworks/f1",
    input: { frameworkId: "f1", confirm: true },
    before: { id: "f1", status: "SNOOZED" },
    after: { id: "f1", status: "ACTIVE" },
    response: { status: "ACTIVE" },
  },
  {
    tool: "update_task_requirement_set_details",
    method: "PATCH",
    path: "/task-requirement-sets/s1/details",
    read: "/task-requirement-sets/s1",
    input: {
      requirementSetId: "s1",
      body: { description: "new" },
      confirm: true,
    },
    before: { id: "s1", description: "old" },
    after: { id: "s1", description: "new" },
    response: { id: "s1" },
  },
  {
    tool: "update_task_requirement_set_requirements",
    method: "PATCH",
    path: "/task-requirement-sets/s1/requirements",
    read: "/task-requirement-sets/s1",
    input: {
      requirementSetId: "s1",
      body: { onboarding: { policyAcceptance: { required: false } } },
      confirm: true,
    },
    before: {
      id: "s1",
      taskRequirements: {
        onboarding: { policyAcceptance: { required: true } },
      },
    },
    after: {
      id: "s1",
      taskRequirements: {
        onboarding: { policyAcceptance: { required: false } },
      },
    },
    response: { id: "s1" },
  },
]) {
  test(`${fixture.tool} reports success only after independent matching readback`, async () => {
    // Arrange
    const client = new FakeClient();
    client.queue(
      "GET",
      fixture.read,
      fixture.before
        ? [ok(fixture.before), ok(fixture.after)]
        : [ok(fixture.after)],
    );
    client.queue(fixture.method, fixture.path, [ok(fixture.response)]);
    // Initial assert
    assert.equal(client.calls.length, 0);
    // Act
    const result = await invoke(fixture.tool, fixture.input, client);
    // Assert
    assert.equal(result.success, true, JSON.stringify(result));
    assert.equal(
      (result.metadata as { verification: { status: string } }).verification
        .status,
      "verified",
    );
    assert.equal(
      client.calls.filter(call => call.method.toUpperCase() === fixture.method)
        .length,
      1,
    );
    assert.equal(client.calls.at(-1)?.path, fixture.read);
  });
}
