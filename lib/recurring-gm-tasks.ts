import { findTask } from "./tasks";
import { gmEventId, isGmEvent } from "./gm-events";
import type { AppState, Task } from "./types";

export const RECURRING_GM_TASKS = [
  { key: "social-points", text: "Update social points" },
  { key: "slides", text: "Make GM slides" },
] as const;

export type RecurringGmTask = (typeof RECURRING_GM_TASKS)[number];

export function recurringGmTaskId(categoryId: string, key: string): string {
  return `recurring-${categoryId}-${key}`;
}

export function recurringGmTasksForWeek(
  state: AppState,
  categoryId: string,
): Task[] {
  return RECURRING_GM_TASKS.flatMap((definition) => {
    const location = findTask(
      state,
      recurringGmTaskId(categoryId, definition.key),
    );
    return location ? [location.task] : [];
  });
}

// Only the GM in the week containing today gets its recurring tasks. Future
// weeks stay empty until they become current, so the board does not fill with
// dozens of recurring items at once. Stable IDs plus removedDefaults keep
// completion and deletions from being recreated on the next load.
export function syncRecurringGmTasks(
  state: AppState,
  categoryId: string | null,
): AppState | null {
  if (!categoryId) return null;

  const gmId = gmEventId(categoryId);
  const gmLocation = findTask(state, gmId);
  if (!gmLocation || !isGmEvent(gmLocation.task)) return null;

  const tasks = { ...state.tasks };
  let changed = false;

  for (const definition of RECURRING_GM_TASKS) {
    const id = recurringGmTaskId(categoryId, definition.key);
    if (state.removedDefaults.includes(id) || findTask(state, id)) continue;

    const task: Task = {
      id,
      text: definition.text,
      done: false,
      parentId: gmId,
      recurring: true,
    };
    tasks[gmLocation.categoryId] = [
      ...(tasks[gmLocation.categoryId] ?? []),
      task,
    ];
    changed = true;
  }

  return changed ? { ...state, tasks } : null;
}
