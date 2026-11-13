import {
  CATEGORIES,
  GM_IDEAS_CATEGORY_ID,
  categoryIndex,
  isGmIdeasCategory,
  sectionLabel,
} from "./categories";
import { weekInfoFromCategoryId } from "./calendar";
import { sortState } from "./dependencies";
import { isGmEvent } from "./gm-events";
import { cleanNotes } from "./notes";
import { clampTaskSpan, moveBounds, shiftTaskSpan } from "./placement";
import { syncSocialFollowUps } from "./social-polls";
import { findTask } from "./tasks";
import type { TagId } from "./tags";
import type { AppState, Task, TasksByCategory } from "./types";

type TaskActionResult = { state?: AppState; error?: string };

export type NewTaskInput = {
  text: string;
  afterId: string;
  beforeId: string;
  endCategoryId: string;
};

export function addTask(
  state: AppState,
  categoryId: string,
  input: NewTaskInput,
): TaskActionResult {
  const text = input.text.trim();
  if (!text) return {};

  // Ideas are a plain backlog: ordering and spans do not apply.
  if (isGmIdeasCategory(categoryId)) {
    const idea: Task = { id: crypto.randomUUID(), text, done: false };
    return {
      state: {
        ...state,
        tasks: {
          ...state.tasks,
          [categoryId]: [...(state.tasks[categoryId] ?? []), idea],
        },
      },
    };
  }

  const { afterId, beforeId } = input;
  const endId = input.endCategoryId || categoryId;
  const targetIndex = categoryIndex(categoryId);
  const targetLabel = sectionLabel(categoryId);
  const endIndex = categoryIndex(endId);

  if (afterId && beforeId && afterId === beforeId) {
    return { error: "Choose two different tasks for the range." };
  }

  const afterLocation = afterId ? findTask(state, afterId) : null;
  const beforeLocation = beforeId ? findTask(state, beforeId) : null;

  if ((afterId && !afterLocation) || (beforeId && !beforeLocation)) {
    return { error: "That task no longer exists." };
  }

  if (
    afterLocation &&
    categoryIndex(afterLocation.categoryId) > targetIndex
  ) {
    return {
      error: `“${afterLocation.task.text}” is in ${sectionLabel(
        afterLocation.categoryId,
      )}, which is after ${targetLabel}.`,
    };
  }

  if (
    beforeLocation &&
    categoryIndex(beforeLocation.categoryId) < targetIndex
  ) {
    return {
      error: `“${beforeLocation.task.text}” is in ${sectionLabel(
        beforeLocation.categoryId,
      )}, which is before ${targetLabel}.`,
    };
  }

  if (
    afterLocation &&
    beforeLocation &&
    categoryIndex(afterLocation.categoryId) >
      categoryIndex(beforeLocation.categoryId)
  ) {
    return {
      error: "The task that must come first is already in a later section.",
    };
  }

  if (endIndex < targetIndex) {
    return { error: "The span must end at or after its starting section." };
  }

  if (beforeLocation && endIndex > categoryIndex(beforeLocation.categoryId)) {
    return {
      error: `The span must end at or before “${beforeLocation.task.text}”.`,
    };
  }

  const task: Task = { id: crypto.randomUUID(), text, done: false };
  if (endIndex > targetIndex) {
    task.endCategoryId = CATEGORIES[endIndex].id;
  }

  const dependencies = [...state.dependencies];
  if (afterLocation) {
    dependencies.push({ before: afterLocation.task.id, after: task.id });
  }
  if (beforeLocation) {
    dependencies.push({ before: task.id, after: beforeLocation.task.id });
  }

  return {
    state: sortState({
      ...state,
      tasks: {
        ...state.tasks,
        [categoryId]: [...(state.tasks[categoryId] ?? []), task],
      },
      dependencies,
    }),
  };
}

export function addSubtask(
  state: AppState,
  parentId: string,
  rawText: string,
  categoryId: string,
): AppState | null {
  const text = rawText.trim();
  if (!text) return null;

  const parent = findTask(state, parentId);
  if (!parent) return null;
  // Ideas do not have subtasks; assign them to a GM instead.
  if (isGmIdeasCategory(parent.categoryId)) return null;
  if (isGmIdeasCategory(categoryId)) return null;
  if (categoryIndex(categoryId) > categoryIndex(parent.categoryId)) {
    return null;
  }

  const subtask: Task = {
    id: crypto.randomUUID(),
    text,
    done: false,
    parentId,
  };
  return {
    ...state,
    tasks: {
      ...state.tasks,
      [categoryId]: [...(state.tasks[categoryId] ?? []), subtask],
    },
  };
}

export function updateSubtaskLead(
  state: AppState,
  categoryId: string,
  taskId: string,
  rawLead: number,
): AppState | null {
  const task = (state.tasks[categoryId] ?? []).find(
    (candidate) => candidate.id === taskId,
  );
  if (!task?.parentId) return null;

  const parent = findTask(state, task.parentId);
  if (!parent) return null;

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

  return sortState({ ...state, tasks });
}

export function renameTask(
  state: AppState,
  categoryId: string,
  taskId: string,
  rawTitle: string,
): TaskActionResult {
  const title = rawTitle.trim();
  if (!title) return { error: "A title can't be empty." };

  return {
    state: {
      ...state,
      tasks: {
        ...state.tasks,
        [categoryId]: (state.tasks[categoryId] ?? []).map((task) =>
          task.id === taskId ? { ...task, text: title } : task,
        ),
      },
    },
  };
}


export function toggleTaskTag(
  state: AppState,
  categoryId: string,
  taskId: string,
  tagId: TagId,
): AppState {
  const toggled: AppState = {
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
  };

  return syncSocialFollowUps(toggled);
}

export function updateTaskNotes(
  state: AppState,
  categoryId: string,
  taskId: string,
  rawNotes: string,
): AppState {
  const notes = cleanNotes(rawNotes);
  return {
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
  };
}

export function toggleTaskDone(
  state: AppState,
  categoryId: string,
  taskId: string,
): AppState {
  const target = (state.tasks[categoryId] ?? []).find(
    (task) => task.id === taskId,
  );
  // USC holidays are calendar reference rows, not tasks, so they stay open.
  if (!target || target.isHoliday) return state;

  return {
    ...state,
    tasks: {
      ...state.tasks,
      [categoryId]: (state.tasks[categoryId] ?? []).map((task) =>
        task.id === taskId ? { ...task, done: !task.done } : task,
      ),
    },
  };
}

export function deleteTask(
  state: AppState,
  taskId: string,
): { state: AppState; removedIds: Set<string> } | null {
  const task = findTask(state, taskId)?.task;
  if (!task) return null;

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

  return {
    state: {
      ...state,
      tasks,
      dependencies: state.dependencies.filter(
        (edge) => !removedIds.has(edge.before) && !removedIds.has(edge.after),
      ),
      removedDefaults: [
        ...new Set([...state.removedDefaults, ...removedIds]),
      ],
    },
    removedIds,
  };
}

export function moveTask(
  state: AppState,
  fromCategoryId: string,
  taskId: string,
  toCategoryId: string,
): AppState | null {
  if (fromCategoryId === toCategoryId) return null;
  // The GM ideas backlog is managed through assign/return, not free moves.
  if (isGmIdeasCategory(fromCategoryId) || isGmIdeasCategory(toCategoryId)) {
    return null;
  }

  const task = (state.tasks[fromCategoryId] ?? []).find(
    (candidate) => candidate.id === taskId,
  );
  if (!task) return null;

  const bounds = moveBounds(state, task);
  const targetIndex = categoryIndex(toCategoryId);
  if (targetIndex < bounds.min || targetIndex > bounds.max) return null;

  // Lead-time subtasks shift along with their parent to keep their gap.
  const delta = targetIndex - categoryIndex(fromCategoryId);
  const movedTask = shiftTaskSpan(task, delta);
  if (!movedTask) return null;

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
        if (newIndex < 0 || newIndex >= CATEGORIES.length) return null;
        // Spring lead tasks stop at the first spring week; they never move
        // back across the semester boundary into the fall.
        if (
          weekInfoFromCategoryId(categoryId)?.semesterId === "spring" &&
          weekInfoFromCategoryId(CATEGORIES[newIndex].id)?.semesterId !==
            "spring"
        ) {
          return null;
        }
        const shiftedTask = shiftTaskSpan(candidate, delta);
        if (!shiftedTask) return null;
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

  return sortState({ ...state, tasks });
}

// Moving an idea out of the backlog makes it a child task of the chosen GM so
// it appears alongside agenda items for that meeting.
export function assignGmIdea(
  state: AppState,
  ideaId: string,
  gmEventId: string,
): AppState | null {
  const ideaLocation = findTask(state, ideaId);
  if (!ideaLocation || !isGmIdeasCategory(ideaLocation.categoryId)) {
    return null;
  }

  const gmLocation = findTask(state, gmEventId);
  if (!gmLocation || !isGmEvent(gmLocation.task)) return null;

  const tasks: TasksByCategory = {};
  for (const [categoryId, list] of Object.entries(state.tasks)) {
    tasks[categoryId] = list.filter((task) => task.id !== ideaId);
  }

  const assigned: Task = {
    ...ideaLocation.task,
    parentId: gmEventId,
    gmIdea: true,
  };
  delete assigned.endCategoryId;
  delete assigned.leadWeeks;

  tasks[gmLocation.categoryId] = [
    ...(tasks[gmLocation.categoryId] ?? []),
    assigned,
  ];

  return sortState({ ...state, tasks });
}

// Sends an assigned idea back to the backlog without disturbing regular tasks
// that were added directly to the GM.
export function returnGmIdea(
  state: AppState,
  taskId: string,
): AppState | null {
  const location = findTask(state, taskId);
  if (!location?.task.gmIdea || !location.task.parentId) return null;

  const parent = findTask(state, location.task.parentId);
  if (!parent || !isGmEvent(parent.task)) return null;

  const tasks: TasksByCategory = {};
  for (const [categoryId, list] of Object.entries(state.tasks)) {
    tasks[categoryId] = list.filter((task) => task.id !== taskId);
  }

  const idea: Task = { ...location.task };
  delete idea.parentId;
  delete idea.gmIdea;
  delete idea.endCategoryId;
  delete idea.leadWeeks;

  tasks[GM_IDEAS_CATEGORY_ID] = [
    ...(tasks[GM_IDEAS_CATEGORY_ID] ?? []),
    idea,
  ];

  return sortState({ ...state, tasks });
}
