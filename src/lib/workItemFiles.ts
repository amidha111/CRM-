export const WORK_ITEM_IMAGE_TYPES = [
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
] as const;

export const WORK_ITEM_FILE_TYPES = [
  "application/pdf",
  "text/plain",
  "text/csv",
  "application/json",
  "application/rtf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/zip",
  "application/x-zip-compressed",
] as const;

export const MAX_WORK_ITEM_IMAGE_BYTES = 10 * 1024 * 1024;
export const MAX_WORK_ITEM_FILE_BYTES = 25 * 1024 * 1024;

const imageTypes = new Set<string>(WORK_ITEM_IMAGE_TYPES);
const fileTypes = new Set<string>(WORK_ITEM_FILE_TYPES);

export const WORK_ITEM_FILE_ACCEPT = [...WORK_ITEM_IMAGE_TYPES, ...WORK_ITEM_FILE_TYPES].join(",");

export function workItemAttachmentType(file: Pick<File, "type">): "image" | "file" | null {
  const contentType = file.type.toLowerCase();
  if (imageTypes.has(contentType)) return "image";
  if (fileTypes.has(contentType)) return "file";
  return null;
}

export function validateWorkItemAttachment(file: Pick<File, "name" | "size" | "type">): "image" | "file" {
  const attachmentType = workItemAttachmentType(file);
  if (!attachmentType) {
    throw new Error(`${file.name || "This file"} is not a supported file type.`);
  }
  const maximum = attachmentType === "image" ? MAX_WORK_ITEM_IMAGE_BYTES : MAX_WORK_ITEM_FILE_BYTES;
  if (file.size <= 0) throw new Error(`${file.name || "This file"} is empty.`);
  if (file.size > maximum) {
    throw new Error(`${file.name || "This file"} must be smaller than ${attachmentType === "image" ? "10 MB" : "25 MB"}.`);
  }
  return attachmentType;
}

export function formatAttachmentSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(bytes < 10 * 1024 ? 1 : 0)} KB`;
  return `${(bytes / 1024 ** 2).toFixed(bytes < 10 * 1024 ** 2 ? 1 : 0)} MB`;
}
