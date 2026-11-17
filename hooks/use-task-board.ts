"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { CATEGORIES } from "@/lib/categories";
import { currentWeekCategoryId } from "@/lib/calendar";
import {
  gmEventOptions as buildGmEventOptions,
  gmMonthOptions as buildGmMonthOptions,
} from "@/lib/gm-events";
import { syncRecurringGmTasks } from "@/lib/recurring-gm-tasks";
import { syncRecurringEboardAgenda } from "@/lib/recurring-eboard-tasks";
import { resolveMeetingSchedule } from "@/lib/meeting";
import * as meetingActions from "@/lib/meeting-actions";
import { restoreDeletedBatch } from "@/lib/deleted-tasks";
import {
  canRedo,
  canUndo,
  commitState,
  defaultBoardState,
  getServerSnapshot,
  getSnapshot,
  hydrateFromServer,
  redo,
  refreshFromStorage,
  setState,
  STORAGE_KEY,
  subscribe,
  undo,
} from "@/lib/storage";
import { matchesTagFilter, TAGS, type TagId } from "@/lib/tags";
import * as dependencyActions from "@/lib/dependency-actions";
import * as spanActions from "@/lib/span-actions";
import * as socialPollActions from "@/lib/social-polls";
import * as taskActions from "@/lib/task-actions";
import { allTasks, findTask } from "@/lib/tasks";
import type { AppState, Task } from "@/lib/types";

// Materialize the recurring prep work for the week the viewer is in. Reset
// uses the same helper so a fresh board still has the current week's tasks.
function withCurrentWeekTasks(state: AppState): AppState {
  const categoryId = currentWeekCategoryId();
  const withGmTasks = syncRecurringGmTasks(state, categoryId);
  return (
    syncRecurringEboardAgenda(withGmTasks ?? state, categoryId) ??
    withGmTasks ??
    state
  );
}

function useTaskStore() {
  const state = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot,
  );

  // Keep multiple tabs in sync.
  useEffect(() => {
    function handleStorage(event: StorageEvent) {
      if (event.key === STORAGE_KEY) refreshFromStorage();
    }
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);

  return state;
}

export function useTaskBoard() {
  const state = useTaskStore();
  const [storageReady, setStorageReady] = useState(false);

  // Load the server copy before rendering or running any recurring sync, so a
  // brand-new tab cannot overwrite the saved board with seeded defaults.
  useEffect(() => {
    let active = true;
    void hydrateFromServer().finally(() => {
      if (active) setStorageReady(true);
    });
    return () => {
      active = false;
    };
  }, []);

  // Materialize the current week's GM prep tasks and e-board agenda. Re-check
  // periodically so a tab left open across a week boundary picks up the next
  // meeting.
  useEffect(() => {
    if (!storageReady) return;

    function sync() {
      const current = getSnapshot();
      const next = withCurrentWeekTasks(current);
      if (next !== current) setState(next);
    }

    sync();
    const timer = window.setInterval(sync, 60_000);
    return () => window.clearInterval(timer);
  }, [storageReady]);

  // Leave native text editing shortcuts alone; the board shortcuts only apply
  // when focus is outside a form control.
  useEffect(() => {
    function handleHistoryShortcut(event: KeyboardEvent) {
      if (!(event.metaKey || event.ctrlKey) || event.altKey) return;

      const target = event.target as HTMLElement | null;
      const tagName = target?.tagName;
      if (
        target?.isContentEditable ||
        tagName === "INPUT" ||
        tagName === "TEXTAREA" ||
        tagName === "SELECT"
      ) {
        return;
      }

      const key = event.key.toLowerCase();
      if (key === "z") {
        const action = event.shiftKey ? redo : undo;
        if (event.shiftKey ? !canRedo() : !canUndo()) return;
        event.preventDefault();
        action();
      } else if (key === "y") {
        if (!canRedo()) return;
        event.preventDefault();
        redo();
      }
    }

    window.addEventListener("keydown", handleHistoryShortcut);
    return () => window.removeEventListener("keydown", handleHistoryShortcut);
  }, []);

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

  const gmEventOptions = buildGmEventOptions(state);
  const gmMonthOptions = buildGmMonthOptions(state);
  const meetingSchedule = resolveMeetingSchedule(state);

  function matchesFilter(task: Task) {
    return matchesTagFilter(task.tags, activeTags);
  }

  function clearTagFilter() {
    setActiveTags([]);
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
    const result = taskActions.addTask(state, categoryId, {
      text: String(data.get("text") ?? ""),
      afterId: String(data.get("after") ?? ""),
      beforeId: String(data.get("before") ?? ""),
      endCategoryId: String(data.get("end") ?? ""),
      dueDate: String(data.get("due") ?? ""),
    });

    if (result.error) {
      setAddError({ categoryId, message: result.error });
      return;
    }
    if (!result.state) return;

    commitState(result.state);
    setAddError(null);
    form.reset();
  }

  function addSubtask(parentId: string) {
    const next = taskActions.addSubtask(
      state,
      parentId,
      subtaskText,
      subtaskCategoryId,
    );
    if (!next) return;

    commitState(next);
    setSubtaskParentId(null);
    setSubtaskText("");
  }

  function updateSubtaskLead(
    categoryId: string,
    taskId: string,
    rawLead: number,
  ) {
    const next = taskActions.updateSubtaskLead(
      state,
      categoryId,
      taskId,
      rawLead,
    );
    if (next) commitState(next);
  }

  function addDependency(taskId: string) {
    const result = dependencyActions.addDependency(
      state,
      taskId,
      depAfterId,
      depBeforeId,
    );
    if (result.error) {
      setDepError(result.error);
      return;
    }
    if (!result.state) return;

    commitState(result.state);
    setDepAfterId("");
    setDepBeforeId("");
    setDepError(null);
  }

  function removeDependency(before: string, after: string) {
    commitState(dependencyActions.removeDependency(state, before, after));
    setDepError(null);
  }

  function renameTask(categoryId: string, taskId: string, rawTitle: string) {
    const result = taskActions.renameTask(state, categoryId, taskId, rawTitle);
    if (result.error) {
      setTitleError(result.error);
      return;
    }
    if (!result.state) return;

    commitState(result.state);
    setTitleDraft(rawTitle.trim());
    setTitleError(null);
  }

  function setTaskSpan(
    categoryId: string,
    taskId: string,
    endCategoryId: string,
  ) {
    const next = spanActions.setTaskSpan(
      state,
      categoryId,
      taskId,
      endCategoryId,
    );
    if (next) commitState(next);
  }

  function toggleTag(categoryId: string, taskId: string, tagId: TagId) {
    commitState(taskActions.toggleTaskTag(state, categoryId, taskId, tagId));
  }

  function togglePollInterest(pollId: string) {
    const next = socialPollActions.togglePollInterest(state, pollId);
    if (next) commitState(next);
  }

  function cancelEditingNotes() {
    setNotesTaskId(null);
    setNotesDraft("");
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
      parentLocation ? `${parentId}:${parentLocation.categoryId}` : null,
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
    commitState(taskActions.updateTaskNotes(state, categoryId, taskId, notesDraft));
    setNotesTaskId(null);
    setNotesDraft("");
  }

  function toggleTask(categoryId: string, taskId: string) {
    commitState(taskActions.toggleTaskDone(state, categoryId, taskId));
  }

  function removeTask(taskId: string) {
    const result = taskActions.deleteTask(state, taskId);
    if (!result) return;

    commitState(result.state);
    if (subtaskParentId === taskId) setSubtaskParentId(null);
    if (notesTaskId && result.removedIds.has(notesTaskId)) setNotesTaskId(null);
    if (
      expandedRowKey &&
      [...result.removedIds].some((id) => expandedRowKey.startsWith(`${id}:`))
    ) {
      setExpandedRowKey(null);
    }
  }

  function restoreDeleted(batchId: string) {
    const next = restoreDeletedBatch(state, batchId);
    if (next) commitState(next);
  }

  // Factory reset for the next year: drop user content, restore the seeded
  // board, and clear any UI drafts that pointed at the old tasks. Committing it
  // keeps the reset undoable until the page reloads.
  function resetBoard() {
    commitState(withCurrentWeekTasks(defaultBoardState()));
    setSubtaskParentId(null);
    setSubtaskText("");
    setNotesTaskId(null);
    setNotesDraft("");
    setExpandedRowKey(null);
    setPanelMode("view");
    setTitleDraft("");
    setTitleError(null);
    setDepAfterId("");
    setDepBeforeId("");
    setDepError(null);
    setAddError(null);
    setActiveTags([]);
  }

  function moveTask(
    fromCategoryId: string,
    taskId: string,
    toCategoryId: string,
  ) {
    const next = taskActions.moveTask(
      state,
      fromCategoryId,
      taskId,
      toCategoryId,
    );
    if (next) commitState(next);
  }

  function assignGmIdea(ideaId: string, gmEventId: string) {
    const next = taskActions.assignGmIdea(state, ideaId, gmEventId);
    if (next) commitState(next);
  }

  function returnGmIdea(taskId: string) {
    const next = taskActions.returnGmIdea(state, taskId);
    if (next) commitState(next);
  }

  function setGmIdeaSuggestedMonth(ideaId: string, month: string) {
    const next = taskActions.setGmIdeaSuggestedMonth(state, ideaId, month);
    if (next) commitState(next);
  }

  function setTodoDueDate(categoryId: string, taskId: string, dueDate: string) {
    const next = taskActions.setTodoDueDate(state, categoryId, taskId, dueDate);
    if (next) commitState(next);
  }

  function setMeetingSchedule(weekday: number, time: string) {
    const next = meetingActions.setMeetingSchedule(state, weekday, time);
    if (next) commitState(next);
  }

  const tasks = allTasks(state);
  const totalTaskCount = tasks.length;
  const filteredTaskCount = tasks.filter(matchesFilter).length;

  return {
    state,
    storageReady,
    canUndo: canUndo(),
    canRedo: canRedo(),
    undo,
    redo,
    deletedTasks: state.deletedTasks ?? [],
    restoreDeleted,
    resetBoard,
    tags: TAGS,
    taskOptions,
    gmEventOptions,
    gmMonthOptions,
    meetingSchedule,
    setMeetingSchedule,
    activeTags,
    totalTaskCount,
    filteredTaskCount,
    matchesFilter,
    clearTagFilter,
    toggleTagFilter,
    addTask,
    addError,
    addSubtask,
    subtaskParentId,
    setSubtaskParentId,
    subtaskText,
    setSubtaskText,
    subtaskCategoryId,
    setSubtaskCategoryId,
    updateSubtaskLead,
    addDependency,
    removeDependency,
    depAfterId,
    setDepAfterId,
    depBeforeId,
    setDepBeforeId,
    depError,
    setDepError,
    renameTask,
    titleDraft,
    setTitleDraft,
    titleError,
    setTitleError,
    setTaskSpan,
    toggleTag,
    togglePollInterest,
    notesTaskId,
    notesDraft,
    setNotesDraft,
    cancelEditingNotes,
    startEditingNotes,
    saveNotes,
    togglePanel,
    expandedRowKey,
    panelMode,
    goToParent,
    toggleTask,
    removeTask,
    moveTask,
    assignGmIdea,
    returnGmIdea,
    setGmIdeaSuggestedMonth,
    setTodoDueDate,
  };
}

export type TaskBoardController = ReturnType<typeof useTaskBoard>;
