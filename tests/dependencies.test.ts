import { describe, expect, it } from "vitest";
import {
  buildGraph,
  isDependency,
  pruneDependencies,
  sortSequenced,
  sortState,
  traverse,
} from "../lib/dependencies";
import { ids, makeState, makeTask } from "./helpers";

describe("buildGraph", () => {
  it("deduplicates edges and ignores self-links", () => {
    const graph = buildGraph([
      { before: "a", after: "b" },
      { before: "a", after: "b" },
      { before: "a", after: "a" },
      { before: "", after: "b" },
    ]);

    expect(graph.precedes.get("a")).toEqual(["b"]);
    expect(graph.follows.get("b")).toEqual(["a"]);
    expect(graph.sequenced).toEqual(new Set(["a", "b"]));
  });
});

describe("traverse", () => {
  it("walks transitive edges once", () => {
    const graph = buildGraph([
      { before: "a", after: "b" },
      { before: "b", after: "c" },
      { before: "c", after: "a" },
    ]);

    expect(traverse("a", graph.precedes)).toEqual(new Set(["b", "c", "a"]));
  });
});

describe("sortSequenced", () => {
  it("sorts sequenced tasks within their existing slots", () => {
    const tasks = [
      makeTask("c"),
      makeTask("free"),
      makeTask("a"),
      makeTask("b"),
    ];
    const graph = buildGraph([
      { before: "a", after: "b" },
      { before: "b", after: "c" },
    ]);

    expect(ids(sortSequenced(tasks, graph))).toEqual(["a", "free", "b", "c"]);
  });

  it("leaves the list alone when fewer than two tasks are sequenced", () => {
    const tasks = [makeTask("a"), makeTask("free")];
    const graph = buildGraph([{ before: "a", after: "missing" }]);

    expect(sortSequenced(tasks, graph)).toBe(tasks);
  });

  it("does not throw when dependencies form a cycle", () => {
    const tasks = [makeTask("b"), makeTask("a")];
    const graph = buildGraph([
      { before: "a", after: "b" },
      { before: "b", after: "a" },
    ]);

    expect(ids(sortSequenced(tasks, graph))).toEqual(["b", "a"]);
  });
});

describe("sortState", () => {
  it("sorts each category with the shared dependency graph", () => {
    const state = makeState(
      {
        "week-1": [makeTask("b"), makeTask("a")],
        "week-2": [makeTask("x"), makeTask("y")],
      },
      { dependencies: [{ before: "a", after: "b" }] },
    );

    const sorted = sortState(state);

    expect(ids(sorted.tasks["week-1"])).toEqual(["a", "b"]);
    expect(ids(sorted.tasks["week-2"])).toEqual(["x", "y"]);
    expect(sorted).not.toBe(state);
  });
});

describe("isDependency", () => {
  it("validates the edge shape", () => {
    expect(isDependency({ before: "a", after: "b" })).toBe(true);
    expect(isDependency({ before: "a" })).toBe(false);
    expect(isDependency(null)).toBe(false);
  });
});

describe("pruneDependencies", () => {
  it("drops duplicates, self-links, and edges to missing tasks", () => {
    const tasks = { "week-1": [makeTask("a"), makeTask("b")] };
    const pruned = pruneDependencies(
      [
        { before: "a", after: "b" },
        { before: "a", after: "b" },
        { before: "a", after: "a" },
        { before: "a", after: "missing" },
        { before: "missing", after: "b" },
      ],
      tasks,
    );

    expect(pruned).toEqual([{ before: "a", after: "b" }]);
  });
});
