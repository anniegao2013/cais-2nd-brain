"use client";

import { useSyncExternalStore } from "react";

type Task = {
  id: string;
  text: string;
  done: boolean;
  isDefault?: boolean;
  recruitment?: boolean;
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

// Seeded tasks. Keep each id stable: stored moves and deletions reference it.
const DEFAULT_EVENTS: Array<{
  id: string;
  text: string;
  category: string;
  recruitment?: boolean;
}> = [
  { id: "default-1", text: "Handoffs", category: "spring" },
  { id: "default-2", text: "Introductions", category: "spring" },
  { id: "default-3", text: "First e-board meeting", category: "spring" },
  { id: "default-4", text: "Confirm leads", category: "spring" },
  { id: "default-5", text: "Fall project sourcing", category: "summer" },
  { id: "default-6", text: "Curriculum edits", category: "summer" },
  {
    id: "default-7",
    text: "Recruitment prep",
    category: "summer",
    recruitment: true,
  },
  { id: "default-8", text: "Sponsorship outreach", category: "summer" },
  { id: "default-9", text: "RSO re-recognition", category: "summer" },
  {
    id: "default-10",
    text: "Open written apps",
    category: "week-1",
    recruitment: true,
  },
  {
    id: "default-11",
    text: "Classification",
    category: "week-4",
    recruitment: true,
  },
  { id: "default-12", text: "Retreat", category: "week-8" },
  { id: "default-13", text: "Midsem ShowCAIS", category: "week-11" },
  { id: "default-14", text: "OpenShowCAIS", category: "week-15" },
  {
    id: "default-15",
    text: "Written delibs",
    category: "week-3",
    recruitment: true,
  },
  {
    id: "default-16",
    text: "Group interviews",
    category: "week-3",
    recruitment: true,
  },
  {
    id: "default-17",
    text: "Individual interviews",
    category: "week-4",
    recruitment: true,
  },
  { id: "default-18", text: "Big little reveal", category: "week-10" },
  { id: "default-19", text: "Spring project sourcing", category: "week-7" },
];

// Recruitment tasks must stay in this relative order when moved.
const RECRUITMENT_CHAIN = [
  "default-7",
  "default-10",
  "default-15",
  "default-16",
  "default-17",
  "default-11",
];

const DEFAULT_BY_ID = new Map(DEFAULT_EVENTS.map((event) => [event.id, event]));

// Additional ordering rules: `task` must happen after `after`.
const DEPENDENCIES = [
  { task: "default-18", after: "default-12" }, // Big little reveal after Retreat
];

const PRECEDENCE_EDGES: Array<[string, string]> = [
  ...RECRUITMENT_CHAIN.slice(1).map(
    (id, index) => [RECRUITMENT_CHAIN[index], id] as [string, string],
  ),
  ...DEPENDENCIES.map(({ after, task }) => [after, task] as [string, string]),
];

// PRECEDES: id -> tasks that must come after it. FOLLOWS: id -> tasks before it.
const PRECEDES = new Map<string, string[]>();
const FOLLOWS = new Map<string, string[]>();
for (const [before, after] of PRECEDENCE_EDGES) {
  PRECEDES.set(before, [...(PRECEDES.get(before) ?? []), after]);
  FOLLOWS.set(after, [...(FOLLOWS.get(after) ?? []), before]);
}

const SEQUENCED_IDS = new Set(PRECEDENCE_EDGES.flat());

function traverse(startId: string, edges: Map<string, string[]>): Set<string> {
  const seen = new Set<string>();
  const stack = [...(edges.get(startId) ?? [])];
  while (stack.length > 0) {
    const id = stack.pop();
    if (id === undefined || seen.has(id)) continue;
    seen.add(id);
    stack.push(...(edges.get(id) ?? []));
  }
  return seen;
}

// Sort only tasks that have ordering rules, leaving other tasks in their slots.
function sortSequenced(tasks: Task[]): Task[] {
  const positions: number[] = [];
  const nodes: Task[] = [];
  tasks.forEach((task, index) => {
    if (SEQUENCED_IDS.has(task.id)) {
      positions.push(index);
      nodes.push(task);
    }
  });
  if (nodes.length < 2) return tasks;

  const nodeIds = new Set(nodes.map((node) => node.id));
  const indegree = new Map(nodes.map((node) => [node.id, 0]));
  const outgoing = new Map<string, Set<string>>();

  for (const [before, after] of PRECEDENCE_EDGES) {
    if (!nodeIds.has(before) || !nodeIds.has(after)) continue;
    const targets = outgoing.get(before) ?? new Set<string>();
    if (targets.has(after)) continue;
    targets.add(after);
    outgoing.set(before, targets);
    indegree.set(after, (indegree.get(after) ?? 0) + 1);
  }

  const ordered: Task[] = [];
  const remaining = [...nodes];
  while (remaining.length > 0) {
    // Stable choice: earliest task whose predecessors are all placed.
    const pick = remaining.findIndex(
      (node) => (indegree.get(node.id) ?? 0) === 0,
    );
    if (pick === -1) break; // Guard against a cycle.

    const [node] = remaining.splice(pick, 1);
    ordered.push(node);
    for (const target of outgoing.get(node.id) ?? []) {
      indegree.set(target, (indegree.get(target) ?? 0) - 1);
    }
  }
  ordered.push(...remaining);

  const sorted = [...tasks];
  positions.forEach((position, index) => {
    sorted[position] = ordered[index];
  });
  return sorted;
}

function sortState(state: AppState): AppState {
  const tasks: TasksByCategory = {};
  for (const [categoryId, list] of Object.entries(state.tasks)) {
    tasks[categoryId] = sortSequenced(list);
  }
  return { ...state, tasks };
}

function categoryIndex(categoryId: string): number {
  return CATEGORIES.findIndex((category) => category.id === categoryId);
}

function findTask(
  state: AppState,
  taskId: string,
): { categoryId: string; task: Task } | null {
  for (const [categoryId, list] of Object.entries(state.tasks)) {
    const task = list.find((candidate) => candidate.id === taskId);
    if (task) return { categoryId, task };
  }
  return null;
}

// A sequenced task may not move before a predecessor or after a successor.
function sequenceBounds(
  state: AppState,
  taskId: string,
): { min: number; max: number } {
  if (!SEQUENCED_IDS.has(taskId)) {
    return { min: 0, max: CATEGORIES.length - 1 };
  }

  let min = 0;
  let max = CATEGORIES.length - 1;
  for (const id of traverse(taskId, FOLLOWS)) {
    const location = findTask(state, id);
    if (location) min = Math.max(min, categoryIndex(location.categoryId));
  }
  for (const id of traverse(taskId, PRECEDES)) {
    const location = findTask(state, id);
    if (location) max = Math.min(max, categoryIndex(location.categoryId));
  }
  return { min, max };
}

function buildDefaultState(): AppState {
  const tasks: TasksByCategory = {};
  for (const event of DEFAULT_EVENTS) {
    tasks[event.category] = [
      ...(tasks[event.category] ?? []),
      {
        id: event.id,
        text: event.text,
        done: false,
        isDefault: true,
        recruitment: event.recruitment,
      },
    ];
  }
  return sortState({ tasks, removedDefaults: [] });
}

const DEFAULT_STATE: AppState = buildDefaultState();

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
    cleaned[categoryId] = Array.isArray(list)
      ? list.filter(isTask).map((task) => {
          const seed = DEFAULT_BY_ID.get(task.id);
          return seed?.recruitment && !task.recruitment
            ? { ...task, recruitment: true }
            : task;
        })
      : [];
  }

  // Default events always exist unless they were deliberately removed.
  const presentIds = new Set(
    Object.values(cleaned).flatMap((list) => list.map((task) => task.id)),
  );
  for (const event of DEFAULT_EVENTS) {
    if (removedDefaults.includes(event.id) || presentIds.has(event.id)) continue;
    cleaned[event.category] = [
      ...(cleaned[event.category] ?? []),
      {
        id: event.id,
        text: event.text,
        done: false,
        isDefault: true,
        recruitment: event.recruitment,
      },
    ];
  }

  return sortState({ tasks: cleaned, removedDefaults });
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

    const bounds = sequenceBounds(state, taskId);
    const targetIndex = categoryIndex(toCategoryId);
    if (targetIndex < bounds.min || targetIndex > bounds.max) return;

    setState(
      sortState({
        ...state,
        tasks: {
          ...state.tasks,
          [fromCategoryId]: (state.tasks[fromCategoryId] ?? []).filter(
            (candidate) => candidate.id !== taskId,
          ),
          [toCategoryId]: [...(state.tasks[toCategoryId] ?? []), task],
        },
      }),
    );
  }

  return (
    <div className="mx-auto w-full max-w-2xl px-6 py-12">
      <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
        Categories
      </h1>
      <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
        Add tasks under the part of the year they belong to. Default events are
        already listed and can be moved to another section. Recruitment events
        are tagged and stay in their required order.
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
                  {tasks.map((task) => {
                    const bounds = sequenceBounds(state, task.id);
                    return (
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
                      {task.recruitment && (
                        <span className="shrink-0 rounded border border-zinc-200 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
                          Recruitment
                        </span>
                      )}
                      <select
                        value={category.id}
                        onChange={(event) =>
                          moveTask(category.id, task.id, event.target.value)
                        }
                        aria-label={`Move "${task.text}" to another section`}
                        className="h-7 shrink-0 rounded-md border border-zinc-200 bg-transparent px-1.5 text-xs text-zinc-500 transition-colors hover:text-zinc-900 focus:border-zinc-400 focus:outline-none dark:border-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-100 dark:focus:border-zinc-600"
                      >
                        {CATEGORIES.map((option, optionIndex) => (
                          <option
                            key={option.id}
                            value={option.id}
                            disabled={
                              optionIndex < bounds.min ||
                              optionIndex > bounds.max
                            }
                          >
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
                    );
                  })}
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
