import assert from "node:assert/strict";
import test from "node:test";
import type { VantaRequest, VantaResponse } from "../client/vanta-client.js";
import { invokeGeneratedOperation } from "../tools/endpoint-tools.js";
import { parseToolEnvelope } from "./helpers.js";

const accepted = (data: unknown): VantaResponse => ({
  status: 200,
  ok: true,
  headers: {},
  data,
});

const unverifiedCases = [
  {
    name: "missing field",
    readback: accepted({ id: "c-1" }),
    reason: "field_missing",
  },
  {
    name: "stale value",
    readback: accepted({ implementationDetails: "Old details" }),
    reason: "value_mismatch",
  },
  {
    name: "null field",
    readback: accepted({ implementationDetails: null }),
    reason: "value_mismatch",
  },
  {
    name: "changed whitespace",
    readback: accepted({ implementationDetails: "New details " }),
    reason: "value_mismatch",
  },
  {
    name: "denied read",
    readback: { ...accepted({ error: "forbidden" }), status: 403, ok: false },
    reason: "read_failed",
  },
  {
    name: "transport failure",
    readback: new Error("Read connection closed"),
    reason: "read_failed",
  },
];

for (const fixture of unverifiedCases) {
  test(`accepted implementation write with ${fixture.name} is unverified without replaying PATCH`, async () => {
    // Arrange
    const calls: VantaRequest[] = [];
    const patchResponse = {
      id: "c-1",
      note: "Updated note",
      implementationDetails: "New details",
    };
    const client = {
      request: async (request: VantaRequest) => {
        calls.push(request);
        if (request.method === "patch") return accepted(patchResponse);
        if (fixture.readback instanceof Error) throw fixture.readback;
        return fixture.readback;
      },
    };
    // Initial Assert
    assert.equal(calls.length, 0);
    assert.equal(patchResponse.implementationDetails, "New details");
    // Act
    const result = await invokeGeneratedOperation(
      "update_control_metadata",
      {
        controlId: "c-1",
        body: { implementationDetails: "New details", note: "Updated note" },
        confirm: true,
      },
      client as never,
    );
    // Assert
    const envelope = parseToolEnvelope(result);
    const error = envelope.error as {
      code: string;
      hint: string;
      details: {
        mutationAccepted: boolean;
        writeStatus: number;
        apiResponse: unknown;
        verification: { reason: string };
      };
    };
    assert.equal(envelope.success, false);
    assert.equal(result.isError, true);
    assert.equal(error.code, "write_unverified");
    assert.equal(error.details.mutationAccepted, true);
    assert.equal(error.details.writeStatus, 200);
    assert.equal(error.details.verification.reason, fixture.reason);
    assert.deepEqual(error.details.apiResponse, patchResponse);
    assert.match(error.hint, /may have changed other supplied fields/);
    assert.deepEqual(
      calls.map(call => [call.method, call.path]),
      [
        ["patch", "/controls/c-1"],
        ["get", "/controls/c-1"],
      ],
    );
    assert.equal(calls[1].body, undefined);
  });
}

for (const details of [
  "Quarterly review\nExceptions require approval ✓.",
  "",
]) {
  test(`implementation details ${details === "" ? "clearing" : "multiline update"} is verified from independent readback`, async () => {
    // Arrange
    const calls: VantaRequest[] = [];
    const readback = {
      id: "c-1",
      implementationDetails: details,
      note: "Readback state",
    };
    const client = {
      request: async (request: VantaRequest) => {
        calls.push(request);
        return accepted(request.method === "patch" ? { id: "c-1" } : readback);
      },
    };
    // Initial Assert
    assert.equal(calls.length, 0);
    assert.equal(readback.implementationDetails, details);
    // Act
    const result = await invokeGeneratedOperation(
      "update_control_metadata",
      {
        controlId: "c-1",
        body: { implementationDetails: details },
        confirm: true,
      },
      client as never,
    );
    // Assert
    const envelope = parseToolEnvelope(result);
    assert.equal(envelope.success, true);
    assert.equal(result.isError, false);
    assert.deepEqual(envelope.data, readback);
    assert.deepEqual(envelope.metadata, {
      verification: { field: "implementationDetails", status: "verified" },
    });
    assert.deepEqual(
      calls.map(call => call.method),
      ["patch", "get"],
    );
  });
}

test("rejected implementation PATCH remains an API error without a verification read", async () => {
  // Arrange
  const calls: VantaRequest[] = [];
  const client = {
    request: async (request: VantaRequest) => {
      calls.push(request);
      return { ...accepted({ message: "Forbidden" }), status: 403, ok: false };
    },
  };
  // Initial Assert
  assert.equal(calls.length, 0);
  // Act
  const result = await invokeGeneratedOperation(
    "update_control_metadata",
    {
      controlId: "c-1",
      body: { implementationDetails: "Details" },
      confirm: true,
    },
    client as never,
  );
  // Assert
  const envelope = parseToolEnvelope(result);
  assert.equal(envelope.success, false);
  assert.equal((envelope.error as { code: string }).code, "api_error");
  assert.deepEqual(
    calls.map(call => call.method),
    ["patch"],
  );
});

test("ordinary control metadata update retains its PATCH response without an extra GET", async () => {
  // Arrange
  const calls: VantaRequest[] = [];
  const payload = { id: "c-1", note: "Updated note" };
  const client = {
    request: async (request: VantaRequest) => {
      calls.push(request);
      return accepted(payload);
    },
  };
  // Initial Assert
  assert.equal(calls.length, 0);
  // Act
  const result = await invokeGeneratedOperation(
    "update_control_metadata",
    {
      controlId: "c-1",
      body: { note: "Updated note" },
      confirm: true,
    },
    client as never,
  );
  // Assert
  const envelope = parseToolEnvelope(result);
  assert.equal(envelope.success, true);
  assert.deepEqual(envelope.data, payload);
  assert.equal(envelope.metadata, undefined);
  assert.deepEqual(
    calls.map(call => call.method),
    ["patch"],
  );
});
