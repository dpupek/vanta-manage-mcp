import assert from "node:assert/strict";
import test from "node:test";
import { buildCapabilitiesPayload } from "../capabilities.js";

test("capabilities payload exposes tenant, spec, upload, and unsupported surfaces", () => {
  // Arrange
  const expectedUnsupportedSurface = "policy-control-linking";

  // Initial Assert
  assert.equal(expectedUnsupportedSurface.length > 0, true);

  // Act
  const capabilities = buildCapabilitiesPayload();

  // Assert
  assert.equal(capabilities.mcp.name, "vanta-mcp-full");
  assert.equal(typeof capabilities.mcp.version, "string");
  assert.equal(typeof capabilities.tenant.label, "string");
  assert.equal(typeof capabilities.runtime.writeEnabled, "boolean");
  assert.ok(capabilities.tools.generated.count > 0);
  assert.ok(capabilities.specSnapshot.totalOperations > 0);
  assert.ok(capabilities.uploads.supportedExtensions.includes(".pdf"));
  assert.ok(
    capabilities.uploads.markdownConversion.supportedInputExtensions.includes(
      ".md",
    ),
  );
  assert.ok(
    capabilities.unsupportedSurfaces.some(
      surface => surface.id === expectedUnsupportedSurface,
    ),
  );
});
