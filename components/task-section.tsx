import type { TaskBoardController } from "@/hooks/use-task-board";
import { weekRangeLabel } from "@/lib/calendar";
import { taskOccurrences } from "@/lib/tasks";
import { AddTaskForm } from "./add-task-form";
import { TaskRow } from "./task-row";

export function TaskSection({
  board,
  category,
}: {
  board: TaskBoardController;
  category: { id: string; label: string };
}) {
  const occurrences = taskOccurrences(board.state, category.id).filter(
    ({ task }) => board.matchesFilter(task),
  );
  if (board.activeTags.length > 0 && occurrences.length === 0) return null;

  const remaining = occurrences.filter(
    ({ task }) => !task.done && !task.isHoliday,
  ).length;
  const dateRange = weekRangeLabel(category.id);

  return (
    <section aria-labelledby={`${category.id}-heading`}>
      <div className="flex items-baseline justify-between gap-4">
        <div className="flex flex-wrap items-baseline gap-x-2">
          <h2
            id={`${category.id}-heading`}
            className="text-base font-medium text-zinc-900 dark:text-zinc-100"
          >
            {category.label}
          </h2>
          {dateRange && (
            <span className="text-xs tabular-nums text-zinc-500 dark:text-zinc-400">
              {dateRange}
            </span>
          )}
        </div>
        <span className="shrink-0 text-xs tabular-nums text-zinc-400 dark:text-zinc-500">
          {remaining} open
        </span>
      </div>

      {occurrences.length > 0 && (
        <ul className="mt-3 flex flex-col divide-y divide-zinc-200 border-y border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
          {occurrences.map(({ task, startCategoryId, isStart }) => (
            <TaskRow
              key={`${task.id}:${category.id}`}
              board={board}
              task={task}
              startCategoryId={startCategoryId}
              categoryId={category.id}
              isStart={isStart}
            />
          ))}
        </ul>
      )}

      <AddTaskForm board={board} category={category} />
    </section>
  );
}
