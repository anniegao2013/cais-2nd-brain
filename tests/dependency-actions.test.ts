import { describe, expect, it } from "vitest";
import {
  addDependency,
  removeDependency,
} from "../lib/dependency-actions";
import { ids, makeState, makeTask } from "./helpers";

function baseState() {
  return makeState({
    "week-1": [makeTask("a"), makeTask("b"), makeTask("c")],
    "week-2": [makeTask("d", { endCategoryId: "week-3" })],
    "week-3": [makeTask("e")],
  });
}

describe("addDependency", () => {
  it("adds both ends of a range and re-sorts the section", () => {
    const state = baseState();
    const result = addDependency(state, "b", "a", "c");

    expect(result.error).toBeUndefined();
    expect(result.state?.dependencies).toEqual([
      { before: "a", after: "b" },
      { before: "b", after: "c" },
    ]);
    expect(ids(result.state?.tasks["week-1"])).toEqual(["a", "b", "c"]);
    expect(state.dependencies).toEqual([]);
  });

  it("requires at least one side of the range", () => {
    expect(addDependency(baseState(), "a", "", "")).toEqual({
      error: "Choose a task that must happen before or after this one.",
    });
  });

  it("rejects ordering a task against itself", () => {
    expect(addDependency(baseState(), "a", "a", "")).toEqual({
      error: "A task can't be ordered against itself.",
    });
  });

  it("rejects the same task on both sides", () => {
    expect(addDependency(baseState(), "a", "b", "b")).toEqual({
      error: "Choose two different tasks for the range.",
    });
  });

  it("rejects tasks that no longer exist", () => {
    expect(addDependency(baseState(), "a", "missing", "")).toEqual({
      error: "That task no longer exists.",
    });
  });

  it("rejects a predecessor that runs past the task", () => {
    const result = addDependency(baseState(), "a", "d", "");

    expect(result.error).toContain("“d” runs through Week 3");
  });

  it("rejects a successor that comes before the task", () => {
    const result = addDependency(baseState(), "d", "", "a");

    expect(result.error).toContain("“d” runs through Week 3");
  });

  it("rejects duplicate rules", () => {
    const state = makeState(
      {
        "week-1": [makeTask("a"), makeTask("b")],
      },
      { dependencies: [{ before: "a", after: "b" }] },
    );

    expect(addDependency(state, "b", "a", "")).toEqual({
      error: "That ordering already exists.",
    });
  });

  it("rejects rules that would create a loop", () => {
    const state = makeState(
      {
        "week-1": [makeTask("a"), makeTask("b"), makeTask("c")],
      },
      {
        dependencies: [
          { before: "a", after: "b" },
          { before: "b", after: "c" },
        ],
      },
    );

    expect(addDependency(state, "a", "c", "")).toEqual({
      error: "Those rules would create a loop.",
    });
  });
});

describe("removeDependency", () => {
  it("removes only the matching edge and re-sorts", () => {
    const state = makeState(
      {
        "week-1": [makeTask("b"), makeTask("a"), makeTask("c")],
      },
      {
        dependencies: [
          { before: "a", after: "b" },
          { before: "b", after: "c" },
        ],
      },
    );

    const next = removeDependency(state, "a", "b");

    expect(next.dependencies).toEqual([{ before: "b", after: "c" }]);
    expect(ids(next.tasks["week-1"])).toEqual(["b", "a", "c"]);
  });
});
