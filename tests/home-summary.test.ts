import { describe, expect, it } from "vitest";
import { boardHomeSummary } from "../lib/home-summary";
import { makeState, makeTask } from "./helpers";

describe("boardHomeSummary", () => {
  it("counts ideas, open to-dos, and overdue to-dos", () => {
    const state = makeState({
      "gm-ideas": [
        makeTask("idea-1"),
        makeTask("idea-2"),
        makeTask("idea-done", { done: true }),
      ],
      todos: [
        makeTask("late", { dueDate: "2026-11-10" }),
        makeTask("soon", { dueDate: "2026-11-18" }),
        makeTask("done", { done: true, dueDate: "2026-11-01" }),
      ],
    });

    const summary = boardHomeSummary(state, "2026-11-18", "week-13");

    expect(summary.gmIdeas).toBe(2);
    expect(summary.openTodos).toBe(2);
    expect(summary.overdueTodos).toBe(1);
    expect(summary.currentWeekLabel).toBe("Fall Week 13");
    expect(summary.nextMeeting).toMatch(/Nov 18/);
    expect(summary.nextMeeting).toMatch(/7:00 PM/);
  });

  it("labels a break without a current week", () => {
    const summary = boardHomeSummary(makeState({}), "2026-12-28", null);

    expect(summary.currentWeekLabel).toBeNull();
    expect(summary.gmIdeas).toBe(0);
    expect(summary.openTodos).toBe(0);
    expect(summary.overdueTodos).toBe(0);
  });
});
