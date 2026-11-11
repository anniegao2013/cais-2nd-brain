import { describe, expect, it } from "vitest";
import {
  DEFAULT_DEPENDENCIES,
  DEFAULT_EVENTS,
  DEFAULT_STATE,
} from "../lib/defaults";
import { SPRING_SEMESTER, categoryIdForDate } from "../lib/calendar";
import { categoryIndex } from "../lib/categories";
import {
  ANNOUNCE_LEAD_WEEKS,
  ANNOUNCE_TEXT,
  SOCIAL_FOLLOW_UPS,
  SOCIAL_POLL_EXCLUDED_PARENT_IDS,
  SOCIAL_POLL_LEAD_WEEKS,
  SOCIAL_POLL_TEXT,
  START_PLANNING_LEAD_WEEKS,
  START_PLANNING_TEXT,
  announceId,
  socialPollId,
  startPlanningId,
} from "../lib/social-polls";
import { findTask } from "../lib/tasks";

describe("default events", () => {
  it("uses unique ids", () => {
    const ids = DEFAULT_EVENTS.map((event) => event.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("seeds every event as open", () => {
    const tasks = Object.values(DEFAULT_STATE.tasks).flat();
    const socialEvents = DEFAULT_EVENTS.filter(
      (event) =>
        event.tags?.includes("social") &&
        !SOCIAL_POLL_EXCLUDED_PARENT_IDS.has(event.id),
    ).length;

    expect(tasks).toHaveLength(
      DEFAULT_EVENTS.length + socialEvents * SOCIAL_FOLLOW_UPS.length,
    );
    expect(tasks.every((task) => task.done === false)).toBe(true);
  });

  it("places the Airbnb gift fund request four weeks before Retreat", () => {
    const retreat = findTask(DEFAULT_STATE, "default-12");
    const request = findTask(DEFAULT_STATE, "default-20");

    expect(retreat?.categoryId).toBe("week-8");
    expect(request?.task.parentId).toBe("default-12");
    expect(request?.task.leadWeeks).toBe(4);
    expect(request?.categoryId).toBe("week-4");
  });

  it("keeps the room booking before classification", () => {
    const request = findTask(DEFAULT_STATE, "default-21");
    const classification = findTask(DEFAULT_STATE, "default-11");

    expect(request?.task.parentId).toBe("default-11");
    expect(categoryIndex(request?.categoryId ?? "")).toBeLessThan(
      categoryIndex(classification?.categoryId ?? ""),
    );
  });

  it("seeds the spring GM events as two-week spans", () => {
    expect(findTask(DEFAULT_STATE, "default-30")).toMatchObject({
      categoryId: "spring-week-1",
      task: {
        text: "Start collecting dues",
        tags: ["gm"],
        endCategoryId: "spring-week-2",
      },
    });
    expect(findTask(DEFAULT_STATE, "default-31")).toMatchObject({
      categoryId: "spring-week-2",
      task: {
        text: "Project reveal",
        tags: ["gm"],
        endCategoryId: "spring-week-3",
      },
    });
  });

  it("adds the website update task to spring week 1", () => {
    expect(findTask(DEFAULT_STATE, "default-37")).toMatchObject({
      categoryId: "spring-week-1",
      task: { text: "Update website with fall projects" },
    });
  });

  it("seeds the spring e-board transition series", () => {
    expect(findTask(DEFAULT_STATE, "default-38")).toMatchObject({
      categoryId: "spring-week-1",
      task: {
        text: "Grooming future eboard",
        endCategoryId: "spring-week-2",
      },
    });
    expect(findTask(DEFAULT_STATE, "default-39")).toMatchObject({
      categoryId: "spring-week-8",
      task: { text: "Eboard role descriptions", tags: ["gm"] },
    });
    expect(findTask(DEFAULT_STATE, "default-40")).toMatchObject({
      categoryId: "spring-week-12",
      task: { text: "Town hall", tags: ["gm"] },
    });
    expect(findTask(DEFAULT_STATE, "default-41")).toMatchObject({
      categoryId: "spring-week-13",
      task: { text: "Election results", tags: ["gm"] },
    });
  });

  it("tags Spring Retreat as social without planning follow-ups", () => {
    expect(findTask(DEFAULT_STATE, "default-32")).toMatchObject({
      categoryId: "spring-week-8",
      task: { text: "Retreat", tags: ["social"] },
    });
    expect(findTask(DEFAULT_STATE, "default-33")).toMatchObject({
      categoryId: "spring-week-4",
      task: {
        text: "Submit gift fund request for Airbnb",
        parentId: "default-32",
        leadWeeks: 4,
      },
    });
    for (const followUp of SOCIAL_FOLLOW_UPS) {
      expect(findTask(DEFAULT_STATE, followUp.id("default-32"))).toBeNull();
    }
  });

  it("places spring OpenShowCAIS last and its room booking in week 7", () => {
    expect(findTask(DEFAULT_STATE, "default-34")).toMatchObject({
      categoryId: "spring-week-16",
      task: { text: "OpenShowCAIS" },
    });
    expect(findTask(DEFAULT_STATE, "default-35")).toMatchObject({
      categoryId: "spring-week-7",
      task: {
        text: "Book a room for OpenShowCAIS",
        parentId: "default-34",
      },
    });
  });

  it("adds E-ball as a confirmed social event in spring week 6", () => {
    const event = findTask(DEFAULT_STATE, "default-36");

    expect(event).toMatchObject({
      categoryId: "spring-week-6",
      task: { text: "E-ball", tags: ["social"] },
    });
    expect(event?.task.suggested).toBeUndefined();
    for (const followUp of SOCIAL_FOLLOW_UPS) {
      expect(findTask(DEFAULT_STATE, followUp.id("default-36"))).toBeNull();
    }
  });
});

describe("social event suggestions", () => {
  const suggestions: {
    id: string;
    text: string;
    category: string;
    date?: string;
  }[] = [
    { id: "default-22", text: "Welcome new members", category: "week-5" },
    { id: "default-23", text: "Fall break", category: "week-7" },
    { id: "default-24", text: "Halloween", category: "week-10" },
    { id: "default-25", text: "Thanksgiving", category: "week-14" },
    {
      id: "default-26",
      text: "Christmas / end of semester",
      category: "week-15",
    },
    {
      id: "default-27",
      text: "Valentine's Day",
      category: "spring-week-5",
      date: "2027-02-14",
    },
    {
      id: "default-28",
      text: "Easter",
      category: "spring-week-11",
      date: "2027-03-28",
    },
    {
      id: "default-29",
      text: "End of the year",
      category: "spring-week-16",
      date: SPRING_SEMESTER.classesEndISO,
    },
  ];

  it.each(suggestions)(
    "seeds $text in $category as a social suggestion",
    ({ id, text, category }) => {
      const found = findTask(DEFAULT_STATE, id);

      expect(found?.task.text).toBe(text);
      expect(found?.categoryId).toBe(category);
      expect(found?.task.tags).toEqual(["social"]);
      expect(found?.task.suggested).toBe(true);
    },
  );

  it("places the spring suggestions on their actual holiday weeks", () => {
    for (const suggestion of suggestions) {
      if (!suggestion.date) continue;

      expect(findTask(DEFAULT_STATE, suggestion.id)?.categoryId).toBe(
        categoryIdForDate(suggestion.date),
      );
    }
  });

  it("keeps spring suggestion follow-ups inside the spring semester", () => {
    for (const suggestion of suggestions) {
      if (!suggestion.date) continue;

      for (const followUp of SOCIAL_FOLLOW_UPS) {
        expect(
          findTask(DEFAULT_STATE, followUp.id(suggestion.id))?.categoryId,
        ).toMatch(/^spring-week-/);
      }
    }
  });

  it("tags every social suggestion as social", () => {
    const social = DEFAULT_EVENTS.filter(
      (event) => event.suggested && event.tags?.includes("social"),
    );

    expect(social.map((event) => event.id)).toEqual(
      suggestions.map((suggestion) => suggestion.id),
    );
  });

  it("does not mark the other defaults as suggestions", () => {
    const otherDefaults = DEFAULT_EVENTS.filter(
      (event) => !event.tags?.includes("social"),
    );

    expect(otherDefaults.every((event) => !event.suggested)).toBe(true);
  });

  it("gives every social suggestion all three follow-ups at their lead times", () => {
    const expected = [
      {
        id: socialPollId,
        text: SOCIAL_POLL_TEXT,
        leadWeeks: SOCIAL_POLL_LEAD_WEEKS,
      },
      {
        id: startPlanningId,
        text: START_PLANNING_TEXT,
        leadWeeks: START_PLANNING_LEAD_WEEKS,
      },
      {
        id: announceId,
        text: ANNOUNCE_TEXT,
        leadWeeks: ANNOUNCE_LEAD_WEEKS,
      },
    ];

    for (const suggestion of suggestions) {
      const event = findTask(DEFAULT_STATE, suggestion.id);
      for (const followUp of expected) {
        const found = findTask(DEFAULT_STATE, followUp.id(suggestion.id));

        expect(found?.task.text).toBe(followUp.text);
        expect(found?.task.parentId).toBe(suggestion.id);
        expect(found?.task.leadWeeks).toBe(followUp.leadWeeks);
        expect(categoryIndex(found?.categoryId ?? "")).toBe(
          categoryIndex(event?.categoryId ?? "") - followUp.leadWeeks,
        );
      }
    }
  });

  it("does not add follow-ups to Retreat, the big little reveal, Spring Retreat, or E-ball", () => {
    for (const parentId of ["default-12", "default-18", "default-32", "default-36"]) {
      for (const followUp of SOCIAL_FOLLOW_UPS) {
        expect(findTask(DEFAULT_STATE, followUp.id(parentId))).toBeNull();
      }
    }
  });

  it("starts every follow-up without interest", () => {
    for (const suggestion of suggestions) {
      expect(
        findTask(DEFAULT_STATE, socialPollId(suggestion.id))?.task.interested,
      ).toBeUndefined();

      for (const followUp of SOCIAL_FOLLOW_UPS) {
        expect(
          findTask(DEFAULT_STATE, followUp.id(suggestion.id)),
        ).not.toBeNull();
      }
    }
  });
});

describe("default dependencies", () => {
  it("orders the recruitment chain", () => {
    const chain = [
      "default-7",
      "default-10",
      "default-15",
      "default-16",
      "default-17",
      "default-11",
    ];

    for (let index = 1; index < chain.length; index += 1) {
      expect(DEFAULT_DEPENDENCIES).toContainEqual({
        before: chain[index - 1],
        after: chain[index],
      });
    }
  });

  it("puts the big little reveal after Retreat", () => {
    expect(DEFAULT_DEPENDENCIES).toContainEqual({
      before: "default-12",
      after: "default-18",
    });
  });

  it("orders the spring e-board transition series", () => {
    const chain = ["default-38", "default-39", "default-40", "default-41"];

    for (let index = 1; index < chain.length; index += 1) {
      expect(DEFAULT_DEPENDENCIES).toContainEqual({
        before: chain[index - 1],
        after: chain[index],
      });
    }
  });
});
