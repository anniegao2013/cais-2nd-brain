# Second Brain

A web app for keeping track of tasks and events.

Tasks are grouped into tabs: before the year (the end of the prior spring
semester and summer), the fall semester, and the spring semester. Each
semester's numbered weeks are grounded in the USC academic calendar: Fall Week 1
and Spring Week 1 start on their Classes Begin dates, the last week ends on
Classes End, and each week header shows its date range. The final week is shortened when Classes End falls before
the end of that calendar week. The board opens on the tab containing the current
week, and earlier weeks in that tab stay behind a control until they are shown.
A set of default tasks is pre-filled and can be moved to another section or
deleted.
Tasks can span multiple sections and are listed
under every week they cover, with the range shown under the title. They can
also have subtasks with editable lead times, plus descriptions that expand on
click and render as nested bullet points. Expanding shows the description on
its own; a separate Edit control changes the title, description, tags, span,
and ordering rules. A filter bar narrows the timeline to tasks with selected
tags. New tasks can optionally be placed between two existing tasks and can be
given an end section. Everything is stored in the browser.

Default tasks and their starter ordering rules live in `lib/defaults.ts`; keep
each entry's `id` stable since it is used to remember moves, deletions, and
dependencies.

Tagging an event with the Social events tag automatically adds three subtasks at
their lead times: "Poll for interest" four weeks before, "Start planning" three
weeks before, and "Announce" two weeks before. The follow-ups stay within the
event's semester, and a deleted follow-up is not recreated. Retreats, the big
little reveal, and E-ball are planned directly, so they are excluded from these
automatic follow-ups.

A GM event is seeded in every instructional week whose Wednesday is not a
holiday. Fall Recess also cancels that week's GM even though the recess only
covers Thursday and Friday. If a week already has a saved GM task, that task is
kept and the generated GM is skipped so the two do not duplicate each other.

Holidays and recesses from the USC academic calendar are mapped into the dated
weeks as reference dates: they use their own styling and cannot be checked off.
The scraper also records each semester's Classes Begin and Classes End dates,
which ground the week numbering. Run it whenever the published calendar changes;
it writes `lib/usc-calendar.generated.json`, which the app imports.

## Project structure

| Path | Responsibility |
| --- | --- |
| `app/` | Next.js routes and layout |
| `components/` | Presentational UI, from the board down to a single task row |
| `hooks/use-task-board.ts` | Client-side UI state and task actions |
| `lib/` | Domain logic: categories, calendar dates, tags, defaults, ordering, placement, notes, storage, scraping, and task operations |
| `scripts/` | Runnable maintenance scripts, including the USC calendar scraper |
| `tests/` | Vitest suites for the pure logic in `lib/` |

Within `lib/`, `types.ts` defines the shared models; `defaults.ts` seeds the
board; `categories.ts`, `calendar.ts`, and `tags.ts` hold the constants and week
dates; `usc-calendar.ts` parses the published academic calendar and
`usc-holidays.ts` maps its holiday and recess rows onto the timeline;
`dependencies.ts` and
`dependency-actions.ts` handle ordering; `placement.ts` and `span-actions.ts`
handle moves and spans; `tasks.ts` derives occurrences; `notes.ts` parses
descriptions; `task-actions.ts` mutates tasks; and `storage.ts` persists
everything in localStorage.

## Getting started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Testing

Logic tests use [Vitest](https://vitest.dev/) and live in `tests/`. They cover
ordering, spans, subtask placement, validation, storage migration, notes, tags,
the seeded defaults, and academic-calendar parsing.

```bash
npm test          # run once
npm run test:watch
```

## Stack

- Next.js 16 (App Router)
- React 19
- TypeScript
- Tailwind CSS 4

## Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Start the dev server |
| `npm run build` | Build for production |
| `npm start` | Run the production build |
| `npm run lint` | Lint the codebase |
| `npm run scrape:usc` | Refresh holiday and recess data from the USC academic calendar |
| `npm test` | Run the unit tests once |
| `npm run test:watch` | Run the unit tests in watch mode |
