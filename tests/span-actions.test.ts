import { describe, expect, it } from "vitest";
import { setTaskSpan } from "../lib/span-actions";
import { makeState, makeTask } from "./helpers";

describe("setTaskSpan", () => {
  it("sets an end section for a spanning task", () => {
    const state = makeState({ "week-1": [makeTask("t")] });

    const next = setTaskSpan(state, "week-1", "t", "week-3");

    expect(next?.tasks["week-1"][0].endCategoryId).toBe("week-3");
    expect(state.tasks["week-1"][0].endCategoryId).toBeUndefined();
  });

  it("clears the span when the end matches the start", () => {
    const state = makeState({
      "week-1": [makeTask("t", { endCategoryId: "week-3" })],
    });

    const next = setTaskSpan(state, "week-1", "t", "week-1");

    expect(next?.tasks["week-1"][0].endCategoryId).toBeUndefined();
  });

  it("rejects ends before the start", () => {
    const state = makeState({ "week-3": [makeTask("t")] });

    expect(setTaskSpan(state, "week-3", "t", "week-1")).toBeNull();
  });

  it("rejects ends beyond the task's move bounds", () => {
    const state = makeState(
      {
        "week-1": [makeTask("t")],
        "week-2": [makeTask("next")],
      },
      { dependencies: [{ before: "t", after: "next" }] },
    );

    expect(setTaskSpan(state, "week-1", "t", "week-3")).toBeNull();
  });

  it("returns null for an unknown task", () => {
    expect(
      setTaskSpan(makeState({ "week-1": [] }), "week-1", "missing", "week-2"),
    ).toBeNull();
  });
});
