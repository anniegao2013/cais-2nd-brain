// The timeline is anchored to a real calendar. Week 1 starts on this date and
// each following week is a seven-day block, so labels stay stable regardless
// of the viewer's timezone.
export const WEEK_ONE_START = "2026-08-25";
export const WEEK_COUNT = 15;

const DAY_MS = 24 * 60 * 60 * 1000;
const WEEK_MS = DAY_MS * 7;
const WEEK_ONE_START_MS = Date.parse(`${WEEK_ONE_START}T00:00:00Z`);

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
  const endMs = startMs + WEEK_MS - DAY_MS;
  return {
    week,
    startISO: toISODate(startMs),
    endISO: toISODate(endMs),
    label: formatRange(startMs, endMs),
  };
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
  const startMs = Date.parse(`${weekRange(week).startISO}T00:00:00Z`);
  return toISODate(startMs + DAY_MS);
}

export function gmDateLabel(categoryId: string): string | null {
  const iso = weekWednesdayISO(categoryId);
  if (!iso) return null;
  return weekdayDate.format(new Date(`${iso}T00:00:00Z`));
}
