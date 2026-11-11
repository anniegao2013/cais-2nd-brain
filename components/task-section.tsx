import type { TaskBoardController } from "@/hooks/use-task-board";
import { weekRangeLabel } from "@/lib/calendar";
import { tabForCategoryId } from "@/lib/categories";
import { overdueWeekOccurrences, taskOccurrences } from "@/lib/tasks";
import { AddTaskForm } from "./add-task-form";
import { TaskRow } from "./task-row";

export function TaskSection({
  board,
  category,
  isCurrentWeek = false,
  currentWeekCategoryId = null,
}: {
  board: TaskBoardController;
  category: { id: string; label: string };
  isCurrentWeek?: boolean;
  currentWeekCategoryId?: string | null;
}) {
  const currentWeekInThisTab =
    currentWeekCategoryId !== null &&
    tabForCategoryId(currentWeekCategoryId) === tabForCategoryId(category.id);
  const overdue = currentWeekInThisTab
    ? overdueWeekOccurrences(board.state, currentWeekCategoryId)
    : [];
  const overdueIds = new Set(overdue.map(({ task }) => task.id));
  const occurrences = taskOccurrences(board.state, category.id).filter(
    ({ task }) => board.matchesFilter(task) && !overdueIds.has(task.id),
  );
  const overdueOccurrences = isCurrentWeek
    ? overdue.filter(({ task }) => board.matchesFilter(task))
    : [];
  if (
    board.activeTags.length > 0 &&
    occurrences.length === 0 &&
    overdueOccurrences.length === 0
  ) {
    return null;
  }

  const remaining =
    occurrences.filter(({ task }) => !task.done && !task.isHoliday).length +
    overdueOccurrences.filter(({ task }) => !task.done && !task.isHoliday)
      .length;
  const dateRange = weekRangeLabel(category.id);

  return (
    <section
      id={`${category.id}-section`}
      aria-labelledby={`${category.id}-heading`}
      aria-current={isCurrentWeek ? "date" : undefined}
      className="scroll-mt-6"
    >
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
          {isCurrentWeek && (
            <span
              title="This week contains today"
              className="inline-flex items-center gap-1 rounded-full bg-zinc-900 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white dark:bg-zinc-100 dark:text-zinc-900"
            >
              <svg
                viewBox="0 0 16 16"
                className="size-3"
                fill="currentColor"
                aria-hidden="true"
              >
                <path d="M3 2.5A1.5 1.5 0 0 1 4.5 1h7A1.5 1.5 0 0 1 13 2.5v12a.5.5 0 0 1-.8.4L8 11.6l-4.2 3.3A.5.5 0 0 1 3 14.5v-12Z" />
              </svg>
              This week
            </span>
          )}
        </div>
        <span className="shrink-0 text-xs tabular-nums text-zinc-400 dark:text-zinc-500">
          {remaining} open
        </span>
      </div>

      {overdueOccurrences.length > 0 && (
        <div className="mt-3">
          <div className="flex items-baseline justify-between gap-3">
            <h3 className="text-[11px] font-semibold uppercase tracking-wide text-red-700 dark:text-red-300">
              Overdue from earlier weeks
            </h3>
            <span className="text-xs tabular-nums text-red-600 dark:text-red-300">
              {overdueOccurrences.length} task
              {overdueOccurrences.length === 1 ? "" : "s"}
            </span>
          </div>
          <ul className="mt-2 flex flex-col divide-y divide-red-200 border-y border-red-200 dark:divide-red-400/30 dark:border-red-400/30">
            {overdueOccurrences.map(({ task, startCategoryId, isStart }) => (
              <TaskRow
                key={`${task.id}:overdue`}
                board={board}
                task={task}
                startCategoryId={startCategoryId}
                categoryId={category.id}
                isStart={isStart}
                isOverdue
              />
            ))}
          </ul>
        </div>
      )}

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
