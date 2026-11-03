import { CATEGORIES, categoryIndex } from "./categories";
import { findTask } from "./tasks";
import type { AppState, Task, TasksByCategory } from "./types";

export const SOCIAL_POLL_TEXT = "Poll for interest";
export const SOCIAL_POLL_LEAD_WEEKS = 4;
export const INTEREST_POLL_PREFIX = "poll-";

export const START_PLANNING_TEXT = "Start planning";
export const START_PLANNING_LEAD_WEEKS = 3;
export const ANNOUNCE_TEXT = "Announce";
export const ANNOUNCE_LEAD_WEEKS = 2;

// Big little reveal and Retreat are large social events that are planned
// directly, so they do not get an automatic interest poll.
export const SOCIAL_POLL_EXCLUDED_PARENT_IDS = new Set([
  "default-12", // Retreat
  "default-18", // Big little reveal
]);

export function socialPollId(parentId: string): string {
  return `${INTEREST_POLL_PREFIX}${parentId}`;
}

export function startPlanningId(parentId: string): string {
  return `plan-${parentId}`;
}

export function announceId(parentId: string): string {
  return `announce-${parentId}`;
}

export function isInterestPoll(task: Task): boolean {
  return task.id.startsWith(INTEREST_POLL_PREFIX);
}

function isSocialEvent(task: Task): boolean {
  return (
    !task.parentId &&
    (task.tags ?? []).includes("social") &&
    !SOCIAL_POLL_EXCLUDED_PARENT_IDS.has(task.id)
  );
}

function cloneTasks(tasks: TasksByCategory): TasksByCategory {
  const copy: TasksByCategory = {};
  for (const [categoryId, list] of Object.entries(tasks)) {
    copy[categoryId] = [...list];
  }
  return copy;
}

// Gives every social event a "Poll for interest" subtask four sections ahead
// of it. The id is derived from the parent so repeated runs stay idempotent,
// and deleting the poll records its id in removedDefaults to keep it deleted.
export function syncSocialPollSubtasks(state: AppState): AppState {
  const tasks = cloneTasks(state.tasks);
  const presentIds = new Set(
    Object.values(state.tasks)
      .flat()
      .map((task) => task.id),
  );
  const removedIds = new Set(state.removedDefaults);
  let changed = false;

  for (const [parentCategoryId, list] of Object.entries(state.tasks)) {
    for (const parent of list) {
      if (!isSocialEvent(parent)) continue;

      const pollId = socialPollId(parent.id);
      if (presentIds.has(pollId) || removedIds.has(pollId)) continue;

      const parentIndex = categoryIndex(parentCategoryId);
      const lead = Math.min(SOCIAL_POLL_LEAD_WEEKS, parentIndex);
      const targetCategory = CATEGORIES[parentIndex - lead].id;
      const poll: Task = {
        id: pollId,
        text: SOCIAL_POLL_TEXT,
        done: false,
        parentId: parent.id,
      };
      if (lead > 0) poll.leadWeeks = lead;

      tasks[targetCategory] = [...(tasks[targetCategory] ?? []), poll];
      presentIds.add(pollId);
      changed = true;
    }
  }

  return changed ? { ...state, tasks } : state;
}

function addFollowUp(
  tasks: TasksByCategory,
  presentIds: Set<string>,
  removedIds: Set<string>,
  event: { task: Task; categoryId: string },
  id: string,
  text: string,
  leadWeeks: number,
): boolean {
  if (presentIds.has(id) || removedIds.has(id)) return false;

  const eventIndex = categoryIndex(event.categoryId);
  const lead = Math.min(leadWeeks, eventIndex);
  const targetCategory = CATEGORIES[eventIndex - lead].id;
  const followUp: Task = {
    id,
    text,
    done: false,
    parentId: event.task.id,
  };
  if (lead > 0) followUp.leadWeeks = lead;

  tasks[targetCategory] = [...(tasks[targetCategory] ?? []), followUp];
  presentIds.add(id);
  return true;
}

// An interested poll adds the two planning steps for its event: start planning
// three sections ahead and announce two sections ahead.
export function syncInterestFollowUps(state: AppState): AppState {
  const interestedPolls = Object.values(state.tasks)
    .flat()
    .filter(
      (task): task is Task & { parentId: string } =>
        isInterestPoll(task) && Boolean(task.interested) && Boolean(task.parentId),
    );

  if (interestedPolls.length === 0) return state;

  const tasks = cloneTasks(state.tasks);
  const presentIds = new Set(
    Object.values(state.tasks)
      .flat()
      .map((task) => task.id),
  );
  const removedIds = new Set(state.removedDefaults);
  let changed = false;

  for (const poll of interestedPolls) {
    const event = findTask(state, poll.parentId);
    if (!event) continue;

    if (
      addFollowUp(
        tasks,
        presentIds,
        removedIds,
        event,
        startPlanningId(event.task.id),
        START_PLANNING_TEXT,
        START_PLANNING_LEAD_WEEKS,
      )
    ) {
      changed = true;
    }
    if (
      addFollowUp(
        tasks,
        presentIds,
        removedIds,
        event,
        announceId(event.task.id),
        ANNOUNCE_TEXT,
        ANNOUNCE_LEAD_WEEKS,
      )
    ) {
      changed = true;
    }
  }

  return changed ? { ...state, tasks } : state;
}

function removeInterestFollowUps(
  state: AppState,
  eventId: string | undefined,
): AppState {
  if (!eventId) return state;

  const ids = new Set([startPlanningId(eventId), announceId(eventId)]);
  const tasks = cloneTasks(state.tasks);
  let changed = false;

  for (const [categoryId, list] of Object.entries(tasks)) {
    const next = list.filter((task) => !ids.has(task.id));
    if (next.length !== list.length) changed = true;
    tasks[categoryId] = next;
  }

  if (!changed) return state;

  return {
    ...state,
    tasks,
    dependencies: state.dependencies.filter(
      (edge) => !ids.has(edge.before) && !ids.has(edge.after),
    ),
  };
}

export function togglePollInterest(
  state: AppState,
  pollId: string,
): AppState | null {
  const location = findTask(state, pollId);
  if (!location || !isInterestPoll(location.task)) return null;

  const interested = !location.task.interested;
  const tasks = cloneTasks(state.tasks);

  for (const [categoryId, list] of Object.entries(tasks)) {
    tasks[categoryId] = list.map((task) => {
      if (task.id !== pollId) return task;
      const next = { ...task };
      if (interested) {
        next.interested = true;
      } else {
        delete next.interested;
      }
      return next;
    });
  }

  const next = { ...state, tasks };
  if (interested) return syncInterestFollowUps(next);
  return removeInterestFollowUps(next, location.task.parentId);
}
