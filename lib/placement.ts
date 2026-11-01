import { CATEGORIES, categoryIndex } from "./categories";
import { buildGraph, sortState, traverse } from "./dependencies";
import { findTask, spanLength } from "./tasks";
import type { AppState, Task, TasksByCategory } from "./types";

// Keep a span inside the allowed range, dropping it if it would be zero.
export function clampTaskSpan(
  task: Task,
  startCategoryId: string,
  maxEndIndex = CATEGORIES.length - 1,
): Task {
  if (!task.endCategoryId) return task;

  const startIndex = categoryIndex(startCategoryId);
  const endIndex = categoryIndex(task.endCategoryId);
  const max = Math.min(maxEndIndex, CATEGORIES.length - 1);
  const clamped = Math.min(Math.max(endIndex, startIndex), max);

  const next = { ...task };
  if (clamped <= startIndex) {
    delete next.endCategoryId;
  } else {
    next.endCategoryId = CATEGORIES[clamped].id;
  }
  return next;
}

export function shiftTaskSpan(task: Task, delta: number): Task | null {
  if (!task.endCategoryId) return task;
  const endIndex = categoryIndex(task.endCategoryId) + delta;
  if (endIndex < 0 || endIndex >= CATEGORIES.length) return null;
  return { ...task, endCategoryId: CATEGORIES[endIndex].id };
}

// A sequenced task may not move before a predecessor or after a successor.
export function sequenceBounds(
  state: AppState,
  taskId: string,
): { min: number; max: number } {
  const graph = buildGraph(state.dependencies);
  if (!graph.sequenced.has(taskId)) {
    return { min: 0, max: CATEGORIES.length - 1 };
  }

  let min = 0;
  let max = CATEGORIES.length - 1;
  for (const id of traverse(taskId, graph.follows)) {
    const location = findTask(state, id);
    if (location) min = Math.max(min, categoryIndex(location.categoryId));
  }
  for (const id of traverse(taskId, graph.precedes)) {
    const location = findTask(state, id);
    if (location) max = Math.min(max, categoryIndex(location.categoryId));
  }
  return { min, max };
}

// Subtasks may only be scheduled in their parent's section or earlier, and a
// parent may not move before any of its subtasks. Subtasks with a leadWeeks
// offset shift with the parent and must stay at least that far ahead of it.
export function baseMoveBounds(
  state: AppState,
  task: Task,
): { min: number; max: number } {
  const bounds = sequenceBounds(state, task.id);

  if (task.parentId) {
    const parent = findTask(state, task.parentId);
    if (parent) {
      bounds.max = Math.min(
        bounds.max,
        categoryIndex(parent.categoryId) - (task.leadWeeks ?? 0),
      );
    }
    return bounds;
  }

  const parentLocation = findTask(state, task.id);
  if (!parentLocation) return bounds;
  const parentIndex = categoryIndex(parentLocation.categoryId);

  for (const [categoryId, list] of Object.entries(state.tasks)) {
    for (const candidate of list) {
      if (candidate.parentId !== task.id) continue;

      if (candidate.leadWeeks !== undefined) {
        // This subtask moves with the parent, so only the gap limits it.
        bounds.min = Math.max(
          bounds.min,
          parentIndex - categoryIndex(categoryId),
        );
      } else {
        bounds.min = Math.max(bounds.min, categoryIndex(categoryId));
      }
    }
  }
  return bounds;
}

// A spanning task also needs room for its remaining sections.
export function moveBounds(
  state: AppState,
  task: Task,
): { min: number; max: number } {
  const bounds = baseMoveBounds(state, task);
  const span = spanLength(state, task);
  if (span > 0) {
    bounds.max = Math.min(bounds.max, CATEGORIES.length - 1 - span);
  }
  return bounds;
}

// Keep subtasks from ending up after their parent if old data is inconsistent.
export function sanitizeSubtaskPlacement(state: AppState): AppState {
  const location = new Map<string, string>();
  for (const [categoryId, list] of Object.entries(state.tasks)) {
    for (const task of list) location.set(task.id, categoryId);
  }

  const tasks: TasksByCategory = {};
  for (const [categoryId, list] of Object.entries(state.tasks)) {
    tasks[categoryId] = tasks[categoryId] ?? [];
    for (const task of list) {
      const parentCategory = task.parentId
        ? location.get(task.parentId)
        : undefined;

      if (!task.parentId) {
        tasks[categoryId].push(clampTaskSpan(task, categoryId));
      } else if (!parentCategory) {
        // Parent is gone; keep the task as a standalone item.
        tasks[categoryId].push(
          clampTaskSpan({ ...task, parentId: undefined }, categoryId),
        );
      } else {
        const latestIndex =
          categoryIndex(parentCategory) - (task.leadWeeks ?? 0);
        const targetIndex = Math.min(
          Math.max(categoryIndex(categoryId), 0),
          Math.max(latestIndex, 0),
        );
        const targetCategory = CATEGORIES[targetIndex].id;
        const nextTask = clampTaskSpan(
          task,
          targetCategory,
          Math.max(latestIndex, 0),
        );

        if (targetCategory === categoryId) {
          tasks[categoryId].push(nextTask);
        } else {
          tasks[targetCategory] = [
            ...(tasks[targetCategory] ?? []),
            nextTask,
          ];
        }
      }
    }
  }

  return sortState({ ...state, tasks });
}
