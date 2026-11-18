import {
  DEFAULT_BY_ID,
  DEFAULT_DEPENDENCIES,
  DEFAULT_EVENTS,
  DEFAULT_STATE,
} from "./defaults";
import {
  BoardConflictError,
  fetchBoard,
  saveBoard,
  type BoardResponse,
} from "./board-api";
import { isMonthKey, isISODate } from "./calendar";
import { normalizeDeletedBatches } from "./deleted-tasks";
import {
  emptyHistory,
  recordHistory,
  type History,
} from "./history";
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
  const deletedTasks = normalizeDeletedBatches(
    parsed && typeof parsed === "object" && "deletedTasks" in parsed
      ? (parsed as AppState).deletedTasks
      : undefined,
  );

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
      ...(deletedTasks.length > 0 ? { deletedTasks } : {}),
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
// A history entry pairs the board with the action that produced the state it
// replaces, so the Undo and Redo controls can name what they will reverse.
type HistoryEntry = { state: AppState; label: string };
let history: History<HistoryEntry> = emptyHistory();
let serverReady = false;
let hydrationPromise: Promise<void> | null = null;
let pendingSave: AppState | null = null;
let saving = false;
let retryTimer: number | null = null;
// The server copy this tab last loaded or wrote, and the token that proves it.
let remoteVersion: string | null = null;
let remoteCopy: BoardResponse | null = null;
// "Keep mine" replaces the newer server copy without a precondition.
let forceNextSave = false;
let noteTimer: number | null = null;
const listeners = new Set<() => void>();

export type SaveStatus = "idle" | "saving" | "saved" | "offline" | "conflict";

export type SaveStatusSnapshot = {
  status: SaveStatus;
  // ISO timestamp of the last successful server write.
  updatedAt: string | null;
  // Set when a save was rejected because another writer got there first.
  conflict: boolean;
  // When that newer copy was written, for the banner's wording.
  remoteUpdatedAt: string | null;
  // A short-lived notice that a newer copy was loaded automatically.
  note: string | null;
};

const SERVER_SAVE_STATUS: SaveStatusSnapshot = {
  status: "idle",
  updatedAt: null,
  conflict: false,
  remoteUpdatedAt: null,
  note: null,
};
let saveStatusSnapshot: SaveStatusSnapshot = SERVER_SAVE_STATUS;
const saveStatusListeners = new Set<() => void>();

function updateSaveStatus(patch: Partial<SaveStatusSnapshot>): void {
  const next = { ...saveStatusSnapshot, ...patch };
  if (
    next.status === saveStatusSnapshot.status &&
    next.updatedAt === saveStatusSnapshot.updatedAt &&
    next.conflict === saveStatusSnapshot.conflict &&
    next.remoteUpdatedAt === saveStatusSnapshot.remoteUpdatedAt &&
    next.note === saveStatusSnapshot.note
  ) {
    return;
  }
  saveStatusSnapshot = next;
  saveStatusListeners.forEach((listener) => listener());
}

export function subscribeSaveStatus(listener: () => void): () => void {
  saveStatusListeners.add(listener);
  return () => {
    saveStatusListeners.delete(listener);
  };
}

export function getSaveStatusSnapshot(): SaveStatusSnapshot {
  return saveStatusSnapshot;
}

// The page is statically rendered, so it has no save state yet.
export function getSaveStatusServerSnapshot(): SaveStatusSnapshot {
  return SERVER_SAVE_STATUS;
}

export function getSnapshot(): AppState {
  if (cache === null) cache = readStorage();
  return cache;
}

// The page is statically rendered, so show the seeded board until the client
// has a chance to load the server copy.
export function getServerSnapshot(): AppState {
  return DEFAULT_STATE;
}

// Reset needs a fresh copy so edits cannot mutate the shared seed, and so the
// reset is a new object that the history stack can record.
export function defaultBoardState(): AppState {
  return snapshot(DEFAULT_STATE);
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

// Apply a non-user update, such as materializing recurring tasks. It does not
// create an undo step.
export function setState(next: AppState): void {
  applyState(next);
  if (serverReady) queueServerSave(next);
}

// Every board edit goes through here so it can be undone with the same
// snapshot that was on screen before the edit. The label names the action that
// is about to happen, so Undo can say "Undo deleted task".
export function commitState(next: AppState, label: string = "Changed board"): void {
  const current = getSnapshot();
  if (current === next) return;
  history = recordHistory(history, { state: snapshot(current), label });
  setState(next);
}

export function canUndo(): boolean {
  return history.past.length > 0;
}

export function canRedo(): boolean {
  return history.future.length > 0;
}

export function getUndoLabel(): string | null {
  return history.past[history.past.length - 1]?.label ?? null;
}

export function getRedoLabel(): string | null {
  return history.future[history.future.length - 1]?.label ?? null;
}

export function undo(): void {
  const entry = history.past[history.past.length - 1];
  if (!entry) return;
  const current: HistoryEntry = {
    state: snapshot(getSnapshot()),
    label: entry.label,
  };
  history = {
    past: history.past.slice(0, -1),
    future: [...history.future, current],
  };
  setState(entry.state);
}

export function redo(): void {
  const entry = history.future[history.future.length - 1];
  if (!entry) return;
  const current: HistoryEntry = {
    state: snapshot(getSnapshot()),
    label: entry.label,
  };
  history = {
    past: [...history.past, current],
    future: history.future.slice(0, -1),
  };
  setState(entry.state);
}

function snapshot(state: AppState): AppState {
  if (typeof structuredClone === "function") return structuredClone(state);
  return JSON.parse(JSON.stringify(state)) as AppState;
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
      history = emptyHistory();
      applyState(remote.state);
      remoteVersion = remote.version || null;
      remoteCopy = remote;
      updateSaveStatus({
        status: "saved",
        updatedAt: remote.updatedAt || new Date().toISOString(),
      });
      return;
    }

    // No server copy yet: migrate whatever this browser already had, or seed a
    // fresh server board from the defaults.
    const initial = localRaw ? normalizeLocal(localRaw) : (cache ?? DEFAULT_STATE);
    history = emptyHistory();
    applyState(initial);
    queueServerSave(initial);
  } catch (error) {
    // Offline or an unavailable API should never block the local board.
    console.warn("Could not load the server board; using local data.", error);
    updateSaveStatus({ status: "offline" });
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
  // While a conflict is open, local edits stay in this browser until the user
  // chooses which copy to keep. Sending them would overwrite the newer board.
  if (saveStatusSnapshot.conflict) return;
  updateSaveStatus({ status: "saving" });
  void flushServerSaves();
}

// Compare board copies by value, not key order: the server normalizes a save
// before writing it, so the same board can serialize with different key order.
function canonical(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map((item) => canonical(item ?? null)).join(",")}]`;
  }
  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, item]) => item !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
      .map(([key, item]) => `${JSON.stringify(key)}:${canonical(item)}`);
    return `{${entries.join(",")}}`;
  }
  return JSON.stringify(value) ?? "null";
}

function boardsMatch(a: AppState, b: AppState): boolean {
  try {
    return canonical(a) === canonical(b);
  } catch {
    return false;
  }
}

async function flushServerSaves(): Promise<void> {
  if (saving) return;
  saving = true;
  let savedAny = false;

  try {
    while (pendingSave) {
      const next = pendingSave;
      pendingSave = null;
      // "Keep mine" skips the precondition until one save actually lands.
      const expected = forceNextSave ? undefined : (remoteVersion ?? undefined);
      try {
        const board = await saveBoard(next, expected);
        forceNextSave = false;
        remoteVersion = board.version || null;
        remoteCopy = board;
        savedAny = true;
      } catch (error) {
        if (error instanceof BoardConflictError) {
          // Another tab or teammate saved first. Keep this tab's copy on screen
          // and let the banner decide which one wins.
          forceNextSave = false;
          pendingSave = null;
          updateSaveStatus({
            status: "conflict",
            conflict: true,
            remoteUpdatedAt: error.board.updatedAt || null,
          });
          remoteVersion = error.board.version || null;
          remoteCopy = error.board;

          // The rejected write was already identical to the server copy, so
          // there is nothing to choose and no reason to alarm anyone.
          if (boardsMatch(next, error.board.state)) {
            updateSaveStatus({
              status: "saved",
              updatedAt: error.board.updatedAt || new Date().toISOString(),
              conflict: false,
              remoteUpdatedAt: null,
            });
            continue;
          }
          return;
        }

        pendingSave = pendingSave ?? next;
        console.warn("Could not save the board to the server; retrying.", error);
        updateSaveStatus({ status: "offline" });
        scheduleRetry();
        return;
      }
    }
    clearRetry();
    if (savedAny) {
      updateSaveStatus({
        status: "saved",
        updatedAt: new Date().toISOString(),
      });
    }
  } finally {
    saving = false;
    // A save can be queued by an edit that lands while this pass is finishing.
    // Pick it up unless a retry or a conflict decision is already pending.
    if (
      pendingSave &&
      saveStatusSnapshot.status !== "offline" &&
      !saveStatusSnapshot.conflict
    ) {
      void flushServerSaves();
    }
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

// Adopt a copy written somewhere else. Undo history belongs to the copy that
// was replaced, so it is dropped rather than replayed onto the new board.
function adoptRemote(remote: BoardResponse): void {
  history = emptyHistory();
  pendingSave = null;
  applyState(remote.state);
  remoteVersion = remote.version || null;
  remoteCopy = remote;
  updateSaveStatus({
    status: "saved",
    updatedAt: remote.updatedAt || new Date().toISOString(),
    conflict: false,
    remoteUpdatedAt: null,
  });
  showSyncNote("Loaded newer changes from the shared board.");
}

function showSyncNote(message: string): void {
  if (typeof window === "undefined") return;
  updateSaveStatus({ note: message });
  if (noteTimer !== null) window.clearTimeout(noteTimer);
  noteTimer = window.setTimeout(() => {
    noteTimer = null;
    updateSaveStatus({ note: null });
  }, 8_000);
}

// The conflict banner's "Load latest": replace this tab's board with the copy
// that won the save.
export function loadLatestBoard(): void {
  const remote = remoteCopy;
  if (remote) {
    adoptRemote(remote);
    return;
  }

  void fetchBoard()
    .then((board) => {
      if (board) adoptRemote(board);
    })
    .catch(() => undefined);
}

// The conflict banner's "Keep mine": write this tab's copy over the newer one,
// deliberately skipping the precondition.
export function keepLocalBoard(): void {
  forceNextSave = true;
  pendingSave = getSnapshot();
  updateSaveStatus({
    status: "saving",
    conflict: false,
    remoteUpdatedAt: null,
  });
  void flushServerSaves();
}

const POLL_INTERVAL_MS = 15_000;

function isFormFocused(): boolean {
  const active = document.activeElement as HTMLElement | null;
  if (!active) return false;
  if (active.isContentEditable) return true;
  const tag = active.tagName;
  if (tag === "TEXTAREA" || tag === "SELECT") return true;
  if (tag !== "INPUT") return false;
  // A focused checkbox or button is not a draft; syncing under it is safe.
  const type = (active as HTMLInputElement).type;
  return ![
    "checkbox",
    "radio",
    "button",
    "submit",
    "reset",
    "range",
    "color",
    "file",
  ].includes(type);
}

// Watch the shared copy while the tab is visible. A newer board is applied
// straight away when this tab has nothing in flight; otherwise the next save's
// precondition raises the banner so neither side is lost.
export function startRemoteSync(): () => void {
  if (typeof window === "undefined") return () => {};
  let stopped = false;

  async function check() {
    if (stopped) return;
    if (!serverReady || saving || pendingSave) return;
    if (saveStatusSnapshot.conflict) return;
    if (document.visibilityState === "hidden") return;

    try {
      const remote = await fetchBoard();
      if (stopped || !remote) return;
      if (remoteVersion !== null && remote.version === remoteVersion) return;
      if (remoteVersion === null) {
        // First look before the initial write lands: remember it, don't apply.
        remoteVersion = remote.version || null;
        remoteCopy = remote;
        return;
      }

      remoteCopy = remote;
      // Never pull the board out from under someone mid-edit. Their pending
      // save will conflict instead, which is the recoverable path.
      if (isFormFocused()) return;
      if (saving || pendingSave) return;
      adoptRemote(remote);
    } catch {
      // Polling is best-effort; the save path owns offline reporting.
    }
  }

  const timer = window.setInterval(() => void check(), POLL_INTERVAL_MS);
  function handleVisible() {
    if (document.visibilityState === "visible") void check();
  }
  document.addEventListener("visibilitychange", handleVisible);
  window.addEventListener("focus", handleVisible);

  return () => {
    stopped = true;
    window.clearInterval(timer);
    document.removeEventListener("visibilitychange", handleVisible);
    window.removeEventListener("focus", handleVisible);
  };
}

// Keep multiple tabs in sync. A change from another tab invalidates the local
// undo path because this tab no longer has the previous shared state.
export function refreshFromStorage(): void {
  history = emptyHistory();
  cache = readStorage();
  listeners.forEach((listener) => listener());
  storageGeneration += 1;
  void alignVersionWithStorageCopy(storageGeneration);
}

let storageGeneration = 0;

// Another tab in this browser just wrote the shared cache. That tab's server
// save may still be in flight, so retry briefly: once the server holds this
// content, adopt its version and the next save is not a false conflict. A
// genuinely different server copy keeps the old token, which lets the
// precondition raise the conflict banner instead of overwriting it.
async function alignVersionWithStorageCopy(generation: number): Promise<void> {
  if (!serverReady) return;

  for (const delay of [0, 400, 900, 1800]) {
    if (delay > 0) {
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
    if (generation !== storageGeneration) return;

    try {
      const remote = await fetchBoard();
      if (generation !== storageGeneration || !remote) return;
      remoteCopy = remote;
      // Compare the current copy: an edit made while the request was in flight
      // must not inherit the remote token.
      if (boardsMatch(getSnapshot(), remote.state)) {
        remoteVersion = remote.version || null;
        return;
      }
    } catch {
      // Leave the version alone; the save path will report a real failure.
      return;
    }
  }
}
