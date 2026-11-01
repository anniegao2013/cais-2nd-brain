import { CATEGORIES, categoryIndex } from "./categories";
import { baseMoveBounds } from "./placement";
import type { AppState } from "./types";

export function setTaskSpan(
  state: AppState,
  categoryId: string,
  taskId: string,
  endCategoryId: string,
): AppState | null {
  const task = (state.tasks[categoryId] ?? []).find(
    (candidate) => candidate.id === taskId,
  );
  if (!task) return null;

  const startIndex = categoryIndex(categoryId);
  const endIndex = categoryIndex(endCategoryId);
  const maxEndIndex = baseMoveBounds(state, task).max;
  if (endIndex < startIndex || endIndex > maxEndIndex) return null;

  return {
    ...state,
    tasks: {
      ...state.tasks,
      [categoryId]: (state.tasks[categoryId] ?? []).map((candidate) => {
        if (candidate.id !== taskId) return candidate;
        if (endIndex === startIndex) {
          const next = { ...candidate };
          delete next.endCategoryId;
          return next;
        }
        return { ...candidate, endCategoryId: CATEGORIES[endIndex].id };
      }),
    },
  };
}
