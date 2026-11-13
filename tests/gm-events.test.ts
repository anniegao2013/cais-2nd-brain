import { describe, expect, it } from "vitest";
import {
  FALL_SEMESTER,
  SPRING_SEMESTER,
  categoryIdForWeek,
} from "../lib/calendar";
import { GM_TEXT, gmEventId, isGmEvent, weeklyGmEvents } from "../lib/gm-events";
import { USC_TIMELINE_HOLIDAYS } from "../lib/usc-holidays";

function gmCategories(): string[] {
  return weeklyGmEvents().map((event) => event.category);
}

describe("weeklyGmEvents", () => {
  it("adds a GM to every fall week without a holiday conflict", () => {
    const fall = gmCategories().filter((categoryId) =>
      categoryId.startsWith("week-"),
    );

    expect(fall).toEqual([
      "week-1",
      "week-2",
      "week-3",
      "week-4",
      "week-5",
      "week-6",
      "week-8",
      "week-9",
      "week-10",
      "week-11",
      "week-13",
      "week-15",
    ]);
    expect(fall).toHaveLength(FALL_SEMESTER.weekCount - 3);
  });

  it("adds a GM to every spring week except spring break", () => {
    const spring = gmCategories().filter((categoryId) =>
      categoryId.startsWith("spring-week-"),
    );
    const expected = Array.from(
      { length: SPRING_SEMESTER.weekCount },
      (_, index) => categoryIdForWeek("spring", index + 1),
    ).filter((categoryId) => categoryId !== "spring-week-10");

    expect(spring).toEqual(expected);
  });

  it("skips Wednesday holidays", () => {
    const categories = gmCategories();

    expect(categories).not.toContain("week-12"); // Veterans Day
    expect(categories).not.toContain("week-14"); // Thanksgiving
    expect(categories).not.toContain("spring-week-10"); // Spring Recess
  });

  it("keeps GM when a holiday falls on another weekday", () => {
    const categories = gmCategories();

    expect(categories).toContain("week-3"); // Labor Day is Monday
    expect(categories).toContain("spring-week-2"); // MLK Day is Monday
    expect(categories).toContain("spring-week-6"); // Presidents Day is Monday
  });

  it("skips Fall Recess even though it does not include Wednesday", () => {
    const fallRecess = USC_TIMELINE_HOLIDAYS.find(
      (holiday) => holiday.label === "Fall Recess",
    );

    expect(fallRecess?.startISO).toBe("2026-10-08");
    expect(gmCategories()).not.toContain("week-7");
  });

  it("keeps every GM event untagged", () => {
    for (const event of weeklyGmEvents()) {
      expect(event).toMatchObject({
        id: gmEventId(event.category),
        text: GM_TEXT,
      });
      expect("tags" in event).toBe(false);
    }
  });

  it("recognizes generated GM events by their stable id", () => {
    expect(isGmEvent({ id: gmEventId("week-1") })).toBe(true);
    expect(isGmEvent({ id: gmEventId("spring-week-12") })).toBe(true);
    expect(isGmEvent({ id: "default-30" })).toBe(false);
    expect(isGmEvent({ id: "custom-gm" })).toBe(false);
  });

  it("cancels a week whose Wednesday is covered by any holiday", () => {
    const categories = weeklyGmEvents([
      ...USC_TIMELINE_HOLIDAYS,
      {
        id: "test-wednesday-holiday",
        label: "Test Holiday",
        categoryId: "week-1",
        startISO: "2026-08-26",
        endISO: "2026-08-26",
      },
    ]).map((event) => event.category);

    expect(categories).not.toContain("week-1");
    expect(categories).toContain("week-2");
  });
});
