import { describe, expect, it } from "vitest";
import { DEFAULT_DEPENDENCIES, DEFAULT_EVENTS } from "../lib/defaults";
import { normalizeStorage } from "../lib/storage";
import type { Task } from "../lib/types";
import { ids } from "./helpers";

const ALL_DEFAULT_IDS = DEFAULT_EVENTS.map((event) => event.id);

function removedExcept(...keep: string[]): string[] {
  return ALL_DEFAULT_IDS.filter((id) => !keep.includes(id));
}

function stored(state: unknown): string {
  return JSON.stringify(state);
}

describe("normalizeStorage", () => {
  it("reads the old category-map format and seeds default dependencies", () => {
    const state = normalizeStorage(
      stored({
        spring: [{ id: "custom", text: "Custom", done: false }],
      }),
    );
    const tasks = Object.values(state.tasks).flat();

    expect(tasks).toHaveLength(DEFAULT_EVENTS.length + 1);
    expect(tasks.some((task) => task.id === "custom")).toBe(true);
    expect(state.dependencies).toEqual(DEFAULT_DEPENDENCIES);
    expect(state.removedDefaults).toEqual([]);
  });

  it("migrates the legacy recruitment boolean to tags", () => {
    const state = normalizeStorage(
      stored({
        tasks: {
          spring: [
            { id: "custom", text: "Custom", done: false, recruitment: true },
          ],
        },
        removedDefaults: ALL_DEFAULT_IDS,
      }),
    );
    const task = state.tasks.spring[0] as Task & { recruitment?: boolean };

    expect(task.tags).toEqual(["recruitment"]);
    expect("recruitment" in task).toBe(false);
  });

  it("backfills seeded tags when a default task has no tags", () => {
    const state = normalizeStorage(
      stored({
        tasks: {
          summer: [{ id: "default-7", text: "Recruitment prep", done: false }],
        },
        removedDefaults: removedExcept("default-7"),
      }),
    );

    expect(state.tasks.summer[0].tags).toEqual(["recruitment"]);
  });

  it("respects an explicitly empty tags array", () => {
    const state = normalizeStorage(
      stored({
        tasks: {
          summer: [
            {
              id: "default-7",
              text: "Recruitment prep",
              done: false,
              tags: [],
            },
          ],
        },
        removedDefaults: removedExcept("default-7"),
      }),
    );

    expect(state.tasks.summer[0].tags).toEqual([]);
  });

  it("backfills a seeded lead time", () => {
    const state = normalizeStorage(
      stored({
        tasks: {
          "week-8": [{ id: "default-12", text: "Retreat", done: false }],
          "week-4": [
            {
              id: "default-20",
              text: "Submit gift fund request for Airbnb",
              done: false,
              parentId: "default-12",
            },
          ],
        },
        removedDefaults: removedExcept("default-12", "default-20"),
      }),
    );

    const subtask = state.tasks["week-4"].find(
      (task) => task.id === "default-20",
    );
    expect(subtask?.leadWeeks).toBe(4);
  });

  it("turns an orphaned subtask into a standalone task", () => {
    const state = normalizeStorage(
      stored({
        tasks: {
          "week-2": [
            {
              id: "orphan",
              text: "Orphan",
              done: false,
              parentId: "missing",
            },
          ],
        },
        removedDefaults: ALL_DEFAULT_IDS,
      }),
    );

    expect(state.tasks["week-2"][0].parentId).toBeUndefined();
  });

  it("moves a subtask that is scheduled after its parent", () => {
    const state = normalizeStorage(
      stored({
        tasks: {
          "week-5": [{ id: "parent", text: "Parent", done: false }],
          "week-7": [
            {
              id: "child",
              text: "Child",
              done: false,
              parentId: "parent",
            },
          ],
        },
        removedDefaults: ALL_DEFAULT_IDS,
      }),
    );

    expect(state.tasks["week-7"]).toEqual([]);
    expect(ids(state.tasks["week-5"])).toEqual(["parent", "child"]);
  });

  it("prunes invalid dependencies and keeps valid ones", () => {
    const state = normalizeStorage(
      stored({
        tasks: {
          "week-1": [
            { id: "a", text: "A", done: false },
            { id: "b", text: "B", done: false },
          ],
        },
        removedDefaults: ALL_DEFAULT_IDS,
        dependencies: [
          { before: "a", after: "b" },
          { before: "a", after: "b" },
          { before: "a", after: "a" },
          { before: "a", after: "missing" },
        ],
      }),
    );

    expect(state.dependencies).toEqual([{ before: "a", after: "b" }]);
  });

  it("respects an explicitly empty dependency list", () => {
    const state = normalizeStorage(
      stored({
        tasks: {
          "week-1": [
            { id: "a", text: "A", done: false },
            { id: "b", text: "B", done: false },
          ],
        },
        removedDefaults: ALL_DEFAULT_IDS,
        dependencies: [],
      }),
    );

    expect(state.dependencies).toEqual([]);
  });

  it("does not restore defaults that were removed", () => {
    const state = normalizeStorage(
      stored({ tasks: {}, removedDefaults: ALL_DEFAULT_IDS }),
    );

    expect(Object.values(state.tasks).flat()).toEqual([]);
  });
});
