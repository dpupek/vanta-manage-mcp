import fs from "node:fs";
import path from "node:path";
import { getUploadPolicyForTool } from "./policy.js";
import { UploadValidationResult } from "./types.js";
import {
  convertMarkdownEvidence,
  MarkdownConversionError,
} from "./markdown-conversion.js";

export const extensionToMimeType: Record<string, string> = {
  ".pdf": "application/pdf",
  ".docx":
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ".csv": "text/csv",
  ".txt": "text/plain",
  ".md": "text/markdown",
  ".markdown": "text/markdown",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".zip": "application/zip",
  ".ps": "application/postscript",
};

const normalizeMimeType = (value: unknown): string | null => {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim().toLowerCase();
  if (!trimmed) {
    return null;
  }
  return trimmed;
};

const mimeMatchesPattern = (value: string, pattern: string): boolean => {
  const normalizedPattern = pattern.toLowerCase();
  if (normalizedPattern.endsWith("/*")) {
    const prefix = normalizedPattern.slice(0, normalizedPattern.length - 1);
    return value.startsWith(prefix);
  }
  return value === normalizedPattern;
};

const mimeAllowed = (value: string, allowedPatterns: string[]): boolean =>
  allowedPatterns.some(pattern => mimeMatchesPattern(value, pattern));

export const validateUploadFileInput = (
  toolName: string,
  args: Record<string, unknown>,
): UploadValidationResult => {
  const rawFilePath = args.filePath;
  if (typeof rawFilePath !== "string" || rawFilePath.trim().length === 0) {
    return {
      success: false,
      error: {
        code: "file_path_required",
        message: "filePath is required for multipart upload tools.",
        hint: "Pass a local readable file path in filePath.",
        details: { toolName },
      },
    };
  }

  const resolvedPath = path.resolve(rawFilePath.trim());
  if (!fs.existsSync(resolvedPath)) {
    return {
      success: false,
      error: {
        code: "file_not_found",
        message: `File does not exist: ${resolvedPath}`,
        hint: "Verify the path and ensure the file exists on the local machine.",
        details: { toolName, filePath: resolvedPath },
      },
    };
  }

  let stats: fs.Stats;
  try {
    stats = fs.statSync(resolvedPath);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      success: false,
      error: {
        code: "file_not_readable",
        message: `Unable to stat file at ${resolvedPath}.`,
        hint: "Ensure the path points to a readable file and retry.",
        details: { toolName, filePath: resolvedPath, reason: message },
      },
    };
  }

  if (!stats.isFile()) {
    return {
      success: false,
      error: {
        code: "file_not_regular",
        message: `Path is not a regular file: ${resolvedPath}`,
        hint: "Pass a file path, not a directory or special filesystem path.",
        details: { toolName, filePath: resolvedPath },
      },
    };
  }

  try {
    fs.accessSync(resolvedPath, fs.constants.R_OK);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      success: false,
      error: {
        code: "file_not_readable",
        message: `File is not readable: ${resolvedPath}`,
        hint: "Adjust file permissions so the MCP process can read this file.",
        details: { toolName, filePath: resolvedPath, reason: message },
      },
    };
  }

  const fileName = path.basename(resolvedPath);
  const extension = path.extname(fileName).toLowerCase();
  const policy = getUploadPolicyForTool(toolName);
  const providedMimeType = normalizeMimeType(args.mimeType);
  const inferredMimeType = extensionToMimeType[extension];

  if (!policy.allowedExtensions.includes(extension)) {
    return {
      success: false,
      error: {
        code: "unsupported_file_type",
        message: `Unsupported file extension '${extension || "(none)"}' for ${toolName}.`,
        hint: "Use a supported file type or convert the document before uploading.",
        details: {
          toolName,
          filePath: resolvedPath,
          extension,
          allowedExtensions: policy.allowedExtensions,
        },
      },
    };
  }

  const effectiveMimeType = providedMimeType ?? inferredMimeType;
  if (!effectiveMimeType) {
    return {
      success: false,
      error: {
        code: "unsupported_file_type",
        message: `Unable to infer MIME type for extension '${extension || "(none)"}'.`,
        hint: "Set mimeType to a supported value for this endpoint or use a different file type.",
        details: {
          toolName,
          filePath: resolvedPath,
          extension,
          mimeType: null,
          allowedMimeTypes: policy.allowedMimeTypes,
        },
      },
    };
  }

  if (!mimeAllowed(effectiveMimeType, policy.allowedMimeTypes)) {
    return {
      success: false,
      error: {
        code: "unsupported_file_type",
        message: `Unsupported MIME type '${effectiveMimeType}' for ${toolName}.`,
        hint: "Set mimeType to a supported value for this endpoint or use a different file type.",
        details: {
          toolName,
          filePath: resolvedPath,
          extension,
          mimeType: effectiveMimeType,
          allowedMimeTypes: policy.allowedMimeTypes,
        },
      },
    };
  }

  if (
    providedMimeType &&
    inferredMimeType &&
    providedMimeType !== inferredMimeType
  ) {
    return {
      success: false,
      error: {
        code: "unsupported_file_type",
        message: `Provided mimeType '${providedMimeType}' does not match extension '${extension}'.`,
        hint: "Use a mimeType matching the file extension, or omit mimeType to use inferred value.",
        details: {
          toolName,
          filePath: resolvedPath,
          extension,
          inferredMimeType,
          providedMimeType,
        },
      },
    };
  }

  return {
    success: true,
    file: {
      absolutePath: resolvedPath,
      fileName,
      extension,
      mimeType: effectiveMimeType,
    },
  };
};

export const prepareUploadFileInput = async (
  toolName: string,
  args: Record<string, unknown>,
): Promise<UploadValidationResult> => {
  const baseValidation = validateReadableFilePath(toolName, args);
  if (!baseValidation.success) {
    return baseValidation;
  }

  const extension = path.extname(baseValidation.file.fileName).toLowerCase();
  if (extension !== ".md" && extension !== ".markdown") {
    return validateUploadFileInput(toolName, args);
  }

  try {
    const conversion = await convertMarkdownEvidence(
      baseValidation.file.absolutePath,
      args,
    );
    const convertedArgs = {
      ...args,
      filePath: conversion.outputPath,
      mimeType:
        conversion.metadata.conversionTarget === "docx"
          ? extensionToMimeType[".docx"]
          : extensionToMimeType[".pdf"],
    };
    const convertedValidation = validateUploadFileInput(
      toolName,
      convertedArgs,
    );
    if (!convertedValidation.success) {
      return convertedValidation;
    }
    return {
      success: true,
      file: {
        ...convertedValidation.file,
        originalPath: baseValidation.file.absolutePath,
      },
      warnings: conversion.warnings,
      metadata: {
        conversion: conversion.metadata,
      },
      cleanupPaths: conversion.cleanupPaths,
    };
  } catch (error) {
    const code =
      error instanceof MarkdownConversionError
        ? error.code
        : "markdown_conversion_failed";
    const message = error instanceof Error ? error.message : String(error);
    return {
      success: false,
      error: {
        code,
        message,
        hint:
          code === "markdown_converter_unavailable"
            ? "Install pandoc and Playwright/Chromium, choose markdownConversionTarget='docx', or upload an already converted PDF/DOCX."
            : "Review the Markdown file and renderer output, then retry.",
        details: {
          toolName,
          filePath: baseValidation.file.absolutePath,
        },
      },
    };
  }
};

const validateReadableFilePath = (
  toolName: string,
  args: Record<string, unknown>,
): UploadValidationResult => {
  const rawFilePath = args.filePath;
  if (typeof rawFilePath !== "string" || rawFilePath.trim().length === 0) {
    return {
      success: false,
      error: {
        code: "file_path_required",
        message: "filePath is required for multipart upload tools.",
        hint: "Pass a local readable file path in filePath.",
        details: { toolName },
      },
    };
  }

  const resolvedPath = path.resolve(rawFilePath.trim());
  if (!fs.existsSync(resolvedPath)) {
    return {
      success: false,
      error: {
        code: "file_not_found",
        message: `File does not exist: ${resolvedPath}`,
        hint: "Verify the path and ensure the file exists on the local machine.",
        details: { toolName, filePath: resolvedPath },
      },
    };
  }

  let stats: fs.Stats;
  try {
    stats = fs.statSync(resolvedPath);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      success: false,
      error: {
        code: "file_not_readable",
        message: `Unable to stat file at ${resolvedPath}.`,
        hint: "Ensure the path points to a readable file and retry.",
        details: { toolName, filePath: resolvedPath, reason: message },
      },
    };
  }

  if (!stats.isFile()) {
    return {
      success: false,
      error: {
        code: "file_not_regular",
        message: `Path is not a regular file: ${resolvedPath}`,
        hint: "Pass a file path, not a directory or special filesystem path.",
        details: { toolName, filePath: resolvedPath },
      },
    };
  }

  try {
    fs.accessSync(resolvedPath, fs.constants.R_OK);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      success: false,
      error: {
        code: "file_not_readable",
        message: `File is not readable: ${resolvedPath}`,
        hint: "Adjust file permissions so the MCP process can read this file.",
        details: { toolName, filePath: resolvedPath, reason: message },
      },
    };
  }

  const fileName = path.basename(resolvedPath);
  const extension = path.extname(fileName).toLowerCase();
  const inferredMimeType =
    extensionToMimeType[extension] ?? "application/octet-stream";

  return {
    success: true,
    file: {
      absolutePath: resolvedPath,
      fileName,
      extension,
      mimeType: inferredMimeType,
    },
  };
};
