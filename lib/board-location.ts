import {
  boardSectionForTab,
  categoriesForTab,
  isScheduleTab,
  tabForCategoryId,
  type BoardSectionId,
  type ScheduleTabId,
  type TimelineTabId,
} from "./categories";

export type BoardLocation = {
  section: BoardSectionId;
  // Only set for the Schedule section. A hash of `#schedule` keeps the
  // viewer's remembered term instead of forcing one.
  tab: ScheduleTabId | null;
  // A specific week or list to reveal, such as `week-13`, `summer`, or `todos`.
  categoryId: string | null;
  // A task to scroll to and briefly highlight.
  taskId: string | null;
};

type LocationTarget = {
  categoryId?: string | null;
  taskId?: string | null;
};

const PLAIN_SECTIONS = new Set<BoardSectionId>([
  "home",
  "gm-ideas",
  "todos",
  "eboard-agenda",
]);

const TASK_PREFIX = "task-";

// `#schedule/fall/week-13` and `#todos/task-<id>` are both valid. The hash is
// the source of the visible section, so Back, Forward, refresh, and shared
// links all land in the same place without a router.
export function parseBoardHash(hash: string): BoardLocation {
  const segments = hash
    .replace(/^#/, "")
    .trim()
    .split("/")
    .filter(Boolean);
  const rawSection = segments[0]?.toLowerCase();
  const rest = segments.slice(1);

  if (rawSection === "schedule") {
    let tab: ScheduleTabId | null = null;
    let categoryId: string | null = null;
    let taskId: string | null = null;
    let index = 0;

    const maybeTab = rest[0]?.toLowerCase() as TimelineTabId | undefined;
    if (maybeTab && isScheduleTab(maybeTab)) {
      tab = maybeTab;
      index = 1;
    }

    const maybeCategory = rest[index];
    if (maybeCategory && !maybeCategory.toLowerCase().startsWith(TASK_PREFIX)) {
      const categoryToken = maybeCategory.toLowerCase();
      const inferred = tabForCategoryId(categoryToken);
      const known = categoriesForTab(inferred).some(
        (category) => category.id === categoryToken,
      );
      if (known) {
        categoryId = categoryToken;
        tab = tab ?? (isScheduleTab(inferred) ? inferred : null);
      }
      index += 1;
    }

    const maybeTask = rest[index];
    if (categoryId && maybeTask?.startsWith(TASK_PREFIX)) {
      taskId = maybeTask.slice(TASK_PREFIX.length) || null;
    }

    return { section: "schedule", tab, categoryId, taskId };
  }

  if (rawSection && PLAIN_SECTIONS.has(rawSection as BoardSectionId)) {
    const section = rawSection as BoardSectionId;
    const maybeTask = rest[0];
    const taskId =
      (section === "gm-ideas" || section === "todos") &&
      maybeTask?.startsWith(TASK_PREFIX)
        ? maybeTask.slice(TASK_PREFIX.length) || null
        : null;

    return {
      section,
      tab: null,
      categoryId: taskId ? section : null,
      taskId,
    };
  }

  return { section: "home", tab: null, categoryId: null, taskId: null };
}

export function boardLocationHash(
  section: BoardSectionId,
  tab: ScheduleTabId,
  target?: LocationTarget,
): string {
  if (section === "home") return "#home";

  if (section === "schedule") {
    let hash = `#schedule/${tab}`;
    if (target?.categoryId) hash += `/${target.categoryId}`;
    if (target?.categoryId && target?.taskId) {
      hash += `/${TASK_PREFIX}${target.taskId}`;
    }
    return hash;
  }

  let hash = `#${section}`;
  if (
    (section === "gm-ideas" || section === "todos") &&
    target?.taskId
  ) {
    hash += `/${TASK_PREFIX}${target.taskId}`;
  }
  return hash;
}

// The link to one task. Schedule tasks include their week; backlog and to-do
// tasks only need their list.
export function taskLinkHash(categoryId: string, taskId: string): string {
  const tab = tabForCategoryId(categoryId);
  if (isScheduleTab(tab)) {
    return boardLocationHash("schedule", tab, { categoryId, taskId });
  }
  // The term is ignored outside Schedule; "fall" is only a placeholder.
  return boardLocationHash(boardSectionForTab(tab), "fall", { taskId });
}

// Rows are keyed by task and section because a spanning task appears in more
// than one week.
export function taskAnchorId(categoryId: string, taskId: string): string {
  return `${TASK_PREFIX}${taskId}-${categoryId}`;
}
