export const WORK_ITEM_IMAGE_TYPES = [
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
] as const;

export const MAX_WORK_ITEM_IMAGE_BYTES = 10 * 1024 * 1024;
export const MAX_WORK_ITEM_FILE_BYTES = 25 * 1024 * 1024;

const imageTypes = new Set<string>(WORK_ITEM_IMAGE_TYPES);

export function workItemAttachmentType(file: Pick<File, "type">): "image" | "file" {
  const contentType = file.type.trim().toLowerCase();
  if (imageTypes.has(contentType)) return "image";
  return "file";
}

export function validateWorkItemAttachment(file: Pick<File, "name" | "size" | "type">): "image" | "file" {
  const attachmentType = workItemAttachmentType(file);
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
