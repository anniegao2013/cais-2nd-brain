import {
  DEFAULT_BY_ID,
  DEFAULT_DEPENDENCIES,
  DEFAULT_EVENTS,
  DEFAULT_STATE,
} from "./defaults";
import { fetchBoard, saveBoard } from "./board-api";
import { isMonthKey, isISODate } from "./calendar";
import { isDependency, pruneDependencies } from "./dependencies";
import { isMeetingSchedule } from "./meeting";
import { sanitizeSubtaskPlacement } from "./placement";
import { syncSocialFollowUps } from "./social-polls";
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

export function normalizeStorage(raw: string): AppState {
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
  const storedMeetingSchedule =
    parsed && typeof parsed === "object" && "meetingSchedule" in parsed
      ? (parsed as AppState).meetingSchedule
      : undefined;
  const meetingSchedule = isMeetingSchedule(storedMeetingSchedule)
    ? storedMeetingSchedule
    : undefined;

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
          if (
            next.gmSuggestedMonth !== undefined &&
            !isMonthKey(next.gmSuggestedMonth)
          ) {
            delete next.gmSuggestedMonth;
          }
          if (next.dueDate !== undefined && !isISODate(next.dueDate)) {
            delete next.dueDate;
          }
          if (seed?.leadWeeks !== undefined && next.leadWeeks === undefined) {
            next.leadWeeks = seed.leadWeeks;
          }
          if (seed?.suggested && next.suggested === undefined) {
            next.suggested = true;
          }
          if (seed?.isHoliday) {
            next.isHoliday = true;
            next.done = false;
          }
          return next;
        })
      : [];
  }

  // USC holidays are tied to real dates. If an older save placed one in a
  // different week (for example, before the week numbering was grounded in
  // Classes Begin), move it to the section that contains its date.
  const relocatedHolidays: Task[] = [];
  for (const [categoryId, list] of Object.entries(cleaned)) {
    const stay: Task[] = [];
    for (const task of list) {
      const seed = DEFAULT_BY_ID.get(task.id);
      if (seed?.isHoliday && seed.category !== categoryId) {
        relocatedHolidays.push(task);
        continue;
      }
      stay.push(task);
    }
    cleaned[categoryId] = stay;
  }
  for (const task of relocatedHolidays) {
    const categoryId = DEFAULT_BY_ID.get(task.id)?.category;
    if (!categoryId) continue;
    cleaned[categoryId] = [...(cleaned[categoryId] ?? []), task];
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
        endCategoryId: event.endCategoryId,
        isHoliday: event.isHoliday,
        tags: event.tags,
        parentId: event.parentId,
        leadWeeks: event.leadWeeks,
        suggested: event.suggested,
      },
    ];
    presentIds.add(event.id);
  }

  return sanitizeSubtaskPlacement(
    syncSocialFollowUps({
      tasks: cleaned,
      removedDefaults,
      dependencies: pruneDependencies(dependencies, cleaned),
      ...(meetingSchedule ? { meetingSchedule } : {}),
    }),
  );
}

function readStorage(): AppState {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    return stored ? normalizeStorage(stored) : DEFAULT_STATE;
  } catch {
    return DEFAULT_STATE;
  }
}

function readLocalRaw(): string | null {
  try {
    return window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

function writeLocalCache(next: AppState): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Storage may be unavailable; keep the in-memory copy.
  }
}

let cache: AppState | null = null;
let serverReady = false;
let hydrationPromise: Promise<void> | null = null;
let pendingSave: AppState | null = null;
let saving = false;
let retryTimer: number | null = null;
const listeners = new Set<() => void>();

export function getSnapshot(): AppState {
  if (cache === null) cache = readStorage();
  return cache;
}

// The page is statically rendered, so show the seeded board until the client
// has a chance to load the server copy.
export function getServerSnapshot(): AppState {
  return DEFAULT_STATE;
}

export function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function applyState(next: AppState): void {
  cache = next;
  if (typeof window !== "undefined") writeLocalCache(next);
  listeners.forEach((listener) => listener());
}

export function setState(next: AppState): void {
  applyState(next);
  if (serverReady) queueServerSave(next);
}

// localStorage remains a cache so the board still opens while the request is
// in flight. The server file is the source of truth once hydration finishes.
export function hydrateFromServer(): Promise<void> {
  hydrationPromise ??= hydrate();
  return hydrationPromise;
}

async function hydrate(): Promise<void> {
  const localRaw = readLocalRaw();

  try {
    const remote = await fetchBoard();
    if (remote) {
      applyState(remote.state);
      return;
    }

    // No server copy yet: migrate whatever this browser already had, or seed a
    // fresh server board from the defaults.
    const initial = localRaw ? normalizeLocal(localRaw) : (cache ?? DEFAULT_STATE);
    applyState(initial);
    queueServerSave(initial);
  } catch (error) {
    // Offline or an unavailable API should never block the local board.
    console.warn("Could not load the server board; using local data.", error);
  } finally {
    serverReady = true;
  }
}

function normalizeLocal(raw: string): AppState {
  try {
    return normalizeStorage(raw);
  } catch {
    return cache ?? DEFAULT_STATE;
  }
}

function queueServerSave(next: AppState): void {
  pendingSave = next;
  void flushServerSaves();
}

async function flushServerSaves(): Promise<void> {
  if (saving) return;
  saving = true;

  try {
    while (pendingSave) {
      const next = pendingSave;
      pendingSave = null;
      try {
        await saveBoard(next);
      } catch (error) {
        pendingSave = pendingSave ?? next;
        console.warn("Could not save the board to the server; retrying.", error);
        scheduleRetry();
        return;
      }
    }
    clearRetry();
  } finally {
    saving = false;
  }
}

function scheduleRetry(): void {
  if (typeof window === "undefined" || retryTimer !== null) return;
  retryTimer = window.setTimeout(() => {
    retryTimer = null;
    void flushServerSaves();
  }, 3_000);
}

function clearRetry(): void {
  if (retryTimer === null || typeof window === "undefined") return;
  window.clearTimeout(retryTimer);
  retryTimer = null;
}

// Keep multiple tabs in sync.
export function refreshFromStorage(): void {
  cache = readStorage();
  listeners.forEach((listener) => listener());
}
