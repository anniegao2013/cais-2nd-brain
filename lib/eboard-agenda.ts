import {
  weekInfoFromCategoryId,
  weekMeetingISO,
  weekRangeForSemester,
} from "./calendar";
import { CATEGORIES, TODO_CATEGORY_ID } from "./categories";
import { isGmEvent } from "./gm-events";
import { meetingFollowsGm, resolveMeetingSchedule } from "./meeting";
import { isEboardAgendaTask } from "./recurring-eboard-tasks";
import { findTask, taskOccurrences } from "./tasks";
import { holidayOnDate } from "./usc-holidays";
import type { AppState, Task } from "./types";

export type MeetingWeek = {
  categoryId: string;
  dateISO: string;
  // The weeks this meeting plans. A meeting before or on the GM plans its own
  // week; a meeting after the GM plans the following week. Cancelled meeting
  // weeks roll into the meeting before them.
  coveredCategoryIds: string[];
};

export type AgendaEvent = {
  task: Task;
  categoryId: string;
};

// Walk the timeline in order and give every meeting the weeks it plans. A
// meeting after Wednesday's GM happens after that week's GM, so it plans the
// following week instead of the current one. Cancelled meeting weeks still roll
// into the meeting before them, which is what moves a Thanksgiving-week item
// onto the previous meeting's agenda.
export function meetingWeeks(state: AppState): MeetingWeek[] {
  const schedule = resolveMeetingSchedule(state);
  const allWeeks: string[] = [];
  const meetings: { categoryId: string; dateISO: string; index: number }[] = [];

  for (const category of CATEGORIES) {
    if (!weekInfoFromCategoryId(category.id)) continue;

    const index = allWeeks.length;
    allWeeks.push(category.id);

    const dateISO = weekMeetingISO(category.id, schedule.weekday);
    if (!dateISO || holidayOnDate(dateISO)) continue;

    meetings.push({ categoryId: category.id, dateISO, index });
  }

  const shift = meetingFollowsGm(schedule.weekday) ? 1 : 0;

  return meetings.map((meeting, index) => {
    const next = meetings[index + 1];
    const start = meeting.index + shift;
    // The next meeting starts covering at next.index + shift. Everything
    // before that belongs to this meeting. When both meetings follow the GM,
    // this includes the next meeting's own week.
    const end = next ? next.index + shift - 1 : allWeeks.length - 1;
    // The final meeting after the GM has no following week to plan. Fall back
    // to its own week so the last agenda is not empty.
    const startIndex = start > end ? meeting.index : start;

    return {
      categoryId: meeting.categoryId,
      dateISO: meeting.dateISO,
      coveredCategoryIds: allWeeks.slice(startIndex, end + 1),
    };
  });
}

export function nextMeetingWeek(
  state: AppState,
  todayISO: string,
): MeetingWeek | null {
  return (
    meetingWeeks(state).find((meeting) => meeting.dateISO >= todayISO) ?? null
  );
}

function coveredEndISO(meeting: MeetingWeek): string {
  const last =
    meeting.coveredCategoryIds[meeting.coveredCategoryIds.length - 1] ??
    meeting.categoryId;
  const info = weekInfoFromCategoryId(last);
  return info
    ? weekRangeForSemester(info.semesterId, info.week).endISO
    : meeting.dateISO;
}

// Events are the open timeline items in the weeks this meeting covers. The GM
// event itself, its prep work, and USC holiday rows are not agenda items.
function isAgendaEvent(state: AppState, task: Task): boolean {
  if (task.done || task.isHoliday || task.recurring || isGmEvent(task)) {
    return false;
  }

  const parent = task.parentId
    ? findTask(state, task.parentId)?.task
    : undefined;
  return !parent || !isGmEvent(parent);
}

export function agendaEvents(
  state: AppState,
  meeting: MeetingWeek,
): AgendaEvent[] {
  const seen = new Set<string>();
  const events: AgendaEvent[] = [];

  for (const categoryId of meeting.coveredCategoryIds) {
    for (const occurrence of taskOccurrences(state, categoryId)) {
      const { task } = occurrence;
      if (seen.has(task.id) || !isAgendaEvent(state, task)) continue;
      seen.add(task.id);
      events.push({ task, categoryId: occurrence.startCategoryId });
    }
  }

  return events;
}

// To-dos do not belong to a week, so the next meeting picks up everything that
// is open and due by the end of its coverage window. Overdue and undated items
// carry forward; later due dates wait for a later meeting.
export function agendaTodos(state: AppState, meeting: MeetingWeek): Task[] {
  const endISO = coveredEndISO(meeting);

  return (state.tasks[TODO_CATEGORY_ID] ?? [])
    .filter(
      (task) =>
        !task.done &&
        !isEboardAgendaTask(task) &&
        (!task.dueDate || task.dueDate <= endISO),
    )
    .sort(compareTodoDueDate);
}

function compareTodoDueDate(a: Task, b: Task): number {
  if (a.dueDate && b.dueDate) return a.dueDate.localeCompare(b.dueDate);
  if (a.dueDate) return -1;
  if (b.dueDate) return 1;
  return 0;
}
