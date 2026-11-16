# Second Brain

A web app for keeping track of tasks and events.

Tasks are grouped into tabs: before the year (the end of the prior spring
semester and summer), the fall semester, the spring semester, a GM ideas
backlog, and a to-do list. Each semester's numbered weeks are grounded in the USC academic
calendar: Fall Week 1 and Spring Week 1 start on their Classes Begin dates, the
last week ends on Classes End, and each week header shows its date range. The
final week is shortened when Classes End falls before
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
given an end section. Events and tasks are saved to the server in
`data/board.json`; the browser keeps a localStorage cache so the board can open
before the server responds.

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
covers Thursday and Friday. Each GM event has an Add task control for attaching
agenda items or follow-up work. The GM ideas tab keeps a running backlog of
ideas; an idea can suggest a month, and GM weeks in that month are grouped
first in the assignment picker. Assigning an idea to a GM turns it into a task
for that meeting, and Return to ideas sends it back to the backlog.

The weekly e-board meeting control at the top of the board stores the meeting's
day of the week and time. GM rows and the GM assignment picker use that slot,
so changing it updates every week at once.

The to-do tab is a simple checklist with optional due dates. Open items are
grouped as overdue, urgent (due today or tomorrow), within the next week,
within the next month, and later or undated; completed items move to their own
group. To-dos use the same checkboxes, notes, tags, and editing controls, but
they are not tied to a week and do not use spans, ordering rules, or subtasks.

When the week containing today has a GM, that GM gets two recurring prep tasks:
"Update social points" and "Make GM slides". They are created only for the
current GM week rather than seeded across the whole year, so future weeks stay
clear until they become current. Deleting one does not recreate it, and
unfinished recurring tasks do not carry forward into later weeks.

Weeks that have an e-board meeting also get a "Make e-board meeting agenda"
to-do, due on the meeting day. Holidays are checked against that exact date, so
Veterans Day only skips the agenda when the meeting falls on November 11, and a
Thursday-Friday recess does not cancel a Wednesday meeting. Only the current
week's agenda is kept, so the checklist does not collect one unfinished agenda
per week.

The E-board agenda tab drafts the next meeting. It pulls open events from every
week the meeting covers, plus open to-dos due by the end of that coverage. A
meeting after Wednesday's GM starts with the following week, so it plans the
next GM rather than repeating the one that just happened; an earlier meeting
starts with its own week. A week whose meeting day is a USC holiday has no
meeting, so its items roll into the meeting before it; for example, Thanksgiving
week items appear on the previous week's agenda.

Holidays and recesses from the USC academic calendar are mapped into the dated
weeks as reference dates: they use their own styling and cannot be checked off.
The scraper also records each semester's Classes Begin and Classes End dates,
which ground the week numbering. Run it whenever the published calendar changes;
it writes `lib/usc-calendar.generated.json`, which the app imports.

## Project structure

| Path | Responsibility |
| --- | --- |
| `app/` | Next.js routes, layout, and the board persistence API |
| `components/` | Presentational UI, from the board down to a single task row |
| `hooks/use-task-board.ts` | Client-side UI state and task actions |
| `lib/` | Domain logic: categories, calendar dates, tags, defaults, ordering, placement, notes, storage, scraping, and task operations |
| `lib/server/` | Server-only board persistence |
| `scripts/` | Runnable maintenance scripts, including the USC calendar scraper |
| `tests/` | Vitest suites for the pure logic in `lib/` |

Within `lib/`, `types.ts` defines the shared models; `defaults.ts` seeds the
board; `categories.ts`, `calendar.ts`, and `tags.ts` hold the constants and week
dates; `usc-calendar.ts` parses the published academic calendar and
`usc-holidays.ts` maps its holiday and recess rows onto the timeline;
`dependencies.ts` and
`dependency-actions.ts` handle ordering; `placement.ts` and `span-actions.ts`
handle moves and spans; `tasks.ts` derives occurrences; `notes.ts` parses
descriptions; `task-actions.ts` mutates tasks; and `storage.ts` hydrates and
saves the board.

## Persistence

The server writes the board to `data/board.json` through `GET` and `PUT` on
`/api/board`. Existing browser data is uploaded automatically the first time the
server has no saved board, so switching from localStorage does not lose events
or tasks. After that the server copy wins, and localStorage is only a cache for
the initial paint and temporary offline use.

Set `BOARD_DATA_FILE` to use a different path. The default path is inside the
project, so use a persistent volume when running the app somewhere with an
ephemeral filesystem. This single-file store fits a small single-user board; a
hosted deployment with multiple users should replace `lib/server/board-store.ts`
with a database.

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
