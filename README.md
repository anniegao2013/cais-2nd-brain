# Second Brain

A web app for keeping track of tasks and events.

Tasks live under sequential sections: before the end of spring semester,
summer, and weeks 1–15. A set of default tasks is pre-filled and can be moved
to another section or deleted. Tasks can have subtasks with editable lead times,
plus descriptions that expand on click and render as nested bullet points. Some
tasks have ordering rules that are enforced automatically when moving them.
Everything is stored in the browser.

Default tasks are defined in the `DEFAULT_EVENTS` list in
`app/task-list.tsx`; keep each entry's `id` stable since it is used to remember
moves and deletions.

## Getting started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

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
