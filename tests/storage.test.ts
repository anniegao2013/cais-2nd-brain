import { describe, expect, it } from "vitest";
import {
  DEFAULT_DEPENDENCIES,
  DEFAULT_EVENTS,
  DEFAULT_STATE,
} from "../lib/defaults";
import { normalizeStorage } from "../lib/storage";
import {
  announceId,
  socialPollId,
  startPlanningId,
} from "../lib/social-polls";
import { findTask } from "../lib/tasks";
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
    const defaultTaskCount = Object.values(DEFAULT_STATE.tasks).flat().length;

    expect(tasks).toHaveLength(defaultTaskCount + 1);
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

  it("adds social suggestions to saves created before they existed", () => {
    const olderDefaultIds = ALL_DEFAULT_IDS.filter(
      (id) => Number(id.split("-")[1]) <= 21,
    );

    const state = normalizeStorage(
      stored({
        tasks: {
          spring: [{ id: "default-1", text: "Handoffs", done: false }],
        },
        removedDefaults: olderDefaultIds.filter((id) => id !== "default-1"),
        dependencies: DEFAULT_DEPENDENCIES,
      }),
    );

    expect(ids(state.tasks["week-5"])).toContain("default-22");
    expect(ids(state.tasks["week-7"])).toContain("default-23");
    expect(ids(state.tasks["week-10"])).toContain("default-24");
    expect(ids(state.tasks["week-14"])).toContain("default-25");
    expect(ids(state.tasks["week-15"])).toContain("default-26");
  });

  it("adds USC holidays to saves created before they were scraped", () => {
    const olderDefaultIds = ALL_DEFAULT_IDS.filter(
      (id) => !id.startsWith("usc-holiday-"),
    );

    const state = normalizeStorage(
      stored({
        tasks: {
          spring: [{ id: "default-1", text: "Handoffs", done: false }],
        },
        removedDefaults: olderDefaultIds.filter((id) => id !== "default-1"),
        dependencies: DEFAULT_DEPENDENCIES,
      }),
    );

    expect(ids(state.tasks["week-3"])).toContain(
      "usc-holiday-2026-09-07-labor-day-holiday",
    );
    expect(ids(state.tasks["week-7"])).toContain(
      "usc-holiday-2026-10-08-fall-recess",
    );
    expect(ids(state.tasks["week-12"])).toContain(
      "usc-holiday-2026-11-11-veterans-day-holiday",
    );
    expect(ids(state.tasks["week-14"])).toContain(
      "usc-holiday-2026-11-25-thanksgiving-holiday",
    );
  });

  it("backfills the holiday marker and clears an old completion", () => {
    const holidayId = "usc-holiday-2026-09-07-labor-day-holiday";
    const state = normalizeStorage(
      stored({
        tasks: {
          "week-3": [{ id: holidayId, text: "Labor Day Holiday", done: true }],
        },
        removedDefaults: removedExcept(holidayId),
        dependencies: DEFAULT_DEPENDENCIES,
      }),
    );

    const holiday = findTask(state, holidayId);

    expect(holiday?.task.isHoliday).toBe(true);
    expect(holiday?.task.done).toBe(false);
  });

  it("moves a USC holiday to the week that contains its date", () => {
    const holidayId = "usc-holiday-2026-09-07-labor-day-holiday";
    const state = normalizeStorage(
      stored({
        tasks: {
          "week-2": [{ id: holidayId, text: "Labor Day Holiday", done: false }],
          "week-3": [],
        },
        removedDefaults: removedExcept(holidayId),
        dependencies: DEFAULT_DEPENDENCIES,
      }),
    );

    expect(ids(state.tasks["week-2"])).not.toContain(holidayId);
    expect(ids(state.tasks["week-3"])).toContain(holidayId);
  });

  it("moves the Sunday-to-Sunday spring recess into its main week", () => {
    const holidayId = "usc-holiday-2027-03-14-spring-recess";
    const state = normalizeStorage(
      stored({
        tasks: {
          "spring-week-9": [
            {
              id: holidayId,
              text: "Spring Recess",
              done: false,
              endCategoryId: "spring-week-10",
            },
          ],
        },
        removedDefaults: removedExcept(holidayId),
        dependencies: DEFAULT_DEPENDENCIES,
      }),
    );

    expect(ids(state.tasks["spring-week-9"] ?? [])).not.toContain(holidayId);
    expect(ids(state.tasks["spring-week-10"])).toContain(holidayId);
    expect(findTask(state, holidayId)?.task.endCategoryId).toBeUndefined();
  });

  it("leaves a deliberately moved non-holiday default where it is", () => {
    const state = normalizeStorage(
      stored({
        tasks: {
          "week-5": [{ id: "default-1", text: "Handoffs", done: false }],
        },
        removedDefaults: removedExcept("default-1"),
        dependencies: DEFAULT_DEPENDENCIES,
      }),
    );

    expect(ids(state.tasks["week-5"])).toContain("default-1");
    expect(ids(state.tasks.spring ?? [])).not.toContain("default-1");
  });

  it("keeps a USC holiday removed once it was deleted", () => {
    const state = normalizeStorage(
      stored({
        tasks: {},
        removedDefaults: ["usc-holiday-2026-09-07-labor-day-holiday"],
      }),
    );

    expect(ids(state.tasks["week-3"])).not.toContain(
      "usc-holiday-2026-09-07-labor-day-holiday",
    );
  });

  it("keeps a social suggestion removed once it was deleted", () => {
    const state = normalizeStorage(
      stored({
        tasks: {},
        removedDefaults: ["default-22"],
      }),
    );

    expect(ids(state.tasks["week-5"])).not.toContain("default-22");
    expect(ids(state.tasks["week-7"])).toContain("default-23");
  });

  it("backfills the suggestion marker on an older save", () => {
    const state = normalizeStorage(
      stored({
        tasks: {
          "week-5": [
            {
              id: "default-22",
              text: "Welcome new members",
              done: false,
              tags: ["social"],
            },
          ],
        },
        removedDefaults: ALL_DEFAULT_IDS.filter((id) => id !== "default-22"),
        dependencies: DEFAULT_DEPENDENCIES,
      }),
    );

    const welcome = state.tasks["week-5"].find(
      (task) => task.id === "default-22",
    );
    const retreat = findTask(state, "default-12");

    expect(welcome?.suggested).toBe(true);
    expect(retreat?.task.suggested).toBeUndefined();
  });

  it("adds social follow-ups to social events on older saves", () => {
    const state = normalizeStorage(
      stored({
        tasks: {
          "week-5": [
            {
              id: "default-22",
              text: "Welcome new members",
              done: false,
              tags: ["social"],
              suggested: true,
            },
          ],
        },
        removedDefaults: ALL_DEFAULT_IDS.filter((id) => id !== "default-22"),
        dependencies: DEFAULT_DEPENDENCIES,
      }),
    );

    expect(findTask(state, socialPollId("default-22"))).toMatchObject({
      categoryId: "week-1",
      task: {
        text: "Poll for interest",
        parentId: "default-22",
        leadWeeks: 4,
      },
    });
    expect(findTask(state, startPlanningId("default-22"))).toMatchObject({
      categoryId: "week-2",
      task: { text: "Start planning", parentId: "default-22", leadWeeks: 3 },
    });
    expect(findTask(state, announceId("default-22"))).toMatchObject({
      categoryId: "week-3",
      task: { text: "Announce", parentId: "default-22", leadWeeks: 2 },
    });
  });

  it("does not recreate an interest poll that was deleted", () => {
    const state = normalizeStorage(
      stored({
        tasks: {
          "week-5": [
            {
              id: "default-22",
              text: "Welcome new members",
              done: false,
              tags: ["social"],
            },
          ],
        },
        removedDefaults: [
          ...ALL_DEFAULT_IDS.filter((id) => id !== "default-22"),
          socialPollId("default-22"),
        ],
        dependencies: DEFAULT_DEPENDENCIES,
      }),
    );

    expect(findTask(state, socialPollId("default-22"))).toBeNull();
  });

  it("keeps follow-ups when an older save already marked interest", () => {
    const state = normalizeStorage(
      stored({
        tasks: {
          "week-5": [
            {
              id: "default-22",
              text: "Welcome new members",
              done: false,
              tags: ["social"],
              suggested: true,
            },
          ],
          "week-1": [
            {
              id: socialPollId("default-22"),
              text: "Poll for interest",
              done: false,
              parentId: "default-22",
              leadWeeks: 4,
              interested: true,
            },
          ],
        },
        removedDefaults: ALL_DEFAULT_IDS.filter((id) => id !== "default-22"),
        dependencies: DEFAULT_DEPENDENCIES,
      }),
    );

    expect(
      findTask(state, socialPollId("default-22"))?.task.interested,
    ).toBe(true);
    expect(findTask(state, startPlanningId("default-22"))).toMatchObject({
      categoryId: "week-2",
      task: { parentId: "default-22", leadWeeks: 3 },
    });
    expect(findTask(state, announceId("default-22"))).toMatchObject({
      categoryId: "week-3",
      task: { parentId: "default-22", leadWeeks: 2 },
    });
  });

  it("does not recreate a planning follow-up that was deleted", () => {
    const state = normalizeStorage(
      stored({
        tasks: {
          "week-5": [
            {
              id: "default-22",
              text: "Welcome new members",
              done: false,
              tags: ["social"],
            },
          ],
        },
        removedDefaults: [
          ...ALL_DEFAULT_IDS.filter((id) => id !== "default-22"),
          startPlanningId("default-22"),
        ],
        dependencies: DEFAULT_DEPENDENCIES,
      }),
    );

    expect(findTask(state, startPlanningId("default-22"))).toBeNull();
    expect(findTask(state, socialPollId("default-22"))).not.toBeNull();
    expect(findTask(state, announceId("default-22"))).not.toBeNull();
  });
});
