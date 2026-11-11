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
  parseUscAcademicCalendarPage,
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
          <td><strong>Classes Begin</strong></td>
          <td>Mon</td>
          <td>August 24</td>
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
          <td><strong>Classes End</strong></td>
          <td>Fri</td>
          <td>December 4</td>
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
          <td><strong>Classes Begin</strong></td>
          <td>Mon</td>
          <td>January 11</td>
        </tr>
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
        <tr>
          <td><strong>Classes End</strong></td>
          <td>Fri</td>
          <td>April 30</td>
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

describe("parseUscAcademicCalendarPage", () => {
  const page = parseUscAcademicCalendarPage(PAGE);

  it("reads Classes Begin and Classes End for each semester", () => {
    expect(page.semesters).toEqual([
      {
        term: "fall",
        year: 2026,
        classesBeginISO: "2026-08-24",
        classesEndISO: "2026-12-04",
      },
      {
        term: "spring",
        year: 2027,
        classesBeginISO: "2027-01-11",
        classesEndISO: "2027-04-30",
      },
    ]);
  });

  it("keeps instructional rows out of the holiday list", () => {
    expect(
      page.entries.some((entry) => entry.label === "Classes Begin"),
    ).toBe(false);
    expect(page.entries.some((entry) => entry.label === "Classes End")).toBe(
      false,
    );
  });
});

describe("date to week mapping", () => {
  it("maps dates onto the week blocks", () => {
    expect(weekNumberForDate("2026-08-24")).toBe(1);
    expect(weekNumberForDate("2026-08-30")).toBe(1);
    expect(weekNumberForDate("2026-08-31")).toBe(2);
    expect(weekNumberForDate("2026-09-07")).toBe(3);
    expect(weekNumberForDate("2026-12-04")).toBe(15);
    expect(categoryIdForDate("2026-10-08")).toBe("week-7");
  });

  it("ignores dates outside the timeline or invalid input", () => {
    expect(categoryIdForDate("2026-08-23")).toBeNull();
    expect(categoryIdForDate("2026-12-05")).toBeNull();
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

  it("marks a holiday in the week that holds most of its days", () => {
    const [early] = timelineHolidays([
      makeEntry("Long Recess", "2026-09-02", "2026-09-10"),
    ]);
    const [late] = timelineHolidays([
      makeEntry("Late Recess", "2026-09-06", "2026-09-10"),
    ]);

    expect(early).toMatchObject({ categoryId: "week-2" });
    expect(late).toMatchObject({ categoryId: "week-3" });
    expect(early).not.toHaveProperty("endCategoryId");
    expect(late).not.toHaveProperty("endCategoryId");
  });

  it("puts a Sunday-to-Sunday spring recess in its main week", () => {
    const [holiday] = timelineHolidays([
      makeEntry("Spring Recess", "2027-03-14", "2027-03-21"),
    ]);

    expect(holiday).toMatchObject({
      categoryId: "spring-week-10",
      startISO: "2027-03-14",
      endISO: "2027-03-21",
    });
    expect(holiday).not.toHaveProperty("endCategoryId");
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
      category: "week-3",
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
    {
      id: "usc-holiday-2027-01-18-martin-luther-king-jr-day-holiday",
      label: "Martin Luther King Jr. Day Holiday",
      category: "spring-week-2",
    },
    {
      id: "usc-holiday-2027-02-15-presidents-day-holiday",
      label: "President’s Day Holiday",
      category: "spring-week-6",
    },
    {
      id: "usc-holiday-2027-03-14-spring-recess",
      label: "Spring Recess",
      category: "spring-week-10",
    },
  ];

  it("finds the Fall 2026 and Spring 2027 holidays on the dated timeline", () => {
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

  it("leaves out holidays that do not map to an instructional week", () => {
    expect(DEFAULT_EVENTS.some((event) => event.text === "Winter Recess")).toBe(
      false,
    );
    expect(
      DEFAULT_EVENTS.some((event) => event.text === "Memorial Day Holiday"),
    ).toBe(false);
  });

  it("uses the scraped instructional range", () => {
    expect(TIMELINE_START_ISO).toBe("2026-08-24");
    expect(TIMELINE_END_ISO).toBe("2027-04-30");
  });
});
