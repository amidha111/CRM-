import test from "node:test";
import assert from "node:assert/strict";
import { matchesWorkItemVisibility } from "../src/lib/workItemFilters.ts";

const fixtures = [
  { status: "open" },
  { status: "in_progress" },
  { status: "ready_for_review" },
  { status: "closed" },
];

test("active work hides only resolved Work Items", () => {
  assert.deepEqual(fixtures.filter((item) => matchesWorkItemVisibility(item, "active")), fixtures.slice(0, 3));
});

test("resolved-only and all-work views remain available", () => {
  assert.deepEqual(fixtures.filter((item) => matchesWorkItemVisibility(item, "resolved")), [fixtures[3]]);
  assert.deepEqual(fixtures.filter((item) => matchesWorkItemVisibility(item, "all")), fixtures);
});

