import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export type MarkdownConversionTarget = "pdf" | "docx";
export type MarkdownConversionRenderer =
  | "auto"
  | "playwright"
  | "typst"
  | "docx";

export interface MarkdownConversionOptions {
  target: MarkdownConversionTarget;
  renderer: MarkdownConversionRenderer;
  footerDocumentName: string;
  referenceDocPath?: string;
}

export interface MarkdownConversionMetadata {
  convertedFrom: "markdown";
  conversionTarget: MarkdownConversionTarget;
  renderer: MarkdownConversionRenderer;
  originalFilePath: string;
  uploadedFilePath: string;
  footerDocumentName?: string;
  referenceDocPath?: string;
}

export interface MarkdownConversionResult {
  outputPath: string;
  cleanupPaths: string[];
  metadata: MarkdownConversionMetadata;
  warnings: string[];
}

export const resolveMarkdownConversionOptions = (
  args: Record<string, unknown>,
): MarkdownConversionOptions => {
  const filePath =
    typeof args.filePath === "string" && args.filePath.trim().length > 0
      ? args.filePath.trim()
      : "document.md";
  const explicitTarget = args.markdownConversionTarget;
  const explicitRenderer = args.markdownConversionRenderer;
  const explicitFooterName = args.markdownFooterDocumentName;
  const explicitReferenceDoc = args.markdownReferenceDocPath;

  const target: MarkdownConversionTarget =
    explicitTarget === "docx" ? "docx" : "pdf";
  const renderer: MarkdownConversionRenderer =
    explicitRenderer === "playwright" ||
    explicitRenderer === "typst" ||
    explicitRenderer === "docx"
      ? explicitRenderer
      : "auto";
  const footerDocumentName =
    typeof explicitFooterName === "string" &&
    explicitFooterName.trim().length > 0
      ? explicitFooterName.trim()
      : path.basename(filePath);

  return {
    target,
    renderer,
    footerDocumentName,
    referenceDocPath:
      typeof explicitReferenceDoc === "string" &&
      explicitReferenceDoc.trim().length > 0
        ? path.resolve(explicitReferenceDoc.trim())
        : undefined,
  };
};

export const buildPdfFooterTemplate = (documentName: string): string => {
  const safeDocumentName = escapeHtml(documentName);
  return `
    <div style="width:100%; font-size:8px; color:#555; padding:0 24px; display:flex; justify-content:space-between;">
      <span>${safeDocumentName}</span>
      <span>Page <span class="pageNumber"></span> of <span class="totalPages"></span></span>
    </div>
  `;
};

export const convertMarkdownEvidence = async (
  inputPath: string,
  args: Record<string, unknown>,
): Promise<MarkdownConversionResult> => {
  const options = resolveMarkdownConversionOptions({
    ...args,
    filePath: inputPath,
  });
  const tempDir = await fs.mkdtemp(
    path.join(os.tmpdir(), "vanta-md-evidence-"),
  );
  const baseName = path.basename(inputPath, path.extname(inputPath));
  const outputPath = path.join(tempDir, `${baseName}.${options.target}`);

  if (options.target === "docx") {
    await convertMarkdownToDocx(inputPath, outputPath, options);
    return buildResult(inputPath, outputPath, tempDir, options, [
      "Converted Markdown to DOCX before Vanta upload.",
    ]);
  }

  if (options.renderer === "typst") {
    await convertMarkdownToTypstPdf(inputPath, outputPath);
    return buildResult(inputPath, outputPath, tempDir, options, [
      "Converted Markdown to PDF using Typst before Vanta upload.",
    ]);
  }

  await convertMarkdownToPlaywrightPdf(inputPath, outputPath, options);
  return buildResult(inputPath, outputPath, tempDir, options, [
    "Converted Markdown to PDF before Vanta upload.",
  ]);
};

const buildResult = (
  inputPath: string,
  outputPath: string,
  tempDir: string,
  options: MarkdownConversionOptions,
  warnings: string[],
): MarkdownConversionResult => ({
  outputPath,
  cleanupPaths: [tempDir],
  metadata: {
    convertedFrom: "markdown",
    conversionTarget: options.target,
    renderer: options.target === "docx" ? "docx" : options.renderer,
    originalFilePath: inputPath,
    uploadedFilePath: outputPath,
    footerDocumentName: options.footerDocumentName,
    referenceDocPath: options.referenceDocPath,
  },
  warnings,
});

export const cleanupMarkdownConversionArtifacts = async (
  cleanupPaths: string[] | undefined,
): Promise<void> => {
  for (const cleanupPath of cleanupPaths ?? []) {
    await fs.rm(cleanupPath, { recursive: true, force: true });
  }
};

const convertMarkdownToDocx = async (
  inputPath: string,
  outputPath: string,
  options: MarkdownConversionOptions,
): Promise<void> => {
  const args = [inputPath, "--from", "gfm", "--output", outputPath];
  if (options.referenceDocPath) {
    args.push("--reference-doc", options.referenceDocPath);
  }
  await runPandoc(args);
};

const convertMarkdownToTypstPdf = async (
  inputPath: string,
  outputPath: string,
): Promise<void> => {
  await runPandoc([
    inputPath,
    "--from",
    "gfm",
    "--pdf-engine",
    "typst",
    "--output",
    outputPath,
  ]);
};

const convertMarkdownToPlaywrightPdf = async (
  inputPath: string,
  outputPath: string,
  options: MarkdownConversionOptions,
): Promise<void> => {
  let browser: Awaited<
    ReturnType<
      Awaited<ReturnType<typeof importPlaywright>>["chromium"]["launch"]
    >
  > | null = null;
  try {
    const htmlPath = outputPath.replace(/\.pdf$/iu, ".html");
    await runPandoc([
      inputPath,
      "--from",
      "gfm",
      "--to",
      "html5",
      "--standalone",
      "--output",
      htmlPath,
    ]);
    const html = await fs.readFile(htmlPath, "utf8");
    const { chromium } = await importPlaywright();
    browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "networkidle" });
    await page.pdf({
      path: outputPath,
      format: "Letter",
      printBackground: true,
      displayHeaderFooter: true,
      headerTemplate: "<span></span>",
      footerTemplate: buildPdfFooterTemplate(options.footerDocumentName),
      margin: {
        top: "0.65in",
        right: "0.65in",
        bottom: "0.75in",
        left: "0.65in",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (
      message.includes("Executable doesn't exist") ||
      message.toLowerCase().includes("browser") ||
      message.toLowerCase().includes("chromium")
    ) {
      throw new MarkdownConversionError(
        "markdown_converter_unavailable",
        `Unable to launch Playwright Chromium for PDF rendering: ${message}`,
      );
    }
    throw new MarkdownConversionError(
      "markdown_conversion_failed",
      `Unable to convert Markdown to PDF: ${message}`,
    );
  } finally {
    await browser?.close();
  }
};

const runPandoc = async (args: string[]): Promise<void> => {
  try {
    await execFileAsync("pandoc", args, { windowsHide: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new MarkdownConversionError(
      "markdown_converter_unavailable",
      `Unable to run pandoc for Markdown conversion: ${message}`,
    );
  }
};

const importPlaywright = async (): Promise<{
  chromium: {
    launch: (options: { headless: true }) => Promise<{
      newPage: () => Promise<{
        setContent: (
          html: string,
          options: { waitUntil: "networkidle" },
        ) => Promise<void>;
        pdf: (options: Record<string, unknown>) => Promise<Buffer>;
      }>;
      close: () => Promise<void>;
    }>;
  };
}> => {
  const moduleName = "playwright";
  try {
    return (await import(moduleName)) as Awaited<
      ReturnType<typeof importPlaywright>
    >;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new MarkdownConversionError(
      "markdown_converter_unavailable",
      `Unable to load Playwright for PDF rendering: ${message}`,
    );
  }
};

const escapeHtml = (value: string): string =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");

export class MarkdownConversionError extends Error {
  public constructor(
    public readonly code:
      | "markdown_converter_unavailable"
      | "markdown_conversion_failed",
    message: string,
  ) {
    super(message);
    this.name = "MarkdownConversionError";
  }
}
