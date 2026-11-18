import { describe, expect, it } from "vitest";
import {
  allTasks,
  findTask,
  groupOccurrencesByGm,
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

describe("groupOccurrencesByGm", () => {
  it("keeps a GM and its tasks together in stored order", () => {
    const state = makeState({
      "week-2": [
        makeTask("gm-week-2"),
        makeTask("regular-a"),
        makeTask("task-for-gm", { parentId: "gm-week-2" }),
        makeTask("idea", { parentId: "gm-week-2", gmIdea: true }),
        makeTask("regular-b"),
      ],
    });

    const groups = groupOccurrencesByGm(
      state,
      taskOccurrences(state, "week-2"),
    );

    expect(groups.map((group) => group.gmId)).toEqual([
      "gm-week-2",
      null,
      null,
    ]);
    expect(ids(groups[0].occurrences.map(({ task }) => task))).toEqual([
      "gm-week-2",
      "task-for-gm",
      "idea",
    ]);
    expect(groups[0].gmOccurrence?.task.id).toBe("gm-week-2");
    expect(groups[0].gmCategoryId).toBe("week-2");
    expect(ids(groups[1].occurrences.map(({ task }) => task))).toEqual([
      "regular-a",
    ]);
    expect(ids(groups[2].occurrences.map(({ task }) => task))).toEqual([
      "regular-b",
    ]);
  });

  it("pulls the GM row ahead of a child that was stored first", () => {
    const state = makeState({
      "week-2": [
        makeTask("task-for-gm", { parentId: "gm-week-2" }),
        makeTask("gm-week-2"),
      ],
    });

    const groups = groupOccurrencesByGm(
      state,
      taskOccurrences(state, "week-2"),
    );

    expect(groups).toHaveLength(1);
    expect(ids(groups[0].occurrences.map(({ task }) => task))).toEqual([
      "gm-week-2",
      "task-for-gm",
    ]);
  });

  it("groups an earlier prep task without the GM row", () => {
    const state = makeState({
      "week-1": [makeTask("prep", { parentId: "gm-week-5", leadWeeks: 4 })],
      "week-5": [makeTask("gm-week-5")],
    });

    const groups = groupOccurrencesByGm(
      state,
      taskOccurrences(state, "week-1"),
    );

    expect(groups).toHaveLength(1);
    expect(groups[0]).toMatchObject({
      gmId: "gm-week-5",
      gmOccurrence: null,
      gmCategoryId: "week-5",
    });
    expect(ids(groups[0].occurrences.map(({ task }) => task))).toEqual([
      "prep",
    ]);
  });

  it("leaves non-GM subtasks and orphaned rows as ordinary groups", () => {
    const state = makeState({
      "week-3": [
        makeTask("event", { suggested: true }),
        makeTask("subtask", { parentId: "event" }),
        makeTask("orphan", { parentId: "missing" }),
      ],
    });

    const groups = groupOccurrencesByGm(
      state,
      taskOccurrences(state, "week-3"),
    );

    expect(groups.map((group) => group.gmId)).toEqual([null, null, null]);
    expect(ids(groups.map((group) => group.occurrences[0].task))).toEqual([
      "event",
      "subtask",
      "orphan",
    ]);
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
        makeTask("weekly", { recurring: true }),
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
