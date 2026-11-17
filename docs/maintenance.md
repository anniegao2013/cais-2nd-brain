# Maintaining Second Brain

This guide is for changing the code, running it, and rolling the board to a new
academic year. For day-to-day use, see [Using the board](usage.md).

## Architecture at a glance

Second Brain is a single-page client app with one persistence endpoint:

- The page shell is rendered by Next.js; the board itself is a client component
  (`components/task-board.tsx`).
- Board actions run through `hooks/use-task-board.ts`, which validates input and
  commits new state through `lib/storage.ts`.
- `lib/storage.ts` keeps the board in memory, mirrors it to localStorage as a
  cache, writes history for undo, and syncs it to `/api/board`.
- `/api/board` reads and writes a single JSON file through
  `lib/server/board-store.ts`. The server file is the source of truth once the
  page finishes loading.

There is no database and no user model. The board is one shared document, which
fits a single team.

## Setup

Requires Node.js and npm.

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

To point the app at a different board file, set `BOARD_DATA_FILE` before
starting it:

```bash
BOARD_DATA_FILE=/path/to/board.json npm run dev
```

The default is `data/board.json`, which is gitignored. The API creates the file
and its directory on the first save.

## Commands

| Command | Description |
| --- | --- |
| `npm run dev` | Start the dev server |
| `npm run build` | Production build |
| `npm start` | Run the production build |
| `npm run lint` | ESLint |
| `npm test` | Run the Vitest suites once |
| `npm run test:watch` | Run Vitest in watch mode |
| `npm run scrape:usc` | Refresh `lib/usc-calendar.generated.json` from USC |
| `npm run scrape:usc -- --input saved.html` | Parse a saved copy of the calendar page instead of fetching it |

`npx tsc --noEmit` checks types without emitting files. Run it alongside lint,
tests, and a build before shipping a change.

## Project structure

| Path | Responsibility |
| --- | --- |
| `app/` | Next.js routes, layout, global styles, and the board API |
| `app/api/board/route.ts` | `GET` / `PUT` handler for the saved board |
| `components/` | UI: home, navigation, board, sections, rows, forms, toolbar |
| `hooks/use-task-board.ts` | Client controller: state, validation, actions, shortcuts, reset |
| `hooks/use-current-week.ts` | Client-only current week id, refreshed every 60 seconds |
| `lib/` | Pure domain logic: categories, calendar, tags, defaults, ordering, storage |
| `lib/server/` | Server-only persistence (the JSON board file) |
| `scripts/` | Maintenance scripts, currently the USC calendar scraper |
| `tests/` | Vitest suites for the pure logic and the file-backed board store |
| `docs/` | This guide and the user guide |

### Module map

| Module | Responsibility |
| --- | --- |
| `lib/types.ts` | Shared `Task`, `AppState`, dependency, deletion, and meeting types |
| `lib/categories.ts` | Category ids and labels, timeline tabs, board sections, tab-to-section mapping |
| `lib/calendar.ts` | Semester dates, week numbering, date-to-week lookup, range labels |
| `lib/usc-calendar.ts` | Parses the published USC academic calendar |
| `lib/usc-calendar.generated.json` | Generated instructional spans and holiday rows |
| `lib/usc-holidays.ts` | Maps calendar holidays and recesses onto timeline sections |
| `lib/tags.ts` | Tag ids, labels, and filter matching |
| `lib/defaults.ts` | Seeded events, starter dependencies, `DEFAULT_STATE` |
| `lib/dependencies.ts`, `dependency-actions.ts` | Ordering rules and pruning |
| `lib/placement.ts`, `span-actions.ts` | Subtask placement, moves, and spans |
| `lib/tasks.ts` | Task lookup, occurrences across spanned weeks, overdue derivation |
| `lib/task-actions.ts` | Pure task mutations (add, rename, move, toggle, notes, delete) |
| `lib/notes.ts` | Parses descriptions into nested bullets |
| `lib/social-polls.ts` | Social-event follow-up subtasks |
| `lib/gm-events.ts` | GM event ids, GM weeks, assignment options |
| `lib/meeting.ts`, `meeting-actions.ts` | Meeting schedule defaults and updates |
| `lib/recurring-gm-tasks.ts` | Current-week GM prep tasks |
| `lib/recurring-eboard-tasks.ts` | Current-week e-board agenda to-do |
| `lib/eboard-agenda.ts` | Draft agenda coverage and items |
| `lib/todo-groups.ts` | Due-date buckets for the To-do section |
| `lib/deleted-tasks.ts` | Recently deleted batches and restore |
| `lib/history.ts` | Bounded undo/redo stacks |
| `lib/storage.ts` | Hydration, normalization, caching, history commits, server saves |
| `lib/server/board-store.ts` | Atomic file reads and writes |
| `lib/board-api.ts` | Browser `fetch` wrappers for `/api/board` |

### UI map

| Component | Responsibility |
| --- | --- |
| `app/page.tsx` | Page header and main shell |
| `components/task-board.tsx` | Section/term state, sticky nav, scroll behavior, board layout |
| `components/board-home.tsx` | Landing page and section shortcuts |
| `components/board-nav.tsx` | Top navigation and Schedule term tabs |
| `components/task-section.tsx` | One week or list section |
| `components/task-row.tsx` | Task controls, GM idea actions, suggestions |
| `components/task-edit-panel.tsx` | Title, tags, span, lead time, ordering |
| `components/task-description.tsx` | Inline description viewer/editor |
| `components/add-task-form.tsx`, `subtask-form.tsx` | Creation forms |
| `components/tag-filter.tsx` | Tag filter bar |
| `components/meeting-schedule-picker.tsx` | Weekly meeting day/time |
| `components/eboard-agenda.tsx` | Draft agenda view |
| `components/history-controls.tsx`, `deleted-tasks.tsx`, `reset-board.tsx` | Toolbar recovery tools |

## Data model

`AppState` (in `lib/types.ts`) is the whole saved board:

```ts
type AppState = {
  tasks: Record<string, Task[]>; // category id -> tasks, in display order
  removedDefaults: string[];     // seeded ids the user deleted on purpose
  dependencies: Dependency[];    // { before, after } ordering edges
  meetingSchedule?: MeetingSchedule; // weekday 0-6 and "HH:MM"
  deletedTasks?: DeletedBatch[];     // newest first, max 25
};
```

Task fields include `text`, `done`, `tags`, `parentId` and `leadWeeks`
(subtasks), `endCategoryId` (spans), `notes`, `suggested`, `gmIdea`, `recurring`,
`gmSuggestedMonth`, `dueDate`, `interested`, and `isHoliday`.

Category ids are stable strings: `spring` and `summer` (before the year),
`week-1`…`week-N` (fall), `spring-week-1`…`spring-week-N`, plus `gm-ideas` and
`todos`. Week ids do not contain a year, so the same ids are reused each year.

`normalizeStorage()` in `lib/storage.ts` is the migration boundary. It accepts the
old bare `category -> tasks` map, converts the legacy `recruitment` boolean to
tags, seeds dependencies when they are missing, relocates holiday rows to the
week containing their real date, and re-adds seeded defaults unless they are in
`removedDefaults`. New persisted fields must be added to the types and normalized
here.

## Seeded defaults

`lib/defaults.ts` builds `DEFAULT_STATE` from `BASE_DEFAULT_EVENTS` plus
`DEFAULT_DEPENDENCIES`:

- A **GM event** is seeded in every instructional week whose Wednesday is not a
  holiday. Fall Recess also cancels that week's GM, even though the recess only
  covers Thursday and Friday.
- Suggested **social events** (including Valentine's Day and Easter) are placed
  in the week containing their real dates.
- Starter **ordering rules** connect related work such as recruitment steps.

Reset uses `defaultBoardState()` in `lib/storage.ts`, which returns a deep copy of
the seed so a reset can never mutate the shared `DEFAULT_STATE` or reuse an old
reference in the undo history.

## Persistence

`GET /api/board` returns `{ state, updatedAt }` or a 404 with
`{ state: null }` when no board exists. `PUT /api/board` accepts the full
`AppState` as JSON, rejects empty or over-2 MB bodies, normalizes it, writes it,
and returns the saved board. Both responses use `Cache-Control: no-store`.

`lib/server/board-store.ts`:

- Resolves the file from `BOARD_DATA_FILE`, defaulting to `data/board.json`.
- Writes to a temporary file and renames it, so a crash cannot leave a partial
  board.
- Serializes writes inside the process so rapid saves cannot interleave.
- Returns `updatedAt` from the file's modification time.

Client hydration (`lib/storage.ts`):

1. The board renders from localStorage or the seeded defaults while the request
   is in flight.
2. If the server has a board, it wins and local history is cleared.
3. If the server has no board, the browser uploads its local copy, or seeds a
   fresh board from `DEFAULT_STATE`.
4. Saves are queued and flushed in order; a failed save retries after 3 seconds.
5. A `storage` event from another tab refreshes the local cache and clears undo
   history.

localStorage is only a cache. The key is `second-brain.tasks.v1`.

### Backup and restore

The board is one JSON file, so a backup is a copy:

```bash
cp data/board.json backup-$(date +%Y-%m-%d).json
```

Restore the same way while the app is stopped, or point `BOARD_DATA_FILE` at the
backup to inspect it. Do not hand-edit the live file while the app is running
unless you are comfortable overwriting the next save; use the UI or the API
instead.

### Deployment notes

- Give the process a persistent volume and set `BOARD_DATA_FILE` to a path on it.
  A serverless or ephemeral filesystem will lose the board on redeploy.
- The write queue and atomic rename assume one app process writing the file.
  Multiple replicas sharing a volume could race; use a database or a single
  writer if you need that.
- The app has no authentication or per-user separation. Put it behind your own
  access control, and replace `lib/server/board-store.ts` with a database before
  opening it to multiple teams.

## Derived and recurring behavior

Some board content is generated or refreshed automatically:

- **Social follow-ups** (`lib/social-polls.ts`) are synced inside
  `normalizeStorage`, so they are repaired on every load. Deleting one is
  respected because its id is recorded as removed.
- **Current-week GM prep tasks** and the **e-board agenda to-do**
  (`lib/recurring-gm-tasks.ts`, `lib/recurring-eboard-tasks.ts`) are synced by
  `withCurrentWeekTasks()` in `hooks/use-task-board.ts` on load, every 60
  seconds, and after a reset. This uses `setState`, not `commitState`, so
  materializing routine work does not create an undo step.
- **The agenda** (`lib/eboard-agenda.ts`) is computed from the current state; it
  is not saved.
- **To-do groups** (`lib/todo-groups.ts`) are computed from due dates at render
  time.

Recent deletions (`lib/deleted-tasks.ts`) keep the 25 newest batches. Undo
history (`lib/history.ts`) keeps 50 snapshots in memory per session and is not
persisted.

## Starting a new academic year

Reset board clears content but does not move the calendar, so starting a new year
is a code change plus a reset:

1. Refresh the calendar data:

   ```bash
   npm run scrape:usc
   ```

   If USC's page has changed or is unavailable, save the page and parse it with
   `npm run scrape:usc -- --input saved.html`. The script writes
   `lib/usc-calendar.generated.json`.

2. Set the board's fall year in `lib/calendar.ts`:

   ```ts
   export const BOARD_TERM: UscSemesterTerm = "fall";
   export const BOARD_YEAR = 2027;
   ```

   Spring is derived as `BOARD_YEAR + 1`. Changing `BOARD_TERM` changes which
   semester the dated timeline starts with.

3. Update any dated defaults in `lib/defaults.ts` (for example the Valentine's
   Day and Easter suggestions use hardcoded ISO dates) and any semester-specific
   seeded events. If the new calendar has a different number of weeks, check
   defaults pinned to `week-15` or `spring-week-15` as well.

4. Run `npm test`, `npx tsc --noEmit`, `npm run lint`, and `npm run build`.

5. Back up the old board, then use **Reset board** in the app to clear the
   previous year's content and restore the defaults. The reset is undoable until
   reload if you need to pull the old board back.

The old board file is untouched by these steps until you reset; keeping a copy is
the safe way to revisit last year.

## Testing

Vitest suites live in `tests/` and cover ordering, spans, subtask placement,
validation, storage migration, deletions and restore, notes, tags, seeded
defaults, recurring tasks, the agenda, the calendar parser, and the file-backed
board store.

```bash
npm test
npm run test:watch
```

Pure logic belongs in `lib/` and should come with a focused test. Tests use
helpers in `tests/helpers.ts`. There is no DOM test setup; components are covered
indirectly through the logic they call.

## Conventions and gotchas

- Keep every seeded `id` in `lib/defaults.ts` stable. Moves, deletions,
  dependencies, and recurring task ids reference those strings.
- Add persisted fields to `AppState` or `Task` **and** to `normalizeStorage`, or
  they will disappear on the next load.
- Week ids and the `TIMELINE_TABS` order are asserted in tests; derive new
  navigation from those constants instead of re-listing them.
- Undo history does not survive reload. Recently deleted items do, because they
  are part of `AppState`.
- The server file is the source of truth once hydration finishes; a stale browser
  tab will be corrected on the next load or cross-tab update.
- `data/` is gitignored. Never commit a real board.
