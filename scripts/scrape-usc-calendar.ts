// Fetches the USC academic calendar and writes the instructional spans and
// holiday/recess rows to a generated JSON file that the app imports. Run with
// `npm run scrape:usc`.
//
// Use `npm run scrape:usc -- --input path/to/page.html` to parse a saved copy
// of the page instead of making a network request.

import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseUscAcademicCalendarPage } from "../lib/usc-calendar";

const SOURCE_URL = "https://usc.edu/academic-calendar/";
const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const outputPath = path.join(
  scriptDirectory,
  "..",
  "lib",
  "usc-calendar.generated.json",
);

function inputPath(): string | null {
  const index = process.argv.indexOf("--input");
  if (index === -1) return null;
  const value = process.argv[index + 1];
  if (!value) throw new Error("--input needs a path to a saved HTML file.");
  return path.resolve(value);
}

async function loadHtml(): Promise<{ html: string; from: string }> {
  const file = inputPath();
  if (file) {
    return { html: await readFile(file, "utf8"), from: file };
  }

  const response = await fetch(SOURCE_URL);
  if (!response.ok) {
    throw new Error(
      `Could not fetch ${SOURCE_URL}: ${response.status} ${response.statusText}`,
    );
  }
  return { html: await response.text(), from: SOURCE_URL };
}

async function main(): Promise<void> {
  const { html, from } = await loadHtml();
  const { entries, semesters } = parseUscAcademicCalendarPage(html);

  if (entries.length === 0) {
    throw new Error(
      `No holiday or recess rows found in ${from}. The page layout may have changed.`,
    );
  }
  if (semesters.length === 0) {
    throw new Error(
      `No Classes Begin/Classes End spans found in ${from}. The page layout may have changed.`,
    );
  }

  const payload = {
    source: SOURCE_URL,
    fetchedAt: new Date().toISOString(),
    semesters,
    entries,
  };
  await writeFile(outputPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");

  console.log(
    `Read ${entries.length} holiday/recess rows and ${semesters.length} semester spans from ${from}.`,
  );
  console.log(`Wrote ${path.relative(process.cwd(), outputPath)}.`);
  console.log("Instructional spans:");
  for (const semester of semesters) {
    console.log(
      `  ${semester.term} ${semester.year}: ${semester.classesBeginISO} to ${semester.classesEndISO}`,
    );
  }
  console.log("Holiday/recess rows:");
  for (const holiday of entries) {
    console.log(
      `  ${holiday.startISO}  ${holiday.label}  [${holiday.term} ${holiday.semesterYear}]`,
    );
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
