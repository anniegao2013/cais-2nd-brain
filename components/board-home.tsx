"use client";

import type { BoardSectionId } from "@/lib/categories";

const QUICK_LINKS: {
  id: Exclude<BoardSectionId, "home">;
  label: string;
  description: string;
}[] = [
  {
    id: "schedule",
    label: "Schedule",
    description:
      "Before the year, Fall, and Spring, with the default CAIS++ events already in place.",
  },
  {
    id: "gm-ideas",
    label: "GM ideas",
    description:
      "A backlog of ideas for future GMs. Assign one to a GM week when it's ready.",
  },
  {
    id: "todos",
    label: "To-do",
    description:
      "A running checklist with optional due dates, grouped by how soon things are due.",
  },
  {
    id: "eboard-agenda",
    label: "E-board meeting agenda",
    description:
      "A draft of the next e-board meeting from the events and open to-dos it covers.",
  },
];

const BASICS = [
  "Add tasks at the end of any section. A task can span several weeks and will show up in each one.",
  "Click ▸ or a task title to read its description. Edit changes the title, description, tags, span, and ordering rules.",
  "Use + to add a subtask, where you can also set a lead time. GM events use Add task instead.",
  "Tag tasks to filter the board. Rows marked Suggestion are just social-event ideas: keep, rename, move, or delete them.",
  "The meeting card sets the weekly e-board day and time. The current GM week also gets two prep tasks, and meeting weeks add the agenda to-do.",
  "Undo, Recently deleted, and Reset board are on the board toolbar. Undo lasts for the session; Reset starts a new year.",
];

export function BoardHome({
  onSelectSection,
}: {
  onSelectSection: (section: BoardSectionId) => void;
}) {
  return (
    <div
      id="board-home"
      className="mx-auto w-full max-w-2xl scroll-mt-24 px-6 py-10"
    >
      <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
        Plan the CAIS++ year
      </h1>
      <p className="mt-2 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
        The weekly schedule, GM ideas, to-dos, and the next e-board agenda live
        on one shared board. Changes save automatically.
      </p>

      <h2 className="mt-8 text-sm font-semibold text-zinc-900 dark:text-zinc-100">
        Jump in
      </h2>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        {QUICK_LINKS.map((link) => (
          <button
            key={link.id}
            type="button"
            onClick={() => onSelectSection(link.id)}
            className="rounded-lg border border-zinc-200 bg-white px-4 py-3 text-left transition-colors hover:border-zinc-400 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-zinc-600"
          >
            <span className="block text-sm font-medium text-zinc-900 dark:text-zinc-100">
              {link.label}
            </span>
            <span className="mt-1 block text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">
              {link.description}
            </span>
          </button>
        ))}
      </div>

      <h2 className="mt-10 text-sm font-semibold text-zinc-900 dark:text-zinc-100">
        How it works
      </h2>
      <ul className="mt-3 space-y-2.5">
        {BASICS.map((item) => (
          <li
            key={item}
            className="flex gap-2.5 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400"
          >
            <span
              aria-hidden="true"
              className="mt-1.5 size-1.5 shrink-0 rounded-full bg-zinc-400 dark:bg-zinc-600"
            />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
