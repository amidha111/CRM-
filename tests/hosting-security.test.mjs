import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("hosting CSP permits the Google API script required by Firebase popup auth", async () => {
  const config = JSON.parse(await readFile("firebase.json", "utf8"));
  const globalHeaders = config.hosting.headers.find((entry) => entry.source === "**")?.headers ?? [];
  const csp = globalHeaders.find((header) => header.key === "Content-Security-Policy")?.value ?? "";
  const scriptDirective = csp
    .split(";")
    .map((directive) => directive.trim())
    .find((directive) => directive.startsWith("script-src ")) ?? "";

  assert.match(scriptDirective, /(?:^|\s)https:\/\/apis\.google\.com(?:\/|\s|$)/);
});
