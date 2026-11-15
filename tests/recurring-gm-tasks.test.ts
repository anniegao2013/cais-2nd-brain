import { describe, expect, it } from "vitest";
import { gmEventId } from "../lib/gm-events";
import {
  RECURRING_GM_TASKS,
  recurringGmTaskId,
  syncRecurringGmTasks,
} from "../lib/recurring-gm-tasks";
import { findTask } from "../lib/tasks";
import { makeState, makeTask } from "./helpers";

function stateWithGm(categoryId = "week-3") {
  return makeState({
    [categoryId]: [makeTask(gmEventId(categoryId), { text: "GM" })],
  });
}

describe("syncRecurringGmTasks", () => {
  it("adds the two weekly prep tasks under the current GM", () => {
    const categoryId = "week-3";
    const gmId = gmEventId(categoryId);

    const next = syncRecurringGmTasks(stateWithGm(categoryId), categoryId);

    const created = next?.tasks[categoryId].filter(
      (task) => task.parentId === gmId,
    );
    expect(created?.map((task) => task.text)).toEqual([
      "Update social points",
      "Make GM slides",
    ]);
    expect(created?.every((task) => task.recurring)).toBe(true);
    expect(created?.map((task) => task.id)).toEqual(
      RECURRING_GM_TASKS.map((definition) =>
        recurringGmTaskId(categoryId, definition.key),
      ),
    );
  });

  it("does nothing without a current week or a GM in that week", () => {
    expect(syncRecurringGmTasks(stateWithGm(), null)).toBeNull();
    expect(syncRecurringGmTasks(makeState({}), "week-3")).toBeNull();
    expect(
      syncRecurringGmTasks(
        makeState({ "week-3": [makeTask("plain")] }),
        "week-3",
      ),
    ).toBeNull();
  });

  it("is idempotent after the tasks have been created", () => {
    const categoryId = "week-3";
    const first = syncRecurringGmTasks(stateWithGm(categoryId), categoryId);
    expect(first).not.toBeNull();
    expect(syncRecurringGmTasks(first!, categoryId)).toBeNull();
  });

  it("does not recreate a deleted recurring task", () => {
    const categoryId = "week-3";
    const deletedId = recurringGmTaskId(categoryId, "social-points");
    const state = {
      ...stateWithGm(categoryId),
      removedDefaults: [deletedId],
    };

    const next = syncRecurringGmTasks(state, categoryId);
    const created = next?.tasks[categoryId].filter(
      (task) => task.recurring,
    );

    expect(created?.map((task) => task.text)).toEqual(["Make GM slides"]);
    expect(findTask(next!, deletedId)).toBeNull();
  });

  it("leaves renamed or completed occurrences alone", () => {
    const categoryId = "week-3";
    const gmId = gmEventId(categoryId);
    const socialId = recurringGmTaskId(categoryId, "social-points");
    const slidesId = recurringGmTaskId(categoryId, "slides");
    const state = makeState({
      [categoryId]: [
        makeTask(gmId, { text: "GM" }),
        makeTask(socialId, {
          text: "Post points in Slack",
          parentId: gmId,
          recurring: true,
          done: true,
        }),
        makeTask(slidesId, { parentId: gmId, recurring: true }),
      ],
    });

    expect(syncRecurringGmTasks(state, categoryId)).toBeNull();
  });
});
