import { afterEach, describe, expect, it, vi } from "vitest";
import {
  GM_IDEAS_CATEGORY,
  GM_IDEAS_CATEGORY_ID,
  TIMELINE_TABS,
  categoriesForTab,
  sectionLabel,
  tabForCategoryId,
} from "../lib/categories";
import { DEFAULT_EVENTS } from "../lib/defaults";
import { gmEventId } from "../lib/gm-events";
import { normalizeStorage } from "../lib/storage";
import {
  addSubtask,
  addTask,
  assignGmIdea,
  moveTask,
  returnGmIdea,
} from "../lib/task-actions";
import { findTask, taskOccurrences } from "../lib/tasks";
import { makeState, makeTask } from "./helpers";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("GM ideas tab", () => {
  it("adds a dedicated single-section tab", () => {
    expect(TIMELINE_TABS.map((tab) => tab.id)).toEqual([
      "before",
      "fall",
      "spring",
      "gm-ideas",
    ]);
    expect(categoriesForTab("gm-ideas")).toEqual([GM_IDEAS_CATEGORY]);
    expect(tabForCategoryId(GM_IDEAS_CATEGORY_ID)).toBe("gm-ideas");
    expect(sectionLabel(GM_IDEAS_CATEGORY_ID)).toBe("GM ideas");
  });

  it("lists every backlog item once and keeps ideas out of week sections", () => {
    const state = makeState({
      [GM_IDEAS_CATEGORY_ID]: [makeTask("first"), makeTask("second")],
      "week-3": [makeTask("week-task")],
    });

    expect(
      taskOccurrences(state, GM_IDEAS_CATEGORY_ID).map(
        (occurrence) => occurrence.task.id,
      ),
    ).toEqual(["first", "second"]);
    expect(
      taskOccurrences(state, "week-3").map((occurrence) => occurrence.task.id),
    ).toEqual(["week-task"]);
  });
});

describe("addTask for GM ideas", () => {
  it("creates a plain idea and ignores ordering and span input", () => {
    vi.spyOn(crypto, "randomUUID").mockReturnValue("idea-1");
    const state = makeState({ [GM_IDEAS_CATEGORY_ID]: [] });

    const result = addTask(state, GM_IDEAS_CATEGORY_ID, {
      text: "  Boba social  ",
      afterId: "missing",
      beforeId: "missing",
      endCategoryId: "spring-week-9",
    });

    expect(result.error).toBeUndefined();
    expect(result.state?.dependencies).toEqual([]);
    expect(result.state?.tasks[GM_IDEAS_CATEGORY_ID][0]).toMatchObject({
      id: "idea-1",
      text: "Boba social",
      done: false,
    });
    expect(
      result.state?.tasks[GM_IDEAS_CATEGORY_ID][0].endCategoryId,
    ).toBeUndefined();
    expect(state.tasks[GM_IDEAS_CATEGORY_ID]).toEqual([]);
  });
});

describe("assignGmIdea", () => {
  it("moves an idea under the selected GM and keeps its details", () => {
    const gmId = gmEventId("week-3");
    const state = makeState({
      [GM_IDEAS_CATEGORY_ID]: [
        makeTask("idea", { text: "Boba social", notes: "Pick a Tuesday" }),
      ],
      "week-3": [makeTask(gmId, { text: "GM" })],
    });

    const next = assignGmIdea(state, "idea", gmId);

    expect(next?.tasks[GM_IDEAS_CATEGORY_ID]).toEqual([]);
    expect(next?.tasks["week-3"]).toHaveLength(2);
    expect(
      next?.tasks["week-3"].find((task) => task.id === "idea"),
    ).toMatchObject({
      text: "Boba social",
      notes: "Pick a Tuesday",
      parentId: gmId,
      gmIdea: true,
    });
  });

  it("rejects missing ideas, non-GM targets, and ideas outside the backlog", () => {
    const gmId = gmEventId("week-3");
    const state = makeState({
      [GM_IDEAS_CATEGORY_ID]: [makeTask("idea")],
      "week-3": [makeTask(gmId, { text: "GM" }), makeTask("plain")],
      "week-4": [makeTask("not-an-idea")],
    });

    expect(assignGmIdea(state, "missing", gmId)).toBeNull();
    expect(assignGmIdea(state, "idea", "plain")).toBeNull();
    expect(assignGmIdea(state, "idea", "missing")).toBeNull();
    expect(assignGmIdea(state, "not-an-idea", gmId)).toBeNull();
  });
});

describe("returnGmIdea", () => {
  it("sends an assigned idea back to the backlog", () => {
    const gmId = gmEventId("week-3");
    const state = makeState({
      "week-3": [
        makeTask(gmId, { text: "GM" }),
        makeTask("idea", {
          text: "Boba social",
          parentId: gmId,
          gmIdea: true,
          leadWeeks: 2,
          endCategoryId: "week-4",
        }),
      ],
    });

    const next = returnGmIdea(state, "idea");
    const idea = next?.tasks[GM_IDEAS_CATEGORY_ID][0];

    expect(next?.tasks["week-3"].map((task) => task.id)).toEqual([gmId]);
    expect(idea).toMatchObject({ id: "idea", text: "Boba social" });
    expect(idea?.parentId).toBeUndefined();
    expect(idea?.gmIdea).toBeUndefined();
    expect(idea?.leadWeeks).toBeUndefined();
    expect(idea?.endCategoryId).toBeUndefined();
  });

  it("ignores regular GM tasks and ideas whose parent is not a GM", () => {
    const gmId = gmEventId("week-3");
    const state = makeState({
      "week-3": [
        makeTask(gmId, { text: "GM" }),
        makeTask("regular", { parentId: gmId }),
      ],
      "week-4": [
        makeTask("parent"),
        makeTask("idea", {
          parentId: "parent",
          gmIdea: true,
        }),
      ],
    });

    expect(returnGmIdea(state, "regular")).toBeNull();
    expect(returnGmIdea(state, "idea")).toBeNull();
    expect(returnGmIdea(state, "missing")).toBeNull();
  });
});

describe("GM idea guards", () => {
  it("does not let the generic move or subtask actions touch the backlog", () => {
    const state = makeState({
      [GM_IDEAS_CATEGORY_ID]: [makeTask("idea")],
      "week-3": [makeTask("week-task")],
    });

    expect(moveTask(state, GM_IDEAS_CATEGORY_ID, "idea", "week-3")).toBeNull();
    expect(moveTask(state, "week-3", "week-task", GM_IDEAS_CATEGORY_ID)).toBeNull();
    expect(addSubtask(state, "idea", "Child", GM_IDEAS_CATEGORY_ID)).toBeNull();
  });
});

describe("GM idea persistence", () => {
  it("keeps backlog items and assigned ideas across a storage round trip", () => {
    const gmId = gmEventId("week-5");
    const state = normalizeStorage(
      JSON.stringify({
        tasks: {
          [GM_IDEAS_CATEGORY_ID]: [
            { id: "idea", text: "Boba social", done: false },
          ],
          "week-5": [
            { id: gmId, text: "GM", done: false },
            {
              id: "assigned",
              text: "Trivia night",
              done: false,
              parentId: gmId,
              gmIdea: true,
            },
          ],
        },
        removedDefaults: DEFAULT_EVENTS.map((event) => event.id),
        dependencies: [],
      }),
    );

    expect(findTask(state, "idea")).toMatchObject({
      categoryId: GM_IDEAS_CATEGORY_ID,
      task: { text: "Boba social" },
    });
    expect(findTask(state, "assigned")).toMatchObject({
      categoryId: "week-5",
      task: { parentId: gmId, gmIdea: true },
    });
  });
});
