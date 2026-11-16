import { describe, expect, it } from "vitest";
import {
  MAX_DELETED_BATCHES,
  normalizeDeletedBatches,
  restoreDeletedBatch,
} from "../lib/deleted-tasks";
import { normalizeStorage } from "../lib/storage";
import { deleteTask } from "../lib/task-actions";
import { makeState, makeTask } from "./helpers";

describe("deleteTask trash", () => {
  it("records the deleted task with its section and timestamp", () => {
    const state = makeState(
      {
        "week-1": [makeTask("a"), makeTask("b")],
      },
      {
        dependencies: [
          { before: "a", after: "b" },
          { before: "b", after: "a" },
        ],
      },
    );

    const result = deleteTask(state, "a", "2026-11-16T10:00:00.000Z");

    expect(result?.deleted.deletedAt).toBe("2026-11-16T10:00:00.000Z");
    expect(result?.deleted.tasks).toEqual([
      { categoryId: "week-1", task: makeTask("a") },
    ]);
    expect(result?.deleted.dependencies).toEqual([
      { before: "a", after: "b" },
      { before: "b", after: "a" },
    ]);
    expect(result?.state.deletedTasks).toEqual([result?.deleted]);
  });

  it("keeps a parent and its subtasks in one batch", () => {
    const state = makeState({
      "week-1": [makeTask("parent")],
      "week-2": [makeTask("child", { parentId: "parent" })],
    });

    const result = deleteTask(state, "parent", "2026-11-16T10:00:00.000Z");

    expect(result?.deleted.tasks).toEqual([
      { categoryId: "week-1", task: makeTask("parent") },
      { categoryId: "week-2", task: makeTask("child", { parentId: "parent" }) },
    ]);
    expect(result?.state.deletedTasks).toHaveLength(1);
  });

  it("lists the newest deletion first and caps the list", () => {
    let state = makeState({
      "week-1": Array.from({ length: MAX_DELETED_BATCHES + 3 }, (_, index) =>
        makeTask(`task-${index}`),
      ),
    });

    for (let index = 0; index <= MAX_DELETED_BATCHES + 2; index += 1) {
      const result = deleteTask(
        state,
        `task-${index}`,
        `2026-11-16T10:00:0${index}.000Z`,
      );
      if (!result) throw new Error("delete failed");
      state = result.state;
    }

    expect(state.deletedTasks).toHaveLength(MAX_DELETED_BATCHES);
    expect(state.deletedTasks?.[0]?.tasks[0]?.task.id).toBe(
      `task-${MAX_DELETED_BATCHES + 2}`,
    );
  });
});

describe("restoreDeletedBatch", () => {
  it("returns the task to its section with its ordering edges", () => {
    const state = makeState(
      {
        "week-1": [makeTask("a"), makeTask("b")],
      },
      {
        dependencies: [{ before: "a", after: "b" }],
      },
    );
    const result = deleteTask(state, "a", "2026-11-16T10:00:00.000Z");
    if (!result) throw new Error("delete failed");

    const restored = restoreDeletedBatch(result.state, result.deleted.id);

    expect(restored?.tasks["week-1"]).toEqual([makeTask("a"), makeTask("b")]);
    expect(restored?.dependencies).toEqual([{ before: "a", after: "b" }]);
    expect(restored?.removedDefaults).toEqual([]);
    expect(restored?.deletedTasks).toEqual([]);
  });

  it("restores a parent together with its subtasks", () => {
    const state = makeState({
      "week-1": [makeTask("child", { parentId: "parent" })],
      "week-2": [makeTask("parent")],
    });
    const result = deleteTask(state, "parent", "2026-11-16T10:00:00.000Z");
    if (!result) throw new Error("delete failed");

    const restored = restoreDeletedBatch(result.state, result.deleted.id);

    expect(restored?.tasks["week-1"]).toEqual([
      makeTask("child", { parentId: "parent" }),
    ]);
    expect(restored?.tasks["week-2"]).toEqual([makeTask("parent")]);
    expect(restored?.removedDefaults).toEqual([]);
  });

  it("clears the tombstone so defaults can exist again", () => {
    const state = makeState({ "week-1": [makeTask("default-1")] });
    const result = deleteTask(state, "default-1", "2026-11-16T10:00:00.000Z");
    if (!result) throw new Error("delete failed");
    expect(result.state.removedDefaults).toEqual(["default-1"]);

    const restored = restoreDeletedBatch(result.state, result.deleted.id);

    expect(restored?.removedDefaults).toEqual([]);
  });

  it("keeps a live task when the same id was created again", () => {
    const state = makeState({ "week-1": [makeTask("a", { text: "Live" })] });
    const result = deleteTask(state, "a", "2026-11-16T10:00:00.000Z");
    if (!result) throw new Error("delete failed");

    const withReplacement = makeState(
      { "week-2": [makeTask("a", { text: "Replacement" })] },
      { deletedTasks: result.state.deletedTasks },
    );
    const restored = restoreDeletedBatch(withReplacement, result.deleted.id);

    expect(restored?.tasks["week-1"]).toBeUndefined();
    expect(restored?.tasks["week-2"]).toEqual([
      makeTask("a", { text: "Replacement" }),
    ]);
  });

  it("returns null for an unknown batch", () => {
    expect(restoreDeletedBatch(makeState({}), "missing")).toBeNull();
  });
});

describe("normalizeDeletedBatches", () => {
  it("keeps valid batches and drops malformed ones", () => {
    const batch = {
      id: "batch",
      deletedAt: "2026-11-16T10:00:00.000Z",
      tasks: [{ categoryId: "week-1", task: makeTask("a") }],
      dependencies: [{ before: "a", after: "b" }],
    };

    expect(
      normalizeDeletedBatches([
        batch,
        batch,
        { id: "bad", deletedAt: "now", tasks: [], dependencies: [] },
        { id: "bad-2", tasks: "nope" },
        null,
      ]),
    ).toEqual([batch]);
  });

  it("survives a storage round trip", () => {
    const state = makeState({ "week-1": [makeTask("a")] });
    const result = deleteTask(state, "a", "2026-11-16T10:00:00.000Z");
    if (!result) throw new Error("delete failed");

    const normalized = normalizeStorage(JSON.stringify(result.state));

    expect(normalized.deletedTasks).toEqual([result.deleted]);
  });
});
