# Second Brain

A shared board for planning the CAIS++ year. It combines a week-by-week
schedule built on the USC academic calendar, a backlog of GM ideas, a to-do
list, and a draft agenda for the next e-board meeting.

The app opens on a Home page that explains the board and links to each area.
Everything saves automatically to a single board file on the server; there is no
save button.

## Quick start

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Documentation

- **[Using the board](docs/usage.md)** — the Home page, Schedule, GM ideas,
  To-do, the e-board agenda, tags, recurring tasks, undo, and reset. Start here
  to run the board.
- **[Maintaining the app](docs/maintenance.md)** — project structure, data
  flow, persistence, the academic-calendar rollover, tests, and deployment.
  Start here to change the code or start a new year.

## Common commands

| Command | Description |
| --- | --- |
| `npm run dev` | Start the dev server |
| `npm run build` | Build for production |
| `npm start` | Run the production build |
| `npm run lint` | Lint the codebase |
| `npm test` | Run the unit tests once |
| `npm run test:watch` | Run the unit tests in watch mode |
| `npm run scrape:usc` | Refresh the USC academic calendar data |

## Data

The live board is stored in `data/board.json`, which is gitignored. Set
`BOARD_DATA_FILE` to use a different path. See
[persistence](docs/maintenance.md#persistence) for the full behavior.

## Stack

- Next.js 16 (App Router)
- React 19
- TypeScript
- Tailwind CSS 4
- Vitest
