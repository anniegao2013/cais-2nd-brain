import type { TaskBoardController } from "@/hooks/use-task-board";
import {
  WEEKDAY_LABELS,
  meetingTimeLabel,
  weekdayLabel,
} from "@/lib/meeting";

export function MeetingSchedulePicker({
  board,
}: {
  board: TaskBoardController;
}) {
  const schedule = board.meetingSchedule;
  const timeLabel = meetingTimeLabel(schedule.time);

  return (
    <div className="mt-6 rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
      <div>
        <h2 className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
          Weekly e-board meeting
        </h2>
        <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
          Every {weekdayLabel(schedule.weekday)} at {timeLabel}
        </p>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-zinc-500 dark:text-zinc-400">
        <label className="flex items-center gap-1.5">
          <span>Day</span>
          <select
            value={schedule.weekday}
            onChange={(event) =>
              board.setMeetingSchedule(
                Number(event.target.value),
                schedule.time,
              )
            }
            aria-label="Day of the week for the e-board meeting"
            className="h-8 rounded-md border border-zinc-200 bg-white px-2 text-xs text-zinc-700 focus:border-zinc-400 focus:outline-none dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-300 dark:focus:border-zinc-600"
          >
            {WEEKDAY_LABELS.map((label, weekday) => (
              <option key={label} value={weekday}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-1.5">
          <span>Time</span>
          <input
            type="time"
            value={schedule.time}
            onChange={(event) =>
              board.setMeetingSchedule(schedule.weekday, event.target.value)
            }
            aria-label="Time of the e-board meeting"
            className="h-8 rounded-md border border-zinc-200 bg-white px-2 text-xs tabular-nums text-zinc-700 focus:border-zinc-400 focus:outline-none dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-300 dark:focus:border-zinc-600"
          />
        </label>
      </div>
    </div>
  );
}
