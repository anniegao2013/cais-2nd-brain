import { describe, expect, it } from "vitest";
import {
  boardLocationHash,
  parseBoardHash,
  taskAnchorId,
  taskLinkHash,
} from "../lib/board-location";

const HOME = { section: "home", tab: null, categoryId: null, taskId: null };

describe("parseBoardHash", () => {
  it("falls back to Home for an empty or unknown hash", () => {
    expect(parseBoardHash("")).toEqual(HOME);
    expect(parseBoardHash("#")).toEqual(HOME);
    expect(parseBoardHash("#nope")).toEqual(HOME);
    expect(parseBoardHash("#home/fall")).toEqual(HOME);
  });

  it("reads a schedule term", () => {
    expect(parseBoardHash("#schedule/fall")).toEqual({
      section: "schedule",
      tab: "fall",
      categoryId: null,
      taskId: null,
    });
    expect(parseBoardHash("#schedule/spring")).toEqual({
      section: "schedule",
      tab: "spring",
      categoryId: null,
      taskId: null,
    });
    expect(parseBoardHash("#schedule/before")).toEqual({
      section: "schedule",
      tab: "before",
      categoryId: null,
      taskId: null,
    });
  });

  it("keeps the remembered term when no valid term is given", () => {
    expect(parseBoardHash("#schedule")).toEqual({
      section: "schedule",
      tab: null,
      categoryId: null,
      taskId: null,
    });
    expect(parseBoardHash("#schedule/winter")).toEqual({
      section: "schedule",
      tab: null,
      categoryId: null,
      taskId: null,
    });
  });

  it("reads a week and an optional task", () => {
    expect(parseBoardHash("#schedule/fall/week-13")).toEqual({
      section: "schedule",
      tab: "fall",
      categoryId: "week-13",
      taskId: null,
    });
    expect(parseBoardHash("#schedule/spring/spring-week-3/task-abc")).toEqual({
      section: "schedule",
      tab: "spring",
      categoryId: "spring-week-3",
      taskId: "abc",
    });
  });

  it("infers the term from a week when the term is omitted", () => {
    expect(parseBoardHash("#schedule/week-13")).toEqual({
      section: "schedule",
      tab: "fall",
      categoryId: "week-13",
      taskId: null,
    });
    expect(parseBoardHash("#schedule/summer")).toEqual({
      section: "schedule",
      tab: "before",
      categoryId: "summer",
      taskId: null,
    });
  });

  it("ignores unknown weeks and task anchors without a week", () => {
    expect(parseBoardHash("#schedule/fall/nope")).toEqual({
      section: "schedule",
      tab: "fall",
      categoryId: null,
      taskId: null,
    });
    expect(parseBoardHash("#schedule/fall/task-abc")).toEqual({
      section: "schedule",
      tab: "fall",
      categoryId: null,
      taskId: null,
    });
  });

  it("reads the flat sections and their task links", () => {
    for (const section of ["gm-ideas", "todos", "eboard-agenda"] as const) {
      expect(parseBoardHash(`#${section}`)).toEqual({
        section,
        tab: null,
        categoryId: null,
        taskId: null,
      });
    }
    expect(parseBoardHash("#todos/task-abc")).toEqual({
      section: "todos",
      tab: null,
      categoryId: "todos",
      taskId: "abc",
    });
    expect(parseBoardHash("#gm-ideas/task-abc")).toEqual({
      section: "gm-ideas",
      tab: null,
      categoryId: "gm-ideas",
      taskId: "abc",
    });
    // The agenda is derived; it has no task anchors.
    expect(parseBoardHash("#eboard-agenda/task-abc")).toEqual({
      section: "eboard-agenda",
      tab: null,
      categoryId: null,
      taskId: null,
    });
  });
});

describe("boardLocationHash", () => {
  it("writes a term for Schedule and a plain section otherwise", () => {
    expect(boardLocationHash("home", "fall")).toBe("#home");
    expect(boardLocationHash("schedule", "spring")).toBe("#schedule/spring");
    expect(boardLocationHash("todos", "fall")).toBe("#todos");
  });

  it("includes a week and a task when given a target", () => {
    expect(
      boardLocationHash("schedule", "fall", { categoryId: "week-13" }),
    ).toBe("#schedule/fall/week-13");
    expect(
      boardLocationHash("schedule", "fall", {
        categoryId: "week-13",
        taskId: "abc",
      }),
    ).toBe("#schedule/fall/week-13/task-abc");
    expect(boardLocationHash("todos", "fall", { taskId: "abc" })).toBe(
      "#todos/task-abc",
    );
    expect(boardLocationHash("gm-ideas", "fall", { taskId: "abc" })).toBe(
      "#gm-ideas/task-abc",
    );
  });

  it("ignores a task without a week on Schedule", () => {
    expect(boardLocationHash("schedule", "fall", { taskId: "abc" })).toBe(
      "#schedule/fall",
    );
  });
});

describe("taskLinkHash", () => {
  it("points a schedule task at its week", () => {
    expect(taskLinkHash("week-13", "abc")).toBe(
      "#schedule/fall/week-13/task-abc",
    );
    expect(taskLinkHash("summer", "abc")).toBe(
      "#schedule/before/summer/task-abc",
    );
  });

  it("points backlog and to-do tasks at their list", () => {
    expect(taskLinkHash("gm-ideas", "abc")).toBe("#gm-ideas/task-abc");
    expect(taskLinkHash("todos", "abc")).toBe("#todos/task-abc");
  });

  it("builds the anchor id from the task and section", () => {
    expect(taskAnchorId("week-13", "abc")).toBe("task-abc-week-13");
    expect(taskAnchorId("todos", "abc")).toBe("task-abc-todos");
  });
});
