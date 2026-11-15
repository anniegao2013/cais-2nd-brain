import type { TaskBoardController } from "@/hooks/use-task-board";
import { useTodayISO } from "@/hooks/use-today";
import { isoDateLabel } from "@/lib/calendar";
import { TODO_CATEGORY_ID, sectionLabel } from "@/lib/categories";
import {
  agendaEvents,
  agendaTodos,
  nextMeetingWeek,
} from "@/lib/eboard-agenda";
import { meetingFollowsGm, meetingTimeLabel } from "@/lib/meeting";
import type { Task } from "@/lib/types";

function MetaBadge({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-full border border-zinc-200 bg-zinc-50 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400">
      {children}
    </span>
  );
}

function AgendaRow({
  board,
  task,
  categoryId,
  meta,
  extra,
}: {
  board: TaskBoardController;
  task: Task;
  categoryId: string;
  meta: string;
  extra?: React.ReactNode;
}) {
  return (
    <li className="flex items-start gap-2 py-2.5">
      <input
        type="checkbox"
        checked={task.done}
        onChange={() => board.toggleTask(categoryId, task.id)}
        aria-label={`Mark "${task.text}" as ${
          task.done ? "not done" : "done"
        }`}
        className="mt-0.5 size-4 shrink-0 accent-zinc-900 dark:accent-zinc-100"
      />
      <div className="min-w-0 flex-1">
        <p
          className={`text-sm ${
            task.done
              ? "text-zinc-400 line-through dark:text-zinc-500"
              : "text-zinc-700 dark:text-zinc-300"
          }`}
        >
          {task.text}
        </p>
        <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[11px] text-zinc-500 dark:text-zinc-400">
          <span>{meta}</span>
          {task.suggested && <MetaBadge>Suggestion</MetaBadge>}
          {task.recurring && <MetaBadge>Weekly</MetaBadge>}
          {extra}
        </div>
      </div>
    </li>
  );
}

function AgendaSection({
  title,
  count,
  empty,
  children,
}: {
  title: string;
  count: number;
  empty: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mt-5">
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
          {title}
        </h3>
        <span className="text-xs tabular-nums text-zinc-400 dark:text-zinc-500">
          {count}
        </span>
      </div>
      {count === 0 ? (
        <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">{empty}</p>
      ) : (
        <ul className="mt-2 flex flex-col divide-y divide-zinc-200 border-y border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
          {children}
        </ul>
      )}
    </div>
  );
}

// The agenda is assembled from the next meeting's coverage window rather than
// copied by hand, so events and to-dos stay in sync with the board.
export function EboardAgenda({ board }: { board: TaskBoardController }) {
  const todayISO = useTodayISO();

  if (!todayISO) {
    return (
      <p className="text-sm text-zinc-500 dark:text-zinc-400">
        Loading the agenda…
      </p>
    );
  }

  const meeting = nextMeetingWeek(board.state, todayISO);

  if (!meeting) {
    return (
      <p className="text-sm text-zinc-500 dark:text-zinc-400">
        No upcoming e-board meetings in the timeline.
      </p>
    );
  }

  const events = agendaEvents(board.state, meeting);
  const todos = agendaTodos(board.state, meeting);
  const timeLabel = meetingTimeLabel(board.meetingSchedule.time);
  const coveredLabels = meeting.coveredCategoryIds.map(sectionLabel);
  const followsGm = meetingFollowsGm(board.meetingSchedule.weekday);

  return (
    <section
      aria-labelledby="eboard-agenda-heading"
      className="rounded-lg border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <div>
          <h2
            id="eboard-agenda-heading"
            className="text-base font-medium text-zinc-900 dark:text-zinc-100"
          >
            Draft e-board meeting agenda
          </h2>
          <p className="mt-0.5 text-sm tabular-nums text-zinc-600 dark:text-zinc-300">
            {isoDateLabel(meeting.dateISO)} · {timeLabel}
          </p>
        </div>
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          {coveredLabels.length === 1
            ? coveredLabels[0]
            : `${coveredLabels.length} weeks covered`}
        </p>
      </div>
      <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
        Covers {coveredLabels.join(", ")}.{" "}
        {followsGm
          ? "Meetings after Wednesday's GM start with the following week. "
          : ""}
        Weeks without a meeting roll into the meeting before them.
      </p>

      <AgendaSection
        title="Events"
        count={events.length}
        empty="No open events in the weeks this meeting covers."
      >
        {events.map(({ task, categoryId }) => (
          <AgendaRow
            key={task.id}
            board={board}
            task={task}
            categoryId={categoryId}
            meta={sectionLabel(categoryId)}
          />
        ))}
      </AgendaSection>

      <AgendaSection
        title="To-dos"
        count={todos.length}
        empty="No open to-dos due by this meeting."
      >
        {todos.map((task) => (
          <AgendaRow
            key={task.id}
            board={board}
            task={task}
            categoryId={TODO_CATEGORY_ID}
            meta={
              task.dueDate
                ? task.dueDate < todayISO
                  ? `Overdue · ${isoDateLabel(task.dueDate)}`
                  : `Due ${isoDateLabel(task.dueDate)}`
                : "No due date"
            }
          />
        ))}
      </AgendaSection>
    </section>
  );
}
