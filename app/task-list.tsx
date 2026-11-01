"use client";

import { useSyncExternalStore, useState } from "react";

const TAGS = [
  { id: "projects", label: "Projects" },
  { id: "curriculum", label: "Curriculum" },
  { id: "recruitment", label: "Recruitment" },
  { id: "social", label: "Social events" },
  { id: "gm", label: "GM" },
] as const;

type TagId = (typeof TAGS)[number]["id"];

const TAG_IDS = new Set<string>(TAGS.map((tag) => tag.id));

function isTagId(value: unknown): value is TagId {
  return typeof value === "string" && TAG_IDS.has(value);
}

function tagLabel(tagId: string): string {
  return TAGS.find((tag) => tag.id === tagId)?.label ?? tagId;
}

type Task = {
  id: string;
  text: string;
  done: boolean;
  isDefault?: boolean;
  tags?: TagId[];
  parentId?: string;
  leadWeeks?: number;
  endCategoryId?: string;
  notes?: string;
};

type TasksByCategory = Record<string, Task[]>;

// An edge means `before` must happen earlier than `after`.
type Dependency = { before: string; after: string };

type AppState = {
  tasks: TasksByCategory;
  removedDefaults: string[];
  dependencies: Dependency[];
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
  tags?: TagId[];
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
    tags: ["recruitment"],
  },
  { id: "default-8", text: "Sponsorship outreach", category: "summer" },
  { id: "default-9", text: "RSO re-recognition", category: "summer" },
  {
    id: "default-10",
    text: "Open written apps",
    category: "week-1",
    tags: ["recruitment"],
  },
  {
    id: "default-11",
    text: "Classification",
    category: "week-4",
    tags: ["recruitment"],
  },
  { id: "default-12", text: "Retreat", category: "week-8" },
  { id: "default-13", text: "Midsem ShowCAIS", category: "week-11" },
  { id: "default-14", text: "OpenShowCAIS", category: "week-15" },
  {
    id: "default-15",
    text: "Written delibs",
    category: "week-3",
    tags: ["recruitment"],
  },
  {
    id: "default-16",
    text: "Group interviews",
    category: "week-3",
    tags: ["recruitment"],
  },
  {
    id: "default-17",
    text: "Individual interviews",
    category: "week-4",
    tags: ["recruitment"],
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

// Recruitment tasks start out ordered. These edges (and any others) can be
// removed or added from the task details panel and are stored with the state.
const RECRUITMENT_CHAIN = [
  "default-7",
  "default-10",
  "default-15",
  "default-16",
  "default-17",
  "default-11",
];

const DEFAULT_DEPENDENCIES: Dependency[] = [
  ...RECRUITMENT_CHAIN.slice(1).map((id, index) => ({
    before: RECRUITMENT_CHAIN[index],
    after: id,
  })),
  // Big little reveal happens after Retreat.
  { before: "default-12", after: "default-18" },
];

const DEFAULT_BY_ID = new Map(DEFAULT_EVENTS.map((event) => [event.id, event]));

type Graph = {
  // PRECEDES: id -> tasks that must come after it.
  precedes: Map<string, string[]>;
  // FOLLOWS: id -> tasks that must come before it.
  follows: Map<string, string[]>;
  sequenced: Set<string>;
};

function buildGraph(dependencies: Dependency[]): Graph {
  const precedes = new Map<string, string[]>();
  const follows = new Map<string, string[]>();
  const sequenced = new Set<string>();

  for (const { before, after } of dependencies) {
    if (!before || !after || before === after) continue;
    const targets = precedes.get(before) ?? [];
    if (targets.includes(after)) continue;
    precedes.set(before, [...targets, after]);
    follows.set(after, [...(follows.get(after) ?? []), before]);
    sequenced.add(before);
    sequenced.add(after);
  }

  return { precedes, follows, sequenced };
}

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
function sortSequenced(tasks: Task[], graph: Graph): Task[] {
  const positions: number[] = [];
  const nodes: Task[] = [];
  tasks.forEach((task, index) => {
    if (graph.sequenced.has(task.id)) {
      positions.push(index);
      nodes.push(task);
    }
  });
  if (nodes.length < 2) return tasks;

  const nodeIds = new Set(nodes.map((node) => node.id));
  const indegree = new Map(nodes.map((node) => [node.id, 0]));
  const outgoing = new Map<string, Set<string>>();

  for (const [before, targets] of graph.precedes) {
    if (!nodeIds.has(before)) continue;
    for (const after of targets) {
      if (!nodeIds.has(after) || before === after) continue;
      const edges = outgoing.get(before) ?? new Set<string>();
      if (edges.has(after)) continue;
      edges.add(after);
      outgoing.set(before, edges);
      indegree.set(after, (indegree.get(after) ?? 0) + 1);
    }
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
  const graph = buildGraph(state.dependencies);
  const tasks: TasksByCategory = {};
  for (const [categoryId, list] of Object.entries(state.tasks)) {
    tasks[categoryId] = sortSequenced(list, graph);
  }
  return { ...state, tasks };
}

function categoryIndex(categoryId: string): number {
  return CATEGORIES.findIndex((category) => category.id === categoryId);
}

function sectionLabel(categoryId: string): string {
  return (
    CATEGORIES.find((category) => category.id === categoryId)?.label ??
    categoryId
  );
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

type TaskOccurrence = {
  task: Task;
  startCategoryId: string;
  isStart: boolean;
};

// A spanning task is listed under every section between its start and end.
function taskOccurrences(
  state: AppState,
  categoryId: string,
): TaskOccurrence[] {
  const sectionIndex = categoryIndex(categoryId);
  const occurrences: TaskOccurrence[] = [];

  for (const category of CATEGORIES) {
    const startIndex = categoryIndex(category.id);
    for (const task of state.tasks[category.id] ?? []) {
      const endIndex = task.endCategoryId
        ? Math.max(startIndex, categoryIndex(task.endCategoryId))
        : startIndex;
      if (sectionIndex < startIndex || sectionIndex > endIndex) continue;

      occurrences.push({
        task,
        startCategoryId: category.id,
        isStart: sectionIndex === startIndex,
      });
    }
  }

  return occurrences;
}

function spanLabel(startCategoryId: string, endCategoryId: string): string {
  if (startCategoryId.startsWith("week-") && endCategoryId.startsWith("week-")) {
    return `Weeks ${startCategoryId.slice(5)}–${endCategoryId.slice(5)}`;
  }
  return `${sectionLabel(startCategoryId)} → ${sectionLabel(endCategoryId)}`;
}

function spanLength(state: AppState, task: Task): number {
  if (!task.endCategoryId) return 0;
  const location = findTask(state, task.id);
  if (!location) return 0;
  return Math.max(
    0,
    categoryIndex(task.endCategoryId) - categoryIndex(location.categoryId),
  );
}

// Keep a span inside the allowed range, dropping it if it would be zero.
function clampTaskSpan(
  task: Task,
  startCategoryId: string,
  maxEndIndex = CATEGORIES.length - 1,
): Task {
  if (!task.endCategoryId) return task;

  const startIndex = categoryIndex(startCategoryId);
  const endIndex = categoryIndex(task.endCategoryId);
  const max = Math.min(maxEndIndex, CATEGORIES.length - 1);
  const clamped = Math.min(Math.max(endIndex, startIndex), max);

  const next = { ...task };
  if (clamped <= startIndex) {
    delete next.endCategoryId;
  } else {
    next.endCategoryId = CATEGORIES[clamped].id;
  }
  return next;
}

function shiftTaskSpan(task: Task, delta: number): Task | null {
  if (!task.endCategoryId) return task;
  const endIndex = categoryIndex(task.endCategoryId) + delta;
  if (endIndex < 0 || endIndex >= CATEGORIES.length) return null;
  return { ...task, endCategoryId: CATEGORIES[endIndex].id };
}

// A sequenced task may not move before a predecessor or after a successor.
function sequenceBounds(
  state: AppState,
  taskId: string,
): { min: number; max: number } {
  const graph = buildGraph(state.dependencies);
  if (!graph.sequenced.has(taskId)) {
    return { min: 0, max: CATEGORIES.length - 1 };
  }

  let min = 0;
  let max = CATEGORIES.length - 1;
  for (const id of traverse(taskId, graph.follows)) {
    const location = findTask(state, id);
    if (location) min = Math.max(min, categoryIndex(location.categoryId));
  }
  for (const id of traverse(taskId, graph.precedes)) {
    const location = findTask(state, id);
    if (location) max = Math.min(max, categoryIndex(location.categoryId));
  }
  return { min, max };
}

// Subtasks may only be scheduled in their parent's section or earlier, and a
// parent may not move before any of its subtasks. Subtasks with a leadWeeks
// offset shift with the parent and must stay at least that far ahead of it.
function baseMoveBounds(
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

// A spanning task also needs room for its remaining sections.
function moveBounds(
  state: AppState,
  task: Task,
): { min: number; max: number } {
  const bounds = baseMoveBounds(state, task);
  const span = spanLength(state, task);
  if (span > 0) {
    bounds.max = Math.min(bounds.max, CATEGORIES.length - 1 - span);
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
        tasks[categoryId].push(clampTaskSpan(task, categoryId));
      } else if (!parentCategory) {
        // Parent is gone; keep the task as a standalone item.
        tasks[categoryId].push(
          clampTaskSpan({ ...task, parentId: undefined }, categoryId),
        );
      } else {
        const latestIndex =
          categoryIndex(parentCategory) - (task.leadWeeks ?? 0);
        const targetIndex = Math.min(
          Math.max(categoryIndex(categoryId), 0),
          Math.max(latestIndex, 0),
        );
        const targetCategory = CATEGORIES[targetIndex].id;
        const nextTask = clampTaskSpan(
          task,
          targetCategory,
          Math.max(latestIndex, 0),
        );

        if (targetCategory === categoryId) {
          tasks[categoryId].push(nextTask);
        } else {
          tasks[targetCategory] = [...tasks[targetCategory], nextTask];
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
        tags: event.tags,
        parentId: event.parentId,
        leadWeeks: event.leadWeeks,
      },
    ];
  }
  return sortState({
    tasks,
    removedDefaults: [],
    dependencies: DEFAULT_DEPENDENCIES,
  });
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

function isDependency(value: unknown): value is Dependency {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as Dependency).before === "string" &&
    typeof (value as Dependency).after === "string"
  );
}

// Drop edges for tasks that no longer exist, plus duplicates and self-links.
function pruneDependencies(
  dependencies: Dependency[],
  tasks: TasksByCategory,
): Dependency[] {
  const present = new Set<string>();
  for (const list of Object.values(tasks)) {
    for (const task of list) present.add(task.id);
  }

  const kept: Dependency[] = [];
  const seen = new Set<string>();
  for (const edge of dependencies) {
    if (!isDependency(edge)) continue;
    if (!present.has(edge.before) || !present.has(edge.after)) continue;
    if (edge.before === edge.after) continue;
    const key = `${edge.before}->${edge.after}`;
    if (seen.has(key)) continue;
    seen.add(key);
    kept.push({ before: edge.before, after: edge.after });
  }
  return kept;
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
  const [expandedRowKey, setExpandedRowKey] = useState<string | null>(null);
  const [panelMode, setPanelMode] = useState<"view" | "edit">("view");
  const [titleDraft, setTitleDraft] = useState("");
  const [titleError, setTitleError] = useState<string | null>(null);
  const [activeTags, setActiveTags] = useState<TagId[]>([]);
  const [depAfterId, setDepAfterId] = useState("");
  const [depBeforeId, setDepBeforeId] = useState("");
  const [depError, setDepError] = useState<string | null>(null);
  const [addError, setAddError] = useState<{
    categoryId: string;
    message: string;
  } | null>(null);

  const taskOptions = CATEGORIES.flatMap((category) =>
    (state.tasks[category.id] ?? []).map((task) => ({
      id: task.id,
      text: task.text,
      label: `${task.text} · ${category.label}`,
    })),
  );

  function matchesFilter(task: Task) {
    return (
      activeTags.length === 0 ||
      (task.tags ?? []).some((tag) => activeTags.includes(tag))
    );
  }

  function toggleTagFilter(tagId: TagId) {
    setActiveTags((current) =>
      current.includes(tagId)
        ? current.filter((tag) => tag !== tagId)
        : [...current, tagId],
    );
  }

  function addTask(categoryId: string, form: HTMLFormElement) {
    const data = new FormData(form);
    const text = String(data.get("text") ?? "").trim();
    if (!text) return;

    const afterId = String(data.get("after") ?? "");
    const beforeId = String(data.get("before") ?? "");
    const endId = String(data.get("end") ?? "") || categoryId;
    const targetIndex = categoryIndex(categoryId);
    const targetLabel = sectionLabel(categoryId);
    const endIndex = categoryIndex(endId);

    if (afterId && beforeId && afterId === beforeId) {
      setAddError({
        categoryId,
        message: "Choose two different tasks for the range.",
      });
      return;
    }

    const afterLocation = afterId ? findTask(state, afterId) : null;
    const beforeLocation = beforeId ? findTask(state, beforeId) : null;

    if (
      (afterId && !afterLocation) ||
      (beforeId && !beforeLocation)
    ) {
      setAddError({ categoryId, message: "That task no longer exists." });
      return;
    }

    if (
      afterLocation &&
      categoryIndex(afterLocation.categoryId) > targetIndex
    ) {
      setAddError({
        categoryId,
        message: `“${afterLocation.task.text}” is in ${sectionLabel(
          afterLocation.categoryId,
        )}, which is after ${targetLabel}.`,
      });
      return;
    }

    if (
      beforeLocation &&
      categoryIndex(beforeLocation.categoryId) < targetIndex
    ) {
      setAddError({
        categoryId,
        message: `“${beforeLocation.task.text}” is in ${sectionLabel(
          beforeLocation.categoryId,
        )}, which is before ${targetLabel}.`,
      });
      return;
    }

    if (
      afterLocation &&
      beforeLocation &&
      categoryIndex(afterLocation.categoryId) >
        categoryIndex(beforeLocation.categoryId)
    ) {
      setAddError({
        categoryId,
        message:
          "The task that must come first is already in a later section.",
      });
      return;
    }

    if (endIndex < targetIndex) {
      setAddError({
        categoryId,
        message: "The span must end at or after its starting section.",
      });
      return;
    }

    if (
      beforeLocation &&
      endIndex > categoryIndex(beforeLocation.categoryId)
    ) {
      setAddError({
        categoryId,
        message: `The span must end at or before “${beforeLocation.task.text}”.`,
      });
      return;
    }

    const task: Task = { id: crypto.randomUUID(), text, done: false };
    if (endIndex > targetIndex) {
      task.endCategoryId = CATEGORIES[endIndex].id;
    }
    const nextDependencies = [...state.dependencies];
    if (afterLocation) {
      nextDependencies.push({ before: afterLocation.task.id, after: task.id });
    }
    if (beforeLocation) {
      nextDependencies.push({ before: task.id, after: beforeLocation.task.id });
    }

    setState(
      sortState({
        ...state,
        tasks: {
          ...state.tasks,
          [categoryId]: [...(state.tasks[categoryId] ?? []), task],
        },
        dependencies: nextDependencies,
      }),
    );
    setAddError(null);
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
    tasks[targetCategory] = [
      ...(tasks[targetCategory] ?? []),
      clampTaskSpan(nextTask, targetCategory, Math.max(latestIndex, 0)),
    ];

    setState(sortState({ ...state, tasks }));
  }

  function addDependency(taskId: string) {
    const taskLocation = findTask(state, taskId);
    if (!taskLocation) return;

    if (!depAfterId && !depBeforeId) {
      setDepError("Choose a task that must happen before or after this one.");
      return;
    }
    if (depAfterId === taskId || depBeforeId === taskId) {
      setDepError("A task can't be ordered against itself.");
      return;
    }
    if (depAfterId && depBeforeId && depAfterId === depBeforeId) {
      setDepError("Choose two different tasks for the range.");
      return;
    }

    const afterLocation = depAfterId ? findTask(state, depAfterId) : null;
    const beforeLocation = depBeforeId ? findTask(state, depBeforeId) : null;
    if (
      (depAfterId && !afterLocation) ||
      (depBeforeId && !beforeLocation)
    ) {
      setDepError("That task no longer exists.");
      return;
    }

    const taskIndex = categoryIndex(taskLocation.categoryId);
    const nextDependencies = [...state.dependencies];

    if (afterLocation) {
      const afterEndIndex = afterLocation.task.endCategoryId
        ? categoryIndex(afterLocation.task.endCategoryId)
        : categoryIndex(afterLocation.categoryId);
      if (afterEndIndex > taskIndex) {
        setDepError(
          afterLocation.task.endCategoryId
            ? `“${afterLocation.task.text}” runs through ${sectionLabel(
                afterLocation.task.endCategoryId,
              )}, which is after ${sectionLabel(taskLocation.categoryId)}.`
            : `“${afterLocation.task.text}” is in ${sectionLabel(
                afterLocation.categoryId,
              )}, which is after ${sectionLabel(taskLocation.categoryId)}.`,
        );
        return;
      }
      if (
        state.dependencies.some(
          (edge) =>
            edge.before === afterLocation.task.id && edge.after === taskId,
        )
      ) {
        setDepError("That ordering already exists.");
        return;
      }
      nextDependencies.push({
        before: afterLocation.task.id,
        after: taskId,
      });
    }

    if (beforeLocation) {
      const taskEndIndex = taskLocation.task.endCategoryId
        ? categoryIndex(taskLocation.task.endCategoryId)
        : taskIndex;
      if (taskEndIndex > categoryIndex(beforeLocation.categoryId)) {
        setDepError(
          taskLocation.task.endCategoryId
            ? `“${taskLocation.task.text}” runs through ${sectionLabel(
                taskLocation.task.endCategoryId,
              )}, which is after “${beforeLocation.task.text}”.`
            : `“${beforeLocation.task.text}” is in ${sectionLabel(
                beforeLocation.categoryId,
              )}, which is before ${sectionLabel(taskLocation.categoryId)}.`,
        );
        return;
      }
      if (
        state.dependencies.some(
          (edge) =>
            edge.before === taskId && edge.after === beforeLocation.task.id,
        )
      ) {
        setDepError("That ordering already exists.");
        return;
      }
      nextDependencies.push({
        before: taskId,
        after: beforeLocation.task.id,
      });
    }

    if (
      afterLocation &&
      beforeLocation &&
      categoryIndex(afterLocation.categoryId) >
        categoryIndex(beforeLocation.categoryId)
    ) {
      setDepError(
        `“${afterLocation.task.text}” already comes after “${beforeLocation.task.text}”.`,
      );
      return;
    }

    const graph = buildGraph(nextDependencies);
    if (traverse(taskId, graph.precedes).has(taskId)) {
      setDepError("Those rules would create a loop.");
      return;
    }

    setState(sortState({ ...state, dependencies: nextDependencies }));
    setDepAfterId("");
    setDepBeforeId("");
    setDepError(null);
  }

  function removeDependency(before: string, after: string) {
    setState(
      sortState({
        ...state,
        dependencies: state.dependencies.filter(
          (edge) => !(edge.before === before && edge.after === after),
        ),
      }),
    );
    setDepError(null);
  }

  function renameTask(categoryId: string, taskId: string, rawTitle: string) {
    const title = rawTitle.trim();
    if (!title) {
      setTitleError("A title can't be empty.");
      return;
    }

    setState({
      ...state,
      tasks: {
        ...state.tasks,
        [categoryId]: (state.tasks[categoryId] ?? []).map((task) =>
          task.id === taskId ? { ...task, text: title } : task,
        ),
      },
    });
    setTitleDraft(title);
    setTitleError(null);
  }

  function setTaskSpan(
    categoryId: string,
    taskId: string,
    endCategoryId: string,
  ) {
    const task = (state.tasks[categoryId] ?? []).find(
      (candidate) => candidate.id === taskId,
    );
    if (!task) return;

    const startIndex = categoryIndex(categoryId);
    const endIndex = categoryIndex(endCategoryId);
    const maxEndIndex = baseMoveBounds(state, task).max;
    if (endIndex < startIndex || endIndex > maxEndIndex) return;

    setState({
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
    });
  }

  function toggleTag(categoryId: string, taskId: string, tagId: TagId) {
    setState({
      ...state,
      tasks: {
        ...state.tasks,
        [categoryId]: (state.tasks[categoryId] ?? []).map((task) => {
          if (task.id !== taskId) return task;
          const tags = task.tags ?? [];
          return {
            ...task,
            tags: tags.includes(tagId)
              ? tags.filter((tag) => tag !== tagId)
              : [...tags, tagId],
          };
        }),
      },
    });
  }

  function startEditingNotes(task: Task, occurrenceCategoryId: string) {
    setExpandedRowKey(`${task.id}:${occurrenceCategoryId}`);
    setPanelMode("edit");
    setNotesTaskId(task.id);
    setNotesDraft(task.notes ?? "");
    setSubtaskParentId(null);
  }

  function togglePanel(
    taskId: string,
    occurrenceCategoryId: string,
    mode: "view" | "edit",
  ) {
    const rowKey = `${taskId}:${occurrenceCategoryId}`;
    const opening = expandedRowKey !== rowKey || panelMode !== mode;
    setExpandedRowKey(opening ? rowKey : null);
    setPanelMode(mode);
    setNotesTaskId(null);
    setNotesDraft("");
    setDepAfterId("");
    setDepBeforeId("");
    setDepError(null);
    setTitleError(null);
    if (opening) {
      setTitleDraft(findTask(state, taskId)?.task.text ?? "");
    }
  }

  function goToParent(parentId: string) {
    const parentLocation = findTask(state, parentId);
    if (
      parentLocation &&
      activeTags.length > 0 &&
      !matchesFilter(parentLocation.task)
    ) {
      setActiveTags([]);
    }
    setExpandedRowKey(
      parentLocation
        ? `${parentId}:${parentLocation.categoryId}`
        : null,
    );
    setPanelMode("view");
    setNotesTaskId(null);
    setNotesDraft("");
    setSubtaskParentId(null);
    setDepAfterId("");
    setDepBeforeId("");
    setDepError(null);
    setTitleDraft(parentLocation?.task.text ?? "");
    setTitleError(null);
    const targetId = parentLocation
      ? `task-${parentId}-${parentLocation.categoryId}`
      : null;
    requestAnimationFrame(() => {
      if (!targetId) return;
      document
        .getElementById(targetId)
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
      dependencies: state.dependencies.filter(
        (edge) =>
          !removedIds.has(edge.before) && !removedIds.has(edge.after),
      ),
      removedDefaults: [
        ...new Set([...state.removedDefaults, ...removedIds]),
      ],
    });
    if (subtaskParentId === taskId) setSubtaskParentId(null);
    if (notesTaskId && removedIds.has(notesTaskId)) setNotesTaskId(null);
    if (
      expandedRowKey &&
      [...removedIds].some((id) => expandedRowKey.startsWith(`${id}:`))
    ) {
      setExpandedRowKey(null);
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
    const movedTask = shiftTaskSpan(task, delta);
    if (!movedTask) return;

    const shifted = new Map<string, { categoryId: string; task: Task }>();
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
          const shiftedTask = shiftTaskSpan(candidate, delta);
          if (!shiftedTask) return;
          shifted.set(candidate.id, {
            categoryId: CATEGORIES[newIndex].id,
            task: shiftedTask,
          });
        }
      }
    }

    const movingIds = new Set<string>([taskId, ...shifted.keys()]);
    const tasks: TasksByCategory = {};
    for (const [categoryId, list] of Object.entries(state.tasks)) {
      tasks[categoryId] = list.filter(
        (candidate) => !movingIds.has(candidate.id),
      );
    }

    tasks[toCategoryId] = [...(tasks[toCategoryId] ?? []), movedTask];
    for (const { categoryId, task: subtask } of shifted.values()) {
      tasks[categoryId] = [...(tasks[categoryId] ?? []), subtask];
    }

    setState(sortState({ ...state, tasks }));
  }

  const allTasks = Object.values(state.tasks).flat();
  const totalTaskCount = allTasks.length;
  const filteredTaskCount = allTasks.filter(matchesFilter).length;

  return (
    <div className="mx-auto w-full max-w-2xl px-6 py-12">
      <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
        Categories
      </h1>
      <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
        Add tasks under the part of the year they belong to. Default events are
        already listed and can be moved to another section. Tasks can also span
        several weeks: pick an end section when adding one, or change it while
        editing, and the task will be listed under every week it covers. Use +
        to add a subtask in the same or an earlier section; open a subtask to
        edit its lead time. Click ▸ or the task title to read the description,
        and use Edit to change the title, description, tags, span, and ordering
        rules. Ordering can also be set when adding an event. Use the filter bar
        to show only tasks with selected tags.
      </p>

      <div
        className="mt-6 flex flex-wrap items-center gap-1.5"
        role="group"
        aria-label="Filter tasks by tag"
      >
        <span className="mr-1 text-xs font-medium text-zinc-500 dark:text-zinc-400">
          Filter
        </span>
        <button
          type="button"
          onClick={() => setActiveTags([])}
          aria-pressed={activeTags.length === 0}
          className={
            activeTags.length === 0
              ? "rounded-full bg-zinc-900 px-2.5 py-1 text-[11px] font-medium text-white transition-colors hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
              : "rounded-full border border-zinc-200 px-2.5 py-1 text-[11px] font-medium text-zinc-600 transition-colors hover:border-zinc-400 hover:text-zinc-900 dark:border-zinc-700 dark:text-zinc-400 dark:hover:border-zinc-500 dark:hover:text-zinc-100"
          }
        >
          All
        </button>
        {TAGS.map((tag) => {
          const active = activeTags.includes(tag.id);
          return (
            <button
              key={tag.id}
              type="button"
              onClick={() => toggleTagFilter(tag.id)}
              aria-pressed={active}
              className={
                active
                  ? "rounded-full bg-zinc-900 px-2.5 py-1 text-[11px] font-medium text-white transition-colors hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
                  : "rounded-full border border-zinc-200 px-2.5 py-1 text-[11px] font-medium text-zinc-600 transition-colors hover:border-zinc-400 hover:text-zinc-900 dark:border-zinc-700 dark:text-zinc-400 dark:hover:border-zinc-500 dark:hover:text-zinc-100"
              }
            >
              {tag.label}
            </button>
          );
        })}
      </div>
      {activeTags.length > 0 && (
        <p className="mt-2 text-xs text-zinc-400 dark:text-zinc-500">
          Showing {filteredTaskCount} of {totalTaskCount} tasks
          {activeTags.length > 1 ? " · matching any selected tag" : ""}
        </p>
      )}

      <div className="mt-10 flex flex-col gap-10">
        {CATEGORIES.map((category) => {
          const occurrences = taskOccurrences(state, category.id).filter(
            ({ task }) => matchesFilter(task),
          );
          if (activeTags.length > 0 && occurrences.length === 0) return null;
          const remaining = occurrences.filter(
            ({ task }) => !task.done,
          ).length;

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

              {occurrences.length > 0 && (
                <ul className="mt-3 flex flex-col divide-y divide-zinc-200 border-y border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
                  {occurrences.map(({ task, startCategoryId, isStart }) => {
                    const parentLocation = task.parentId
                      ? findTask(state, task.parentId)
                      : null;
                    const parent = parentLocation?.task;
                    const parentMaxIndex = parentLocation
                      ? categoryIndex(parentLocation.categoryId)
                      : 0;
                    const isSubtask = Boolean(task.parentId);
                    const rowKey = `${task.id}:${category.id}`;
                    const descriptionId = `description-${task.id}-${category.id}`;
                    const editorId = `editor-${task.id}-${category.id}`;
                    const formOpen = isStart && subtaskParentId === task.id;
                    const notesOpen = notesTaskId === task.id;
                    const panelOpen = expandedRowKey === rowKey;
                    const viewing = panelOpen && panelMode === "view";
                    const editing = panelOpen && panelMode === "edit";
                    const bounds = moveBounds(state, task);
                    const spanMaxIndex = Math.max(
                      categoryIndex(startCategoryId),
                      baseMoveBounds(state, task).max,
                    );
                    const incomingEdges = state.dependencies.filter(
                      (edge) => edge.after === task.id,
                    );
                    const outgoingEdges = state.dependencies.filter(
                      (edge) => edge.before === task.id,
                    );
                    const afterNames = incomingEdges.flatMap((edge) => {
                      const location = findTask(state, edge.before);
                      return location ? [location.task.text] : [];
                    });
                    const beforeNames = outgoingEdges.flatMap((edge) => {
                      const location = findTask(state, edge.after);
                      return location ? [location.task.text] : [];
                    });

                    return (
                      <li
                        key={rowKey}
                        id={`task-${task.id}-${category.id}`}
                        className={`py-2.5 ${isSubtask ? "pl-6" : ""}`}
                      >
                        <div className="group flex flex-wrap items-center gap-2">
                          <input
                            type="checkbox"
                            checked={task.done}
                            onChange={() => toggleTask(startCategoryId, task.id)}
                            aria-label={`Mark "${task.text}" as ${
                              task.done ? "not done" : "done"
                            }`}
                            className="size-4 shrink-0 accent-zinc-900 dark:accent-zinc-100"
                          />
                          <button
                            type="button"
                            onClick={() =>
                              togglePanel(task.id, category.id, "view")
                            }
                            aria-expanded={viewing}
                            aria-controls={descriptionId}
                            className={`flex flex-1 items-center text-left text-sm ${
                              task.done
                                ? "text-zinc-400 line-through dark:text-zinc-500"
                                : "text-zinc-700 dark:text-zinc-300"
                            }`}
                          >
                            <span className="min-w-0 flex-1">{task.text}</span>
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              togglePanel(task.id, category.id, "view")
                            }
                            aria-expanded={viewing}
                            aria-controls={descriptionId}
                            aria-label={`${
                              viewing ? "Hide" : "Show"
                            } description for "${task.text}"`}
                            title={viewing ? "Hide description" : "Show description"}
                            className="flex size-6 shrink-0 items-center justify-center rounded-md border border-zinc-200 text-xs text-zinc-500 transition-colors hover:text-zinc-900 dark:border-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-100"
                          >
                            {viewing ? "▾" : "▸"}
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              togglePanel(task.id, category.id, "edit")
                            }
                            aria-expanded={editing}
                            aria-controls={editorId}
                            aria-label={`${
                              editing ? "Close editor for" : "Edit"
                            } "${task.text}"`}
                            className={
                              editing
                                ? "h-7 shrink-0 rounded-md border border-zinc-900 bg-zinc-900 px-2 text-[11px] font-medium text-white transition-colors hover:bg-zinc-700 dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
                                : "h-7 shrink-0 rounded-md border border-zinc-200 px-2 text-[11px] font-medium text-zinc-600 transition-colors hover:border-zinc-400 hover:text-zinc-900 dark:border-zinc-800 dark:text-zinc-400 dark:hover:border-zinc-600 dark:hover:text-zinc-100"
                            }
                          >
                            {editing ? "Done" : "Edit"}
                          </button>
                          {isStart && !isSubtask && (
                            <button
                              type="button"
                              onClick={() => {
                                if (formOpen) {
                                  setSubtaskParentId(null);
                                  return;
                                }
                                setSubtaskParentId(task.id);
                                setSubtaskText("");
                                setSubtaskCategoryId(startCategoryId);
                                setNotesTaskId(null);
                              }}
                              aria-label={`Add a subtask to "${task.text}"`}
                              aria-expanded={formOpen}
                              className="flex size-6 shrink-0 items-center justify-center rounded-md border border-zinc-200 text-xs text-zinc-500 transition-colors hover:text-zinc-900 dark:border-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-100"
                            >
                              +
                            </button>
                          )}
                          {isStart && (
                            <select
                              value={startCategoryId}
                              onChange={(event) =>
                                moveTask(
                                  startCategoryId,
                                  task.id,
                                  event.target.value,
                                )
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
                          )}
                          {isStart && (
                            <button
                              type="button"
                              onClick={() => removeTask(startCategoryId, task.id)}
                              aria-label={`Delete "${task.text}"`}
                              className="text-sm text-zinc-400 opacity-0 transition-opacity hover:text-zinc-900 focus:opacity-100 group-hover:opacity-100 dark:text-zinc-500 dark:hover:text-zinc-100"
                            >
                              ×
                            </button>
                          )}
                        </div>

                        {((task.tags?.length ?? 0) > 0 ||
                          task.endCategoryId) && (
                          <div className="mt-1 flex flex-wrap items-center gap-1 pl-7">
                            {task.endCategoryId && (
                              <span
                                aria-label={`Spans ${spanLabel(
                                  startCategoryId,
                                  task.endCategoryId,
                                )}`}
                                className="rounded-full border border-zinc-300 bg-white px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-zinc-700 dark:border-zinc-600 dark:bg-zinc-950 dark:text-zinc-200"
                              >
                                ↔ {spanLabel(startCategoryId, task.endCategoryId)}
                              </span>
                            )}
                            {task.tags?.map((tagId) => (
                              <span
                                key={tagId}
                                className="rounded-full border border-zinc-200 bg-zinc-50 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-zinc-600 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300"
                              >
                                {tagLabel(tagId)}
                              </span>
                            ))}
                          </div>
                        )}

                        {(afterNames.length > 0 || beforeNames.length > 0) && (
                          <div className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 pl-7 text-xs text-zinc-500 dark:text-zinc-400">
                            {afterNames.length > 0 && (
                              <span>After {afterNames.join(", ")}</span>
                            )}
                            {afterNames.length > 0 &&
                              beforeNames.length > 0 && (
                                <span aria-hidden>·</span>
                              )}
                            {beforeNames.length > 0 && (
                              <span>Before {beforeNames.join(", ")}</span>
                            )}
                          </div>
                        )}

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

                        {panelOpen && (
                          <div
                            id={editing ? editorId : descriptionId}
                            className="mt-2 pl-7"
                          >
                            {editing && (
                              <>
                                {parent && (
                                  <button
                                    type="button"
                                    onClick={() => goToParent(parent.id)}
                                    className="mb-2 inline-flex items-center gap-1 text-xs font-medium text-zinc-600 underline-offset-2 transition-colors hover:text-zinc-900 hover:underline dark:text-zinc-300 dark:hover:text-zinc-50"
                                  >
                                    ← Go to {parent.text}
                                  </button>
                                )}
                            <div className="mb-3 rounded-md border border-zinc-200 p-3 dark:border-zinc-800">
                              <form
                                onSubmit={(event) => {
                                  event.preventDefault();
                                  renameTask(startCategoryId, task.id, titleDraft);
                                }}
                              >
                                <label
                                  htmlFor={`title-${task.id}`}
                                  className="text-xs font-medium text-zinc-900 dark:text-zinc-100"
                                >
                                  Title
                                </label>
                                <div className="mt-1.5 flex gap-2">
                                  <input
                                    id={`title-${task.id}`}
                                    value={titleDraft}
                                    onChange={(event) => {
                                      setTitleDraft(event.target.value);
                                      setTitleError(null);
                                    }}
                                    className="h-8 flex-1 rounded-md border border-zinc-200 bg-white px-2.5 text-sm text-zinc-900 focus:border-zinc-400 focus:outline-none dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100 dark:focus:border-zinc-600"
                                  />
                                  <button
                                    type="submit"
                                    className="h-8 shrink-0 rounded-md bg-zinc-900 px-3 text-xs font-medium text-white transition-colors hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
                                  >
                                    Save
                                  </button>
                                </div>
                                {titleError && (
                                  <p
                                    role="alert"
                                    className="mt-1 text-xs text-red-600 dark:text-red-400"
                                  >
                                    {titleError}
                                  </p>
                                )}
                              </form>
                              <div className="mt-3 flex flex-wrap items-center gap-2">
                                <span className="text-xs text-zinc-500 dark:text-zinc-400">
                                  Tags
                                </span>
                                {TAGS.map((tag) => {
                                  const active = (task.tags ?? []).includes(
                                    tag.id,
                                  );
                                  return (
                                    <button
                                      key={tag.id}
                                      type="button"
                                      onClick={() =>
                                        toggleTag(startCategoryId, task.id, tag.id)
                                      }
                                      aria-pressed={active}
                                      aria-label={`${
                                        active ? "Remove" : "Add"
                                      } ${tag.label} tag ${
                                        active ? "from" : "to"
                                      } ${task.text}`}
                                      className={
                                        active
                                          ? "rounded-full bg-zinc-900 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-white transition-colors hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
                                          : "rounded-full border border-dashed border-zinc-300 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-zinc-500 transition-colors hover:border-zinc-400 hover:text-zinc-900 dark:border-zinc-700 dark:text-zinc-400 dark:hover:border-zinc-500 dark:hover:text-zinc-100"
                                      }
                                    >
                                      {active ? `${tag.label} ×` : `+ ${tag.label}`}
                                    </button>
                                  );
                                })}
                              </div>
                              <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
                                <span className="font-medium text-zinc-900 dark:text-zinc-100">
                                  Span
                                </span>
                                <span>Starts in {sectionLabel(startCategoryId)}, runs through</span>
                                <select
                                  id={`span-${task.id}`}
                                  value={task.endCategoryId ?? startCategoryId}
                                  onChange={(event) =>
                                    setTaskSpan(
                                      startCategoryId,
                                      task.id,
                                      event.target.value,
                                    )
                                  }
                                  className="h-7 rounded-md border border-zinc-200 bg-transparent px-1.5 text-xs text-zinc-600 focus:border-zinc-400 focus:outline-none dark:border-zinc-800 dark:text-zinc-300 dark:focus:border-zinc-600"
                                >
                                  {CATEGORIES.slice(
                                    categoryIndex(startCategoryId),
                                    spanMaxIndex + 1,
                                  ).map((option, offset) => (
                                    <option key={option.id} value={option.id}>
                                      {offset === 0
                                        ? "Same section only"
                                        : option.label}
                                    </option>
                                  ))}
                                </select>
                              </div>
                              <p className="mt-1 text-xs text-zinc-400 dark:text-zinc-500">
                                {task.endCategoryId
                                  ? `Runs across ${spanLabel(
                                      startCategoryId,
                                      task.endCategoryId,
                                    )}.`
                                  : "Choose a later section to make this task span multiple weeks."}
                              </p>
                            </div>
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
                                          startCategoryId,
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
                            <div className="mb-3 rounded-md border border-zinc-200 p-3 dark:border-zinc-800">
                              <div className="text-xs font-medium text-zinc-900 dark:text-zinc-100">
                                Ordering
                              </div>
                              {incomingEdges.length === 0 &&
                              outgoingEdges.length === 0 ? (
                                <p className="mt-1 text-xs text-zinc-400 dark:text-zinc-500">
                                  No ordering rules yet.
                                </p>
                              ) : (
                                <ul className="mt-1.5 flex flex-col gap-1 text-xs text-zinc-600 dark:text-zinc-300">
                                  {incomingEdges.map((edge) => {
                                    const other = findTask(state, edge.before);
                                    const otherText =
                                      other?.task.text ?? "Unknown task";
                                    return (
                                      <li
                                        key={`${edge.before}->${edge.after}`}
                                        className="flex items-center gap-2"
                                      >
                                        <span className="min-w-0 flex-1">
                                          After{" "}
                                          <span className="font-medium text-zinc-900 dark:text-zinc-100">
                                            {otherText}
                                          </span>
                                        </span>
                                        <button
                                          type="button"
                                          onClick={() =>
                                            removeDependency(
                                              edge.before,
                                              edge.after,
                                            )
                                          }
                                          aria-label={`Remove rule that ${otherText} comes before ${task.text}`}
                                          className="shrink-0 text-zinc-400 transition-colors hover:text-zinc-900 dark:text-zinc-500 dark:hover:text-zinc-100"
                                        >
                                          ×
                                        </button>
                                      </li>
                                    );
                                  })}
                                  {outgoingEdges.map((edge) => {
                                    const other = findTask(state, edge.after);
                                    const otherText =
                                      other?.task.text ?? "Unknown task";
                                    return (
                                      <li
                                        key={`${edge.before}->${edge.after}`}
                                        className="flex items-center gap-2"
                                      >
                                        <span className="min-w-0 flex-1">
                                          Before{" "}
                                          <span className="font-medium text-zinc-900 dark:text-zinc-100">
                                            {otherText}
                                          </span>
                                        </span>
                                        <button
                                          type="button"
                                          onClick={() =>
                                            removeDependency(
                                              edge.before,
                                              edge.after,
                                            )
                                          }
                                          aria-label={`Remove rule that ${task.text} comes before ${otherText}`}
                                          className="shrink-0 text-zinc-400 transition-colors hover:text-zinc-900 dark:text-zinc-500 dark:hover:text-zinc-100"
                                        >
                                          ×
                                        </button>
                                      </li>
                                    );
                                  })}
                                </ul>
                              )}

                              <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs text-zinc-600 dark:text-zinc-300">
                                <span>Must be between</span>
                                <select
                                  value={depAfterId}
                                  onChange={(event) => {
                                    setDepAfterId(event.target.value);
                                    setDepError(null);
                                  }}
                                  aria-label={`Task that must come before ${task.text}`}
                                  className="h-7 max-w-48 rounded-md border border-zinc-200 bg-transparent px-1.5 text-xs text-zinc-600 focus:border-zinc-400 focus:outline-none dark:border-zinc-800 dark:text-zinc-300 dark:focus:border-zinc-600"
                                >
                                  <option value="">Any</option>
                                  {taskOptions
                                    .filter((option) => option.id !== task.id)
                                    .map((option) => (
                                      <option key={option.id} value={option.id}>
                                        {option.label}
                                      </option>
                                    ))}
                                </select>
                                <span>and</span>
                                <select
                                  value={depBeforeId}
                                  onChange={(event) => {
                                    setDepBeforeId(event.target.value);
                                    setDepError(null);
                                  }}
                                  aria-label={`Task that must come after ${task.text}`}
                                  className="h-7 max-w-48 rounded-md border border-zinc-200 bg-transparent px-1.5 text-xs text-zinc-600 focus:border-zinc-400 focus:outline-none dark:border-zinc-800 dark:text-zinc-300 dark:focus:border-zinc-600"
                                >
                                  <option value="">Any</option>
                                  {taskOptions
                                    .filter((option) => option.id !== task.id)
                                    .map((option) => (
                                      <option key={option.id} value={option.id}>
                                        {option.label}
                                      </option>
                                    ))}
                                </select>
                                <button
                                  type="button"
                                  onClick={() => addDependency(task.id)}
                                  className="h-7 rounded-md bg-zinc-900 px-2.5 text-xs font-medium text-white transition-colors hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
                                >
                                  Add
                                </button>
                              </div>
                              {depError && (
                                <p
                                  role="alert"
                                  className="mt-1 text-xs text-red-600 dark:text-red-400"
                                >
                                  {depError}
                                </p>
                              )}
                            </div>
                              </>
                            )}
                            <div className="mb-3 rounded-md border border-zinc-200 p-3 dark:border-zinc-800">
                              <div className="text-xs font-medium text-zinc-900 dark:text-zinc-100">
                                Description
                              </div>
                            {notesOpen ? (
                              <form
                                onSubmit={(event) => {
                                  event.preventDefault();
                                  saveNotes(startCategoryId, task.id);
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
                                {editing && (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      startEditingNotes(task, category.id)
                                    }
                                    className="mt-2 text-xs font-medium text-zinc-500 underline-offset-2 transition-colors hover:text-zinc-900 hover:underline dark:text-zinc-400 dark:hover:text-zinc-100"
                                  >
                                    {task.notes
                                      ? "Edit description"
                                      : "Add description"}
                                  </button>
                                )}
                              </>
                            )}
                            </div>
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
                                    optionIndex > categoryIndex(startCategoryId)
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

              {activeTags.length === 0 && (
                <form
                  onSubmit={(event) => {
                    event.preventDefault();
                    addTask(category.id, event.currentTarget);
                  }}
                  className="mt-3 flex flex-col gap-2"
                >
                  <div className="flex gap-2">
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
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5 text-xs text-zinc-500 dark:text-zinc-400">
                    <label className="flex items-center gap-1.5">
                      <span>Must be after</span>
                      <select
                        name="after"
                        defaultValue=""
                        className="h-7 max-w-48 rounded-md border border-zinc-200 bg-transparent px-1.5 text-xs text-zinc-600 focus:border-zinc-400 focus:outline-none dark:border-zinc-800 dark:text-zinc-300 dark:focus:border-zinc-600"
                      >
                        <option value="">Any</option>
                        {taskOptions.map((option) => (
                          <option key={option.id} value={option.id}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="flex items-center gap-1.5">
                      <span>and before</span>
                      <select
                        name="before"
                        defaultValue=""
                        className="h-7 max-w-48 rounded-md border border-zinc-200 bg-transparent px-1.5 text-xs text-zinc-600 focus:border-zinc-400 focus:outline-none dark:border-zinc-800 dark:text-zinc-300 dark:focus:border-zinc-600"
                      >
                        <option value="">Any</option>
                        {taskOptions.map((option) => (
                          <option key={option.id} value={option.id}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="flex items-center gap-1.5">
                      <span>spanning through</span>
                      <select
                        name="end"
                        defaultValue=""
                        className="h-7 max-w-48 rounded-md border border-zinc-200 bg-transparent px-1.5 text-xs text-zinc-600 focus:border-zinc-400 focus:outline-none dark:border-zinc-800 dark:text-zinc-300 dark:focus:border-zinc-600"
                      >
                        <option value="">This section only</option>
                        {CATEGORIES.slice(
                          categoryIndex(category.id) + 1,
                        ).map((option) => (
                          <option key={option.id} value={option.id}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                  {addError?.categoryId === category.id && (
                    <p
                      role="alert"
                      className="text-xs text-red-600 dark:text-red-400"
                    >
                      {addError.message}
                    </p>
                  )}
                </form>
              )}
            </section>
          );
        })}
        {activeTags.length > 0 && filteredTaskCount === 0 && (
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            No tasks match these tags.
          </p>
        )}
      </div>
    </div>
  );
}
