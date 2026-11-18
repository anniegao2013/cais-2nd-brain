import { isoDateLabel } from "./calendar";
import {
  GM_IDEAS_CATEGORY_ID,
  TODO_CATEGORY_ID,
  sectionLabel,
} from "./categories";
import { nextMeetingWeek } from "./eboard-agenda";
import { meetingTimeLabel, resolveMeetingSchedule } from "./meeting";
import { todoBucketFor } from "./todo-groups";
import type { AppState } from "./types";

export type HomeSummary = {
  currentWeekLabel: string | null;
  gmIdeas: number;
  openTodos: number;
  overdueTodos: number;
  nextMeeting: string | null;
};

// Counts for the Home cards. Keeping this pure makes the landing page a view of
// the board instead of a static explainer.
export function boardHomeSummary(
  state: AppState,
  todayISO: string,
  currentWeekCategoryId: string | null,
): HomeSummary {
  const todos = state.tasks[TODO_CATEGORY_ID] ?? [];
  const meeting = nextMeetingWeek(state, todayISO);
  const meetingTime = meetingTimeLabel(resolveMeetingSchedule(state).time);

  return {
    currentWeekLabel: currentWeekCategoryId
      ? sectionLabel(currentWeekCategoryId)
      : null,
    gmIdeas: (state.tasks[GM_IDEAS_CATEGORY_ID] ?? []).filter(
      (task) => !task.done,
    ).length,
    openTodos: todos.filter((task) => !task.done).length,
    overdueTodos: todos.filter(
      (task) => !task.done && todoBucketFor(task.dueDate, todayISO) === "overdue",
    ).length,
    nextMeeting: meeting
      ? `${isoDateLabel(meeting.dateISO)} · ${meetingTime}`
      : null,
  };
}
