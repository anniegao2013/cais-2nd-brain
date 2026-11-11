import { CATEGORIES, categoryIndex } from "./categories";
import { weekInfoFromCategoryId } from "./calendar";
import { pruneDependencies } from "./dependencies";
import { findTask } from "./tasks";
import type { AppState, Task, TasksByCategory } from "./types";

export const SOCIAL_POLL_TEXT = "Poll for interest";
export const SOCIAL_POLL_LEAD_WEEKS = 4;
export const INTEREST_POLL_PREFIX = "poll-";

export const START_PLANNING_TEXT = "Start planning";
export const START_PLANNING_LEAD_WEEKS = 3;
export const ANNOUNCE_TEXT = "Announce";
export const ANNOUNCE_LEAD_WEEKS = 2;

// Retreats, the big little reveal, and E-ball are large social events that are
// planned directly, so they do not get automatic follow-ups.
export const SOCIAL_POLL_EXCLUDED_PARENT_IDS = new Set([
  "default-12", // Retreat
  "default-18", // Big little reveal
  "default-32", // Spring Retreat
  "default-36", // E-ball
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

type SocialFollowUp = {
  text: string;
  leadWeeks: number;
  id: (parentId: string) => string;
};

// Every social event gets these three subtasks, scheduled at their lead times.
export const SOCIAL_FOLLOW_UPS: SocialFollowUp[] = [
  {
    text: SOCIAL_POLL_TEXT,
    leadWeeks: SOCIAL_POLL_LEAD_WEEKS,
    id: socialPollId,
  },
  {
    text: START_PLANNING_TEXT,
    leadWeeks: START_PLANNING_LEAD_WEEKS,
    id: startPlanningId,
  },
  {
    text: ANNOUNCE_TEXT,
    leadWeeks: ANNOUNCE_LEAD_WEEKS,
    id: announceId,
  },
];

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

// Follow-ups stay inside the event's semester. Fall events may fall back into
// the pre-year sections, while spring events stop at the first spring week
// instead of spilling back into the fall.
const FIRST_SPRING_WEEK_INDEX = CATEGORIES.findIndex((category) =>
  category.id.startsWith("spring-week-"),
);

function fillFollowUp(
  tasks: TasksByCategory,
  presentIds: Set<string>,
  removedIds: Set<string>,
  event: { task: Task; categoryId: string },
  followUp: SocialFollowUp,
): boolean {
  const id = followUp.id(event.task.id);
  if (presentIds.has(id) || removedIds.has(id)) return false;

  const eventIndex = categoryIndex(event.categoryId);
  if (eventIndex < 0) return false;

  const semesterStartIndex =
    weekInfoFromCategoryId(event.categoryId)?.semesterId === "spring"
      ? FIRST_SPRING_WEEK_INDEX
      : 0;
  const targetIndex = Math.max(semesterStartIndex, eventIndex - followUp.leadWeeks);
  const lead = eventIndex - targetIndex;

  const task: Task = {
    id,
    text: followUp.text,
    done: false,
    parentId: event.task.id,
  };
  if (lead > 0) task.leadWeeks = lead;

  const targetCategory = CATEGORIES[targetIndex].id;
  tasks[targetCategory] = [...(tasks[targetCategory] ?? []), task];
  presentIds.add(id);
  return true;
}

// Gives every social event its poll, planning, and announcement subtasks. The
// ids are derived from the parent so repeated runs stay idempotent, and
// deleting a generated task records its id in removedDefaults to keep it gone.
// Follow-ups generated before a parent was excluded are pruned here, along with
// any ordering edges that referenced them.
export function syncSocialFollowUps(state: AppState): AppState {
  const tasks = cloneTasks(state.tasks);
  let changed = false;

  const excludedFollowUpParents = new Map<string, string>();
  for (const parentId of SOCIAL_POLL_EXCLUDED_PARENT_IDS) {
    for (const followUp of SOCIAL_FOLLOW_UPS) {
      excludedFollowUpParents.set(followUp.id(parentId), parentId);
    }
  }

  for (const [categoryId, list] of Object.entries(tasks)) {
    const kept = list.filter((task) => {
      const parentId = excludedFollowUpParents.get(task.id);
      return !(parentId && task.parentId === parentId);
    });
    if (kept.length !== list.length) {
      tasks[categoryId] = kept;
      changed = true;
    }
  }

  const presentIds = new Set(
    Object.values(tasks)
      .flat()
      .map((task) => task.id),
  );
  const removedIds = new Set(state.removedDefaults);
  const socialParents = Object.entries(tasks).flatMap(([categoryId, list]) =>
    list
      .filter(isSocialEvent)
      .map((task) => ({ task, categoryId })),
  );

  for (const event of socialParents) {
    for (const followUp of SOCIAL_FOLLOW_UPS) {
      if (
        fillFollowUp(tasks, presentIds, removedIds, event, followUp)
      ) {
        changed = true;
      }
    }
  }

  if (!changed) return state;

  return {
    ...state,
    tasks,
    dependencies: pruneDependencies(state.dependencies, tasks),
  };
}

// Interest only records whether the group wants the event; the follow-up tasks
// are always present, so toggling this never adds or removes them.
export function togglePollInterest(
  state: AppState,
  pollId: string,
): AppState | null {
  const location = findTask(state, pollId);
  if (!location || !isInterestPoll(location.task)) return null;

  const interested = !location.task.interested;
  const tasks = cloneTasks(state.tasks);

  tasks[location.categoryId] = tasks[location.categoryId].map((task) => {
    if (task.id !== pollId) return task;
    const next = { ...task };
    if (interested) {
      next.interested = true;
    } else {
      delete next.interested;
    }
    return next;
  });

  return { ...state, tasks };
}
