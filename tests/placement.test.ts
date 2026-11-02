import { describe, expect, it } from "vitest";
import { CATEGORIES, categoryIndex } from "../lib/categories";
import {
  baseMoveBounds,
  clampTaskSpan,
  moveBounds,
  sanitizeSubtaskPlacement,
  sequenceBounds,
  shiftTaskSpan,
} from "../lib/placement";
import { ids, makeState, makeTask } from "./helpers";

const lastIndex = CATEGORIES.length - 1;

describe("clampTaskSpan", () => {
  it("returns the task unchanged when it has no span", () => {
    const task = makeTask("t");
    expect(clampTaskSpan(task, "week-2")).toBe(task);
  });

  it("drops a span that ends at or before its start", () => {
    const task = makeTask("t", { endCategoryId: "week-1" });
    const next = clampTaskSpan(task, "week-2");

    expect(next.endCategoryId).toBeUndefined();
    expect(task.endCategoryId).toBe("week-1");
  });

  it("clamps a span to the maximum end section", () => {
    const task = makeTask("t", { endCategoryId: "week-5" });
    const next = clampTaskSpan(task, "week-1", categoryIndex("week-3"));

    expect(next.endCategoryId).toBe("week-3");
  });

  it("keeps a span that fits", () => {
    const task = makeTask("t", { endCategoryId: "week-3" });

    expect(clampTaskSpan(task, "week-1").endCategoryId).toBe("week-3");
  });
});

describe("shiftTaskSpan", () => {
  it("returns the same task when it has no span", () => {
    const task = makeTask("t");
    expect(shiftTaskSpan(task, 2)).toBe(task);
  });

  it("shifts the end section by a delta", () => {
    const task = makeTask("t", { endCategoryId: "week-2" });

    expect(shiftTaskSpan(task, 2)?.endCategoryId).toBe("week-4");
    expect(shiftTaskSpan(task, -1)?.endCategoryId).toBe("week-1");
  });

  it("returns null when the shifted end leaves the timeline", () => {
    expect(shiftTaskSpan(makeTask("t", { endCategoryId: "spring" }), -1)).toBeNull();
    expect(
      shiftTaskSpan(makeTask("t", { endCategoryId: "week-15" }), 1),
    ).toBeNull();
  });
});

describe("sequenceBounds", () => {
  const state = makeState(
    {
      "week-2": [makeTask("a")],
      "week-4": [makeTask("b")],
      "week-6": [makeTask("c")],
    },
    {
      dependencies: [
        { before: "a", after: "b" },
        { before: "b", after: "c" },
      ],
    },
  );

  it("leaves unsequenced tasks free to move anywhere", () => {
    expect(sequenceBounds(state, "free")).toEqual({
      min: 0,
      max: lastIndex,
    });
  });

  it("uses the nearest predecessor and successor", () => {
    expect(sequenceBounds(state, "b")).toEqual({
      min: categoryIndex("week-2"),
      max: categoryIndex("week-6"),
    });
  });

  it("follows transitive edges to the nearest limit", () => {
    expect(sequenceBounds(state, "a").max).toBe(categoryIndex("week-4"));
    expect(sequenceBounds(state, "c").min).toBe(categoryIndex("week-4"));
  });
});

describe("baseMoveBounds", () => {
  it("keeps a lead-time subtask at least its lead before the parent", () => {
    const state = makeState({
      "week-4": [makeTask("sub", { parentId: "parent", leadWeeks: 4 })],
      "week-8": [makeTask("parent")],
    });

    expect(baseMoveBounds(state, state.tasks["week-4"][0]).max).toBe(
      categoryIndex("week-8") - 4,
    );
  });

  it("keeps a parent from moving before a fixed subtask", () => {
    const state = makeState({
      "week-4": [makeTask("sub", { parentId: "parent" })],
      "week-8": [makeTask("parent")],
    });

    expect(baseMoveBounds(state, state.tasks["week-8"][0]).min).toBe(
      categoryIndex("week-4"),
    );
  });

  it("lets a parent move as long as a lead-time subtask keeps its gap", () => {
    const state = makeState({
      "week-4": [makeTask("sub", { parentId: "parent", leadWeeks: 4 })],
      "week-8": [makeTask("parent")],
    });

    expect(baseMoveBounds(state, state.tasks["week-8"][0]).min).toBe(
      categoryIndex("week-8") - categoryIndex("week-4"),
    );
  });

  it("limits a plain subtask to the parent's section", () => {
    const state = makeState({
      "week-4": [makeTask("sub", { parentId: "parent" })],
      "week-8": [makeTask("parent")],
    });

    expect(baseMoveBounds(state, state.tasks["week-4"][0]).max).toBe(
      categoryIndex("week-8"),
    );
  });
});

describe("moveBounds", () => {
  it("reserves room for a task's remaining span", () => {
    const state = makeState({
      "week-1": [makeTask("span", { endCategoryId: "week-3" })],
    });

    expect(moveBounds(state, state.tasks["week-1"][0]).max).toBe(lastIndex - 2);
  });

  it("does not restrict a task without a span", () => {
    const state = makeState({ "week-1": [makeTask("plain")] });

    expect(moveBounds(state, state.tasks["week-1"][0]).max).toBe(lastIndex);
  });
});

describe("sanitizeSubtaskPlacement", () => {
  it("drops a normal task span that ends at its start", () => {
    const state = makeState({
      "week-2": [makeTask("same", { endCategoryId: "week-2" })],
    });

    const next = sanitizeSubtaskPlacement(state);

    expect(next.tasks["week-2"][0].endCategoryId).toBeUndefined();
  });

  it("turns an orphaned subtask into a standalone task", () => {
    const state = makeState({
      "week-2": [makeTask("orphan", { parentId: "missing" })],
    });

    const next = sanitizeSubtaskPlacement(state);

    expect(next.tasks["week-2"][0].parentId).toBeUndefined();
  });

  it("moves a subtask that is later than its parent", () => {
    const state = makeState({
      "week-5": [makeTask("parent")],
      "week-7": [makeTask("sub", { parentId: "parent" })],
    });

    const next = sanitizeSubtaskPlacement(state);

    expect(next.tasks["week-7"]).toEqual([]);
    expect(ids(next.tasks["week-5"])).toEqual(["parent", "sub"]);
  });

  it("moves a lead-time subtask to the parent's lead offset", () => {
    const state = makeState({
      "week-6": [makeTask("sub", { parentId: "parent", leadWeeks: 4 })],
      "week-8": [makeTask("parent")],
    });

    const next = sanitizeSubtaskPlacement(state);

    expect(next.tasks["week-6"]).toEqual([]);
    expect(ids(next.tasks["week-4"])).toEqual(["sub"]);
  });

  it("sorts the resulting state", () => {
    const state = makeState(
      {
        "week-1": [makeTask("b"), makeTask("a")],
      },
      { dependencies: [{ before: "a", after: "b" }] },
    );

    const next = sanitizeSubtaskPlacement(state);

    expect(ids(next.tasks["week-1"])).toEqual(["a", "b"]);
  });
});
