import { afterEach, describe, expect, it, vi } from "vitest";
import {
  addSubtask,
  addTask,
  deleteTask,
  moveTask,
  renameTask,
  toggleTaskDone,
  toggleTaskTag,
  updateSubtaskLead,
  updateTaskNotes,
} from "../lib/task-actions";
import { ids, makeState, makeTask } from "./helpers";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("addTask", () => {
  it("creates a trimmed task with an optional span", () => {
    vi.spyOn(crypto, "randomUUID").mockReturnValue("new-task");
    const state = makeState({ summer: [] });

    const result = addTask(state, "summer", {
      text: "  New task  ",
      afterId: "",
      beforeId: "",
      endCategoryId: "week-2",
    });

    const created = result.state?.tasks.summer.find(
      (task) => task.id === "new-task",
    );
    expect(result.error).toBeUndefined();
    expect(created).toMatchObject({
      text: "New task",
      done: false,
      endCategoryId: "week-2",
    });
    expect(state.tasks.summer).toEqual([]);
  });

  it("does not add a span when the end matches the start", () => {
    vi.spyOn(crypto, "randomUUID").mockReturnValue("new-task");
    const state = makeState({ summer: [] });

    const result = addTask(state, "summer", {
      text: "New task",
      afterId: "",
      beforeId: "",
      endCategoryId: "",
    });

    expect(result.state?.tasks.summer[0].endCategoryId).toBeUndefined();
  });

  it("adds the ordering edges for a range and sorts the result", () => {
    vi.spyOn(crypto, "randomUUID").mockReturnValue("new-task");
    const state = makeState({
      "week-1": [makeTask("a")],
      "week-2": [makeTask("b")],
    });

    const result = addTask(state, "week-1", {
      text: "New task",
      afterId: "a",
      beforeId: "b",
      endCategoryId: "",
    });

    expect(result.state?.dependencies).toEqual([
      { before: "a", after: "new-task" },
      { before: "new-task", after: "b" },
    ]);
    expect(ids(result.state?.tasks["week-1"])).toEqual(["a", "new-task"]);
  });

  it("ignores blank titles", () => {
    expect(
      addTask(makeState({ spring: [] }), "spring", {
        text: "   ",
        afterId: "",
        beforeId: "",
        endCategoryId: "",
      }),
    ).toEqual({});
  });

  it("rejects the same task for both sides of the range", () => {
    const state = makeState({
      "week-1": [makeTask("a")],
    });

    expect(
      addTask(state, "week-1", {
        text: "New task",
        afterId: "a",
        beforeId: "a",
        endCategoryId: "",
      }),
    ).toEqual({ error: "Choose two different tasks for the range." });
  });

  it("rejects tasks that no longer exist", () => {
    const state = makeState({ "week-1": [] });

    expect(
      addTask(state, "week-1", {
        text: "New task",
        afterId: "missing",
        beforeId: "",
        endCategoryId: "",
      }),
    ).toEqual({ error: "That task no longer exists." });
  });

  it("rejects an 'after' task in a later section", () => {
    const state = makeState({
      "week-1": [],
      "week-2": [makeTask("later")],
    });

    expect(
      addTask(state, "week-1", {
        text: "New task",
        afterId: "later",
        beforeId: "",
        endCategoryId: "",
      }),
    ).toEqual({
      error: "“later” is in Week 2, which is after Week 1.",
    });
  });

  it("rejects a 'before' task in an earlier section", () => {
    const state = makeState({
      "week-1": [makeTask("early")],
      "week-2": [],
    });

    expect(
      addTask(state, "week-2", {
        text: "New task",
        afterId: "",
        beforeId: "early",
        endCategoryId: "",
      }),
    ).toEqual({
      error: "“early” is in Week 1, which is before Week 2.",
    });
  });

  it("rejects a span that ends before it starts", () => {
    const state = makeState({ "week-2": [] });

    expect(
      addTask(state, "week-2", {
        text: "New task",
        afterId: "",
        beforeId: "",
        endCategoryId: "week-1",
      }),
    ).toEqual({
      error: "The span must end at or after its starting section.",
    });
  });

  it("rejects a span that runs past the next task", () => {
    const state = makeState({
      "week-1": [],
      "week-2": [makeTask("next")],
    });

    expect(
      addTask(state, "week-1", {
        text: "New task",
        afterId: "",
        beforeId: "next",
        endCategoryId: "week-3",
      }),
    ).toEqual({
      error: "The span must end at or before “next”.",
    });
  });
});

describe("addSubtask", () => {
  it("creates a subtask in the same or an earlier section", () => {
    vi.spyOn(crypto, "randomUUID").mockReturnValue("new-sub");
    const state = makeState({
      "week-2": [makeTask("parent")],
    });

    const same = addSubtask(state, "parent", "  Child  ", "week-2");
    const earlier = addSubtask(state, "parent", "Child", "week-1");

    expect(same?.tasks["week-2"][1]).toMatchObject({
      id: "new-sub",
      text: "Child",
      parentId: "parent",
    });
    expect(earlier?.tasks["week-1"][0]).toMatchObject({
      text: "Child",
      parentId: "parent",
    });
  });

  it("rejects blank text, missing parents, and later sections", () => {
    const state = makeState({
      "week-2": [makeTask("parent")],
    });

    expect(addSubtask(state, "parent", "  ", "week-2")).toBeNull();
    expect(addSubtask(state, "missing", "Child", "week-2")).toBeNull();
    expect(addSubtask(state, "parent", "Child", "week-3")).toBeNull();
  });
});

describe("updateSubtaskLead", () => {
  it("moves a lead-time subtask to the parent's offset", () => {
    const state = makeState({
      "week-6": [makeTask("sub", { parentId: "parent" })],
      "week-8": [makeTask("parent")],
    });

    const next = updateSubtaskLead(state, "week-6", "sub", 4);

    expect(next?.tasks["week-6"]).toEqual([]);
    expect(next?.tasks["week-4"][0]).toMatchObject({
      id: "sub",
      leadWeeks: 4,
    });
  });

  it("removes the lead and leaves the subtask in place when set to zero", () => {
    const state = makeState({
      "week-6": [makeTask("sub", { parentId: "parent", leadWeeks: 4 })],
      "week-8": [makeTask("parent")],
    });

    const next = updateSubtaskLead(state, "week-6", "sub", 0);

    expect(next?.tasks["week-6"][0].leadWeeks).toBeUndefined();
  });

  it("clamps the lead to the parent's section", () => {
    const state = makeState({
      "week-1": [makeTask("sub", { parentId: "parent" })],
      "week-4": [makeTask("parent")],
    });

    const next = updateSubtaskLead(state, "week-1", "sub", 10);

    expect(next?.tasks.spring[0]).toMatchObject({
      id: "sub",
      leadWeeks: 5,
    });
  });

  it("drops a span that no longer fits after the move", () => {
    const state = makeState({
      "week-5": [
        makeTask("sub", {
          parentId: "parent",
          endCategoryId: "week-7",
        }),
      ],
      "week-8": [makeTask("parent")],
    });

    const next = updateSubtaskLead(state, "week-5", "sub", 4);

    expect(next?.tasks["week-4"][0].endCategoryId).toBeUndefined();
  });

  it("ignores tasks that are not subtasks or whose parent is gone", () => {
    const state = makeState({
      "week-1": [makeTask("plain"), makeTask("orphan", { parentId: "missing" })],
    });

    expect(updateSubtaskLead(state, "week-1", "plain", 2)).toBeNull();
    expect(updateSubtaskLead(state, "week-1", "orphan", 2)).toBeNull();
  });
});

describe("renameTask", () => {
  it("trims and saves a new title", () => {
    const state = makeState({ "week-1": [makeTask("t", { text: "Old" })] });

    const result = renameTask(state, "week-1", "t", "  New  ");

    expect(result.error).toBeUndefined();
    expect(result.state?.tasks["week-1"][0].text).toBe("New");
  });

  it("rejects an empty title", () => {
    const state = makeState({ "week-1": [makeTask("t")] });

    expect(renameTask(state, "week-1", "t", "   ")).toEqual({
      error: "A title can't be empty.",
    });
  });
});

describe("toggleTaskTag", () => {
  it("adds and removes tags without touching the others", () => {
    const state = makeState({
      "week-1": [makeTask("t", { tags: ["projects"] })],
    });

    const added = toggleTaskTag(state, "week-1", "t", "gm");
    const removed = toggleTaskTag(added, "week-1", "t", "projects");

    expect(added.tasks["week-1"][0].tags).toEqual(["projects", "gm"]);
    expect(removed.tasks["week-1"][0].tags).toEqual(["gm"]);
  });
});

describe("updateTaskNotes", () => {
  it("cleans nested notes before saving", () => {
    const state = makeState({ "week-1": [makeTask("t")] });

    const next = updateTaskNotes(state, "week-1", "t", "* Top\n    * Child");

    expect(next.tasks["week-1"][0].notes).toBe("Top\n  Child");
  });

  it("removes notes when the input is empty", () => {
    const state = makeState({
      "week-1": [makeTask("t", { notes: "Old" })],
    });

    const next = updateTaskNotes(state, "week-1", "t", "   ");

    expect(next.tasks["week-1"][0].notes).toBeUndefined();
  });
});

describe("toggleTaskDone", () => {
  it("flips the completion state", () => {
    const state = makeState({ "week-1": [makeTask("t")] });

    expect(toggleTaskDone(state, "week-1", "t").tasks["week-1"][0].done).toBe(
      true,
    );
  });
});

describe("deleteTask", () => {
  it("deletes the task, its edges, and records the removal", () => {
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

    const result = deleteTask(state, "a");

    expect(ids(result?.state.tasks["week-1"])).toEqual(["b"]);
    expect(result?.state.dependencies).toEqual([]);
    expect(result?.state.removedDefaults).toEqual(["a"]);
    expect(result?.removedIds).toEqual(new Set(["a"]));
  });

  it("cascades to subtasks when a parent is deleted", () => {
    const state = makeState({
      "week-1": [makeTask("parent")],
      "week-2": [makeTask("child", { parentId: "parent" })],
    });

    const result = deleteTask(state, "parent");

    expect(result?.state.tasks["week-1"]).toEqual([]);
    expect(result?.state.tasks["week-2"]).toEqual([]);
    expect(result?.state.removedDefaults).toEqual(["parent", "child"]);
  });

  it("does not delete the parent when a subtask is deleted", () => {
    const state = makeState({
      "week-1": [makeTask("parent")],
      "week-2": [makeTask("child", { parentId: "parent" })],
    });

    const result = deleteTask(state, "child");

    expect(ids(result?.state.tasks["week-1"])).toEqual(["parent"]);
    expect(result?.state.tasks["week-2"]).toEqual([]);
  });

  it("returns null for an unknown task", () => {
    expect(deleteTask(makeState({ "week-1": [] }), "missing")).toBeNull();
  });
});

describe("moveTask", () => {
  it("moves a task to another section", () => {
    const state = makeState({ "week-1": [makeTask("t")], "week-3": [] });

    const next = moveTask(state, "week-1", "t", "week-3");

    expect(next?.tasks["week-1"]).toEqual([]);
    expect(ids(next?.tasks["week-3"])).toEqual(["t"]);
  });

  it("returns null for the same section or a missing task", () => {
    const state = makeState({ "week-1": [makeTask("t")] });

    expect(moveTask(state, "week-1", "t", "week-1")).toBeNull();
    expect(moveTask(state, "week-1", "missing", "week-2")).toBeNull();
  });

  it("respects dependency bounds", () => {
    const state = makeState(
      {
        "week-2": [makeTask("a")],
        "week-4": [makeTask("b")],
      },
      { dependencies: [{ before: "a", after: "b" }] },
    );

    expect(moveTask(state, "week-2", "a", "week-5")).toBeNull();
  });

  it("shifts lead-time subtasks with their parent", () => {
    const state = makeState({
      "week-4": [makeTask("sub", { parentId: "parent", leadWeeks: 4 })],
      "week-8": [makeTask("parent")],
    });

    const next = moveTask(state, "week-8", "parent", "week-9");

    expect(ids(next?.tasks["week-9"])).toEqual(["parent"]);
    expect(ids(next?.tasks["week-5"])).toEqual(["sub"]);
  });

  it("keeps a parent from moving before a fixed subtask", () => {
    const state = makeState({
      "week-6": [makeTask("sub", { parentId: "parent" })],
      "week-8": [makeTask("parent")],
    });

    expect(moveTask(state, "week-8", "parent", "week-5")).toBeNull();
  });

  it("shifts the span along with the task", () => {
    const state = makeState({
      "week-1": [makeTask("t", { endCategoryId: "week-3" })],
      "week-2": [],
    });

    const next = moveTask(state, "week-1", "t", "week-2");

    expect(next?.tasks["week-2"][0].endCategoryId).toBe("week-4");
  });

  it("rejects a move that would push the span off the timeline", () => {
    const state = makeState(
      {
        spring: [makeTask("t", { endCategoryId: "week-15" })],
        summer: [],
      },
      {},
    );

    expect(moveTask(state, "spring", "t", "summer")).toBeNull();
  });

  it("keeps a subtask at or before its parent", () => {
    const state = makeState({
      "week-3": [makeTask("sub", { parentId: "parent" })],
      "week-5": [makeTask("parent")],
    });

    expect(moveTask(state, "week-3", "sub", "week-6")).toBeNull();
  });
});
