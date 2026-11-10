import { describe, expect, it } from "vitest";
import {
  CLASSES_BEGIN_ISO,
  CLASSES_END_ISO,
  WEEK_COUNT,
  WEEK_ONE_START,
  gmDateLabel,
  timelineRangeLabel,
  weekNumberFromCategoryId,
  weekRange,
  weekRangeLabel,
  weekWednesdayISO,
} from "../lib/calendar";

describe("weekRange", () => {
  it("anchors week 1 to Classes Begin", () => {
    expect(CLASSES_BEGIN_ISO).toBe("2026-08-24");
    expect(WEEK_ONE_START).toBe(CLASSES_BEGIN_ISO);
    expect(weekRange(1)).toMatchObject({
      week: 1,
      startISO: "2026-08-24",
      endISO: "2026-08-30",
      label: "Aug 24–30",
    });
  });

  it("starts every week on the Classes Begin weekday", () => {
    const firstDay = new Date(`${CLASSES_BEGIN_ISO}T00:00:00Z`).getUTCDay();

    expect(firstDay).toBe(1); // Classes Begin is a Monday in Fall 2026.
    for (let week = 1; week <= WEEK_COUNT; week += 1) {
      const start = new Date(`${weekRange(week).startISO}T00:00:00Z`);
      expect(start.getUTCDay()).toBe(firstDay);
    }
  });

  it("advances seven days at a time", () => {
    expect(weekRange(2).startISO).toBe("2026-08-31");
    expect(weekRange(2).label).toBe("Aug 31–Sep 6");
    expect(weekRange(10).label).toBe("Oct 26–Nov 1");
    expect(weekRange(14).label).toBe("Nov 23–29");
  });

  it("ends the final week on Classes End", () => {
    expect(CLASSES_END_ISO).toBe("2026-12-04");
    expect(weekRange(WEEK_COUNT)).toMatchObject({
      startISO: "2026-11-30",
      endISO: "2026-12-04",
      label: "Nov 30–Dec 4",
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
    expect(weekRangeLabel("week-3")).toBe("Sep 7–13");
    expect(weekRangeLabel("week-15")).toBe("Nov 30–Dec 4");
    expect(weekRangeLabel("spring")).toBeNull();
    expect(weekRangeLabel("summer")).toBeNull();
  });
});

describe("timelineRangeLabel", () => {
  it("spans Classes Begin through Classes End", () => {
    expect(timelineRangeLabel()).toBe("Aug 24 – Dec 4, 2026");
  });
});

describe("gmDateLabel", () => {
  it("puts GM on the Wednesday of each week", () => {
    expect(weekWednesdayISO("week-1")).toBe("2026-08-26");
    expect(gmDateLabel("week-1")).toBe("Wed, Aug 26");
    expect(gmDateLabel("week-10")).toBe("Wed, Oct 28");
    expect(gmDateLabel("week-15")).toBe("Wed, Dec 2");
  });

  it("has no date for spring or summer", () => {
    expect(weekWednesdayISO("spring")).toBeNull();
    expect(gmDateLabel("spring")).toBeNull();
    expect(gmDateLabel("summer")).toBeNull();
  });
});
