import {
  TIMELINE_END_ISO,
  TIMELINE_START_ISO,
  categoryIdForDate,
} from "./calendar";
import generated from "./usc-calendar.generated.json";
import type {
  UscCalendarEntry,
  UscSemesterBoundary,
} from "./usc-calendar";

type GeneratedCalendar = {
  source: string;
  fetchedAt: string;
  semesters: UscSemesterBoundary[];
  entries: UscCalendarEntry[];
};

const calendar = generated as unknown as GeneratedCalendar;

export const USC_CALENDAR_SOURCE = calendar.source;
export const USC_CALENDAR_FETCHED_AT = calendar.fetchedAt;
export const USC_CALENDAR_SEMESTERS = calendar.semesters;
export const USC_CALENDAR_ENTRIES = calendar.entries;

export type TimelineHoliday = {
  id: string;
  label: string;
  categoryId: string;
  startISO: string;
  endISO: string;
};

const DAY_MS = 24 * 60 * 60 * 1000;

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/['\u2019]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function holidayId(entry: UscCalendarEntry): string {
  return `usc-holiday-${entry.startISO}-${slugify(entry.label)}`;
}

// A multi-day break can touch two week blocks. Mark it in the week that holds
// most of its days, so a Sunday-to-Sunday recess lands in its main week instead
// of spanning both.
function majorityWeekCategoryId(
  startISO: string,
  endISO: string,
): string | null {
  const counts = new Map<string, number>();
  const start = Date.parse(`${startISO}T00:00:00Z`);
  const end = Date.parse(`${endISO}T00:00:00Z`);

  for (let ms = start; ms <= end; ms += DAY_MS) {
    const categoryId = categoryIdForDate(
      new Date(ms).toISOString().slice(0, 10),
    );
    if (!categoryId) continue;
    counts.set(categoryId, (counts.get(categoryId) ?? 0) + 1);
  }

  let best: string | null = null;
  let bestCount = 0;
  for (const [categoryId, count] of counts) {
    if (count > bestCount) {
      best = categoryId;
      bestCount = count;
    }
  }
  return best;
}

// Holidays and recesses that overlap the dated instructional timeline. Dates
// outside Classes Begin through Classes End (for example, winter recess) are
// left out because the board has no dated section for them.
export function timelineHolidays(
  entries: UscCalendarEntry[] = USC_CALENDAR_ENTRIES,
): TimelineHoliday[] {
  const holidays: TimelineHoliday[] = [];
  const seen = new Set<string>();

  for (const entry of entries) {
    if (entry.endISO < TIMELINE_START_ISO || entry.startISO > TIMELINE_END_ISO) {
      continue;
    }

    const startISO =
      entry.startISO < TIMELINE_START_ISO
        ? TIMELINE_START_ISO
        : entry.startISO;
    const endISO =
      entry.endISO > TIMELINE_END_ISO ? TIMELINE_END_ISO : entry.endISO;
    const categoryId = majorityWeekCategoryId(startISO, endISO);
    if (!categoryId) continue;

    const id = holidayId(entry);
    if (seen.has(id)) continue;
    seen.add(id);

    holidays.push({
      id,
      label: entry.label,
      categoryId,
      startISO: entry.startISO,
      endISO: entry.endISO,
    });
  }

  return holidays.sort(
    (left, right) =>
      left.startISO.localeCompare(right.startISO) ||
      left.label.localeCompare(right.label),
  );
}

export const USC_TIMELINE_HOLIDAYS = timelineHolidays();
