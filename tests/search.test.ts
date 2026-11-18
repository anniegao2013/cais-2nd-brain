import { describe, expect, it } from "vitest";
import { searchBoard } from "../lib/search";
import { makeState, makeTask } from "./helpers";

describe("searchBoard", () => {
  it("returns nothing for an empty query", () => {
    const state = makeState({ "week-1": [makeTask("one")] });
    expect(searchBoard(state, "")).toEqual([]);
    expect(searchBoard(state, "   ")).toEqual([]);
  });

  it("matches titles case-insensitively and ranks them by section", () => {
    const state = makeState({
      "week-1": [makeTask("one", { text: "Open written apps" })],
      "week-2": [makeTask("two", { text: "Written delibs" })],
      todos: [makeTask("todo", { text: "Review written applications" })],
    });

    const results = searchBoard(state, "WRITTEN");

    expect(results.map((result) => result.task.id)).toEqual([
      "one",
      "two",
      "todo",
    ]);
    expect(results[0].sectionLabel).toBe("Fall Week 1");
  });

  it("searches descriptions, tags, and section names", () => {
    const state = makeState({
      "week-4": [
        makeTask("notes", {
          text: "Send the deck",
          notes: "Include the recruitment timeline and budget",
        }),
        makeTask("tagged", { text: "Book a room", tags: ["social"] }),
      ],
      "week-5": [makeTask("week", { text: "Kickoff" })],
      "gm-ideas": [makeTask("idea", { text: "Boba social" })],
    });

    expect(searchBoard(state, "recruitment")[0].task.id).toBe("notes");
    expect(searchBoard(state, "social events")[0].task.id).toBe("tagged");
    expect(
      searchBoard(state, "fall week 5").map((result) => result.task.id),
    ).toEqual(["week"]);
    expect(searchBoard(state, "boba")[0].task.id).toBe("idea");
  });

  it("returns a description snippet when only the notes match", () => {
    const notes = "Plan the room booking, confirm the projector, and order food for the meeting.";
    const state = makeState({
      "week-2": [makeTask("room", { text: "Logistics", notes })],
    });

    const [result] = searchBoard(state, "projector");
    expect(result.snippet).toContain("projector");
    expect(result.snippet?.startsWith("…")).toBe(true);

    expect(searchBoard(state, "logistics")[0].snippet).toBeNull();
  });

  it("caps the result count", () => {
    const tasks = Array.from({ length: 60 }, (_, index) =>
      makeTask(`task-${index}`, { text: `Common task ${index}` }),
    );
    const state = makeState({ "week-1": tasks });

    expect(searchBoard(state, "common", 10)).toHaveLength(10);
  });

  it("keeps completed tasks findable", () => {
    const state = makeState({
      todos: [makeTask("done", { text: "Archive photos", done: true })],
    });
    expect(searchBoard(state, "archive")).toHaveLength(1);
  });

  it("lists a spanning task once, in its first section", () => {
    const state = makeState({
      "week-2": [
        makeTask("spans", {
          text: "Recruitment push",
          endCategoryId: "week-4",
        }),
      ],
      "week-3": [],
      "week-4": [],
    });

    const results = searchBoard(state, "recruitment");
    expect(results).toHaveLength(1);
    expect(results[0].categoryId).toBe("week-2");
  });
});
