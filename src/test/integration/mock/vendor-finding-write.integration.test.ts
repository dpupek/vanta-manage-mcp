import assert from "node:assert/strict";
import test from "node:test";
import { parseToolEnvelope } from "../../helpers.js";
import { FakeVantaServer } from "./fake-vanta-server.js";
import { McpStdioHarness } from "./mcp-stdio-harness.js";

const parseMultipartField = (
  rawBody: string,
  fieldName: string,
): string | null => {
  const match = rawBody.match(
    new RegExp(`name="${fieldName}"\\r\\n\\r\\n([^\\r\\n]+)`, "u"),
  );
  return match?.[1] ?? null;
};

test("mock vendor + finding write lifecycle performs readback assertions", async () => {
  // Arrange
  const fakeServer = new FakeVantaServer();
  await fakeServer.start();
  const harness = new McpStdioHarness({
    envOverrides: {
      VANTA_API_BASE_URL: fakeServer.baseUrl,
      VANTA_CLIENT_ID: "fake-client-id",
      VANTA_CLIENT_SECRET: "fake-client-secret",
      VANTA_ENV_FILE: undefined,
    },
  });
  await harness.start();

  const vendor = {
    id: "vendor-1",
    name: "Vendor One",
    status: "MANAGED",
    additionalNotes: "Initial note",
  };
  const findings: Record<string, unknown>[] = [];

  fakeServer.setRoute("GET", "/vendors/vendor-1", () => ({
    status: 200,
    body: vendor,
  }));
  fakeServer.setRoute("PATCH", "/vendors/vendor-1", request => {
    const body = request.jsonBody as Record<string, unknown>;
    if (typeof body.additionalNotes === "string") {
      vendor.additionalNotes = body.additionalNotes;
    }
    return { status: 200, body: vendor };
  });
  fakeServer.setRoute("POST", "/vendors/vendor-1/set-status", request => {
    const status = parseMultipartField(request.rawBody, "status");
    if (!status) {
      return { status: 400, body: { error: "missing_status" } };
    }
    vendor.status = status;
    return { status: 200, body: vendor };
  });
  fakeServer.setRoute("GET", "/vendors/vendor-1/findings", () => ({
    status: 200,
    body: {
      results: {
        data: findings,
        pageInfo: {
          hasNextPage: false,
          hasPreviousPage: false,
          startCursor: null,
          endCursor: null,
        },
      },
    },
  }));
  fakeServer.setRoute("POST", "/vendors/vendor-1/findings", request => {
    const body = request.jsonBody as Record<string, unknown>;
    const finding = {
      id: "finding-1",
      content: body.content,
      riskStatus: body.riskStatus,
      remediation: body.remediation ?? null,
    };
    findings.push(finding);
    return { status: 200, body: finding };
  });
  fakeServer.setRoute("PATCH", "/vendors/vendor-1/findings/finding-1", request => {
    const body = request.jsonBody as Record<string, unknown>;
    const finding = findings.find(item => item.id === "finding-1");
    if (!finding) {
      return { status: 404, body: { error: "not_found" } };
    }
    if (typeof body.content === "string") {
      finding.content = body.content;
    }
    if (typeof body.riskStatus === "string") {
      finding.riskStatus = body.riskStatus;
    }
    return { status: 200, body: finding };
  });
  fakeServer.setRoute("DELETE", "/vendors/vendor-1/findings/finding-1", () => {
    const index = findings.findIndex(item => item.id === "finding-1");
    if (index >= 0) {
      findings.splice(index, 1);
    }
    return { status: 204 };
  });

  try {
    // Initial Assert
    assert.equal(findings.length, 0);

    // Act
    const updateVendor = await harness.callTool("update_vendor", {
      vendorId: "vendor-1",
      body: { additionalNotes: "Updated note" },
      confirm: true,
    });
    const updateEnvelope = parseToolEnvelope(updateVendor);

    const readVendor = await harness.callTool("get_vendor", {
      vendorId: "vendor-1",
    });
    const readVendorEnvelope = parseToolEnvelope(readVendor);

    const setStatus = await harness.callTool("set_status_for_vendor", {
      vendorId: "vendor-1",
      status: "IN_PROCUREMENT",
      confirm: true,
    });
    const setStatusEnvelope = parseToolEnvelope(setStatus);

    const createFinding = await harness.callTool("create_vendor_finding", {
      vendorId: "vendor-1",
      body: {
        content: "Missing penetration test evidence",
        riskStatus: "REMEDIATE",
        remediation: { state: "OPEN", requirementNotes: "Follow-up required" },
      },
      confirm: true,
    });
    const createFindingEnvelope = parseToolEnvelope(createFinding);

    const listFindingsAfterCreate = await harness.callTool("list_vendor_findings", {
      vendorId: "vendor-1",
      pageSize: 20,
    });
    const findingsAfterCreateEnvelope = parseToolEnvelope(listFindingsAfterCreate);

    const updateFinding = await harness.callTool("update_vendor_finding", {
      vendorId: "vendor-1",
      findingId: "finding-1",
      body: {
        content: "Accepted temporary exception",
        riskStatus: "ACCEPT",
      },
      confirm: true,
    });
    const updateFindingEnvelope = parseToolEnvelope(updateFinding);

    const deleteFinding = await harness.callTool("delete_finding_by_id", {
      vendorId: "vendor-1",
      findingId: "finding-1",
      confirm: true,
    });
    const deleteFindingEnvelope = parseToolEnvelope(deleteFinding);

    const listFindingsAfterDelete = await harness.callTool("list_vendor_findings", {
      vendorId: "vendor-1",
      pageSize: 20,
    });
    const findingsAfterDeleteEnvelope = parseToolEnvelope(listFindingsAfterDelete);

    // Assert
    assert.equal(updateEnvelope.success, true);
    assert.equal(readVendorEnvelope.success, true);
    assert.equal(
      (readVendorEnvelope.data as Record<string, unknown>).additionalNotes,
      "Updated note",
    );
    assert.equal(setStatusEnvelope.success, true);
    assert.equal(
      (setStatusEnvelope.data as Record<string, unknown>).status,
      "IN_PROCUREMENT",
    );
    assert.equal(createFindingEnvelope.success, true);
    assert.equal(findingsAfterCreateEnvelope.success, true);
    const findingsAfterCreate = (
      findingsAfterCreateEnvelope.data as { results?: { data?: Record<string, unknown>[] } }
    ).results?.data ?? [];
    assert.equal(findingsAfterCreate.length, 1);
    assert.equal(updateFindingEnvelope.success, true);
    assert.equal(deleteFindingEnvelope.success, true);
    assert.equal(findingsAfterDeleteEnvelope.success, true);
    const findingsAfterDelete = (
      findingsAfterDeleteEnvelope.data as { results?: { data?: Record<string, unknown>[] } }
    ).results?.data ?? [];
    assert.equal(findingsAfterDelete.length, 0);
  } finally {
    await harness.stop();
    await fakeServer.stop();
  }
});
