import type { TaskBoardController } from "@/hooks/use-task-board";
import { todayISODate } from "@/lib/calendar";
import {
  groupTodos,
  type TodoBucketId,
} from "@/lib/todo-groups";
import type { TaskOccurrence } from "@/lib/types";
import { TaskRow } from "./task-row";

const BUCKET_STYLES: Record<
  TodoBucketId,
  { heading: string; count: string; list: string }
> = {
  overdue: {
    heading: "text-red-700 dark:text-red-300",
    count: "text-red-600 dark:text-red-300",
    list: "divide-red-200 border-red-200 dark:divide-red-400/30 dark:border-red-400/30",
  },
  urgent: {
    heading: "text-amber-700 dark:text-amber-300",
    count: "text-amber-600 dark:text-amber-300",
    list: "divide-amber-200 border-amber-200 dark:divide-amber-400/30 dark:border-amber-400/30",
  },
  "next-week": {
    heading: "text-sky-700 dark:text-sky-300",
    count: "text-sky-600 dark:text-sky-300",
    list: "divide-sky-200 border-sky-200 dark:divide-sky-400/30 dark:border-sky-400/30",
  },
  "next-month": {
    heading: "text-zinc-700 dark:text-zinc-300",
    count: "text-zinc-500 dark:text-zinc-400",
    list: "divide-zinc-200 border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800",
  },
  later: {
    heading: "text-zinc-500 dark:text-zinc-400",
    count: "text-zinc-400 dark:text-zinc-500",
    list: "divide-zinc-200 border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800",
  },
  completed: {
    heading: "text-zinc-400 dark:text-zinc-500",
    count: "text-zinc-400 dark:text-zinc-500",
    list: "divide-zinc-200 border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800",
  },
};

export function TodoGroups({
  board,
  categoryId,
  occurrences,
}: {
  board: TaskBoardController;
  categoryId: string;
  occurrences: TaskOccurrence[];
}) {
  const groups = groupTodos(
    occurrences.map(({ task }) => task),
    todayISODate(),
  );

  if (groups.length === 0) return null;

  return (
    <div className="mt-4 flex flex-col gap-5">
      {groups.map((group) => {
        const styles = BUCKET_STYLES[group.id];
        return (
          <div key={group.id}>
            <div className="flex items-baseline justify-between gap-3">
              <h3
                className={`text-[11px] font-semibold uppercase tracking-wide ${styles.heading}`}
              >
                {group.label}
              </h3>
              <span className={`text-xs tabular-nums ${styles.count}`}>
                {group.tasks.length}
              </span>
            </div>
            <ul
              className={`mt-2 flex flex-col divide-y border-y ${styles.list}`}
            >
              {group.tasks.map((task) => (
                <TaskRow
                  key={`${task.id}:${categoryId}`}
                  board={board}
                  task={task}
                  startCategoryId={categoryId}
                  categoryId={categoryId}
                  isStart
                />
              ))}
            </ul>
          </div>
        );
      })}
    </div>
  );
}
