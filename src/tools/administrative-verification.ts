import { isDeepStrictEqual } from "node:util";
import { setTimeout as sleep } from "node:timers/promises";
import { VantaApiClient, VantaResponse } from "../client/vanta-client.js";
import { currentRequestSignal } from "../client/request-context.js";

interface Read {
  ok: boolean;
  status: number;
  data: unknown;
  error?: string;
}
export interface AdministrativeContext {
  tool: string;
  args: Record<string, unknown>;
  before?: unknown;
  capturedVendors?: string[];
  capturedVendorSnapshots?: Record<string, unknown>[];
  warnings: string[];
}
export interface AdministrativeVerification {
  verified: boolean;
  reason?: string;
  warnings: string[];
  readback?: unknown;
  attempts: number;
  fields?: SnoozeVerificationFields;
}
interface SnoozeVerificationFields {
  status: {
    verification: "verified" | "unverified";
    requested: "SNOOZED";
    readbackValue: unknown;
  };
  snoozedUntilDate: {
    verification: "verified" | "unverified";
    requested: unknown;
    writeResponseValue: unknown;
    writeResponseMatchesRequest: boolean | null;
    readbackPresent: boolean;
    readbackValue: unknown;
  };
}
const snoozeFields = (
  args: Record<string, unknown>,
  mutation: VantaResponse,
  actual?: Record<string, unknown>,
): SnoozeVerificationFields => {
  const requested = object(args.body)?.snoozedUntilDate ?? null;
  const writeResponse = object(mutation.data);
  const returned =
    writeResponse && Object.hasOwn(writeResponse, "snoozedUntilDate");
  const present = Boolean(actual && Object.hasOwn(actual, "snoozedUntilDate"));
  return {
    status: {
      verification: actual?.status === "SNOOZED" ? "verified" : "unverified",
      requested: "SNOOZED",
      readbackValue: actual?.status ?? null,
    },
    snoozedUntilDate: {
      verification:
        present && actual?.snoozedUntilDate === requested
          ? "verified"
          : "unverified",
      requested,
      writeResponseValue: returned ? writeResponse.snoozedUntilDate : null,
      writeResponseMatchesRequest: returned
        ? writeResponse.snoozedUntilDate === requested
        : null,
      readbackPresent: present,
      readbackValue: present ? actual?.snoozedUntilDate : null,
    },
  };
};
const object = (value: unknown): Record<string, unknown> | undefined =>
  typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
const encoded = (value: unknown): string => encodeURIComponent(String(value));
const selected = new Set([
  "update_vendor_alert_settings",
  "create_vendor_category",
  "update_vendor_category",
  "delete_vendor_category",
  "set_engagement",
  "remove_engagement",
  "set_framework_variant",
  "snooze_framework",
  "reactivate_framework",
  "update_task_requirement_set_details",
  "update_task_requirement_set_requirements",
]);
export const needsAdministrativeVerification = (
  tool: string,
  args: Record<string, unknown>,
): boolean =>
  selected.has(tool) ||
  ((tool === "create_vendor" || tool === "update_vendor") &&
    Object.hasOwn(object(args.body) ?? {}, "categoryId"));

const pathFor = (
  tool: string,
  args: Record<string, unknown>,
  result?: unknown,
): string | undefined => {
  switch (tool) {
    case "update_vendor_alert_settings":
      return "/vendor-alert-settings";
    case "create_vendor_category": {
      const id = object(result)?.id;
      return typeof id === "string" && id
        ? `/vendor-categories/${encoded(id)}`
        : undefined;
    }
    case "create_vendor": {
      const id = object(result)?.id;
      return typeof id === "string" && id
        ? `/vendors/${encoded(id)}`
        : undefined;
    }
    case "update_vendor_category":
    case "delete_vendor_category":
      return `/vendor-categories/${encoded(args.categoryId)}`;
    case "set_engagement":
    case "remove_engagement":
      return `/vendors/${encoded(args.engagementVendorId)}`;
    case "update_vendor":
      return `/vendors/${encoded(args.vendorId)}`;
    case "set_framework_variant":
    case "snooze_framework":
    case "reactivate_framework":
      return `/frameworks/${encoded(args.frameworkId)}`;
    case "update_task_requirement_set_details":
    case "update_task_requirement_set_requirements":
      return `/task-requirement-sets/${encoded(args.requirementSetId)}`;
    default:
      return undefined;
  }
};
const read = async (
  client: VantaApiClient,
  path: string,
  query?: Record<string, unknown>,
  maxRetries = 0,
): Promise<Read> => {
  try {
    const result = await client.request({
      method: "get",
      path,
      query,
      maxRetries,
    });
    return { ok: result.ok, status: result.status, data: result.data };
  } catch (error) {
    return {
      ok: false,
      status: 0,
      data: null,
      error: error instanceof Error ? error.message : String(error),
    };
  }
};

const vendorInventory = async (
  client: VantaApiClient,
  categoryId: string,
): Promise<{
  ids?: string[];
  snapshots?: Record<string, unknown>[];
  reason?: string;
}> => {
  const ids: string[] = [];
  const snapshots: Record<string, unknown>[] = [];
  const seen = new Set<string>();
  let cursor: string | undefined;
  for (let page = 0; page < 100; page += 1) {
    const response = await read(
      client,
      "/vendors",
      { pageSize: 100, ...(cursor ? { pageCursor: cursor } : {}) },
      2,
    );
    if (!response.ok)
      return {
        reason: `Vendor inventory failed (HTTP ${response.status.toString()}).`,
      };
    const results = object(object(response.data)?.results);
    const rows = results?.data;
    const info = object(results?.pageInfo);
    if (!Array.isArray(rows) || typeof info?.hasNextPage !== "boolean")
      return {
        reason:
          "Vendor inventory did not include complete pagination information.",
      };
    for (const value of rows) {
      const row = object(value);
      if (
        typeof row?.id !== "string" ||
        !("categoryId" in row) ||
        !(typeof row.categoryId === "string" || row.categoryId === null)
      )
        return { reason: "Vendor inventory omitted an ID or category ID." };
      if (row.categoryId === categoryId) {
        ids.push(row.id);
        snapshots.push(row);
      }
    }
    if (!info.hasNextPage) return { ids: [...new Set(ids)].sort(), snapshots };
    if (
      typeof info.endCursor !== "string" ||
      !info.endCursor ||
      seen.has(info.endCursor)
    )
      return { reason: "Vendor inventory has an invalid or repeated cursor." };
    cursor = info.endCursor;
    seen.add(cursor);
  }
  return { reason: "Vendor inventory exceeded the 100-page safety limit." };
};

export async function prepareAdministrativeVerification(
  tool: string,
  args: Record<string, unknown>,
  client: VantaApiClient,
): Promise<{ context?: AdministrativeContext; error?: string }> {
  if (!needsAdministrativeVerification(tool, args)) return {};
  const context: AdministrativeContext = { tool, args, warnings: [] };
  const path = pathFor(tool, args);
  if (path) {
    const before = await read(
      client,
      path,
      tool.includes("framework") ? { includeStatus: true } : undefined,
      tool === "delete_vendor_category" ? 2 : 0,
    );
    if (before.ok) {
      context.before = before.data;
      if (tool === "remove_engagement") {
        const vendor = object(before.data);
        const parent = vendor?.parentVendor;
        if (
          vendor &&
          Object.hasOwn(vendor, "parentVendor") &&
          (parent === null ||
            (typeof object(parent)?.id === "string" &&
              object(parent)?.id !== args.parentVendorId))
        ) {
          context.warnings.push(
            "The requested engagement was not attached to this parent before the write; Vanta may report a successful no-op.",
          );
        }
      }
    } else if (tool === "delete_vendor_category")
      return {
        error: `Cannot read the category before deletion (HTTP ${before.status.toString()}).`,
      };
    else
      context.warnings.push(
        "The pre-write read failed; unrelated changes cannot be compared.",
      );
  }
  if (tool === "delete_vendor_category") {
    const first = await vendorInventory(client, String(args.categoryId));
    if (!first.ids) return { error: first.reason };
    const fresh = await vendorInventory(client, String(args.categoryId));
    if (!fresh.ids) return { error: fresh.reason };
    if (!isDeepStrictEqual(first.ids, fresh.ids))
      context.warnings.push(
        "Affected vendors changed between pre-delete inventories.",
      );
    context.capturedVendors = fresh.ids;
    context.capturedVendorSnapshots = fresh.snapshots;
    context.warnings.push(
      "Concurrent vendor-category assignments between inventory and deletion cannot be ruled out.",
    );
    context.warnings.push(
      "A post-delete 404 confirms the category is no longer visible to this caller; it cannot independently rule out a permission change.",
    );
  }
  return { context };
}

const contains = (actual: unknown, expected: unknown): boolean => {
  const expectedObject = object(expected);
  if (expectedObject) {
    const actualObject = object(actual);
    return Boolean(
      actualObject &&
        Object.entries(expectedObject).every(
          ([key, value]) =>
            Object.hasOwn(actualObject, key) &&
            contains(actualObject[key], value),
        ),
    );
  }
  return isDeepStrictEqual(actual, expected);
};
const otherChanges = (
  before: unknown,
  after: unknown,
  requested: unknown,
): boolean => {
  const old = object(before),
    next = object(after),
    changes = object(requested) ?? {};
  if (!old || !next) return false;
  const volatile = new Set(["updatedAt", "updatedDate", "lastUpdatedAt"]);
  return Object.keys(old).some(key => {
    if (volatile.has(key)) return false;
    if (Object.hasOwn(changes, key))
      return object(changes[key])
        ? otherChanges(old[key], next[key], changes[key])
        : false;
    return Object.hasOwn(next, key) && !isDeepStrictEqual(old[key], next[key]);
  });
};

const assess = async (
  context: AdministrativeContext,
  client: VantaApiClient,
  mutation: VantaResponse,
): Promise<{
  verified: boolean;
  reason?: string;
  data?: unknown;
  drift?: boolean;
  stop?: boolean;
  fields?: SnoozeVerificationFields;
}> => {
  const { tool, args, before } = context;
  const body = object(args.body) ?? {};
  const path = pathFor(tool, args, mutation.data);
  if (!path)
    return {
      verified: false,
      reason:
        "The accepted response did not include the ID needed for readback.",
    };
  const response = await read(
    client,
    path,
    tool.includes("framework") ? { includeStatus: true } : undefined,
  );
  if (tool === "delete_vendor_category") {
    if (response.status !== 404)
      return {
        verified: false,
        reason: "Category deletion was not confirmed by a 404 readback.",
        data: response,
      };
    const expected = body.replacementCategoryId;
    const outcomes = [];
    let drift = false;
    for (const id of context.capturedVendors ?? []) {
      const vendor = await read(client, `/vendors/${encoded(id)}`);
      const beforeVendor = context.capturedVendorSnapshots?.find(
        item => item.id === id,
      );
      if (
        vendor.ok &&
        otherChanges(beforeVendor, vendor.data, { categoryId: true })
      )
        drift = true;
      outcomes.push({
        id,
        ok:
          vendor.ok &&
          object(vendor.data)?.id === id &&
          Object.hasOwn(object(vendor.data) ?? {}, "categoryId") &&
          object(vendor.data)?.categoryId === expected,
        status: vendor.status,
      });
    }
    return {
      verified: outcomes.every(item => item.ok),
      reason: "One or more captured vendors could not be verified.",
      data: { categoryStatus: response.status, outcomes },
      drift,
    };
  }
  if (!response.ok)
    return {
      verified: false,
      reason: `Readback failed (HTTP ${response.status.toString()}).`,
      data: response,
    };
  const actual = object(response.data);
  if (!actual)
    return {
      verified: false,
      reason: "Readback was not an object.",
      data: response,
    };
  const expectedId =
    tool === "update_vendor_alert_settings"
      ? undefined
      : tool === "create_vendor_category" || tool === "create_vendor"
        ? object(mutation.data)?.id
        : tool === "update_vendor_category"
          ? args.categoryId
          : tool === "set_engagement" || tool === "remove_engagement"
            ? args.engagementVendorId
            : tool === "update_vendor"
              ? args.vendorId
              : tool.includes("framework")
                ? args.frameworkId
                : args.requirementSetId;
  if (expectedId !== undefined && actual.id !== expectedId) {
    return {
      verified: false,
      reason: "The independent read returned a different or missing object ID.",
      data: response.data,
    };
  }
  let matches = false;
  let requested: unknown = body;
  let beforeForDrift: unknown = before;
  let afterForDrift: unknown = actual;
  if (tool === "update_vendor_alert_settings") {
    const changes = body.changes;
    const rows = actual.items;
    matches =
      Array.isArray(changes) &&
      Array.isArray(rows) &&
      changes.every(change => {
        const c = object(change);
        return (
          c &&
          rows.some(
            row => object(row)?.category === c.category && contains(row, c),
          )
        );
      });
    const priorItems = object(before)?.items;
    if (
      Array.isArray(priorItems) &&
      Array.isArray(rows) &&
      Array.isArray(changes)
    ) {
      const unexpected = (priorItems as unknown[]).some(item => {
        const old = object(item);
        const next = (rows as unknown[]).find(
          row => object(row)?.category === old?.category,
        );
        const change = (changes as unknown[]).find(
          row => object(row)?.category === old?.category,
        );
        return otherChanges(old, next, change);
      });
      return {
        verified: matches,
        reason: "One or more requested alert settings did not match.",
        data: response.data,
        drift: unexpected,
      };
    }
  } else if (tool === "set_engagement" || tool === "remove_engagement") {
    const parent = actual.parentVendor;
    const parentId = parent === null ? null : object(parent)?.id;
    matches = parent === null || typeof parentId === "string";
    matches =
      matches &&
      (tool === "set_engagement"
        ? parentId === args.parentVendorId
        : parentId !== args.parentVendorId);
    requested = { parentVendor: true };
  } else if (tool === "set_framework_variant") {
    const variants = actual.activeVariants;
    const expected = body.variantIds;
    matches =
      Array.isArray(variants) &&
      Array.isArray(expected) &&
      variants.every(value => typeof object(value)?.id === "string") &&
      isDeepStrictEqual(
        variants.map(value => object(value)?.id).sort(),
        [...(expected as unknown[])].sort(),
      );
    requested = { activeVariants: true };
  } else if (tool === "snooze_framework") {
    const fields = snoozeFields(args, mutation, actual);
    const statusVerified = fields.status.verification === "verified";
    const dateVerified = fields.snoozedUntilDate.verification === "verified";
    return {
      verified: statusVerified && dateVerified,
      reason: !statusVerified
        ? "Independent readback did not confirm the snoozed status."
        : !fields.snoozedUntilDate.readbackPresent
          ? "The public framework read does not expose the requested snooze-until date."
          : "Independent readback did not match the requested snooze-until date.",
      data: response.data,
      drift: otherChanges(before, actual, {
        status: true,
        snoozedUntilDate: true,
      }),
      stop: statusVerified && !fields.snoozedUntilDate.readbackPresent,
      fields,
    };
  } else if (tool === "reactivate_framework") {
    matches = actual.status === "ACTIVE";
    requested = { status: true, snoozedUntilDate: true };
  } else if (tool === "update_task_requirement_set_requirements") {
    matches = contains(actual.taskRequirements, body);
    requested = body;
    beforeForDrift = object(before)?.taskRequirements;
    afterForDrift = actual.taskRequirements;
  } else {
    requested = body;
    matches = contains(actual, requested);
  }
  return {
    verified: matches,
    reason:
      tool === "snooze_framework" && !Object.hasOwn(actual, "snoozedUntilDate")
        ? "The public framework read does not expose the requested snooze-until date."
        : "Independent readback did not match the requested fields.",
    data: response.data,
    drift: otherChanges(beforeForDrift, afterForDrift, requested),
  };
};

export async function verifyAdministrativeWrite(
  context: AdministrativeContext,
  client: VantaApiClient,
  mutation: VantaResponse,
  wait: (ms: number, signal?: AbortSignal) => Promise<void> = async (
    ms,
    signal,
  ) => {
    await sleep(ms, undefined, { signal });
  },
): Promise<AdministrativeVerification> {
  let last: Awaited<ReturnType<typeof assess>> = {
    verified: false,
    reason: "Readback not attempted.",
  };
  let attempts = 0;
  for (let i = 0; i < 3; i += 1) {
    attempts += 1;
    try {
      last = await assess(context, client, mutation);
    } catch (error) {
      last = {
        verified: false,
        reason: error instanceof Error ? error.message : String(error),
      };
    }
    if (
      last.verified ||
      last.stop === true ||
      currentRequestSignal()?.aborted === true
    )
      break;
    if (i < 2) {
      try {
        await wait(250, currentRequestSignal());
      } catch {
        break;
      }
    }
  }
  const warnings = [...context.warnings];
  if (last.drift)
    warnings.push(
      "Unrequested fields changed between pre-write and readback; review concurrent changes.",
    );
  return {
    verified: last.verified,
    reason: last.verified ? undefined : last.reason,
    warnings,
    readback: last.data,
    attempts,
    ...(context.tool === "snooze_framework"
      ? { fields: last.fields ?? snoozeFields(context.args, mutation) }
      : {}),
  };
}
