"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { CATEGORIES } from "@/lib/categories";
import { currentWeekCategoryId } from "@/lib/calendar";
import {
  gmEventOptions as buildGmEventOptions,
  gmMonthOptions as buildGmMonthOptions,
} from "@/lib/gm-events";
import { syncRecurringGmTasks } from "@/lib/recurring-gm-tasks";
import { syncRecurringEboardAgenda } from "@/lib/recurring-eboard-tasks";
import {
  meetingTimeLabel,
  resolveMeetingSchedule,
  weekdayLabel,
} from "@/lib/meeting";
import * as meetingActions from "@/lib/meeting-actions";
import { restoreDeletedBatch } from "@/lib/deleted-tasks";
import { taskAnchorId, taskLinkHash } from "@/lib/board-location";
import { copyText } from "@/lib/clipboard";
import {
  canRedo,
  canUndo,
  commitState,
  defaultBoardState,
  getRedoLabel,
  getServerSnapshot,
  getSnapshot,
  getUndoLabel,
  hydrateFromServer,
  redo,
  refreshFromStorage,
  setState,
  startRemoteSync,
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

export type BoardToast = {
  id: string;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
};

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

  // Watch the shared copy so a teammate's save is noticed without a reload.
  useEffect(() => startRemoteSync(), []);

  return state;
}

export function useTaskBoard() {
  const state = useTaskStore();
  const [storageReady, setStorageReady] = useState(false);
  const [toast, setToast] = useState<BoardToast | null>(null);
  const [hideCompleted, setHideCompleted] = useState(false);
  const toastTimer = useRef<number | null>(null);

  function dismissToast() {
    if (toastTimer.current) {
      window.clearTimeout(toastTimer.current);
      toastTimer.current = null;
    }
    setToast(null);
  }

  function showToast(
    message: string,
    action?: Pick<BoardToast, "actionLabel" | "onAction">,
  ) {
    if (typeof window === "undefined") return;
    if (toastTimer.current) window.clearTimeout(toastTimer.current);
    setToast({ id: crypto.randomUUID(), message, ...action });
    toastTimer.current = window.setTimeout(() => {
      toastTimer.current = null;
      setToast(null);
    }, 6_000);
  }

  // Every user edit dismisses a stale undo toast before it can point at the
  // wrong change.
  function commit(next: AppState, label: string) {
    commitState(next, label);
    dismissToast();
  }

  function undoBoard() {
    undo();
    dismissToast();
  }

  function redoBoard() {
    redo();
    dismissToast();
  }

  useEffect(() => {
    return () => {
      if (toastTimer.current) window.clearTimeout(toastTimer.current);
    };
  }, []);

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
        setToast(null);
        action();
      } else if (key === "y") {
        if (!canRedo()) return;
        event.preventDefault();
        setToast(null);
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
      tags: activeTags.length > 0 ? [...activeTags] : undefined,
    });

    if (result.error) {
      setAddError({ categoryId, message: result.error });
      return;
    }
    if (!result.state) return;

    commit(result.state, "added a task");
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

    commit(next, "added a subtask");
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
    if (next) commit(next, "changed a lead time");
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

    commit(result.state, "added an ordering rule");
    setDepBeforeId("");
    setDepError(null);
  }

  function removeDependency(before: string, after: string) {
    commit(
      dependencyActions.removeDependency(state, before, after),
      "removed an ordering rule",
    );
    setDepError(null);
  }

  function renameTask(categoryId: string, taskId: string, rawTitle: string) {
    const result = taskActions.renameTask(state, categoryId, taskId, rawTitle);
    if (result.error) {
      setTitleError(result.error);
      return;
    }
    if (!result.state) return;

    commit(result.state, "renamed a task");
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
    if (next) commit(next, "changed a task span");
  }

  function toggleTag(categoryId: string, taskId: string, tagId: TagId) {
    commit(
      taskActions.toggleTaskTag(state, categoryId, taskId, tagId),
      "changed a task tag",
    );
  }

  function togglePollInterest(pollId: string) {
    const next = socialPollActions.togglePollInterest(state, pollId);
    if (next) commit(next, "changed event interest");
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
      ? taskAnchorId(parentLocation.categoryId, parentId)
      : null;
    requestAnimationFrame(() => {
      if (!targetId) return;
      document
        .getElementById(targetId)
        ?.scrollIntoView({ behavior: "smooth", block: "center" });
    });
  }

  function saveNotes(categoryId: string, taskId: string) {
    commit(
      taskActions.updateTaskNotes(state, categoryId, taskId, notesDraft),
      "updated a description",
    );
    setNotesTaskId(null);
    setNotesDraft("");
  }

  function toggleTask(categoryId: string, taskId: string) {
    const task = findTask(state, taskId)?.task;
    commit(
      taskActions.toggleTaskDone(state, categoryId, taskId),
      task?.done ? "reopened a task" : "completed a task",
    );
  }

  function removeTask(taskId: string) {
    const result = taskActions.deleteTask(state, taskId);
    if (!result) return;

    const removed = findTask(state, taskId)?.task;
    commit(result.state, "deleted a task");
    if (subtaskParentId === taskId) setSubtaskParentId(null);
    if (notesTaskId && result.removedIds.has(notesTaskId)) setNotesTaskId(null);
    if (
      expandedRowKey &&
      [...result.removedIds].some((id) => expandedRowKey.startsWith(`${id}:`))
    ) {
      setExpandedRowKey(null);
    }
    showToast(
      removed ? `Deleted “${removed.text}”` : "Deleted a task",
      { actionLabel: "Undo", onAction: undoBoard },
    );
  }

  function restoreDeleted(batchId: string) {
    const next = restoreDeletedBatch(state, batchId);
    if (next) commit(next, "restored deleted tasks");
  }

  // Factory reset for the next year: drop user content, restore the seeded
  // board, and clear any UI drafts that pointed at the old tasks. Committing it
  // keeps the reset undoable until the page reloads.
  function resetBoard() {
    commit(withCurrentWeekTasks(defaultBoardState()), "reset the board");
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
    showToast("Reset the board to the seeded schedule", {
      actionLabel: "Undo",
      onAction: undoBoard,
    });
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
    if (next) commit(next, "moved a task");
  }

  function assignGmIdea(ideaId: string, gmEventId: string) {
    const next = taskActions.assignGmIdea(state, ideaId, gmEventId);
    if (next) commit(next, "assigned a GM idea");
  }

  function returnGmIdea(taskId: string) {
    const next = taskActions.returnGmIdea(state, taskId);
    if (next) commit(next, "returned a GM idea");
  }

  function setGmIdeaSuggestedMonth(ideaId: string, month: string) {
    const next = taskActions.setGmIdeaSuggestedMonth(state, ideaId, month);
    if (next) commit(next, "changed a GM idea month");
  }

  function setTodoDueDate(categoryId: string, taskId: string, dueDate: string) {
    const next = taskActions.setTodoDueDate(state, categoryId, taskId, dueDate);
    if (next) commit(next, "changed a due date");
  }

  function duplicateTask(categoryId: string, taskId: string) {
    const next = taskActions.duplicateTask(state, categoryId, taskId);
    if (next) commit(next, "duplicated a task");
  }

  function clearCompleted(categoryId: string) {
    const result = taskActions.clearCompletedTasks(state, categoryId);
    if (!result) return;

    commit(result.state, "cleared completed tasks");
    showToast(
      `Cleared ${result.count} completed ${
        result.count === 1 ? "task" : "tasks"
      } · Recently deleted`,
      { actionLabel: "Undo", onAction: undoBoard },
    );
  }

  function copyTaskLink(categoryId: string, taskId: string) {
    const hash = taskLinkHash(categoryId, taskId);
    const url = `${window.location.origin}${window.location.pathname}${hash}`;
    void copyText(url).then((copied) =>
      showToast(copied ? "Task link copied" : "Could not copy the link"),
    );
  }

  function setMeetingSchedule(weekday: number, time: string) {
    const next = meetingActions.setMeetingSchedule(state, weekday, time);
    if (!next) return;
    commit(next, "changed the meeting schedule");
    showToast(
      `Meeting moved to ${weekdayLabel(weekday)} at ${meetingTimeLabel(time)}`,
      { actionLabel: "Undo", onAction: undoBoard },
    );
  }

  const tasks = allTasks(state);
  const totalTaskCount = tasks.length;
  const completedTaskCount = tasks.filter((task) => task.done).length;
  const filteredTaskCount = tasks.filter(matchesFilter).length;

  return {
    state,
    storageReady,
    toast,
    dismissToast,
    showToast,
    canUndo: canUndo(),
    canRedo: canRedo(),
    undoLabel: getUndoLabel(),
    redoLabel: getRedoLabel(),
    undo: undoBoard,
    redo: redoBoard,
    hideCompleted,
    setHideCompleted,
    toggleHideCompleted: () => setHideCompleted((hidden) => !hidden),
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
    completedTaskCount,
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
    duplicateTask,
    clearCompleted,
    copyTaskLink,
    assignGmIdea,
    returnGmIdea,
    setGmIdeaSuggestedMonth,
    setTodoDueDate,
  };
}

export type TaskBoardController = ReturnType<typeof useTaskBoard>;
