import {
  DATED_SEMESTERS,
  categoryIdForWeek,
  weekRangeForSemester,
  weekWednesdayISO,
} from "./calendar";
import { USC_TIMELINE_HOLIDAYS, type TimelineHoliday } from "./usc-holidays";

export const GM_TEXT = "GM";

// A Wednesday holiday cancels that week's GM. Fall Recess is Thursday-Friday,
// but the whole week is off, so it cancels GM even without a Wednesday holiday.
const WEEK_CANCELLING_HOLIDAY_LABELS = new Set(["Fall Recess"]);

export type WeeklyGmEvent = {
  id: string;
  text: string;
  category: string;
};

export function gmEventId(categoryId: string): string {
  return `gm-${categoryId}`;
}

const GM_EVENT_ID_PATTERN = /^gm-(?:spring-)?week-\d+$/;

export function isGmEvent(task: { id: string }): boolean {
  return GM_EVENT_ID_PATTERN.test(task.id);
}

function coversDate(holiday: TimelineHoliday, iso: string): boolean {
  return holiday.startISO <= iso && iso <= holiday.endISO;
}

function overlapsWeek(
  holiday: TimelineHoliday,
  startISO: string,
  endISO: string,
): boolean {
  return holiday.startISO <= endISO && holiday.endISO >= startISO;
}

// One GM per instructional week, skipping weeks with a Wednesday holiday and
// weeks that are off entirely, such as Fall Recess.
export function weeklyGmEvents(
  holidays: TimelineHoliday[] = USC_TIMELINE_HOLIDAYS,
): WeeklyGmEvent[] {
  const events: WeeklyGmEvent[] = [];

  for (const semester of DATED_SEMESTERS) {
    for (let week = 1; week <= semester.weekCount; week += 1) {
      const categoryId = categoryIdForWeek(semester.id, week);
      const wednesday = weekWednesdayISO(categoryId);
      if (!wednesday) continue;
      if (holidays.some((holiday) => coversDate(holiday, wednesday))) {
        continue;
      }

      const range = weekRangeForSemester(semester.id, week);
      const weekOff = holidays.some(
        (holiday) =>
          WEEK_CANCELLING_HOLIDAY_LABELS.has(holiday.label) &&
          overlapsWeek(holiday, range.startISO, range.endISO),
      );
      if (weekOff) continue;

      events.push({
        id: gmEventId(categoryId),
        text: GM_TEXT,
        category: categoryId,
      });
    }
  }

  return events;
}
