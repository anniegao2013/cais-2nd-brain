"use client";

import { useSyncExternalStore, useState } from "react";

type Task = {
  id: string;
  text: string;
  done: boolean;
  isDefault?: boolean;
  recruitment?: boolean;
  parentId?: string;
  leadWeeks?: number;
  notes?: string;
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
  parentId?: string;
  leadWeeks?: number;
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
  // Retreat is in week 8, so this lands four weeks earlier in week 4. It must
  // stay at least four sections earlier and shifts along with Retreat.
  {
    id: "default-20",
    text: "Submit gift fund request for Airbnb",
    category: "week-4",
    parentId: "default-12",
    leadWeeks: 4,
  },
  {
    id: "default-21",
    text: "Book a room for classification",
    category: "week-2",
    parentId: "default-11",
  },
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

// Additional ordering rules: `task` must happen after `after`.
const DEPENDENCIES = [
  { task: "default-18", after: "default-12" }, // Big little reveal after Retreat
];

const DEFAULT_BY_ID = new Map(DEFAULT_EVENTS.map((event) => [event.id, event]));

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

// Subtasks may only be scheduled in their parent's section or earlier, and a
// parent may not move before any of its subtasks. Subtasks with a leadWeeks
// offset shift with the parent and must stay at least that far ahead of it.
function moveBounds(
  state: AppState,
  task: Task,
): { min: number; max: number } {
  const bounds = sequenceBounds(state, task.id);

  if (task.parentId) {
    const parent = findTask(state, task.parentId);
    if (parent) {
      bounds.max = Math.min(
        bounds.max,
        categoryIndex(parent.categoryId) - (task.leadWeeks ?? 0),
      );
    }
    return bounds;
  }

  const parentLocation = findTask(state, task.id);
  if (!parentLocation) return bounds;
  const parentIndex = categoryIndex(parentLocation.categoryId);

  for (const [categoryId, list] of Object.entries(state.tasks)) {
    for (const candidate of list) {
      if (candidate.parentId !== task.id) continue;

      if (candidate.leadWeeks !== undefined) {
        // This subtask moves with the parent, so only the gap limits it.
        bounds.min = Math.max(
          bounds.min,
          parentIndex - categoryIndex(categoryId),
        );
      } else {
        bounds.min = Math.max(bounds.min, categoryIndex(categoryId));
      }
    }
  }
  return bounds;
}

// Keep subtasks from ending up after their parent if old data is inconsistent.
function sanitizeSubtaskPlacement(state: AppState): AppState {
  const location = new Map<string, string>();
  for (const [categoryId, list] of Object.entries(state.tasks)) {
    for (const task of list) location.set(task.id, categoryId);
  }

  const tasks: TasksByCategory = {};
  for (const [categoryId, list] of Object.entries(state.tasks)) {
    tasks[categoryId] = tasks[categoryId] ?? [];
    for (const task of list) {
      const parentCategory = task.parentId
        ? location.get(task.parentId)
        : undefined;

      if (!task.parentId) {
        tasks[categoryId].push(task);
      } else if (!parentCategory) {
        // Parent is gone; keep the task as a standalone item.
        tasks[categoryId].push({ ...task, parentId: undefined });
      } else {
        const latestIndex =
          categoryIndex(parentCategory) - (task.leadWeeks ?? 0);
        const targetIndex = Math.min(
          Math.max(categoryIndex(categoryId), 0),
          Math.max(latestIndex, 0),
        );
        const targetCategory = CATEGORIES[targetIndex].id;

        if (targetCategory === categoryId) {
          tasks[categoryId].push(task);
        } else {
          tasks[targetCategory] = [...tasks[targetCategory], task];
        }
      }
    }
  }

  return sortState({ ...state, tasks });
}

type NoteLine = { level: number; text: string };
type NoteNode = { text: string; children: NoteNode[] };

// Notes are stored one bullet per line. Leading whitespace sets the nesting
// level (a tab or two spaces per level); bullet markers are optional.
function parseNoteLines(raw: string): NoteLine[] {
  const lines: NoteLine[] = [];

  for (const rawLine of raw.split("\n")) {
    const indent = rawLine.match(/^[\t ]*/)?.[0] ?? "";
    const text = rawLine
      .slice(indent.length)
      .replace(/^[-*•]\s*/, "")
      .trim();
    if (!text) continue;

    const spaces = indent.replace(/\t/g, "  ").length;
    const level = Math.min(
      Math.ceil(spaces / 2),
      lines.length === 0 ? 0 : lines[lines.length - 1].level + 1,
    );
    lines.push({ level, text });
  }

  return lines;
}

function notesToTree(lines: NoteLine[]): NoteNode[] {
  const roots: NoteNode[] = [];
  const stack: NoteNode[] = [];

  for (const line of lines) {
    const node: NoteNode = { text: line.text, children: [] };
    if (line.level === 0 || stack.length === 0) {
      roots.push(node);
    } else {
      stack[Math.min(line.level, stack.length) - 1].children.push(node);
    }
    stack[line.level] = node;
    stack.length = line.level + 1;
  }

  return roots;
}

function cleanNotes(raw: string): string {
  return parseNoteLines(raw)
    .map((line) => `${"  ".repeat(line.level)}${line.text}`)
    .join("\n");
}

function NoteBullets({ nodes }: { nodes: NoteNode[] }) {
  return (
    <ul className="flex list-disc flex-col gap-1 pl-4 marker:text-zinc-400 dark:marker:text-zinc-600">
      {nodes.map((node, index) => (
        <li key={index}>
          {node.text}
          {node.children.length > 0 && <NoteBullets nodes={node.children} />}
        </li>
      ))}
    </ul>
  );
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
        parentId: event.parentId,
        leadWeeks: event.leadWeeks,
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
          let next = task;
          if (seed?.recruitment && !next.recruitment) {
            next = { ...next, recruitment: true };
          }
          if (seed?.leadWeeks !== undefined && next.leadWeeks === undefined) {
            next = { ...next, leadWeeks: seed.leadWeeks };
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
        recruitment: event.recruitment,
        parentId: event.parentId,
        leadWeeks: event.leadWeeks,
      },
    ];
    presentIds.add(event.id);
  }

  return sanitizeSubtaskPlacement({ tasks: cleaned, removedDefaults });
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
  const [subtaskParentId, setSubtaskParentId] = useState<string | null>(null);
  const [subtaskText, setSubtaskText] = useState("");
  const [subtaskCategoryId, setSubtaskCategoryId] = useState("");
  const [notesTaskId, setNotesTaskId] = useState<string | null>(null);
  const [notesDraft, setNotesDraft] = useState("");
  const [expandedTaskId, setExpandedTaskId] = useState<string | null>(null);

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

  function addSubtask(parentId: string) {
    const text = subtaskText.trim();
    if (!text) return;

    const parent = findTask(state, parentId);
    if (!parent) return;
    if (
      categoryIndex(subtaskCategoryId) > categoryIndex(parent.categoryId)
    ) {
      return;
    }

    const subtask: Task = {
      id: crypto.randomUUID(),
      text,
      done: false,
      parentId,
    };
    setState({
      ...state,
      tasks: {
        ...state.tasks,
        [subtaskCategoryId]: [
          ...(state.tasks[subtaskCategoryId] ?? []),
          subtask,
        ],
      },
    });
    setSubtaskParentId(null);
    setSubtaskText("");
  }

  function updateSubtaskLead(
    categoryId: string,
    taskId: string,
    rawLead: number,
  ) {
    const task = (state.tasks[categoryId] ?? []).find(
      (candidate) => candidate.id === taskId,
    );
    if (!task?.parentId) return;

    const parent = findTask(state, task.parentId);
    if (!parent) return;

    const parentIndex = categoryIndex(parent.categoryId);
    const lead = Math.max(
      0,
      Math.min(parentIndex, Math.floor(Number.isFinite(rawLead) ? rawLead : 0)),
    );
    const latestIndex = parentIndex - lead;

    const tasks: TasksByCategory = {};
    for (const [id, list] of Object.entries(state.tasks)) {
      tasks[id] = list.filter((candidate) => candidate.id !== taskId);
    }

    const nextTask: Task = { ...task };
    if (lead > 0) {
      nextTask.leadWeeks = lead;
    } else {
      delete nextTask.leadWeeks;
    }

    const targetIndex = Math.max(
      0,
      Math.min(categoryIndex(categoryId), latestIndex),
    );
    const targetCategory = CATEGORIES[targetIndex].id;
    tasks[targetCategory] = [...(tasks[targetCategory] ?? []), nextTask];

    setState(sortState({ ...state, tasks }));
  }

  function startEditingNotes(task: Task) {
    setExpandedTaskId(task.id);
    setNotesTaskId(task.id);
    setNotesDraft(task.notes ?? "");
    setSubtaskParentId(null);
  }

  function toggleExpanded(taskId: string) {
    setExpandedTaskId((current) => (current === taskId ? null : taskId));
    setNotesTaskId(null);
    setNotesDraft("");
  }

  function goToParent(parentId: string) {
    setExpandedTaskId(parentId);
    setNotesTaskId(null);
    setNotesDraft("");
    setSubtaskParentId(null);
    requestAnimationFrame(() => {
      document
        .getElementById(`task-${parentId}`)
        ?.scrollIntoView({ behavior: "smooth", block: "center" });
    });
  }

  function saveNotes(categoryId: string, taskId: string) {
    const notes = cleanNotes(notesDraft);
    setState({
      ...state,
      tasks: {
        ...state.tasks,
        [categoryId]: (state.tasks[categoryId] ?? []).map((task) => {
          if (task.id !== taskId) return task;
          if (!notes) {
            const next = { ...task };
            delete next.notes;
            return next;
          }
          return { ...task, notes };
        }),
      },
    });
    setNotesTaskId(null);
    setNotesDraft("");
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
    const task = (state.tasks[categoryId] ?? []).find(
      (candidate) => candidate.id === taskId,
    );
    if (!task) return;

    // Deleting a task also removes its subtasks.
    const removedIds = new Set<string>([taskId]);
    if (!task.parentId) {
      for (const list of Object.values(state.tasks)) {
        for (const candidate of list) {
          if (candidate.parentId === taskId) removedIds.add(candidate.id);
        }
      }
    }

    const tasks: TasksByCategory = {};
    for (const [id, list] of Object.entries(state.tasks)) {
      tasks[id] = list.filter((candidate) => !removedIds.has(candidate.id));
    }

    setState({
      ...state,
      tasks,
      removedDefaults: [
        ...new Set([...state.removedDefaults, ...removedIds]),
      ],
    });
    if (subtaskParentId === taskId) setSubtaskParentId(null);
    if (notesTaskId && removedIds.has(notesTaskId)) setNotesTaskId(null);
    if (expandedTaskId && removedIds.has(expandedTaskId)) {
      setExpandedTaskId(null);
    }
  }

  function moveTask(fromCategoryId: string, taskId: string, toCategoryId: string) {
    if (fromCategoryId === toCategoryId) return;

    const task = (state.tasks[fromCategoryId] ?? []).find(
      (candidate) => candidate.id === taskId,
    );
    if (!task) return;

    const bounds = moveBounds(state, task);
    const targetIndex = categoryIndex(toCategoryId);
    if (targetIndex < bounds.min || targetIndex > bounds.max) return;

    // Lead-time subtasks shift along with their parent to keep their gap.
    const delta = targetIndex - categoryIndex(fromCategoryId);
    const shifted = new Map<string, string>();
    if (!task.parentId) {
      for (const [categoryId, list] of Object.entries(state.tasks)) {
        for (const candidate of list) {
          if (
            candidate.parentId !== taskId ||
            candidate.leadWeeks === undefined
          ) {
            continue;
          }
          const newIndex = categoryIndex(categoryId) + delta;
          if (newIndex < 0 || newIndex >= CATEGORIES.length) return;
          shifted.set(candidate.id, CATEGORIES[newIndex].id);
        }
      }
    }

    const movingIds = new Set<string>([taskId, ...shifted.keys()]);
    const tasks: TasksByCategory = {};
    const movedSubtasks = new Map<string, Task>();
    for (const [categoryId, list] of Object.entries(state.tasks)) {
      tasks[categoryId] = [];
      for (const candidate of list) {
        if (movingIds.has(candidate.id)) {
          movedSubtasks.set(candidate.id, candidate);
        } else {
          tasks[categoryId].push(candidate);
        }
      }
    }

    tasks[toCategoryId] = [...(tasks[toCategoryId] ?? []), task];
    for (const [subtaskId, categoryId] of shifted) {
      const subtask = movedSubtasks.get(subtaskId);
      if (subtask) {
        tasks[categoryId] = [...(tasks[categoryId] ?? []), subtask];
      }
    }

    setState(sortState({ ...state, tasks }));
  }

  return (
    <div className="mx-auto w-full max-w-2xl px-6 py-12">
      <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
        Categories
      </h1>
      <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
        Add tasks under the part of the year they belong to. Default events are
        already listed and can be moved to another section. Use + to add a
        subtask in the same or an earlier section; open a subtask to edit its
        lead time. Click a task to expand its description; use Tab to indent
        bullets. Some tasks have ordering rules that are enforced
        automatically.
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
                    const parentLocation = task.parentId
                      ? findTask(state, task.parentId)
                      : null;
                    const parent = parentLocation?.task;
                    const parentMaxIndex = parentLocation
                      ? categoryIndex(parentLocation.categoryId)
                      : 0;
                    const isSubtask = Boolean(task.parentId);
                    const formOpen = subtaskParentId === task.id;
                    const notesOpen = notesTaskId === task.id;
                    const expanded = expandedTaskId === task.id;
                    const bounds = moveBounds(state, task);

                    return (
                      <li
                        key={task.id}
                        id={`task-${task.id}`}
                        className={`py-2.5 ${isSubtask ? "pl-6" : ""}`}
                      >
                        <div className="group flex items-center gap-3">
                          <input
                            type="checkbox"
                            checked={task.done}
                            onChange={() => toggleTask(category.id, task.id)}
                            aria-label={`Mark "${task.text}" as ${
                              task.done ? "not done" : "done"
                            }`}
                            className="size-4 shrink-0 accent-zinc-900 dark:accent-zinc-100"
                          />
                          <button
                            type="button"
                            onClick={() => toggleExpanded(task.id)}
                            aria-expanded={expanded}
                            aria-controls={`details-${task.id}`}
                            className={`flex flex-1 items-center gap-1.5 text-left text-sm ${
                              task.done
                                ? "text-zinc-400 line-through dark:text-zinc-500"
                                : "text-zinc-700 dark:text-zinc-300"
                            }`}
                          >
                            <span className="min-w-0 flex-1">{task.text}</span>
                            <span
                              aria-hidden
                              className="shrink-0 text-[10px] text-zinc-400 dark:text-zinc-500"
                            >
                              {expanded ? "▾" : "▸"}
                            </span>
                          </button>
                          {task.recruitment && (
                            <span className="shrink-0 rounded border border-zinc-200 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
                              Recruitment
                            </span>
                          )}
                          {!isSubtask && (
                            <button
                              type="button"
                              onClick={() => {
                                if (formOpen) {
                                  setSubtaskParentId(null);
                                  return;
                                }
                                setSubtaskParentId(task.id);
                                setSubtaskText("");
                                setSubtaskCategoryId(category.id);
                                setNotesTaskId(null);
                              }}
                              aria-label={`Add a subtask to "${task.text}"`}
                              aria-expanded={formOpen}
                              className="flex size-6 shrink-0 items-center justify-center rounded-md border border-zinc-200 text-xs text-zinc-500 transition-colors hover:text-zinc-900 dark:border-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-100"
                            >
                              +
                            </button>
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
                        </div>

                        {parent && (
                          <div className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 pl-7 text-xs text-zinc-500 dark:text-zinc-400">
                            <span>Subtask of</span>
                            <button
                              type="button"
                              onClick={() => goToParent(parent.id)}
                              className="font-medium text-zinc-700 underline-offset-2 transition-colors hover:text-zinc-900 hover:underline dark:text-zinc-200 dark:hover:text-zinc-50"
                            >
                              {parent.text}
                            </button>
                            <span aria-hidden>·</span>
                            <span>
                              {task.leadWeeks
                                ? `at least ${task.leadWeeks} week${
                                    task.leadWeeks === 1 ? "" : "s"
                                  } before`
                                : "can be scheduled the same week or earlier"}
                            </span>
                          </div>
                        )}

                        {expanded && (
                          <div id={`details-${task.id}`} className="mt-2 pl-7">
                            {parent && (
                              <button
                                type="button"
                                onClick={() => goToParent(parent.id)}
                                className="mb-2 inline-flex items-center gap-1 text-xs font-medium text-zinc-600 underline-offset-2 transition-colors hover:text-zinc-900 hover:underline dark:text-zinc-300 dark:hover:text-zinc-50"
                              >
                                ← Go to {parent.text}
                              </button>
                            )}
                            {task.parentId && parent && (
                              <div className="mb-3 rounded-md border border-zinc-200 p-3 dark:border-zinc-800">
                                <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-zinc-600 dark:text-zinc-300">
                                  <span className="font-medium text-zinc-900 dark:text-zinc-100">
                                    Lead time
                                  </span>
                                  <label
                                    htmlFor={`lead-${task.id}`}
                                    className="flex flex-wrap items-center gap-1.5"
                                  >
                                    <span>must be at least</span>
                                    <input
                                      id={`lead-${task.id}`}
                                      type="number"
                                      inputMode="numeric"
                                      min={0}
                                      max={Math.max(0, parentMaxIndex)}
                                      value={task.leadWeeks ?? 0}
                                      onChange={(event) =>
                                        updateSubtaskLead(
                                          category.id,
                                          task.id,
                                          Number(event.target.value),
                                        )
                                      }
                                      className="h-7 w-14 rounded-md border border-zinc-200 bg-white px-2 text-center text-xs tabular-nums text-zinc-900 focus:border-zinc-400 focus:outline-none dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100 dark:focus:border-zinc-600"
                                    />
                                    <span>
                                      week{task.leadWeeks === 1 ? "" : "s"}{" "}
                                      before {parent.text}
                                    </span>
                                  </label>
                                </div>
                                <p className="mt-1 text-xs text-zinc-400 dark:text-zinc-500">
                                  {task.leadWeeks
                                    ? `Moves with ${parent.text} when it is rescheduled.`
                                    : `Can be scheduled in the same section as ${parent.text} or earlier.`}
                                </p>
                              </div>
                            )}
                            {notesOpen ? (
                              <form
                                onSubmit={(event) => {
                                  event.preventDefault();
                                  saveNotes(category.id, task.id);
                                }}
                              >
                                <label
                                  htmlFor={`notes-${task.id}`}
                                  className="sr-only"
                                >
                                  Description for {task.text}
                                </label>
                                <textarea
                                  id={`notes-${task.id}`}
                                  value={notesDraft}
                                  onChange={(event) =>
                                    setNotesDraft(event.target.value)
                                  }
                                  onKeyDown={(event) => {
                                    if (event.key !== "Tab") return;
                                    event.preventDefault();
                                    const target = event.currentTarget;
                                    const start = target.selectionStart;
                                    const end = target.selectionEnd;

                                    if (event.shiftKey) {
                                      const lineStart =
                                        notesDraft.lastIndexOf(
                                          "\n",
                                          start - 1,
                                        ) + 1;
                                      const prefix = notesDraft.slice(
                                        lineStart,
                                        start,
                                      );
                                      const remove = prefix.endsWith("  ")
                                        ? 2
                                        : prefix.endsWith(" ")
                                          ? 1
                                          : 0;
                                      if (remove === 0) return;
                                      setNotesDraft(
                                        notesDraft.slice(0, start - remove) +
                                          notesDraft.slice(end),
                                      );
                                      requestAnimationFrame(() => {
                                        target.selectionStart =
                                          target.selectionEnd = start - remove;
                                      });
                                      return;
                                    }

                                    setNotesDraft(
                                      notesDraft.slice(0, start) +
                                        "  " +
                                        notesDraft.slice(end),
                                    );
                                    requestAnimationFrame(() => {
                                      target.selectionStart =
                                        target.selectionEnd = start + 2;
                                    });
                                  }}
                                  rows={4}
                                  placeholder="Add a description — one bullet per line"
                                  autoFocus
                                  className="w-full resize-y rounded-md border border-zinc-200 bg-white p-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-400 focus:outline-none dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-500 dark:focus:border-zinc-600"
                                />
                                <div className="mt-2 flex items-center gap-2">
                                  <button
                                    type="submit"
                                    className="h-8 rounded-md bg-zinc-900 px-3 text-xs font-medium text-white transition-colors hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
                                  >
                                    Save
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setNotesTaskId(null);
                                      setNotesDraft("");
                                    }}
                                    className="h-8 rounded-md px-2 text-xs text-zinc-500 transition-colors hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
                                  >
                                    Cancel
                                  </button>
                                  <span className="text-xs text-zinc-400 dark:text-zinc-500">
                                    One bullet per line · Tab indents
                                  </span>
                                </div>
                              </form>
                            ) : (
                              <>
                                {task.notes ? (
                                  <div className="pr-2 text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">
                                    <NoteBullets
                                      nodes={notesToTree(
                                        parseNoteLines(task.notes),
                                      )}
                                    />
                                  </div>
                                ) : (
                                  <p className="text-xs italic text-zinc-400 dark:text-zinc-500">
                                    No description yet.
                                  </p>
                                )}
                                <button
                                  type="button"
                                  onClick={() => startEditingNotes(task)}
                                  className="mt-2 text-xs font-medium text-zinc-500 underline-offset-2 transition-colors hover:text-zinc-900 hover:underline dark:text-zinc-400 dark:hover:text-zinc-100"
                                >
                                  {task.notes ? "Edit description" : "Add description"}
                                </button>
                              </>
                            )}
                          </div>
                        )}

                        {formOpen && !isSubtask && (
                          <form
                            onSubmit={(event) => {
                              event.preventDefault();
                              addSubtask(task.id);
                            }}
                            className="mt-2 flex flex-col gap-2 pl-7 sm:flex-row sm:items-center"
                          >
                            <input
                              value={subtaskText}
                              onChange={(event) =>
                                setSubtaskText(event.target.value)
                              }
                              placeholder="Add a subtask…"
                              aria-label={`Subtask for ${task.text}`}
                              autoComplete="off"
                              className="h-8 flex-1 rounded-md border border-zinc-200 bg-white px-2.5 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-400 focus:outline-none dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-500 dark:focus:border-zinc-600"
                            />
                            <select
                              value={subtaskCategoryId}
                              onChange={(event) =>
                                setSubtaskCategoryId(event.target.value)
                              }
                              aria-label="Subtask section"
                              className="h-8 rounded-md border border-zinc-200 bg-transparent px-2 text-xs text-zinc-600 focus:border-zinc-400 focus:outline-none dark:border-zinc-800 dark:text-zinc-300 dark:focus:border-zinc-600"
                            >
                              {CATEGORIES.map((option, optionIndex) => (
                                <option
                                  key={option.id}
                                  value={option.id}
                                  disabled={
                                    optionIndex > categoryIndex(category.id)
                                  }
                                >
                                  {option.label}
                                </option>
                              ))}
                            </select>
                            <div className="flex gap-2">
                              <button
                                type="submit"
                                className="h-8 rounded-md bg-zinc-900 px-3 text-xs font-medium text-white transition-colors hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
                              >
                                Add
                              </button>
                              <button
                                type="button"
                                onClick={() => setSubtaskParentId(null)}
                                className="h-8 rounded-md px-2 text-xs text-zinc-500 transition-colors hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
                              >
                                Cancel
                              </button>
                            </div>
                          </form>
                        )}
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
