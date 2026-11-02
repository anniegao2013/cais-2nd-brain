import { CATEGORIES, categoryIndex, sectionLabel } from "./categories";
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
