"use client";

import { useSyncExternalStore } from "react";

type Task = {
  id: string;
  text: string;
  done: boolean;
};

type TasksByCategory = Record<string, Task[]>;

const STORAGE_KEY = "second-brain.tasks.v1";

const CATEGORIES = [
  { id: "spring", label: "Before end of spring semester" },
  { id: "summer", label: "Summer" },
  ...Array.from({ length: 15 }, (_, index) => ({
    id: `week-${index + 1}`,
    label: `Week ${index + 1}`,
  })),
];

const EMPTY: TasksByCategory = {};
let cache: TasksByCategory | null = null;
const listeners = new Set<() => void>();

function readStorage(): TasksByCategory {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    return stored ? (JSON.parse(stored) as TasksByCategory) : EMPTY;
  } catch {
    return EMPTY;
  }
}

function getSnapshot(): TasksByCategory {
  if (cache === null) cache = readStorage();
  return cache;
}

function getServerSnapshot(): TasksByCategory {
  return EMPTY;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function setTasks(next: TasksByCategory) {
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
  const tasksByCategory = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot,
  );

  function addTask(categoryId: string, form: HTMLFormElement) {
    const data = new FormData(form);
    const text = String(data.get("text") ?? "").trim();
    if (!text) return;

    const task: Task = { id: crypto.randomUUID(), text, done: false };
    const current = getSnapshot();
    setTasks({
      ...current,
      [categoryId]: [...(current[categoryId] ?? []), task],
    });
    form.reset();
  }

  function toggleTask(categoryId: string, taskId: string) {
    const current = getSnapshot();
    setTasks({
      ...current,
      [categoryId]: (current[categoryId] ?? []).map((task) =>
        task.id === taskId ? { ...task, done: !task.done } : task,
      ),
    });
  }

  function removeTask(categoryId: string, taskId: string) {
    const current = getSnapshot();
    setTasks({
      ...current,
      [categoryId]: (current[categoryId] ?? []).filter(
        (task) => task.id !== taskId,
      ),
    });
  }

  return (
    <div className="mx-auto w-full max-w-2xl px-6 py-12">
      <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
        Categories
      </h1>
      <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
        Add tasks under the part of the year they belong to.
      </p>

      <div className="mt-10 flex flex-col gap-10">
        {CATEGORIES.map((category) => {
          const tasks = tasksByCategory[category.id] ?? [];
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
