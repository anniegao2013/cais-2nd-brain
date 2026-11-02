import { categoryIndex, sectionLabel } from "./categories";
import { buildGraph, sortState, traverse } from "./dependencies";
import { findTask } from "./tasks";
import type { AppState } from "./types";

type DependencyActionResult = { state?: AppState; error?: string };

export function addDependency(
  state: AppState,
  taskId: string,
  afterId: string,
  beforeId: string,
): DependencyActionResult {
  const taskLocation = findTask(state, taskId);
  if (!taskLocation) return {};

  if (!afterId && !beforeId) {
    return {
      error: "Choose a task that must happen before or after this one.",
    };
  }
  if (afterId === taskId || beforeId === taskId) {
    return { error: "A task can't be ordered against itself." };
  }
  if (afterId && beforeId && afterId === beforeId) {
    return { error: "Choose two different tasks for the range." };
  }

  const afterLocation = afterId ? findTask(state, afterId) : null;
  const beforeLocation = beforeId ? findTask(state, beforeId) : null;
  if ((afterId && !afterLocation) || (beforeId && !beforeLocation)) {
    return { error: "That task no longer exists." };
  }

  const taskIndex = categoryIndex(taskLocation.categoryId);
  const dependencies = [...state.dependencies];

  if (afterLocation) {
    const afterEndIndex = afterLocation.task.endCategoryId
      ? categoryIndex(afterLocation.task.endCategoryId)
      : categoryIndex(afterLocation.categoryId);
    if (afterEndIndex > taskIndex) {
      return {
        error: afterLocation.task.endCategoryId
          ? `“${afterLocation.task.text}” runs through ${sectionLabel(
              afterLocation.task.endCategoryId,
            )}, which is after ${sectionLabel(taskLocation.categoryId)}.`
          : `“${afterLocation.task.text}” is in ${sectionLabel(
              afterLocation.categoryId,
            )}, which is after ${sectionLabel(taskLocation.categoryId)}.`,
      };
    }
    if (
      state.dependencies.some(
        (edge) =>
          edge.before === afterLocation.task.id && edge.after === taskId,
      )
    ) {
      return { error: "That ordering already exists." };
    }
    dependencies.push({ before: afterLocation.task.id, after: taskId });
  }

  if (beforeLocation) {
    const taskEndIndex = taskLocation.task.endCategoryId
      ? categoryIndex(taskLocation.task.endCategoryId)
      : taskIndex;
    if (taskEndIndex > categoryIndex(beforeLocation.categoryId)) {
      return {
        error: taskLocation.task.endCategoryId
          ? `“${taskLocation.task.text}” runs through ${sectionLabel(
              taskLocation.task.endCategoryId,
            )}, which is after “${beforeLocation.task.text}”.`
          : `“${beforeLocation.task.text}” is in ${sectionLabel(
              beforeLocation.categoryId,
            )}, which is before ${sectionLabel(taskLocation.categoryId)}.`,
      };
    }
    if (
      state.dependencies.some(
        (edge) =>
          edge.before === taskId && edge.after === beforeLocation.task.id,
      )
    ) {
      return { error: "That ordering already exists." };
    }
    dependencies.push({ before: taskId, after: beforeLocation.task.id });
  }

  if (
    afterLocation &&
    beforeLocation &&
    categoryIndex(afterLocation.categoryId) >
      categoryIndex(beforeLocation.categoryId)
  ) {
    return {
      error: `“${afterLocation.task.text}” already comes after “${beforeLocation.task.text}”.`,
    };
  }

  const graph = buildGraph(dependencies);
  if (traverse(taskId, graph.precedes).has(taskId)) {
    return { error: "Those rules would create a loop." };
  }

  return { state: sortState({ ...state, dependencies }) };
}

export function removeDependency(
  state: AppState,
  before: string,
  after: string,
): AppState {
  return sortState({
    ...state,
    dependencies: state.dependencies.filter(
      (edge) => !(edge.before === before && edge.after === after),
    ),
  });
}
