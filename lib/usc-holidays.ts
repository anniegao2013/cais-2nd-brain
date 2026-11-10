import {
  TIMELINE_END_ISO,
  TIMELINE_START_ISO,
  categoryIdForDate,
} from "./calendar";
import generated from "./usc-calendar.generated.json";
import type { UscCalendarEntry } from "./usc-calendar";

type GeneratedCalendar = {
  source: string;
  fetchedAt: string;
  entries: UscCalendarEntry[];
};

const calendar = generated as unknown as GeneratedCalendar;

export const USC_CALENDAR_SOURCE = calendar.source;
export const USC_CALENDAR_FETCHED_AT = calendar.fetchedAt;
export const USC_CALENDAR_ENTRIES = calendar.entries;

export type TimelineHoliday = {
  id: string;
  label: string;
  categoryId: string;
  endCategoryId?: string;
  startISO: string;
  endISO: string;
};

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

// Holidays and recesses that overlap the dated week timeline. Dates outside
// Week 1 through Week 15 (for example, winter recess) are left out because the
// board has no dated section for them.
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
    const categoryId = categoryIdForDate(startISO);
    if (!categoryId) continue;

    const id = holidayId(entry);
    if (seen.has(id)) continue;
    seen.add(id);

    const endCategoryId = categoryIdForDate(endISO) ?? categoryId;
    holidays.push({
      id,
      label: entry.label,
      categoryId,
      ...(endCategoryId === categoryId ? {} : { endCategoryId }),
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
