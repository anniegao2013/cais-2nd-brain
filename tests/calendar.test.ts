import { describe, expect, it } from "vitest";
import {
  CLASSES_BEGIN_ISO,
  CLASSES_END_ISO,
  SPRING_WEEK_COUNT,
  WEEK_COUNT,
  WEEK_ONE_START,
  categoryIdForDate,
  currentWeekCategoryId,
  currentWeekNumber,
  gmDateLabel,
  semesterRangeLabel,
  timelineRangeLabel,
  weekInfoFromCategoryId,
  weekNumberFromCategoryId,
  weekRange,
  weekRangeForSemester,
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
    expect(weekRangeLabel("spring-week-1")).toBe("Jan 11–17");
    expect(weekRangeLabel("spring")).toBeNull();
    expect(weekRangeLabel("summer")).toBeNull();
  });
});

describe("spring semester", () => {
  it("runs its own numbered weeks from Spring Classes Begin", () => {
    expect(SPRING_WEEK_COUNT).toBe(16);
    expect(weekRangeForSemester("spring", 1)).toMatchObject({
      startISO: "2027-01-11",
      endISO: "2027-01-17",
      label: "Jan 11–17",
    });
    expect(weekRangeForSemester("spring", SPRING_WEEK_COUNT)).toMatchObject({
      startISO: "2027-04-26",
      endISO: "2027-04-30",
      label: "Apr 26–30",
    });
    expect(semesterRangeLabel("spring")).toBe("Jan 11 – Apr 30, 2027");
  });

  it("parses spring week category ids", () => {
    expect(weekInfoFromCategoryId("spring-week-6")).toEqual({
      semesterId: "spring",
      week: 6,
    });
    expect(weekNumberFromCategoryId("spring-week-6")).toBeNull();
    expect(weekInfoFromCategoryId("spring")).toBeNull();
    expect(weekInfoFromCategoryId("spring-week-17")).toBeNull();
  });

  it("maps Spring 2027 dates and holidays onto spring weeks", () => {
    expect(categoryIdForDate("2027-01-11")).toBe("spring-week-1");
    expect(categoryIdForDate("2027-02-15")).toBe("spring-week-6");
    expect(categoryIdForDate("2027-04-30")).toBe("spring-week-16");
    expect(categoryIdForDate("2026-12-17")).toBeNull();
    expect(categoryIdForDate("2027-05-01")).toBeNull();
  });

  it("finds the spring week containing today", () => {
    expect(currentWeekCategoryId(new Date(2027, 1, 15, 12))).toBe(
      "spring-week-6",
    );
    expect(currentWeekNumber(new Date(2027, 1, 15, 12))).toBeNull();
  });

  it("puts GM on the Wednesday of a spring week", () => {
    expect(weekWednesdayISO("spring-week-1")).toBe("2027-01-13");
    expect(gmDateLabel("spring-week-1")).toBe("Wed, Jan 13");
  });
});

describe("timelineRangeLabel", () => {
  it("spans Classes Begin through Classes End", () => {
    expect(timelineRangeLabel()).toBe("Aug 24 – Dec 4, 2026");
  });
});

describe("currentWeekNumber", () => {
  it("finds the week containing today's local date", () => {
    expect(currentWeekNumber(new Date(2026, 10, 9, 12))).toBe(12);
    expect(currentWeekNumber(new Date(2026, 10, 15, 23, 59))).toBe(12);
  });

  it("returns null outside the instructional timeline", () => {
    expect(currentWeekNumber(new Date(2026, 7, 23, 12))).toBeNull();
    expect(currentWeekNumber(new Date(2026, 11, 5, 12))).toBeNull();
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
