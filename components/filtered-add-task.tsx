"use client";

import { useState } from "react";
import type { TaskBoardController } from "@/hooks/use-task-board";
import {
  CATEGORIES,
  GM_IDEAS_CATEGORY,
  TODO_CATEGORY,
  categoriesForTab,
  type Category,
  type TimelineTabId,
} from "@/lib/categories";

function targetCategories(activeTabId: TimelineTabId): Category[] {
  if (activeTabId === "gm-ideas") return [GM_IDEAS_CATEGORY];
  if (activeTabId === "todos") return [TODO_CATEGORY, ...CATEGORIES];
  // The agenda is a derived view, not a list the tag filter narrows, so an
  // add bar there would promise something it cannot keep.
  if (activeTabId === "eboard-agenda") return [];
  return categoriesForTab(activeTabId);
}

// The board hides sections with no matching rows while a tag filter is active.
// This bar keeps adding possible from anywhere, and the new task inherits the
// active tags so it appears immediately.
export function FilteredAddTask({
  board,
  activeTabId,
  currentWeekCategoryId,
}: {
  board: TaskBoardController;
  activeTabId: TimelineTabId;
  currentWeekCategoryId: string | null;
}) {
  const options = targetCategories(activeTabId);
  const preferred =
    activeTabId === "gm-ideas"
      ? GM_IDEAS_CATEGORY.id
      : activeTabId === "todos" || activeTabId === "eboard-agenda"
        ? TODO_CATEGORY.id
        : currentWeekCategoryId;
  const fallback =
    preferred && options.some((option) => option.id === preferred)
      ? preferred
      : (options[0]?.id ?? "");

  const [selected, setSelected] = useState(fallback);
  const categoryId = options.some((option) => option.id === selected)
    ? selected
    : fallback;

  if (board.activeTags.length === 0 || options.length === 0) return null;

  const tagLabels = board.tags
    .filter((tag) => board.activeTags.includes(tag.id))
    .map((tag) => tag.label);
  const error =
    board.addError?.categoryId === categoryId ? board.addError.message : null;

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        board.addTask(categoryId, event.currentTarget);
      }}
      className="mt-3 rounded-lg border border-dashed border-zinc-300 bg-white p-3 dark:border-zinc-700 dark:bg-zinc-900"
    >
      <p className="text-[11px] font-medium text-zinc-600 dark:text-zinc-300">
        Add while filtered
      </p>
      <p className="mt-0.5 text-[11px] text-zinc-500 dark:text-zinc-400">
        New tasks get{" "}
        {tagLabels.length > 0 ? tagLabels.join(", ") : "the selected tags"} so
        they show up here.
      </p>
      <div className="mt-2 flex flex-col gap-2 sm:flex-row">
        <input
          name="text"
          placeholder="Add a task…"
          aria-label="Add a task with the selected tags"
          autoComplete="off"
          className="h-8 flex-1 rounded-md border border-zinc-200 bg-white px-2.5 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-400 focus:outline-none dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100 dark:placeholder:text-zinc-500 dark:focus:border-zinc-600"
        />
        <select
          value={categoryId}
          onChange={(event) => setSelected(event.target.value)}
          aria-label="Section for the new task"
          className="h-8 min-w-0 rounded-md border border-zinc-200 bg-transparent px-2 text-xs text-zinc-600 focus:border-zinc-400 focus:outline-none dark:border-zinc-800 dark:text-zinc-300 dark:focus:border-zinc-600"
        >
          {options.map((option) => (
            <option key={option.id} value={option.id}>
              {option.label}
            </option>
          ))}
        </select>
        <button
          type="submit"
          className="h-8 shrink-0 rounded-md bg-zinc-900 px-3 text-xs font-medium text-white transition-colors hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
        >
          Add
        </button>
      </div>
      {error && (
        <p role="alert" className="mt-1 text-xs text-red-600 dark:text-red-400">
          {error}
        </p>
      )}
    </form>
  );
}
