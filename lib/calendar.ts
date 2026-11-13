// The timeline is grounded in the USC academic calendar: Week 1 of each
// semester begins on its Classes Begin date and the final week ends on Classes
// End. The scraped semester spans are committed in usc-calendar.generated.json
// so the board stays stable between scraper runs.
import generated from "./usc-calendar.generated.json";
import type { UscSemesterBoundary, UscSemesterTerm } from "./usc-calendar";

type GeneratedCalendar = { semesters: UscSemesterBoundary[] };

export const BOARD_TERM: UscSemesterTerm = "fall";
export const BOARD_YEAR = 2026;

const calendar = generated as unknown as GeneratedCalendar;

const DAY_MS = 24 * 60 * 60 * 1000;
const WEEK_MS = DAY_MS * 7;

export type DatedSemesterId = "fall" | "spring";

type SemesterDefinition = {
  id: DatedSemesterId;
  term: UscSemesterTerm;
  year: number;
  classesBeginISO: string;
  classesEndISO: string;
  weekCount: number;
  startMs: number;
  endMs: number;
};

function defineSemester(
  term: UscSemesterTerm,
  year: number,
): SemesterDefinition {
  const semester = calendar.semesters.find(
    (candidate) => candidate.term === term && candidate.year === year,
  );
  if (!semester) {
    throw new Error(
      `Missing the ${term} ${year} Classes Begin/Classes End span. Run \`npm run scrape:usc\`.`,
    );
  }

  const startMs = Date.parse(`${semester.classesBeginISO}T00:00:00Z`);
  const endMs = Date.parse(`${semester.classesEndISO}T00:00:00Z`);
  if (endMs < startMs) {
    throw new Error("Classes End cannot be before Classes Begin.");
  }

  // The final week can be shorter than seven days when Classes End falls before
  // the end of that calendar week.
  const inclusiveDayCount = Math.round((endMs - startMs) / DAY_MS) + 1;

  return {
    id: term === "fall" ? "fall" : "spring",
    term,
    year,
    classesBeginISO: semester.classesBeginISO,
    classesEndISO: semester.classesEndISO,
    weekCount: Math.ceil(inclusiveDayCount / 7),
    startMs,
    endMs,
  };
}

export const FALL_SEMESTER = defineSemester(BOARD_TERM, BOARD_YEAR);
export const SPRING_SEMESTER = defineSemester("spring", BOARD_YEAR + 1);
export const DATED_SEMESTERS = [FALL_SEMESTER, SPRING_SEMESTER] as const;

function semesterById(semesterId: DatedSemesterId): SemesterDefinition {
  return semesterId === "fall" ? FALL_SEMESTER : SPRING_SEMESTER;
}

export const CLASSES_BEGIN_ISO = FALL_SEMESTER.classesBeginISO;
export const CLASSES_END_ISO = FALL_SEMESTER.classesEndISO;
export const WEEK_ONE_START = CLASSES_BEGIN_ISO;
export const TIMELINE_START_ISO = FALL_SEMESTER.classesBeginISO;
export const TIMELINE_END_ISO = SPRING_SEMESTER.classesEndISO;
export const WEEK_COUNT = FALL_SEMESTER.weekCount;
export const SPRING_WEEK_COUNT = SPRING_SEMESTER.weekCount;

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

function formatSpan(startISO: string, endISO: string): string {
  const start = new Date(`${startISO}T00:00:00Z`);
  const end = new Date(`${endISO}T00:00:00Z`);
  const sameYear = start.getUTCFullYear() === end.getUTCFullYear();
  const startLabel = sameYear
    ? monthDay.format(start)
    : `${monthDay.format(start)}, ${start.getUTCFullYear()}`;
  return `${startLabel} – ${monthDay.format(end)}, ${end.getUTCFullYear()}`;
}

export type WeekInfo = {
  semesterId: DatedSemesterId;
  week: number;
};

export type WeekRange = {
  week: number;
  startISO: string;
  endISO: string;
  label: string;
};

function validWeek(
  semester: SemesterDefinition,
  week: number,
): WeekInfo | null {
  return Number.isInteger(week) && week >= 1 && week <= semester.weekCount
    ? { semesterId: semester.id, week }
    : null;
}

// Fall keeps the original `week-N` ids so stored boards keep working. Spring
// weeks get their own prefix.
export function categoryIdForWeek(
  semesterId: DatedSemesterId,
  week: number,
): string {
  return semesterId === "fall" ? `week-${week}` : `spring-week-${week}`;
}

export function weekInfoFromCategoryId(categoryId: string): WeekInfo | null {
  const fallMatch = /^week-(\d+)$/.exec(categoryId);
  if (fallMatch) return validWeek(FALL_SEMESTER, Number(fallMatch[1]));

  const springMatch = /^spring-week-(\d+)$/.exec(categoryId);
  if (springMatch) return validWeek(SPRING_SEMESTER, Number(springMatch[1]));

  return null;
}

// Kept for callers that only care about the original Fall board.
export function weekNumberFromCategoryId(categoryId: string): number | null {
  const info = weekInfoFromCategoryId(categoryId);
  return info?.semesterId === "fall" ? info.week : null;
}

export function weekRangeForSemester(
  semesterId: DatedSemesterId,
  week: number,
): WeekRange {
  const semester = semesterById(semesterId);
  const startMs = semester.startMs + (week - 1) * WEEK_MS;
  const endMs = Math.min(startMs + WEEK_MS - DAY_MS, semester.endMs);
  return {
    week,
    startISO: toISODate(startMs),
    endISO: toISODate(endMs),
    label: formatRange(startMs, endMs),
  };
}

export function weekRange(week: number): WeekRange {
  return weekRangeForSemester("fall", week);
}

// Maps a real calendar date to the semester week that contains it. Dates in
// the winter or summer breaks return null because they are not instructional.
export function semesterWeekForDate(iso: string): WeekInfo | null {
  const ms = Date.parse(`${iso}T00:00:00Z`);
  if (Number.isNaN(ms)) return null;

  for (const semester of DATED_SEMESTERS) {
    if (ms < semester.startMs || ms > semester.endMs) continue;
    return {
      semesterId: semester.id,
      week: Math.floor((ms - semester.startMs) / WEEK_MS) + 1,
    };
  }
  return null;
}

export function weekNumberForDate(iso: string): number | null {
  const info = semesterWeekForDate(iso);
  return info?.semesterId === "fall" ? info.week : null;
}

export function categoryIdForDate(iso: string): string | null {
  const info = semesterWeekForDate(iso);
  return info ? categoryIdForWeek(info.semesterId, info.week) : null;
}

function localISODate(now: Date): string {
  return [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, "0"),
    String(now.getDate()).padStart(2, "0"),
  ].join("-");
}

// Uses the viewer's local calendar date so the indicator changes when their
// day rolls over, not when UTC does.
export function currentWeekNumber(now: Date = new Date()): number | null {
  return weekNumberForDate(localISODate(now));
}

export function currentWeekCategoryId(now: Date = new Date()): string | null {
  return categoryIdForDate(localISODate(now));
}

// Returns the date range for a week section, or null for spring/summer.
export function weekRangeLabel(categoryId: string): string | null {
  const info = weekInfoFromCategoryId(categoryId);
  return info
    ? weekRangeForSemester(info.semesterId, info.week).label
    : null;
}

export function semesterRangeLabel(semesterId: DatedSemesterId): string {
  const semester = semesterById(semesterId);
  return formatSpan(
    weekRangeForSemester(semesterId, 1).startISO,
    weekRangeForSemester(semesterId, semester.weekCount).endISO,
  );
}

export function timelineRangeLabel(): string {
  return semesterRangeLabel("fall");
}

// GM events always happen on the Wednesday of the week they are listed under.
export function weekWednesdayISO(categoryId: string): string | null {
  const info = weekInfoFromCategoryId(categoryId);
  if (!info) return null;

  const semester = semesterById(info.semesterId);
  const startMs = semester.startMs + (info.week - 1) * WEEK_MS;
  const startDay = new Date(startMs).getUTCDay();
  const daysUntilWednesday = (3 - startDay + 7) % 7;
  return toISODate(startMs + daysUntilWednesday * DAY_MS);
}

export function gmDateLabel(categoryId: string): string | null {
  const iso = weekWednesdayISO(categoryId);
  if (!iso) return null;
  return weekdayDate.format(new Date(`${iso}T00:00:00Z`));
}

const MONTH_KEY_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;

export function isMonthKey(value: unknown): value is string {
  return typeof value === "string" && MONTH_KEY_PATTERN.test(value);
}

export function monthKeyForISO(iso: string): string {
  return iso.slice(0, 7);
}

const monthYear = new Intl.DateTimeFormat("en-US", {
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

export function monthLabel(monthKey: string): string {
  if (!isMonthKey(monthKey)) return monthKey;
  return monthYear.format(new Date(`${monthKey}-01T00:00:00Z`));
}
