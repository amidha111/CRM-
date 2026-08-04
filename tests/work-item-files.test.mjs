import test from "node:test";
import assert from "node:assert/strict";
import {
  formatAttachmentSize,
  validateWorkItemAttachment,
  workItemAttachmentType,
} from "../src/lib/workItemFiles.ts";

function file(name, type, size) {
  return { name, type, size };
}

test("images remain inline screenshot attachments", () => {
  const screenshot = file("screen.png", "image/png", 500_000);
  assert.equal(workItemAttachmentType(screenshot), "image");
  assert.equal(validateWorkItemAttachment(screenshot), "image");
});

test("common documents are accepted as downloadable files", () => {
  const fixtures = [
    file("brief.pdf", "application/pdf", 1_000_000),
    file("fees.xlsx", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", 2_000_000),
    file("notes.txt", "text/plain", 100),
    file("evidence.zip", "application/zip", 3_000_000),
  ];
  fixtures.forEach((fixture) => assert.equal(validateWorkItemAttachment(fixture), "file"));
});

test("executable, empty, and oversized files are rejected", () => {
  assert.throws(
    () => validateWorkItemAttachment(file("installer.exe", "application/x-msdownload", 1_000)),
    /not a supported file type/,
  );
  assert.throws(() => validateWorkItemAttachment(file("empty.pdf", "application/pdf", 0)), /is empty/);
  assert.throws(
    () => validateWorkItemAttachment(file("large.pdf", "application/pdf", 25 * 1024 * 1024 + 1)),
    /smaller than 25 MB/,
  );
});

test("attachment sizes use compact readable labels", () => {
  assert.equal(formatAttachmentSize(500), "500 B");
  assert.equal(formatAttachmentSize(1536), "1.5 KB");
  assert.equal(formatAttachmentSize(2 * 1024 * 1024), "2.0 MB");
});
