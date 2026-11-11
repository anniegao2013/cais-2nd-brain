import { describe, expect, it } from "vitest";
import {
  allTasks,
  findTask,
  overdueWeekOccurrences,
  spanLabel,
  spanLength,
  taskOccurrences,
} from "../lib/tasks";
import { ids, makeState, makeTask } from "./helpers";

describe("findTask", () => {
  it("finds a task across categories", () => {
    const state = makeState({
      summer: [makeTask("summer-task")],
      "week-2": [makeTask("week-task")],
    });

    expect(findTask(state, "week-task")).toMatchObject({
      categoryId: "week-2",
      task: { id: "week-task" },
    });
    expect(findTask(state, "missing")).toBeNull();
  });
});

describe("taskOccurrences", () => {
  const spanning = makeTask("span", { endCategoryId: "week-3" });
  const single = makeTask("single");
  const state = makeState({
    "week-1": [spanning],
    "week-2": [single],
  });

  it("lists a normal task only under its own section", () => {
    expect(ids(taskOccurrences(state, "week-2").map(({ task }) => task))).toEqual(
      ["span", "single"],
    );
    expect(taskOccurrences(state, "week-2")[1]).toMatchObject({
      startCategoryId: "week-2",
      isStart: true,
    });
  });

  it("lists a spanning task under every covered section", () => {
    expect(ids(taskOccurrences(state, "week-1").map(({ task }) => task))).toEqual(
      ["span"],
    );
    expect(ids(taskOccurrences(state, "week-3").map(({ task }) => task))).toEqual(
      ["span"],
    );
    expect(taskOccurrences(state, "week-4")).toEqual([]);
    expect(taskOccurrences(state, "summer")).toEqual([]);
  });

  it("marks only the starting occurrence", () => {
    expect(taskOccurrences(state, "week-2")[0]).toMatchObject({
      task: { id: "span" },
      startCategoryId: "week-1",
      isStart: false,
    });
    expect(taskOccurrences(state, "week-3")[0]).toMatchObject({
      startCategoryId: "week-1",
      isStart: false,
    });
  });

  it("ignores a span whose end is before its start", () => {
    const backwards = makeState({
      "week-3": [makeTask("backwards", { endCategoryId: "week-1" })],
    });

    expect(ids(taskOccurrences(backwards, "week-3").map(({ task }) => task))).toEqual(
      ["backwards"],
    );
    expect(taskOccurrences(backwards, "week-2")).toEqual([]);
  });
});

describe("overdueWeekOccurrences", () => {
  it("carries incomplete tasks forward from earlier weeks", () => {
    const state = makeState({
      "week-1": [
        makeTask("late"),
        makeTask("finished", { done: true }),
        makeTask("holiday", { isHoliday: true }),
        makeTask("idea", { suggested: true }),
      ],
      "week-4": [makeTask("current")],
    });

    const overdue = overdueWeekOccurrences(state, "week-4");

    expect(ids(overdue.map(({ task }) => task))).toEqual(["late"]);
    expect(overdue[0]).toMatchObject({
      startCategoryId: "week-1",
      isStart: true,
      isOverdue: true,
    });
  });

  it("only carries tasks whose span ends before the current week", () => {
    const state = makeState({
      "week-2": [
        makeTask("ended", { endCategoryId: "week-3" }),
        makeTask("reaches-current", { endCategoryId: "week-4" }),
        makeTask("spans-further", { endCategoryId: "week-6" }),
      ],
    });

    expect(
      ids(overdueWeekOccurrences(state, "week-4").map(({ task }) => task)),
    ).toEqual(["ended"]);
  });

  it("does not carry subtasks of suggestions", () => {
    const state = makeState({
      "week-5": [makeTask("idea", { suggested: true })],
      "week-1": [makeTask("poll", { parentId: "idea" })],
    });

    expect(overdueWeekOccurrences(state, "week-6")).toEqual([]);
  });

  it("does not pull in pre-semester tasks", () => {
    const state = makeState({
      spring: [makeTask("spring-task")],
      summer: [makeTask("summer-task")],
      "week-1": [makeTask("week-task")],
    });

    expect(
      ids(overdueWeekOccurrences(state, "week-4").map(({ task }) => task)),
    ).toEqual(["week-task"]);
  });

  it("only carries overdue tasks within the same semester", () => {
    const state = makeState({
      "week-1": [makeTask("fall-late")],
      "spring-week-1": [
        makeTask("spring-late"),
        makeTask("spring-done", { done: true }),
      ],
      "spring-week-4": [makeTask("spring-current")],
    });

    expect(
      ids(
        overdueWeekOccurrences(state, "spring-week-4").map(({ task }) => task),
      ),
    ).toEqual(["spring-late"]);
  });

  it("returns nothing without a numbered current week", () => {
    const state = makeState({ "week-1": [makeTask("late")] });

    expect(overdueWeekOccurrences(state, "summer")).toEqual([]);
    expect(overdueWeekOccurrences(state, "week-1")).toEqual([]);
  });
});

describe("spanLabel", () => {
  it("uses week ranges for week-to-week spans", () => {
    expect(spanLabel("week-1", "week-3")).toBe("Fall weeks 1–3");
    expect(spanLabel("spring-week-2", "spring-week-5")).toBe(
      "Spring weeks 2–5",
    );
  });

  it("uses section labels for other spans", () => {
    expect(spanLabel("summer", "week-2")).toBe("Summer → Fall Week 2");
    expect(spanLabel("spring", "summer")).toBe(
      "Before end of spring semester → Summer",
    );
    expect(spanLabel("week-15", "spring-week-1")).toBe(
      "Fall Week 15 → Spring Week 1",
    );
  });
});

describe("spanLength", () => {
  it("counts the gap between start and end sections", () => {
    const state = makeState({
      "week-1": [makeTask("span", { endCategoryId: "week-3" })],
    });

    expect(spanLength(state, state.tasks["week-1"][0])).toBe(2);
    expect(spanLength(state, makeTask("plain"))).toBe(0);
    expect(spanLength(state, makeTask("missing", { endCategoryId: "week-3" }))).toBe(
      0,
    );
  });
});

describe("allTasks", () => {
  it("flattens every category", () => {
    const state = makeState({
      spring: [makeTask("a")],
      "week-1": [makeTask("b"), makeTask("c")],
    });

    expect(ids(allTasks(state))).toEqual(["a", "b", "c"]);
  });
});
