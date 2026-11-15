import { afterEach, describe, expect, it, vi } from "vitest";
import {
  TIMELINE_TABS,
  TODO_CATEGORY,
  TODO_CATEGORY_ID,
  categoriesForTab,
  sectionLabel,
  tabForCategoryId,
} from "../lib/categories";
import { isISODate } from "../lib/calendar";
import { DEFAULT_EVENTS } from "../lib/defaults";
import { normalizeStorage } from "../lib/storage";
import {
  addSubtask,
  addTask,
  moveTask,
  setTodoDueDate,
} from "../lib/task-actions";
import { findTask, taskOccurrences } from "../lib/tasks";
import { groupTodos, todoBucketFor } from "../lib/todo-groups";
import { makeState, makeTask } from "./helpers";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("To-do tab", () => {
  it("adds a dedicated single-section tab", () => {
    expect(TIMELINE_TABS.map((tab) => tab.id)).toEqual([
      "before",
      "fall",
      "spring",
      "gm-ideas",
      "todos",
      "eboard-agenda",
    ]);
    expect(categoriesForTab("todos")).toEqual([TODO_CATEGORY]);
    expect(tabForCategoryId(TODO_CATEGORY_ID)).toBe("todos");
    expect(sectionLabel(TODO_CATEGORY_ID)).toBe("To-do");
  });

  it("lists every to-do once and keeps it out of week sections", () => {
    const state = makeState({
      [TODO_CATEGORY_ID]: [makeTask("first"), makeTask("second")],
      "week-3": [makeTask("week-task")],
    });

    expect(
      taskOccurrences(state, TODO_CATEGORY_ID).map(
        (occurrence) => occurrence.task.id,
      ),
    ).toEqual(["first", "second"]);
    expect(
      taskOccurrences(state, "week-3").map((occurrence) => occurrence.task.id),
    ).toEqual(["week-task"]);
  });
});

describe("addTask for to-dos", () => {
  it("creates a plain to-do and ignores ordering and span input", () => {
    vi.spyOn(crypto, "randomUUID").mockReturnValue("todo-1");
    const state = makeState({ [TODO_CATEGORY_ID]: [] });

    const result = addTask(state, TODO_CATEGORY_ID, {
      text: "  Email the advisor  ",
      afterId: "missing",
      beforeId: "missing",
      endCategoryId: "spring-week-9",
      dueDate: "2026-11-16",
    });

    expect(result.error).toBeUndefined();
    expect(result.state?.dependencies).toEqual([]);
    expect(result.state?.tasks[TODO_CATEGORY_ID][0]).toMatchObject({
      id: "todo-1",
      text: "Email the advisor",
      done: false,
      dueDate: "2026-11-16",
    });
    expect(
      result.state?.tasks[TODO_CATEGORY_ID][0].endCategoryId,
    ).toBeUndefined();
    expect(state.tasks[TODO_CATEGORY_ID]).toEqual([]);
  });

  it("ignores an invalid due date", () => {
    vi.spyOn(crypto, "randomUUID").mockReturnValue("todo-2");
    const state = makeState({ [TODO_CATEGORY_ID]: [] });

    const result = addTask(state, TODO_CATEGORY_ID, {
      text: "Email the advisor",
      afterId: "",
      beforeId: "",
      endCategoryId: "",
      dueDate: "2026-02-30",
    });

    expect(result.state?.tasks[TODO_CATEGORY_ID][0].dueDate).toBeUndefined();
  });
});

describe("to-do placement rules", () => {
  it("does not allow subtasks for a to-do", () => {
    const state = makeState({
      [TODO_CATEGORY_ID]: [makeTask("parent")],
    });

    expect(
      addSubtask(state, "parent", "Child", TODO_CATEGORY_ID),
    ).toBeNull();
  });

  it("does not allow free moves into or out of the list", () => {
    const state = makeState({
      [TODO_CATEGORY_ID]: [makeTask("todo")],
      "week-3": [makeTask("week-task")],
    });

    expect(moveTask(state, TODO_CATEGORY_ID, "todo", "week-3")).toBeNull();
    expect(moveTask(state, "week-3", "week-task", TODO_CATEGORY_ID)).toBeNull();
  });
});

describe("to-do due dates", () => {
  it("validates real ISO calendar dates", () => {
    expect(isISODate("2026-11-15")).toBe(true);
    expect(isISODate("2028-02-29")).toBe(true);
    expect(isISODate("2026-02-30")).toBe(false);
    expect(isISODate("2026-1-5")).toBe(false);
    expect(isISODate("November 5")).toBe(false);
  });

  it("sets and clears a due date on a to-do", () => {
    const state = makeState({ [TODO_CATEGORY_ID]: [makeTask("todo")] });

    const dated = setTodoDueDate(
      state,
      TODO_CATEGORY_ID,
      "todo",
      "2026-11-16",
    );
    expect(dated?.tasks[TODO_CATEGORY_ID][0].dueDate).toBe("2026-11-16");

    const cleared = setTodoDueDate(dated!, TODO_CATEGORY_ID, "todo", "");
    expect(cleared?.tasks[TODO_CATEGORY_ID][0].dueDate).toBeUndefined();
  });

  it("rejects invalid dates, missing tasks, and other sections", () => {
    const state = makeState({
      [TODO_CATEGORY_ID]: [makeTask("todo")],
      "week-3": [makeTask("week-task")],
    });

    expect(
      setTodoDueDate(state, TODO_CATEGORY_ID, "todo", "2026-02-30"),
    ).toBeNull();
    expect(
      setTodoDueDate(state, TODO_CATEGORY_ID, "missing", "2026-11-16"),
    ).toBeNull();
    expect(
      setTodoDueDate(state, "week-3", "week-task", "2026-11-16"),
    ).toBeNull();
  });
});

describe("to-do groupings", () => {
  const today = "2026-11-15";

  it("buckets due dates relative to today", () => {
    expect(todoBucketFor("2026-11-14", today)).toBe("overdue");
    expect(todoBucketFor("2026-11-15", today)).toBe("urgent");
    expect(todoBucketFor("2026-11-16", today)).toBe("urgent");
    expect(todoBucketFor("2026-11-17", today)).toBe("next-week");
    expect(todoBucketFor("2026-11-22", today)).toBe("next-week");
    expect(todoBucketFor("2026-11-23", today)).toBe("next-month");
    expect(todoBucketFor("2026-12-15", today)).toBe("next-month");
    expect(todoBucketFor("2026-12-16", today)).toBe("later");
    expect(todoBucketFor(undefined, today)).toBe("later");
    expect(todoBucketFor("2026-02-30", today)).toBe("later");
  });

  it("groups open items by urgency and keeps completed items separate", () => {
    const tasks = [
      makeTask("no-date"),
      makeTask("later", { dueDate: "2026-12-20" }),
      makeTask("overdue", { dueDate: "2026-11-10" }),
      makeTask("today", { dueDate: "2026-11-15" }),
      makeTask("this-week", { dueDate: "2026-11-18" }),
      makeTask("this-month", { dueDate: "2026-11-30" }),
      makeTask("finished", { dueDate: "2026-11-01", done: true }),
    ];

    expect(groupTodos(tasks, today).map((group) => group.id)).toEqual([
      "overdue",
      "urgent",
      "next-week",
      "next-month",
      "later",
      "completed",
    ]);
    expect(groupTodos(tasks, today).find((group) => group.id === "later")?.tasks)
      .toMatchObject([{ id: "later" }, { id: "no-date" }]);
  });

  it("omits empty groups and sorts dated items first", () => {
    const groups = groupTodos(
      [
        makeTask("undated"),
        makeTask("later-date", { dueDate: "2026-12-20" }),
        makeTask("soon", { dueDate: "2026-11-20" }),
      ],
      today,
    );

    expect(groups.map((group) => group.id)).toEqual(["next-week", "later"]);
    expect(groups[1].tasks.map((task) => task.id)).toEqual([
      "later-date",
      "undated",
    ]);
  });
});

describe("to-do persistence", () => {
  it("keeps to-dos and their details across a storage round trip", () => {
    const state = normalizeStorage(
      JSON.stringify({
        tasks: {
          [TODO_CATEGORY_ID]: [
            {
              id: "todo",
              text: "Email the advisor",
              done: true,
              notes: "Ask about room booking",
              tags: ["projects"],
              dueDate: "2026-11-16",
            },
            {
              id: "bad-date",
              text: "Bad date",
              done: false,
              dueDate: "2026-02-30",
            },
          ],
        },
        removedDefaults: DEFAULT_EVENTS.map((event) => event.id),
        dependencies: [],
      }),
    );

    expect(findTask(state, "todo")).toMatchObject({
      categoryId: TODO_CATEGORY_ID,
      task: {
        text: "Email the advisor",
        done: true,
        notes: "Ask about room booking",
        tags: ["projects"],
        dueDate: "2026-11-16",
      },
    });
    expect(findTask(state, "bad-date")?.task.dueDate).toBeUndefined();
  });
});
