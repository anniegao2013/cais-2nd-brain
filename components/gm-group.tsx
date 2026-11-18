import type { TaskBoardController } from "@/hooks/use-task-board";
import { taskLinkHash } from "@/lib/board-location";
import { gmDateLabel } from "@/lib/calendar";
import { isGmEvent } from "@/lib/gm-events";
import { meetingTimeLabel } from "@/lib/meeting";
import type { OccurrenceGroup } from "@/lib/tasks";
import { TaskRow } from "./task-row";

// One GM and everything scheduled for it, kept in a single labelled block so
// agenda items, prep tasks, and assigned ideas read as part of the GM instead
// of as unrelated rows in the week.
export function GmGroup({
  board,
  group,
  categoryId,
}: {
  board: TaskBoardController;
  group: OccurrenceGroup;
  categoryId: string;
}) {
  if (!group.gmId) return null;

  const groupDate = group.gmCategoryId
    ? gmDateLabel(group.gmCategoryId, board.meetingSchedule.weekday)
    : null;
  const groupTime = groupDate
    ? meetingTimeLabel(board.meetingSchedule.time)
    : null;
  const childOccurrences = group.occurrences.filter(
    ({ task }) => !isGmEvent(task),
  );
  const openChildren = childOccurrences.filter(
    ({ task }) => !task.done && !task.isHoliday,
  ).length;

  return (
    <li className="my-1.5 rounded-lg border border-indigo-200/80 bg-indigo-50/30 px-1.5 pb-1 dark:border-indigo-400/30 dark:bg-indigo-400/5">
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 px-1.5 pb-1 pt-1.5">
        <span className="rounded-full border border-indigo-300 bg-indigo-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-indigo-700 dark:border-indigo-400/60 dark:bg-indigo-400/15 dark:text-indigo-300">
          GM
        </span>
        <span className="text-[11px] text-zinc-500 dark:text-zinc-400">
          {group.gmOccurrence ? "tasks & ideas" : "prep for this GM"}
        </span>
        <a
          href={taskLinkHash(group.gmCategoryId ?? categoryId, group.gmId)}
          aria-label="Open this GM on the board"
          className="text-[11px] font-medium text-indigo-700 underline-offset-2 transition-colors hover:underline print:hidden dark:text-indigo-300"
        >
          Open GM
        </a>
        <span className="ml-auto text-[11px] tabular-nums text-indigo-700/70 dark:text-indigo-300/70">
          {group.gmOccurrence
            ? childOccurrences.length === 0
              ? "No tasks yet"
              : `${openChildren} open`
            : [groupDate, groupTime].filter(Boolean).join(" · ")}
        </span>
      </div>

      <ul
        aria-label={
          group.gmOccurrence ? "GM tasks and ideas" : "GM prep tasks"
        }
        className="flex flex-col divide-y divide-indigo-100 dark:divide-indigo-400/10"
      >
        {group.occurrences.map(({ task, startCategoryId, isStart }) => (
          <TaskRow
            key={`${task.id}:${categoryId}`}
            board={board}
            task={task}
            startCategoryId={startCategoryId}
            categoryId={categoryId}
            isStart={isStart}
            inGmGroup
          />
        ))}
      </ul>
    </li>
  );
}
