import { isDependency, pruneDependencies } from "./dependencies";
import { sanitizeSubtaskPlacement } from "./placement";
import type { AppState, DeletedBatch, Task } from "./types";

// Keep the list short enough that the saved board stays small, while still
// covering an ordinary "oops" moment.
export const MAX_DELETED_BATCHES = 25;

function isTask(value: unknown): value is Task {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as Task).id === "string" &&
    typeof (value as Task).text === "string" &&
    typeof (value as Task).done === "boolean"
  );
}

export function isDeletedBatch(value: unknown): value is DeletedBatch {
  if (typeof value !== "object" || value === null) return false;
  const batch = value as DeletedBatch;
  return (
    typeof batch.id === "string" &&
    typeof batch.deletedAt === "string" &&
    Array.isArray(batch.tasks) &&
    batch.tasks.length > 0 &&
    batch.tasks.every(
      (entry) =>
        typeof entry === "object" &&
        entry !== null &&
        typeof entry.categoryId === "string" &&
        isTask(entry.task),
    ) &&
    Array.isArray(batch.dependencies)
  );
}

export function normalizeDeletedBatches(value: unknown): DeletedBatch[] {
  if (!Array.isArray(value)) return [];

  const seen = new Set<string>();
  const batches: DeletedBatch[] = [];
  for (const entry of value) {
    if (!isDeletedBatch(entry) || seen.has(entry.id)) continue;
    seen.add(entry.id);
    batches.push({
      id: entry.id,
      deletedAt: entry.deletedAt,
      tasks: entry.tasks.map(({ categoryId, task }) => ({ categoryId, task })),
      dependencies: entry.dependencies.filter(isDependency),
    });
    if (batches.length >= MAX_DELETED_BATCHES) break;
  }
  return batches;
}

// Put a deleted event or task back in its original section. Edges that were
// dropped with it come back too, and its tombstone is cleared so defaults and
// recurring items are allowed to exist again.
export function restoreDeletedBatch(
  state: AppState,
  batchId: string,
): AppState | null {
  const batches = state.deletedTasks ?? [];
  const batch = batches.find((entry) => entry.id === batchId);
  if (!batch) return null;

  const present = new Set<string>();
  for (const list of Object.values(state.tasks)) {
    for (const task of list) present.add(task.id);
  }

  const tasks = { ...state.tasks };
  for (const { categoryId, task } of batch.tasks) {
    // A task with the same id was created again; keep the live copy.
    if (present.has(task.id)) continue;
    tasks[categoryId] = [...(tasks[categoryId] ?? []), task];
    present.add(task.id);
  }

  const restoredIds = new Set(batch.tasks.map((entry) => entry.task.id));
  const dependencies = pruneDependencies(
    [...state.dependencies, ...batch.dependencies],
    tasks,
  );

  return sanitizeSubtaskPlacement({
    ...state,
    tasks,
    dependencies,
    removedDefaults: state.removedDefaults.filter((id) => !restoredIds.has(id)),
    deletedTasks: batches.filter((entry) => entry.id !== batchId),
  });
}
