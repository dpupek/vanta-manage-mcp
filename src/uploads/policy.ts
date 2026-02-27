import { UploadPolicy } from "./types.js";

const defaultAllowedExtensions = [
  ".pdf",
  ".docx",
  ".xlsx",
  ".csv",
  ".txt",
  ".png",
  ".jpg",
  ".jpeg",
  ".webp",
  ".zip",
  ".ps",
];

const defaultAllowedMimeTypes = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "text/csv",
  "text/plain",
  "image/*",
  "application/zip",
  "application/x-zip-compressed",
  "application/postscript",
];

const buildDefaultPolicy = (): UploadPolicy => ({
  allowedExtensions: [...defaultAllowedExtensions],
  allowedMimeTypes: [...defaultAllowedMimeTypes],
});

export const uploadPolicyByToolName: Record<string, UploadPolicy> = {
  create_file_questionnaire: buildDefaultPolicy(),
  upload_file_for_document: buildDefaultPolicy(),
  create_trust_center_resource: buildDefaultPolicy(),
  upload_document_to_vendor: buildDefaultPolicy(),
  upload_document_for_security_review: buildDefaultPolicy(),
};

export const getUploadPolicyForTool = (toolName: string): UploadPolicy =>
  uploadPolicyByToolName[toolName] ?? buildDefaultPolicy();
