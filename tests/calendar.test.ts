import { describe, expect, it } from "vitest";
import {
  WEEK_COUNT,
  WEEK_ONE_START,
  timelineRangeLabel,
  weekNumberFromCategoryId,
  weekRange,
  weekRangeLabel,
} from "../lib/calendar";

describe("weekRange", () => {
  it("anchors week 1 to August 25, 2026", () => {
    expect(WEEK_ONE_START).toBe("2026-08-25");
    expect(weekRange(1)).toMatchObject({
      week: 1,
      startISO: "2026-08-25",
      endISO: "2026-08-31",
      label: "Aug 25–31",
    });
  });

  it("starts every week on a Tuesday", () => {
    for (let week = 1; week <= WEEK_COUNT; week += 1) {
      const start = new Date(`${weekRange(week).startISO}T00:00:00Z`);
      expect(start.getUTCDay()).toBe(2);
    }
  });

  it("advances seven days at a time", () => {
    expect(weekRange(2).startISO).toBe("2026-09-01");
    expect(weekRange(2).label).toBe("Sep 1–7");
    expect(weekRange(10).label).toBe("Oct 27–Nov 2");
    expect(weekRange(14).label).toBe("Nov 24–30");
  });

  it("ends week 15 on December 7, 2026", () => {
    expect(weekRange(15)).toMatchObject({
      startISO: "2026-12-01",
      endISO: "2026-12-07",
      label: "Dec 1–7",
    });
  });
});

describe("weekNumberFromCategoryId", () => {
  it("reads week section ids only", () => {
    expect(weekNumberFromCategoryId("week-1")).toBe(1);
    expect(weekNumberFromCategoryId("week-15")).toBe(15);
    expect(weekNumberFromCategoryId("spring")).toBeNull();
    expect(weekNumberFromCategoryId("summer")).toBeNull();
    expect(weekNumberFromCategoryId("week-0")).toBeNull();
    expect(weekNumberFromCategoryId("week-16")).toBeNull();
    expect(weekNumberFromCategoryId("week-abc")).toBeNull();
  });
});

describe("weekRangeLabel", () => {
  it("labels week sections and ignores the rest", () => {
    expect(weekRangeLabel("week-3")).toBe("Sep 8–14");
    expect(weekRangeLabel("week-15")).toBe("Dec 1–7");
    expect(weekRangeLabel("spring")).toBeNull();
    expect(weekRangeLabel("summer")).toBeNull();
  });
});

describe("timelineRangeLabel", () => {
  it("spans the whole week timeline", () => {
    expect(timelineRangeLabel()).toBe("Aug 25 – Dec 7, 2026");
  });
});
