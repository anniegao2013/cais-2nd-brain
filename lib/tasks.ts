import {
  CATEGORIES,
  categoryIndex,
  isGmIdeasCategory,
  isTodoCategory,
  sectionLabel,
} from "./categories";
import { weekInfoFromCategoryId } from "./calendar";
import { isGmEvent } from "./gm-events";
import type { AppState, Task, TaskOccurrence } from "./types";

export function findTask(
  state: AppState,
  taskId: string,
): { categoryId: string; task: Task } | null {
  for (const [categoryId, list] of Object.entries(state.tasks)) {
    const task = list.find((candidate) => candidate.id === taskId);
    if (task) return { categoryId, task };
  }
  return null;
}

// A spanning task is listed under every section between its start and end.
export function taskOccurrences(
  state: AppState,
  categoryId: string,
): TaskOccurrence[] {
  // The backlog lists have no dates or spans: every item is one row.
  if (isGmIdeasCategory(categoryId) || isTodoCategory(categoryId)) {
    return (state.tasks[categoryId] ?? []).map((task) => ({
      task,
      startCategoryId: categoryId,
      isStart: true,
    }));
  }

  const sectionIndex = categoryIndex(categoryId);
  const occurrences: TaskOccurrence[] = [];

  for (const category of CATEGORIES) {
    const startIndex = categoryIndex(category.id);
    for (const task of state.tasks[category.id] ?? []) {
      const endIndex = task.endCategoryId
        ? Math.max(startIndex, categoryIndex(task.endCategoryId))
        : startIndex;
      if (sectionIndex < startIndex || sectionIndex > endIndex) continue;

      occurrences.push({
        task,
        startCategoryId: category.id,
        isStart: sectionIndex === startIndex,
      });
    }
  }

  return occurrences;
}

// A GM and everything scheduled for it are shown as one block in a week:
// agenda items, prep tasks, and assigned ideas stay next to their GM instead of
// being scattered through the week's list. A prep task can sit in an earlier
// week than its GM, so a group may appear without the GM row itself.
export type OccurrenceGroup = {
  // The GM event id, or null for an ordinary task row.
  gmId: string | null;
  // The GM row when the GM itself occurs in this section.
  gmOccurrence: TaskOccurrence | null;
  // The GM's home section, used to label prep groups in earlier weeks.
  gmCategoryId: string | null;
  // The GM row first, then its tasks and ideas in their stored order.
  occurrences: TaskOccurrence[];
};

// Walks up from a task to the GM event that owns it. Ideas assigned to a GM and
// manually added tasks both point at the GM through parentId.
function gmRootId(state: AppState, task: Task): string | null {
  if (isGmEvent(task)) return task.id;

  let current = task;
  const seen = new Set<string>();
  while (current.parentId) {
    if (seen.has(current.id)) return null;
    seen.add(current.id);

    const parent = findTask(state, current.parentId)?.task;
    if (!parent) return null;
    if (isGmEvent(parent)) return parent.id;
    current = parent;
  }

  return null;
}

export function groupOccurrencesByGm(
  state: AppState,
  occurrences: TaskOccurrence[],
): OccurrenceGroup[] {
  const groups = new Map<string, OccurrenceGroup>();
  const ordered: OccurrenceGroup[] = [];

  for (const occurrence of occurrences) {
    const gmId = gmRootId(state, occurrence.task);

    if (!gmId) {
      ordered.push({
        gmId: null,
        gmOccurrence: null,
        gmCategoryId: null,
        occurrences: [occurrence],
      });
      continue;
    }

    let group = groups.get(gmId);
    if (!group) {
      const location = findTask(state, gmId);
      group = {
        gmId,
        gmOccurrence: null,
        gmCategoryId: location?.categoryId ?? occurrence.startCategoryId,
        occurrences: [],
      };
      groups.set(gmId, group);
      ordered.push(group);
    }

    if (isGmEvent(occurrence.task)) {
      group.gmOccurrence = occurrence;
      group.occurrences.unshift(occurrence);
    } else {
      group.occurrences.push(occurrence);
    }
  }

  return ordered;
}

// Incomplete tasks from earlier weeks that no longer reach the current week
// are carried forward for display in the current week. Their stored home stays
// unchanged, so completing one returns it to its original week.
export function overdueWeekOccurrences(
  state: AppState,
  currentWeekCategoryId: string,
): TaskOccurrence[] {
  const current = weekInfoFromCategoryId(currentWeekCategoryId);
  if (!current) return [];

  const occurrences: TaskOccurrence[] = [];
  for (const category of CATEGORIES) {
    const info = weekInfoFromCategoryId(category.id);
    if (
      !info ||
      info.semesterId !== current.semesterId ||
      info.week >= current.week
    ) {
      continue;
    }

    for (const task of state.tasks[category.id] ?? []) {
      const parent = task.parentId
        ? findTask(state, task.parentId)?.task
        : undefined;
      if (
        task.done ||
        task.isHoliday ||
        task.suggested ||
        task.recurring ||
        parent?.suggested
      ) {
        continue;
      }

      const end = task.endCategoryId
        ? weekInfoFromCategoryId(task.endCategoryId)
        : info;
      if (
        !end ||
        end.semesterId !== current.semesterId ||
        end.week >= current.week
      ) {
        continue;
      }

      occurrences.push({
        task,
        startCategoryId: category.id,
        isStart: true,
        isOverdue: true,
      });
    }
  }

  return occurrences;
}

export function spanLabel(
  startCategoryId: string,
  endCategoryId: string,
): string {
  const start = weekInfoFromCategoryId(startCategoryId);
  const end = weekInfoFromCategoryId(endCategoryId);
  if (start && end && start.semesterId === end.semesterId) {
    const prefix = start.semesterId === "fall" ? "Fall weeks" : "Spring weeks";
    return `${prefix} ${start.week}–${end.week}`;
  }
  return `${sectionLabel(startCategoryId)} → ${sectionLabel(endCategoryId)}`;
}

export function spanLength(state: AppState, task: Task): number {
  if (!task.endCategoryId) return 0;
  const location = findTask(state, task.id);
  if (!location) return 0;
  return Math.max(
    0,
    categoryIndex(task.endCategoryId) - categoryIndex(location.categoryId),
  );
}

export function allTasks(state: AppState): Task[] {
  return Object.values(state.tasks).flat();
}
