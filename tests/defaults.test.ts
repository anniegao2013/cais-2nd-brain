import { describe, expect, it } from "vitest";
import {
  DEFAULT_DEPENDENCIES,
  DEFAULT_EVENTS,
  DEFAULT_STATE,
} from "../lib/defaults";
import { categoryIndex } from "../lib/categories";
import {
  SOCIAL_POLL_LEAD_WEEKS,
  SOCIAL_POLL_TEXT,
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
    const socialPolls = DEFAULT_EVENTS.filter((event) =>
      event.tags?.includes("social"),
    ).length;

    expect(tasks).toHaveLength(DEFAULT_EVENTS.length + socialPolls);
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
});

describe("social event suggestions", () => {
  const suggestions = [
    { id: "default-22", text: "Welcome new members", category: "week-5" },
    { id: "default-23", text: "Fall break", category: "week-7" },
    { id: "default-24", text: "Halloween", category: "week-10" },
    { id: "default-25", text: "Thanksgiving", category: "week-14" },
    {
      id: "default-26",
      text: "Christmas / end of semester",
      category: "week-15",
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

  it("tags every social suggestion as social", () => {
    const social = DEFAULT_EVENTS.filter((event) =>
      event.tags?.includes("social"),
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

  it("gives every social suggestion an interest poll four sections earlier", () => {
    for (const suggestion of suggestions) {
      const event = findTask(DEFAULT_STATE, suggestion.id);
      const poll = findTask(DEFAULT_STATE, socialPollId(suggestion.id));

      expect(poll?.task.text).toBe(SOCIAL_POLL_TEXT);
      expect(poll?.task.parentId).toBe(suggestion.id);
      expect(poll?.task.leadWeeks).toBe(SOCIAL_POLL_LEAD_WEEKS);
      expect(categoryIndex(poll?.categoryId ?? "")).toBe(
        categoryIndex(event?.categoryId ?? "") - SOCIAL_POLL_LEAD_WEEKS,
      );
    }
  });

  it("does not add interest polls to Retreat or the big little reveal", () => {
    expect(findTask(DEFAULT_STATE, socialPollId("default-12"))).toBeNull();
    expect(findTask(DEFAULT_STATE, socialPollId("default-18"))).toBeNull();
  });

  it("starts polls without interest or planning follow-ups", () => {
    for (const suggestion of suggestions) {
      const poll = findTask(DEFAULT_STATE, socialPollId(suggestion.id));

      expect(poll?.task.interested).toBeUndefined();
      expect(
        findTask(DEFAULT_STATE, startPlanningId(suggestion.id)),
      ).toBeNull();
      expect(findTask(DEFAULT_STATE, announceId(suggestion.id))).toBeNull();
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
});
