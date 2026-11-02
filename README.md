# Second Brain

A web app for keeping track of tasks and events.

Tasks live under sequential sections: before the end of spring semester,
summer, and weeks 1–15. A set of default tasks is pre-filled and can be moved
to another section or deleted. Tasks can span multiple sections and are listed
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

## Project structure

| Path | Responsibility |
| --- | --- |
| `app/` | Next.js routes and layout |
| `components/` | Presentational UI, from the board down to a single task row |
| `hooks/use-task-board.ts` | Client-side UI state and task actions |
| `lib/` | Domain logic: categories, tags, defaults, ordering, placement, notes, storage, and task operations |
| `tests/` | Vitest suites for the pure logic in `lib/` |

Within `lib/`, `types.ts` defines the shared models; `defaults.ts` seeds the
board; `categories.ts` and `tags.ts` hold the constants; `dependencies.ts` and
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
and the seeded defaults.

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
| `npm test` | Run the unit tests once |
| `npm run test:watch` | Run the unit tests in watch mode |
