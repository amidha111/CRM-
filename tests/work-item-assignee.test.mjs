import test from "node:test";
import assert from "node:assert/strict";
import { assigneeForWorkItemSave } from "../src/lib/workItemAssignees.ts";

test("editing preserves the canonical assignee name when the directory cache is stale", () => {
  const item = {
    assigneeEmail: "nikita@planclarity.ai",
    assigneeName: "Nikita Selmenskih",
  };
  const staleAssignees = [
    { email: "amidha111@gmail.com", name: "Amit Midha" },
    { email: "nikita@planclarity.ai", name: "Nikita" },
  ];

  assert.deepEqual(
    assigneeForWorkItemSave(item, item.assigneeEmail, staleAssignees),
    { email: "nikita@planclarity.ai", name: "Nikita Selmenskih" },
  );
});

test("reassignment uses the selected directory identity", () => {
  const item = {
    assigneeEmail: "nikita@planclarity.ai",
    assigneeName: "Nikita Selmenskih",
  };
  const assignees = [
    { email: "amidha111@gmail.com", name: "Amit Midha" },
    { email: "nikita@planclarity.ai", name: "Nikita Selmenskih" },
  ];

  assert.deepEqual(
    assigneeForWorkItemSave(item, "amidha111@gmail.com", assignees),
    { email: "amidha111@gmail.com", name: "Amit Midha" },
  );
});
