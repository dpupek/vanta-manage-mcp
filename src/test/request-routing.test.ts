import assert from "node:assert/strict";
import test from "node:test";
import { resolveVantaUrl } from "../client/vanta-client.js";

test("API families preserve version and proxy base paths", () => {
  // Arrange
  const cases = [
    [
      "https://api.vanta.com/v1",
      "/controls",
      "manage",
      "https://api.vanta.com/v1/controls",
    ],
    [
      "https://api.vanta-gov.com/v1/",
      "/audits",
      "audit",
      "https://api.vanta-gov.com/v1/audits",
    ],
    [
      "https://api.vanta.com/v1",
      "/v1/resources/custom_resource",
      "connectors",
      "https://api.vanta.com/v1/resources/custom_resource",
    ],
    [
      "https://api.vanta-gov.com/v1/",
      "/v1/resources/custom_resource",
      "connectors",
      "https://api.vanta-gov.com/v1/resources/custom_resource",
    ],
    [
      "http://localhost:1234/proxy/v1",
      "/v1/resources/custom_resource",
      "connectors",
      "http://localhost:1234/proxy/v1/resources/custom_resource",
    ],
    [
      "http://localhost:1234",
      "/controls",
      "manage",
      "http://localhost:1234/controls",
    ],
    [
      "http://localhost:1234",
      "/v1/resources/custom_resource",
      "connectors",
      "http://localhost:1234/v1/resources/custom_resource",
    ],
  ] as const;
  // Initial Assert
  assert.equal(cases.length, 7);
  // Act
  const actual = cases.map(
    ([base, route, source]) => resolveVantaUrl(base, route, source).href,
  );
  // Assert
  assert.deepEqual(
    actual,
    cases.map(([, , , expected]) => expected),
  );
});
