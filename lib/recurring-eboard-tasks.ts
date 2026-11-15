import { weekMeetingISO } from "./calendar";
import { TODO_CATEGORY_ID } from "./categories";
import { resolveMeetingSchedule } from "./meeting";
import { findTask } from "./tasks";
import { holidayOnDate } from "./usc-holidays";
import type { AppState, Task } from "./types";

export const EBOARD_AGENDA_KEY = "eboard-agenda";
export const EBOARD_AGENDA_TEXT = "Make e-board meeting agenda";

// Generated agenda items carry the week in their id so each week's occurrence
// can be checked off or deleted on its own.
const EBOARD_AGENDA_ID_PATTERN = /^recurring-(?:spring-)?week-\d+-eboard-agenda$/;

export function eboardAgendaId(categoryId: string): string {
  return `recurring-${categoryId}-${EBOARD_AGENDA_KEY}`;
}

export function isEboardAgendaTask(task: { id: string }): boolean {
  return EBOARD_AGENDA_ID_PATTERN.test(task.id);
}

// The agenda is prep work for a week that actually has an e-board meeting.
// Holidays are checked against the meeting's real date, not its week, so a
// Thursday-Friday recess does not cancel a Wednesday meeting and Veterans Day
// only cancels a meeting that falls on November 11. Only the current week's
// agenda is kept so the checklist does not collect one unfinished agenda per
// week; past occurrences are replaced as the week turns over. A deleted
// occurrence stays deleted for that week via removedDefaults.
export function syncRecurringEboardAgenda(
  state: AppState,
  categoryId: string | null,
): AppState | null {
  if (!categoryId) return null;

  const currentId = eboardAgendaId(categoryId);
  const tasks = { ...state.tasks };
  let changed = false;

  for (const [id, list] of Object.entries(state.tasks)) {
    const filtered = list.filter(
      (task) => !(isEboardAgendaTask(task) && task.id !== currentId),
    );
    if (filtered.length !== list.length) {
      tasks[id] = filtered;
      changed = true;
    }
  }

  const schedule = resolveMeetingSchedule(state);
  const meetingISO = weekMeetingISO(categoryId, schedule.weekday);
  const hasMeeting = Boolean(meetingISO && !holidayOnDate(meetingISO));

  if (!hasMeeting) {
    // A meeting date covered by a USC holiday has no class and no agenda.
    if (findTask(state, currentId)) {
      tasks[TODO_CATEGORY_ID] = (tasks[TODO_CATEGORY_ID] ?? []).filter(
        (task) => task.id !== currentId,
      );
      changed = true;
    }
    return changed ? { ...state, tasks } : null;
  }

  if (findTask(state, currentId) || state.removedDefaults.includes(currentId)) {
    return changed ? { ...state, tasks } : null;
  }

  const agenda: Task = {
    id: currentId,
    text: EBOARD_AGENDA_TEXT,
    done: false,
    recurring: true,
    ...(meetingISO ? { dueDate: meetingISO } : {}),
  };
  tasks[TODO_CATEGORY_ID] = [...(tasks[TODO_CATEGORY_ID] ?? []), agenda];

  return { ...state, tasks };
}
