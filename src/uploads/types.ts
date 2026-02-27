export type UploadValidationErrorCode =
  | "file_path_required"
  | "file_not_found"
  | "file_not_readable"
  | "file_not_regular"
  | "unsupported_file_type";

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
}

export type UploadValidationResult =
  | { success: true; file: ValidatedUploadFile }
  | { success: false; error: UploadValidationError };
