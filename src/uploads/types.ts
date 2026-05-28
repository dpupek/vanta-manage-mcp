export type UploadValidationErrorCode =
  | "file_path_required"
  | "file_not_found"
  | "file_not_readable"
  | "file_not_regular"
  | "unsupported_file_type"
  | "markdown_converter_unavailable"
  | "markdown_conversion_failed";

export interface UploadValidationError {
  code: UploadValidationErrorCode;
  message: string;
  hint: string;
  details?: Record<string, unknown>;
}

export interface UploadPolicy {
  allowedExtensions: string[];
  allowedMimeTypes: string[];
}

export interface ValidatedUploadFile {
  absolutePath: string;
  fileName: string;
  extension: string;
  mimeType: string;
  originalPath?: string;
}

export type UploadValidationResult =
  | {
      success: true;
      file: ValidatedUploadFile;
      warnings?: string[];
      metadata?: Record<string, unknown>;
      cleanupPaths?: string[];
    }
  | { success: false; error: UploadValidationError };
