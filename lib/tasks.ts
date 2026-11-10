import { CATEGORIES, categoryIndex, sectionLabel } from "./categories";
import { weekNumberFromCategoryId } from "./calendar";
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

// Incomplete tasks from earlier weeks that no longer reach the current week
// are carried forward for display in the current week. Their stored home stays
// unchanged, so completing one returns it to its original week.
export function overdueWeekOccurrences(
  state: AppState,
  currentWeekCategoryId: string,
): TaskOccurrence[] {
  const currentWeek = weekNumberFromCategoryId(currentWeekCategoryId);
  if (currentWeek === null) return [];

  const occurrences: TaskOccurrence[] = [];
  for (const category of CATEGORIES) {
    const week = weekNumberFromCategoryId(category.id);
    if (week === null || week >= currentWeek) continue;

    for (const task of state.tasks[category.id] ?? []) {
      const parent = task.parentId
        ? findTask(state, task.parentId)?.task
        : undefined;
      if (task.done || task.isHoliday || task.suggested || parent?.suggested) {
        continue;
      }

      const endWeek = task.endCategoryId
        ? weekNumberFromCategoryId(task.endCategoryId)
        : week;
      if ((endWeek ?? week) >= currentWeek) continue;

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
  if (startCategoryId.startsWith("week-") && endCategoryId.startsWith("week-")) {
    return `Weeks ${startCategoryId.slice(5)}–${endCategoryId.slice(5)}`;
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
