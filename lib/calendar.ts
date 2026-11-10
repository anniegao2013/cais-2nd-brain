// The timeline is grounded in the USC academic calendar: Week 1 begins on
// Classes Begin and the final week ends on Classes End. The scraped semester
// span is committed in usc-calendar.generated.json so the board stays stable
// between scraper runs.
import generated from "./usc-calendar.generated.json";
import type { UscSemesterBoundary, UscSemesterTerm } from "./usc-calendar";

type GeneratedCalendar = { semesters: UscSemesterBoundary[] };

export const BOARD_TERM: UscSemesterTerm = "fall";
export const BOARD_YEAR = 2026;

const calendar = generated as unknown as GeneratedCalendar;
const boardSemester = calendar.semesters.find(
  (semester) =>
    semester.term === BOARD_TERM && semester.year === BOARD_YEAR,
);

if (!boardSemester) {
  throw new Error(
    "Missing the Fall 2026 Classes Begin/Classes End span. Run `npm run scrape:usc`.",
  );
}

export const CLASSES_BEGIN_ISO = boardSemester.classesBeginISO;
export const CLASSES_END_ISO = boardSemester.classesEndISO;
export const WEEK_ONE_START = CLASSES_BEGIN_ISO;
export const TIMELINE_START_ISO = CLASSES_BEGIN_ISO;
export const TIMELINE_END_ISO = CLASSES_END_ISO;

const DAY_MS = 24 * 60 * 60 * 1000;
const WEEK_MS = DAY_MS * 7;
const WEEK_ONE_START_MS = Date.parse(`${CLASSES_BEGIN_ISO}T00:00:00Z`);
const CLASSES_END_MS = Date.parse(`${CLASSES_END_ISO}T00:00:00Z`);

if (CLASSES_END_MS < WEEK_ONE_START_MS) {
  throw new Error("Classes End cannot be before Classes Begin.");
}

// The final week can be shorter than seven days when Classes End falls before
// the end of that calendar week.
const INCLUSIVE_DAY_COUNT =
  Math.round((CLASSES_END_MS - WEEK_ONE_START_MS) / DAY_MS) + 1;
export const WEEK_COUNT = Math.ceil(INCLUSIVE_DAY_COUNT / 7);

const monthDay = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  timeZone: "UTC",
});

const weekdayDate = new Intl.DateTimeFormat("en-US", {
  weekday: "short",
  month: "short",
  day: "numeric",
  timeZone: "UTC",
});

function toISODate(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

function formatRange(startMs: number, endMs: number): string {
  const start = new Date(startMs);
  const end = new Date(endMs);
  const sameMonth =
    start.getUTCFullYear() === end.getUTCFullYear() &&
    start.getUTCMonth() === end.getUTCMonth();

  const startLabel = monthDay.format(start);
  const endLabel = sameMonth ? String(end.getUTCDate()) : monthDay.format(end);
  return `${startLabel}–${endLabel}`;
}

export type WeekRange = {
  week: number;
  startISO: string;
  endISO: string;
  label: string;
};

export function weekNumberFromCategoryId(categoryId: string): number | null {
  if (!categoryId.startsWith("week-")) return null;
  const week = Number(categoryId.slice("week-".length));
  return Number.isInteger(week) && week >= 1 && week <= WEEK_COUNT
    ? week
    : null;
}

export function weekRange(week: number): WeekRange {
  const startMs = WEEK_ONE_START_MS + (week - 1) * WEEK_MS;
  const endMs = Math.min(startMs + WEEK_MS - DAY_MS, CLASSES_END_MS);
  return {
    week,
    startISO: toISODate(startMs),
    endISO: toISODate(endMs),
    label: formatRange(startMs, endMs),
  };
}

// Maps a real calendar date to the numbered week that contains it.
export function weekNumberForDate(iso: string): number | null {
  const ms = Date.parse(`${iso}T00:00:00Z`);
  if (Number.isNaN(ms)) return null;

  const offset = ms - WEEK_ONE_START_MS;
  if (offset < 0 || ms > CLASSES_END_MS) return null;
  return Math.floor(offset / WEEK_MS) + 1;
}

export function categoryIdForDate(iso: string): string | null {
  const week = weekNumberForDate(iso);
  return week === null ? null : `week-${week}`;
}

// Returns the date range for a week section, or null for spring/summer.
export function weekRangeLabel(categoryId: string): string | null {
  const week = weekNumberFromCategoryId(categoryId);
  return week === null ? null : weekRange(week).label;
}

export function timelineRangeLabel(): string {
  const first = weekRange(1);
  const last = weekRange(WEEK_COUNT);
  const start = new Date(`${first.startISO}T00:00:00Z`);
  const end = new Date(`${last.endISO}T00:00:00Z`);
  const sameYear = start.getUTCFullYear() === end.getUTCFullYear();

  const startLabel = sameYear
    ? monthDay.format(start)
    : `${monthDay.format(start)}, ${start.getUTCFullYear()}`;
  return `${startLabel} – ${monthDay.format(end)}, ${end.getUTCFullYear()}`;
}

// GM events always happen on the Wednesday of the week they are listed under.
export function weekWednesdayISO(categoryId: string): string | null {
  const week = weekNumberFromCategoryId(categoryId);
  if (week === null) return null;

  const startMs = WEEK_ONE_START_MS + (week - 1) * WEEK_MS;
  const startDay = new Date(startMs).getUTCDay();
  const daysUntilWednesday = (3 - startDay + 7) % 7;
  return toISODate(startMs + daysUntilWednesday * DAY_MS);
}

export function gmDateLabel(categoryId: string): string | null {
  const iso = weekWednesdayISO(categoryId);
  if (!iso) return null;
  return weekdayDate.format(new Date(`${iso}T00:00:00Z`));
}
