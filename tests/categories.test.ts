import { describe, expect, it } from "vitest";
import {
  BOARD_SECTIONS,
  SCHEDULE_TABS,
  TIMELINE_TABS,
  boardSectionForTab,
  categoriesForTab,
  isScheduleTab,
  type TimelineTabId,
} from "../lib/categories";

const TAB_IDS = TIMELINE_TABS.map((tab) => tab.id);

describe("board navigation", () => {
  it("lists the top-level sections in order", () => {
    expect(BOARD_SECTIONS.map((section) => section.id)).toEqual([
      "home",
      "schedule",
      "gm-ideas",
      "todos",
      "eboard-agenda",
    ]);
  });

  it("labels the sections for the nav bar", () => {
    expect(BOARD_SECTIONS.map((section) => section.label)).toEqual([
      "Home",
      "Schedule",
      "GM ideas",
      "To-do",
      "E-board meeting agenda",
    ]);
  });

  it("keeps Home out of the timeline tabs", () => {
    expect((TAB_IDS as string[])).not.toContain("home");
  });

  it("keeps the three terms inside Schedule", () => {
    expect(SCHEDULE_TABS.map((tab) => tab.id)).toEqual([
      "before",
      "fall",
      "spring",
    ]);
    expect(SCHEDULE_TABS).toEqual(TIMELINE_TABS.slice(0, 3));
  });

  it("maps every timeline tab to its section", () => {
    expect(boardSectionForTab("before")).toBe("schedule");
    expect(boardSectionForTab("fall")).toBe("schedule");
    expect(boardSectionForTab("spring")).toBe("schedule");
    expect(boardSectionForTab("gm-ideas")).toBe("gm-ideas");
    expect(boardSectionForTab("todos")).toBe("todos");
    expect(boardSectionForTab("eboard-agenda")).toBe("eboard-agenda");
  });

  it("recognizes only the term tabs as schedule tabs", () => {
    const schedule = TAB_IDS.filter((id) => isScheduleTab(id));
    expect(schedule).toEqual(["before", "fall", "spring"]);

    const others: TimelineTabId[] = ["gm-ideas", "todos", "eboard-agenda"];
    for (const id of others) expect(isScheduleTab(id)).toBe(false);
  });

  it("still exposes the weekly categories for each term", () => {
    expect(categoriesForTab("before").map((category) => category.id)).toEqual([
      "spring",
      "summer",
    ]);
    expect(categoriesForTab("fall")[0]?.id).toBe("week-1");
    expect(categoriesForTab("spring")[0]?.id).toBe("spring-week-1");
  });
});
