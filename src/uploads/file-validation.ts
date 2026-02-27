import fs from "node:fs";
import path from "node:path";
import { getUploadPolicyForTool } from "./policy.js";
import { UploadValidationResult } from "./types.js";

const extensionToMimeType: Record<string, string> = {
  ".pdf": "application/pdf",
  ".docx":
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ".csv": "text/csv",
  ".txt": "text/plain",
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
