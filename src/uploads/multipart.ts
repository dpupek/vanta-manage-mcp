import { openAsBlob } from "node:fs";
import { ValidatedUploadFile } from "./types.js";

export const appendUploadFile = async (
  formData: FormData,
  fileFieldName: string,
  file: ValidatedUploadFile,
): Promise<void> => {
  const blob = await openAsBlob(file.absolutePath, { type: file.mimeType });
  const multipartFile = new File([blob], file.fileName, {
    type: file.mimeType,
  });
  formData.append(fileFieldName, multipartFile);
};
