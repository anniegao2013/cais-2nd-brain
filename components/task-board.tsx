"use client";

import { useTaskBoard } from "@/hooks/use-task-board";
import { CATEGORIES } from "@/lib/categories";
import { TagFilter } from "./tag-filter";
import { TaskSection } from "./task-section";

export default function TaskBoard() {
  const board = useTaskBoard();

  return (
    <div className="mx-auto w-full max-w-2xl px-6 py-12">
      <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
        Categories
      </h1>
      <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
        Add tasks under the part of the year they belong to. Default events are
        already listed and can be moved to another section. Tasks can also span
        several weeks: pick an end section when adding one, or change it while
        editing, and the task will be listed under every week it covers. Use +
        to add a subtask in the same or an earlier section; open a subtask to
        edit its lead time. Click ▸ or the task title to read the description,
        and use Edit to change the title, description, tags, span, and ordering
        rules. Ordering can also be set when adding an event. Use the filter bar
        to show only tasks with selected tags.
      </p>

      <TagFilter board={board} />

      <div className="mt-10 flex flex-col gap-10">
        {CATEGORIES.map((category) => (
          <TaskSection key={category.id} board={board} category={category} />
        ))}
        {board.activeTags.length > 0 && board.filteredTaskCount === 0 && (
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            No tasks match these tags.
          </p>
        )}
      </div>
    </div>
  );
}
