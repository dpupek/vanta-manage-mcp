import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  buildPdfFooterTemplate,
  cleanupMarkdownConversionArtifacts,
  resolveMarkdownConversionOptions,
} from "../uploads/markdown-conversion.js";
import { buildOperationSchema } from "../tools/operation-schema.js";
import { generatedOperations } from "../generated/operations.generated.js";

test("markdown conversion options default to PDF through auto renderer", () => {
  // Arrange
  const args = {
    filePath: "policy.md",
  };

  // Initial Assert
  assert.equal(args.filePath.endsWith(".md"), true);

  // Act
  const options = resolveMarkdownConversionOptions(args);

  // Assert
  assert.equal(options.target, "pdf");
  assert.equal(options.renderer, "auto");
  assert.equal(options.footerDocumentName, "policy.md");
});

test("PDF footer template includes document name and page numbering placeholders", () => {
  // Arrange
  const documentName = "Access Control Policy";

  // Initial Assert
  assert.equal(documentName.length > 0, true);

  // Act
  const footer = buildPdfFooterTemplate(documentName);

  // Assert
  assert.match(footer, /Access Control Policy/);
  assert.match(footer, /pageNumber/);
  assert.match(footer, /totalPages/);
});

test("DOCX conversion options retain a reference document path", () => {
  // Arrange
  const args = {
    filePath: "policy.md",
    markdownConversionTarget: "docx",
    markdownReferenceDocPath: "reference.docx",
  };

  // Initial Assert
  assert.equal(args.markdownConversionTarget, "docx");

  // Act
  const options = resolveMarkdownConversionOptions(args);

  // Assert
  assert.equal(options.target, "docx");
  assert.equal(options.referenceDocPath?.endsWith("reference.docx"), true);
});

test("markdown conversion cleanup removes temporary output directories", async () => {
  // Arrange
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "vanta-md-cleanup-"));
  const convertedPath = path.join(tempDir, "evidence.pdf");
  fs.writeFileSync(convertedPath, "converted", "utf8");

  try {
    // Initial Assert
    assert.equal(fs.existsSync(convertedPath), true);

    // Act
    await cleanupMarkdownConversionArtifacts([tempDir]);

    // Assert
    assert.equal(fs.existsSync(tempDir), false);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test("multipart schemas expose markdown conversion arguments", () => {
  // Arrange
  const operation = generatedOperations.find(
    candidate => candidate.operationId === "UploadFileForDocument",
  );
  assert.ok(operation);

  // Initial Assert
  assert.equal(operation.requestBody?.kind, "multipart");

  // Act
  const schema = buildOperationSchema(operation);
  const shape = schema.shape;

  // Assert
  assert.ok("markdownConversionTarget" in shape);
  assert.ok("markdownFooterDocumentName" in shape);
  assert.ok("markdownConversionRenderer" in shape);
});
