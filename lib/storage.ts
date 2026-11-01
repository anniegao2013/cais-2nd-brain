import {
  DEFAULT_BY_ID,
  DEFAULT_DEPENDENCIES,
  DEFAULT_EVENTS,
  DEFAULT_STATE,
} from "./defaults";
import { isDependency, pruneDependencies } from "./dependencies";
import { sanitizeSubtaskPlacement } from "./placement";
import { isTagId, type TagId } from "./tags";
import type { AppState, Task, TasksByCategory } from "./types";

export const STORAGE_KEY = "second-brain.tasks.v1";

function isTask(value: unknown): value is Task {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as Task).id === "string" &&
    typeof (value as Task).text === "string" &&
    typeof (value as Task).done === "boolean"
  );
}

function normalizeStorage(raw: string): AppState {
  const parsed: unknown = JSON.parse(raw);

  // Older saves were just a category -> tasks map.
  const tasks: TasksByCategory =
    parsed && typeof parsed === "object" && "tasks" in parsed
      ? ((parsed as AppState).tasks ?? {})
      : ((parsed as TasksByCategory) ?? {});
  const removedDefaults =
    parsed && typeof parsed === "object" && "removedDefaults" in parsed
      ? ((parsed as AppState).removedDefaults ?? [])
      : [];
  // Older saves have no dependencies; seed the defaults for them. An empty
  // stored array is respected so removed rules stay removed.
  const storedDependencies =
    parsed && typeof parsed === "object" && "dependencies" in parsed
      ? (parsed as AppState).dependencies
      : undefined;
  const dependencies = Array.isArray(storedDependencies)
    ? storedDependencies.filter(isDependency)
    : DEFAULT_DEPENDENCIES;

  const cleaned: TasksByCategory = {};
  for (const [categoryId, list] of Object.entries(tasks)) {
    cleaned[categoryId] = Array.isArray(list)
      ? list.filter(isTask).map((task) => {
          const seed = DEFAULT_BY_ID.get(task.id);
          // Older saves stored a single `recruitment` boolean; newer saves
          // store a `tags` array. A missing tags array falls back to legacy or
          // seeded tags, while an empty array is respected.
          const legacyRecruitment = (task as { recruitment?: unknown })
            .recruitment;
          const tags: TagId[] = Array.isArray(task.tags)
            ? task.tags.filter(isTagId)
            : typeof legacyRecruitment === "boolean"
              ? legacyRecruitment
                ? ["recruitment"]
                : []
              : seed?.tags
                ? [...seed.tags]
                : [];

          const next: Task & { recruitment?: boolean } = { ...task, tags };
          delete next.recruitment;
          if (seed?.leadWeeks !== undefined && next.leadWeeks === undefined) {
            next.leadWeeks = seed.leadWeeks;
          }
          return next;
        })
      : [];
  }

  // Default events always exist unless they were deliberately removed.
  const presentIds = new Set(
    Object.values(cleaned).flatMap((list) => list.map((task) => task.id)),
  );
  for (const event of DEFAULT_EVENTS) {
    if (removedDefaults.includes(event.id) || presentIds.has(event.id)) continue;
    if (
      event.parentId &&
      (!presentIds.has(event.parentId) ||
        removedDefaults.includes(event.parentId))
    ) {
      continue;
    }

    cleaned[event.category] = [
      ...(cleaned[event.category] ?? []),
      {
        id: event.id,
        text: event.text,
        done: false,
        isDefault: true,
        tags: event.tags,
        parentId: event.parentId,
        leadWeeks: event.leadWeeks,
      },
    ];
    presentIds.add(event.id);
  }

  return sanitizeSubtaskPlacement({
    tasks: cleaned,
    removedDefaults,
    dependencies: pruneDependencies(dependencies, cleaned),
  });
}

function readStorage(): AppState {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    return stored ? normalizeStorage(stored) : DEFAULT_STATE;
  } catch {
    return DEFAULT_STATE;
  }
}

let cache: AppState | null = null;
const listeners = new Set<() => void>();

export function getSnapshot(): AppState {
  if (cache === null) cache = readStorage();
  return cache;
}

export function getServerSnapshot(): AppState {
  return DEFAULT_STATE;
}

export function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function setState(next: AppState): void {
  cache = next;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Storage may be unavailable; keep the in-memory copy.
  }
  listeners.forEach((listener) => listener());
}

// Keep multiple tabs in sync.
export function refreshFromStorage(): void {
  cache = readStorage();
  listeners.forEach((listener) => listener());
}
