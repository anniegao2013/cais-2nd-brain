"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { CATEGORIES } from "@/lib/categories";
import {
  getServerSnapshot,
  getSnapshot,
  refreshFromStorage,
  setState,
  STORAGE_KEY,
  subscribe,
} from "@/lib/storage";
import { matchesTagFilter, TAGS, type TagId } from "@/lib/tags";
import * as dependencyActions from "@/lib/dependency-actions";
import * as spanActions from "@/lib/span-actions";
import * as taskActions from "@/lib/task-actions";
import { allTasks, findTask } from "@/lib/tasks";
import type { Task } from "@/lib/types";

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
    });

    if (result.error) {
      setAddError({ categoryId, message: result.error });
      return;
    }
    if (!result.state) return;

    setState(result.state);
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

    setState(next);
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
    if (next) setState(next);
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

    setState(result.state);
    setDepAfterId("");
    setDepBeforeId("");
    setDepError(null);
  }

  function removeDependency(before: string, after: string) {
    setState(dependencyActions.removeDependency(state, before, after));
    setDepError(null);
  }

  function renameTask(categoryId: string, taskId: string, rawTitle: string) {
    const result = taskActions.renameTask(state, categoryId, taskId, rawTitle);
    if (result.error) {
      setTitleError(result.error);
      return;
    }
    if (!result.state) return;

    setState(result.state);
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
    if (next) setState(next);
  }

  function toggleTag(categoryId: string, taskId: string, tagId: TagId) {
    setState(taskActions.toggleTaskTag(state, categoryId, taskId, tagId));
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
    setState(taskActions.updateTaskNotes(state, categoryId, taskId, notesDraft));
    setNotesTaskId(null);
    setNotesDraft("");
  }

  function toggleTask(categoryId: string, taskId: string) {
    setState(taskActions.toggleTaskDone(state, categoryId, taskId));
  }

  function removeTask(taskId: string) {
    const result = taskActions.deleteTask(state, taskId);
    if (!result) return;

    setState(result.state);
    if (subtaskParentId === taskId) setSubtaskParentId(null);
    if (notesTaskId && result.removedIds.has(notesTaskId)) setNotesTaskId(null);
    if (
      expandedRowKey &&
      [...result.removedIds].some((id) => expandedRowKey.startsWith(`${id}:`))
    ) {
      setExpandedRowKey(null);
    }
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
    if (next) setState(next);
  }

  const tasks = allTasks(state);
  const totalTaskCount = tasks.length;
  const filteredTaskCount = tasks.filter(matchesFilter).length;

  return {
    state,
    tags: TAGS,
    taskOptions,
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
  };
}

export type TaskBoardController = ReturnType<typeof useTaskBoard>;
