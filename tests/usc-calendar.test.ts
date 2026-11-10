import { describe, expect, it } from "vitest";
import {
  TIMELINE_END_ISO,
  TIMELINE_START_ISO,
  categoryIdForDate,
  weekNumberForDate,
} from "../lib/calendar";
import { DEFAULT_EVENTS, DEFAULT_STATE } from "../lib/defaults";
import { findTask } from "../lib/tasks";
import {
  parseUscAcademicCalendar,
  type UscCalendarEntry,
} from "../lib/usc-calendar";
import {
  USC_TIMELINE_HOLIDAYS,
  timelineHolidays,
} from "../lib/usc-holidays";

const PAGE = `
<html>
  <body>
    <h2>Academic Calendar</h2>
    <h3 class="wp-block-heading"><strong>Fall Semester 2026</strong></h3>
    <h3><strong><!-- /wp:heading --></strong></h3>
    <table>
      <tbody>
        <tr>
          <td><strong>Open Registration</strong></td>
          <td>Mon-Fri</td>
          <td>August 17-21</td>
        </tr>
        <tr>
          <td><strong>Labor Day Holiday</strong></td>
          <td>Mon</td>
          <td>September 7</td>
        </tr>
        <tr>
          <td><strong>Fall Recess</strong></td>
          <td>Thu-Fri</td>
          <td>October 8\u20139</td>
        </tr>
        <tr>
          <td><strong>Veterans Day Holiday</strong></td>
          <td>Wed</td>
          <td>November 11</td>
        </tr>
        <tr>
          <td><strong>Thanksgiving Holiday</strong></td>
          <td>Wed-Sun</td>
          <td>November 25-29</td>
        </tr>
        <tr>
          <td><strong>Winter Recess</strong></td>
          <td>Thu-Sun</td>
          <td>December 17-January 10<br /><em>*Winter Holiday for Graduate Student Workers: 12/25/26-01/01/27</em></td>
        </tr>
        <tr>
          <td><strong>Labor Day Holiday</strong></td>
          <td>Mon</td>
          <td>September 7</td>
        </tr>
      </tbody>
    </table>
    <h3><strong>Spring Semester 2027</strong></h3>
    <table>
      <tbody>
        <tr>
          <td><strong>Martin Luther King Jr. Day Holiday</strong></td>
          <td>Mon</td>
          <td>January 18</td>
        </tr>
        <tr>
          <td><strong>Spring Recess</strong></td>
          <td>Sun-Sun</td>
          <td>March 14-21</td>
        </tr>
        <tr>
          <td><strong>Juneteenth</strong></td>
          <td>Sat</td>
          <td>June 19</td>
        </tr>
      </tbody>
    </table>
    <h3><strong>Other information</strong></h3>
    <table>
      <tbody>
        <tr>
          <td><strong>Fake Holiday</strong></td>
          <td>Mon</td>
          <td>September 7</td>
        </tr>
      </tbody>
    </table>
  </body>
</html>
`;

function makeEntry(
  label: string,
  startISO: string,
  endISO = startISO,
): UscCalendarEntry {
  return {
    label,
    term: "fall",
    semesterYear: Number(startISO.slice(0, 4)),
    days: "",
    startISO,
    endISO,
  };
}

describe("parseUscAcademicCalendar", () => {
  const entries = parseUscAcademicCalendar(PAGE);

  it("keeps only rows labeled holiday or recess", () => {
    expect(entries.map((entry) => entry.label)).toEqual([
      "Labor Day Holiday",
      "Fall Recess",
      "Veterans Day Holiday",
      "Thanksgiving Holiday",
      "Winter Recess",
      "Martin Luther King Jr. Day Holiday",
      "Spring Recess",
    ]);
  });

  it("deduplicates repeated rows", () => {
    expect(
      entries.filter((entry) => entry.label === "Labor Day Holiday"),
    ).toHaveLength(1);
  });

  it("reads single dates and same-month ranges", () => {
    expect(entries).toContainEqual({
      label: "Labor Day Holiday",
      term: "fall",
      semesterYear: 2026,
      days: "Mon",
      startISO: "2026-09-07",
      endISO: "2026-09-07",
    });
    expect(entries).toContainEqual(
      expect.objectContaining({
        label: "Thanksgiving Holiday",
        startISO: "2026-11-25",
        endISO: "2026-11-29",
      }),
    );
  });

  it("rolls a cross-year range into the next year and drops notes", () => {
    expect(entries).toContainEqual(
      expect.objectContaining({
        label: "Winter Recess",
        startISO: "2026-12-17",
        endISO: "2027-01-10",
      }),
    );
  });

  it("ignores tables that are not under a semester heading", () => {
    expect(entries.some((entry) => entry.label === "Fake Holiday")).toBe(false);
    expect(entries.some((entry) => entry.label === "Juneteenth")).toBe(false);
  });
});

describe("date to week mapping", () => {
  it("maps dates onto the week blocks", () => {
    expect(weekNumberForDate("2026-08-25")).toBe(1);
    expect(weekNumberForDate("2026-09-07")).toBe(2);
    expect(weekNumberForDate("2026-12-07")).toBe(15);
    expect(categoryIdForDate("2026-10-08")).toBe("week-7");
  });

  it("ignores dates outside the timeline or invalid input", () => {
    expect(categoryIdForDate("2026-08-24")).toBeNull();
    expect(categoryIdForDate("2026-12-08")).toBeNull();
    expect(categoryIdForDate("not-a-date")).toBeNull();
  });
});

describe("timelineHolidays", () => {
  it("keeps only holidays that overlap the timeline", () => {
    const holidays = timelineHolidays([
      makeEntry("Before", "2026-08-01", "2026-08-10"),
      makeEntry("Inside", "2026-09-07"),
      makeEntry("After", "2026-12-17", "2027-01-10"),
    ]);

    expect(holidays.map((holiday) => holiday.label)).toEqual(["Inside"]);
  });

  it("clamps an overlapping start to the first week", () => {
    const [holiday] = timelineHolidays([
      makeEntry("Early Recess", "2026-08-20", "2026-08-26"),
    ]);

    expect(holiday).toMatchObject({
      categoryId: "week-1",
      startISO: "2026-08-20",
    });
  });

  it("spans a holiday that covers more than one week", () => {
    const [holiday] = timelineHolidays([
      makeEntry("Long Recess", "2026-09-02", "2026-09-10"),
    ]);

    expect(holiday).toMatchObject({
      categoryId: "week-2",
      endCategoryId: "week-3",
    });
  });

  it("builds stable ids from the date and label", () => {
    const [holiday] = timelineHolidays([
      makeEntry("Labor Day Holiday", "2026-09-07"),
    ]);

    expect(holiday.id).toBe("usc-holiday-2026-09-07-labor-day-holiday");
  });
});

describe("scraped USC holidays in the default board", () => {
  const expected = [
    {
      id: "usc-holiday-2026-09-07-labor-day-holiday",
      label: "Labor Day Holiday",
      category: "week-2",
    },
    {
      id: "usc-holiday-2026-10-08-fall-recess",
      label: "Fall Recess",
      category: "week-7",
    },
    {
      id: "usc-holiday-2026-11-11-veterans-day-holiday",
      label: "Veterans Day Holiday",
      category: "week-12",
    },
    {
      id: "usc-holiday-2026-11-25-thanksgiving-holiday",
      label: "Thanksgiving Holiday",
      category: "week-14",
    },
  ];

  it("finds the four Fall 2026 holidays on the dated timeline", () => {
    expect(
      USC_TIMELINE_HOLIDAYS.map((holiday) => ({
        id: holiday.id,
        label: holiday.label,
        category: holiday.categoryId,
      })),
    ).toEqual(expected);
  });

  it.each(expected)("seeds $label in $category", ({ id, label, category }) => {
    const found = findTask(DEFAULT_STATE, id);

    expect(found?.task.text).toBe(label);
    expect(found?.task.done).toBe(false);
    expect(found?.task.isDefault).toBe(true);
    expect(found?.task.isHoliday).toBe(true);
    expect(found?.categoryId).toBe(category);
  });

  it("leaves out holidays after Week 15", () => {
    expect(DEFAULT_EVENTS.some((event) => event.text === "Winter Recess")).toBe(
      false,
    );
    expect(
      DEFAULT_EVENTS.some(
        (event) => event.id === "usc-holiday-2026-12-17-winter-recess",
      ),
    ).toBe(false);
  });

  it("uses the dated timeline range", () => {
    expect(TIMELINE_START_ISO).toBe("2026-08-25");
    expect(TIMELINE_END_ISO).toBe("2026-12-07");
  });
});
