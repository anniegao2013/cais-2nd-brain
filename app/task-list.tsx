"use client";

import { useSyncExternalStore } from "react";

type Task = {
  id: string;
  text: string;
  done: boolean;
  isDefault?: boolean;
};

type TasksByCategory = Record<string, Task[]>;

type AppState = {
  tasks: TasksByCategory;
  removedDefaults: string[];
};

const STORAGE_KEY = "second-brain.tasks.v1";

const CATEGORIES = [
  { id: "spring", label: "Before end of spring semester" },
  { id: "summer", label: "Summer" },
  ...Array.from({ length: 15 }, (_, index) => ({
    id: `week-${index + 1}`,
    label: `Week ${index + 1}`,
  })),
];

const DEFAULT_EVENTS: Task[] = [
  "Handoffs",
  "Introductions",
  "First e-board meeting",
  "Confirm leads",
].map((text, index) => ({
  id: `default-${index + 1}`,
  text,
  done: false,
  isDefault: true,
}));

const DEFAULT_STATE: AppState = {
  tasks: { spring: DEFAULT_EVENTS },
  removedDefaults: [],
};

let cache: AppState | null = null;
const listeners = new Set<() => void>();

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

  const cleaned: TasksByCategory = {};
  for (const [categoryId, list] of Object.entries(tasks)) {
    cleaned[categoryId] = Array.isArray(list) ? list.filter(isTask) : [];
  }

  // Default events always exist unless they were deliberately removed.
  const presentIds = new Set(
    Object.values(cleaned).flatMap((list) => list.map((task) => task.id)),
  );
  for (const event of DEFAULT_EVENTS) {
    if (removedDefaults.includes(event.id) || presentIds.has(event.id)) continue;
    cleaned.spring = [...(cleaned.spring ?? []), { ...event }];
  }

  return { tasks: cleaned, removedDefaults };
}

function readStorage(): AppState {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    return stored ? normalizeStorage(stored) : DEFAULT_STATE;
  } catch {
    return DEFAULT_STATE;
  }
}

function getSnapshot(): AppState {
  if (cache === null) cache = readStorage();
  return cache;
}

function getServerSnapshot(): AppState {
  return DEFAULT_STATE;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function setState(next: AppState) {
  cache = next;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Storage may be unavailable; keep the in-memory copy.
  }
  listeners.forEach((listener) => listener());
}

// Keep multiple tabs in sync.
if (typeof window !== "undefined") {
  window.addEventListener("storage", (event) => {
    if (event.key === STORAGE_KEY) {
      cache = readStorage();
      listeners.forEach((listener) => listener());
    }
  });
}

export default function TaskList() {
  const state = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot,
  );

  function addTask(categoryId: string, form: HTMLFormElement) {
    const data = new FormData(form);
    const text = String(data.get("text") ?? "").trim();
    if (!text) return;

    const task: Task = { id: crypto.randomUUID(), text, done: false };
    setState({
      ...state,
      tasks: {
        ...state.tasks,
        [categoryId]: [...(state.tasks[categoryId] ?? []), task],
      },
    });
    form.reset();
  }

  function toggleTask(categoryId: string, taskId: string) {
    setState({
      ...state,
      tasks: {
        ...state.tasks,
        [categoryId]: (state.tasks[categoryId] ?? []).map((task) =>
          task.id === taskId ? { ...task, done: !task.done } : task,
        ),
      },
    });
  }

  function removeTask(categoryId: string, taskId: string) {
    setState({
      ...state,
      tasks: {
        ...state.tasks,
        [categoryId]: (state.tasks[categoryId] ?? []).filter(
          (task) => task.id !== taskId,
        ),
      },
      removedDefaults: state.removedDefaults.includes(taskId)
        ? state.removedDefaults
        : [...state.removedDefaults, taskId],
    });
  }

  function moveTask(fromCategoryId: string, taskId: string, toCategoryId: string) {
    if (fromCategoryId === toCategoryId) return;

    const task = (state.tasks[fromCategoryId] ?? []).find(
      (candidate) => candidate.id === taskId,
    );
    if (!task) return;

    setState({
      ...state,
      tasks: {
        ...state.tasks,
        [fromCategoryId]: (state.tasks[fromCategoryId] ?? []).filter(
          (candidate) => candidate.id !== taskId,
        ),
        [toCategoryId]: [...(state.tasks[toCategoryId] ?? []), task],
      },
    });
  }

  return (
    <div className="mx-auto w-full max-w-2xl px-6 py-12">
      <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
        Categories
      </h1>
      <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
        Add tasks under the part of the year they belong to. Default events are
        already listed and can be moved to another section.
      </p>

      <div className="mt-10 flex flex-col gap-10">
        {CATEGORIES.map((category) => {
          const tasks = state.tasks[category.id] ?? [];
          const remaining = tasks.filter((task) => !task.done).length;

          return (
            <section key={category.id} aria-labelledby={`${category.id}-heading`}>
              <div className="flex items-baseline justify-between gap-4">
                <h2
                  id={`${category.id}-heading`}
                  className="text-base font-medium text-zinc-900 dark:text-zinc-100"
                >
                  {category.label}
                </h2>
                <span className="shrink-0 text-xs tabular-nums text-zinc-400 dark:text-zinc-500">
                  {remaining} open
                </span>
              </div>

              {tasks.length > 0 && (
                <ul className="mt-3 flex flex-col divide-y divide-zinc-200 border-y border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
                  {tasks.map((task) => (
                    <li
                      key={task.id}
                      className="group flex items-center gap-3 py-2.5"
                    >
                      <input
                        type="checkbox"
                        checked={task.done}
                        onChange={() => toggleTask(category.id, task.id)}
                        aria-label={`Mark "${task.text}" as ${
                          task.done ? "not done" : "done"
                        }`}
                        className="size-4 shrink-0 accent-zinc-900 dark:accent-zinc-100"
                      />
                      <span
                        className={`flex-1 text-sm ${
                          task.done
                            ? "text-zinc-400 line-through dark:text-zinc-500"
                            : "text-zinc-700 dark:text-zinc-300"
                        }`}
                      >
                        {task.text}
                      </span>
                      <select
                        value={category.id}
                        onChange={(event) =>
                          moveTask(category.id, task.id, event.target.value)
                        }
                        aria-label={`Move "${task.text}" to another section`}
                        className="h-7 shrink-0 rounded-md border border-zinc-200 bg-transparent px-1.5 text-xs text-zinc-500 transition-colors hover:text-zinc-900 focus:border-zinc-400 focus:outline-none dark:border-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-100 dark:focus:border-zinc-600"
                      >
                        {CATEGORIES.map((option) => (
                          <option key={option.id} value={option.id}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        onClick={() => removeTask(category.id, task.id)}
                        aria-label={`Delete "${task.text}"`}
                        className="text-sm text-zinc-400 opacity-0 transition-opacity hover:text-zinc-900 focus:opacity-100 group-hover:opacity-100 dark:text-zinc-500 dark:hover:text-zinc-100"
                      >
                        ×
                      </button>
                    </li>
                  ))}
                </ul>
              )}

              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  addTask(category.id, event.currentTarget);
                }}
                className="mt-3 flex gap-2"
              >
                <input
                  name="text"
                  placeholder="Add a task…"
                  aria-label={`Add a task to ${category.label}`}
                  autoComplete="off"
                  className="h-9 flex-1 rounded-md border border-zinc-200 bg-white px-3 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-400 focus:outline-none dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-500 dark:focus:border-zinc-600"
                />
                <button
                  type="submit"
                  className="h-9 shrink-0 rounded-md bg-zinc-900 px-3 text-sm font-medium text-white transition-colors hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
                >
                  Add
                </button>
              </form>
            </section>
          );
        })}
      </div>
    </div>
  );
}
