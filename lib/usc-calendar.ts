// Parser for the USC academic calendar page. It reads the published HTML,
// extracts the instructional span (Classes Begin through Classes End), and
// returns only holiday/recess rows. Keeping this pure makes the scraper easy to
// test against a saved copy of the page.

export type UscSemesterTerm = "fall" | "spring" | "summer";

export type UscCalendarEntry = {
  label: string;
  term: UscSemesterTerm;
  semesterYear: number;
  days: string;
  startISO: string;
  endISO: string;
};

export type UscSemesterBoundary = {
  term: UscSemesterTerm;
  year: number;
  classesBeginISO: string;
  classesEndISO: string;
};

export type UscAcademicCalendarPage = {
  entries: UscCalendarEntry[];
  semesters: UscSemesterBoundary[];
};

const MONTHS: Record<string, number> = {
  january: 1,
  jan: 1,
  february: 2,
  feb: 2,
  march: 3,
  mar: 3,
  april: 4,
  apr: 4,
  may: 5,
  june: 6,
  jun: 6,
  july: 7,
  jul: 7,
  august: 8,
  aug: 8,
  september: 9,
  sep: 9,
  sept: 9,
  october: 10,
  oct: 10,
  november: 11,
  nov: 11,
  december: 12,
  dec: 12,
};

const MONTH_SOURCE = Object.keys(MONTHS)
  .sort((left, right) => right.length - left.length)
  .join("|");

const HOLIDAY_LABEL = /holiday|recess/i;
const CLASSES_BEGIN_LABEL = /^classes begin$/i;
const CLASSES_END_LABEL = /^classes end$/i;

const BLOCK_RE =
  /<h([1-6])\b[^>]*>([\s\S]*?)<\/h\1\s*>|<table\b[^>]*>([\s\S]*?)<\/table\s*>/gi;

function decodeEntities(value: string): string {
  return value.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (match, entity: string) => {
    const lower = entity.toLowerCase();
    if (lower.startsWith("#x")) {
      return String.fromCodePoint(Number.parseInt(lower.slice(2), 16));
    }
    if (lower.startsWith("#")) {
      return String.fromCodePoint(Number.parseInt(lower.slice(1), 10));
    }
    const named: Record<string, string> = {
      amp: "&",
      apos: "'",
      gt: ">",
      lt: "<",
      nbsp: " ",
      quot: '"',
    };
    return named[lower] ?? match;
  });
}

function textFromHtml(value: string): string {
  return decodeEntities(value.replace(/<[^>]*>/g, " "))
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function parseSemesterHeading(
  text: string,
): { term: UscSemesterTerm; year: number } | null {
  const match = text.match(
    /\b(Fall|Spring|Summer)\b(?:\s+(?:Semester|Session))?\s+(\d{4})/i,
  );
  if (!match) return null;

  return {
    term: match[1].toLowerCase() as UscSemesterTerm,
    year: Number(match[2]),
  };
}

function isoDate(year: number, month: number, day: number): string | null {
  const ms = Date.UTC(year, month - 1, day);
  const date = new Date(ms);
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }
  return date.toISOString().slice(0, 10);
}

type ParsedDates = { startISO: string; endISO: string };

function parseDateRange(
  value: string,
  semesterYear: number,
): ParsedDates | null {
  // Cells sometimes carry a second line of notes after a <br>. Callers pass the
  // first line only, but drop any remaining marked note just in case.
  const normalized = value
    .replace(/[\u2010-\u2015\u2212]/g, "-")
    .replace(/\u00a0/g, " ")
    .replace(/\*.*$/, "")
    .replace(/\s+/g, " ")
    .trim();

  const monthDayRange = new RegExp(
    `^(${MONTH_SOURCE})\\s+(\\d{1,2})(?:\\s*(?:-|to)\\s*(?:(${MONTH_SOURCE})\\s+)?(\\d{1,2}))?$`,
    "i",
  );
  const match = normalized.match(monthDayRange);
  if (!match) return null;

  const startMonth = MONTHS[match[1].toLowerCase()];
  const startDay = Number(match[2]);
  if (startMonth === undefined) return null;

  const endMonthName = match[3]?.toLowerCase();
  const endMonth = endMonthName ? MONTHS[endMonthName] : startMonth;
  const endDay = match[4] ? Number(match[4]) : startDay;
  if (endMonth === undefined) return null;

  // A range such as "December 17-January 10" crosses into the next year.
  let endYear = semesterYear;
  if (endMonth < startMonth) endYear += 1;

  const startISO = isoDate(semesterYear, startMonth, startDay);
  const endISO = isoDate(endYear, endMonth, endDay);
  if (!startISO || !endISO || endISO < startISO) return null;

  return { startISO, endISO };
}

type ParsedRow = {
  label: string;
  days: string;
  dates: ParsedDates;
};

function parseTableRows(
  tableHtml: string,
  semesterYear: number,
): ParsedRow[] {
  const rows: ParsedRow[] = [];
  const matches = tableHtml.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr\s*>/gi);

  for (const row of matches) {
    const cells = [
      ...row[1].matchAll(/<t[dh]\b[^>]*>([\s\S]*?)<\/t[dh]\s*>/gi),
    ].map((cell) => cell[1]);
    if (cells.length < 3) continue;

    // Only the first line of the date cell is the actual date range.
    const dateLine = cells[2].split(/<br\s*\/?>/i)[0];
    const dates = parseDateRange(textFromHtml(dateLine), semesterYear);
    if (!dates) continue;

    rows.push({
      label: textFromHtml(cells[0]),
      days: textFromHtml(cells[1]),
      dates,
    });
  }

  return rows;
}

type SemesterAccumulator = {
  term: UscSemesterTerm;
  year: number;
  classesBeginISO?: string;
  classesEndISO?: string;
};

function pushSemester(
  active: SemesterAccumulator | null,
  semesters: UscSemesterBoundary[],
  seen: Set<string>,
): void {
  if (!active?.classesBeginISO || !active.classesEndISO) return;

  const key = `${active.term}-${active.year}`;
  if (seen.has(key)) return;
  seen.add(key);
  semesters.push({
    term: active.term,
    year: active.year,
    classesBeginISO: active.classesBeginISO,
    classesEndISO: active.classesEndISO,
  });
}

export function parseUscAcademicCalendarPage(
  html: string,
): UscAcademicCalendarPage {
  const entries: UscCalendarEntry[] = [];
  const semesters: UscSemesterBoundary[] = [];
  const seenEntries = new Set<string>();
  const seenSemesters = new Set<string>();
  let active: SemesterAccumulator | null = null;

  for (const block of html.matchAll(BLOCK_RE)) {
    if (block[1]) {
      const heading = textFromHtml(block[2]);
      if (!heading) continue;

      pushSemester(active, semesters, seenSemesters);
      // A real heading that is not a semester marks the end of the calendar
      // section. Empty headings directly after a semester title are ignored.
      const parsed = parseSemesterHeading(heading);
      active = parsed ? { ...parsed } : null;
      continue;
    }

    if (!active || !block[3]) continue;

    for (const row of parseTableRows(block[3], active.year)) {
      if (CLASSES_BEGIN_LABEL.test(row.label)) {
        active.classesBeginISO = row.dates.startISO;
        continue;
      }
      if (CLASSES_END_LABEL.test(row.label)) {
        active.classesEndISO = row.dates.endISO;
        continue;
      }
      if (!HOLIDAY_LABEL.test(row.label)) continue;

      const key = `${row.label.toLowerCase()}|${row.dates.startISO}|${row.dates.endISO}`;
      if (seenEntries.has(key)) continue;
      seenEntries.add(key);
      entries.push({
        label: row.label,
        term: active.term,
        semesterYear: active.year,
        days: row.days,
        ...row.dates,
      });
    }
  }

  pushSemester(active, semesters, seenSemesters);

  return {
    entries: entries.sort(
      (left, right) =>
        left.startISO.localeCompare(right.startISO) ||
        left.label.localeCompare(right.label),
    ),
    semesters: semesters.sort(
      (left, right) =>
        left.classesBeginISO.localeCompare(right.classesBeginISO) ||
        left.term.localeCompare(right.term) ||
        left.year - right.year,
    ),
  };
}

export function parseUscAcademicCalendar(html: string): UscCalendarEntry[] {
  return parseUscAcademicCalendarPage(html).entries;
}
