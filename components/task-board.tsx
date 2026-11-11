"use client";

import { useEffect, useRef, useState } from "react";
import { useCurrentWeek } from "@/hooks/use-current-week";
import { useTaskBoard } from "@/hooks/use-task-board";
import {
  SPRING_WEEK_COUNT,
  WEEK_COUNT,
  semesterRangeLabel,
} from "@/lib/calendar";
import {
  TIMELINE_TABS,
  categoriesForTab,
  tabForCategoryId,
  type TimelineTabId,
} from "@/lib/categories";
import { TagFilter } from "./tag-filter";
import { TaskSection } from "./task-section";

function tabSummary(tabId: TimelineTabId): string {
  if (tabId === "before") {
    return "Tasks from before the academic year begins.";
  }

  const weekCount = tabId === "fall" ? WEEK_COUNT : SPRING_WEEK_COUNT;
  return `Weeks 1–${weekCount} run ${semesterRangeLabel(tabId)}.`;
}

export default function TaskBoard() {
  const board = useTaskBoard();
  const currentWeekCategoryId = useCurrentWeek();
  const [selectedTabId, setSelectedTabId] = useState<TimelineTabId | null>(
    null,
  );
  const [showEarlierSections, setShowEarlierSections] = useState(false);
  const hasAutoScrolled = useRef(false);
  const scrollIntent = useRef<"tabs" | "boundary" | null>(null);

  const currentTabId =
    currentWeekCategoryId === null
      ? null
      : tabForCategoryId(currentWeekCategoryId);
  const activeTabId = selectedTabId ?? currentTabId ?? "fall";
  const tabCategories = categoriesForTab(activeTabId);
  const currentWeekIndex =
    currentWeekCategoryId === null
      ? -1
      : tabCategories.findIndex(
          (category) => category.id === currentWeekCategoryId,
        );
  const hiddenSectionCount = Math.max(0, currentWeekIndex);
  const visibleCategories =
    showEarlierSections || hiddenSectionCount === 0
      ? tabCategories
      : tabCategories.slice(currentWeekIndex);

  function boundaryElement(): HTMLElement | null {
    return (
      document.getElementById("past-sections-toggle") ??
      (currentWeekCategoryId === null
        ? null
        : document.getElementById(`${currentWeekCategoryId}-section`))
    );
  }

  // Land on the week the viewer is in instead of making them scroll past the
  // earlier sections every time the board loads. Switching tabs starts at the
  // tab bar, and revealing or hiding the mask stays anchored at the boundary.
  useEffect(() => {
    const intent = scrollIntent.current;
    if (intent) {
      scrollIntent.current = null;
      const target =
        intent === "tabs"
          ? document.getElementById("timeline-tabs")
          : boundaryElement();
      target?.scrollIntoView({ block: "start" });
      return;
    }

    if (hasAutoScrolled.current || currentWeekCategoryId === null) return;
    if (tabForCategoryId(currentWeekCategoryId) !== activeTabId) return;

    hasAutoScrolled.current = true;
    boundaryElement()?.scrollIntoView({ block: "start" });
    // boundaryElement reads currentWeekCategoryId from this render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTabId, showEarlierSections, currentWeekCategoryId]);

  function selectTab(tabId: TimelineTabId) {
    setShowEarlierSections(false);
    if (tabId === activeTabId) {
      document.getElementById("timeline-tabs")?.scrollIntoView({
        block: "start",
      });
      return;
    }
    scrollIntent.current = "tabs";
    setSelectedTabId(tabId);
  }

  function toggleEarlierSections() {
    scrollIntent.current = "boundary";
    setShowEarlierSections((shown) => !shown);
  }

  return (
    <div className="mx-auto w-full max-w-2xl px-6 py-12">
      <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
        Categories
      </h1>
      <p className="mt-1 text-xs tabular-nums text-zinc-500 dark:text-zinc-400">
        {tabSummary(activeTabId)}
      </p>
      <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
        Add tasks under the part of the year they belong to. Default events are
        already listed and can be moved to another section. Tasks can also span
        several weeks: pick an end section when adding one, or change it while
        editing, and the task will be listed under every week it covers. Use +
        to add a subtask in the same or an earlier section; open a subtask to
        edit its lead time. Click ▸ or the task title to read the description,
        and use Edit to change the title, description, tags, span, and ordering
        rules. Ordering can also be set when adding an event. Use the tabs to
        switch between the pre-year list and each semester, and the filter bar
        to show only tasks with selected tags. Tasks marked Suggestion are just
        ideas for social events, not events that are already planned: keep,
        move, rename, or delete them as you like.
      </p>

      <TagFilter board={board} />

      <div
        id="timeline-tabs"
        role="tablist"
        aria-label="Timeline terms"
        className="mt-8 flex scroll-mt-6 gap-1 overflow-x-auto rounded-full border border-zinc-200 bg-zinc-50 p-1 dark:border-zinc-800 dark:bg-zinc-900"
      >
        {TIMELINE_TABS.map((tab) => {
          const active = tab.id === activeTabId;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              id={`timeline-tab-${tab.id}`}
              aria-selected={active}
              onClick={() => selectTab(tab.id)}
              className={
                active
                  ? "flex-1 whitespace-nowrap rounded-full bg-white px-3 py-1.5 text-xs font-medium text-zinc-900 shadow-sm transition-colors dark:bg-zinc-800 dark:text-zinc-100"
                  : "flex-1 whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-medium text-zinc-500 transition-colors hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
              }
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      <div
        role="tabpanel"
        aria-labelledby={`timeline-tab-${activeTabId}`}
        className="mt-8 flex flex-col gap-10"
      >
        {hiddenSectionCount > 0 && (
          <div
            id="past-sections-toggle"
            className="flex scroll-mt-6 items-center gap-3"
          >
            <span
              aria-hidden="true"
              className="h-px flex-1 bg-zinc-200 dark:bg-zinc-800"
            />
            <button
              type="button"
              onClick={toggleEarlierSections}
              aria-expanded={showEarlierSections}
              className="rounded-full border border-zinc-200 bg-white px-3 py-1 text-[11px] font-medium text-zinc-600 transition-colors hover:border-zinc-400 hover:text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400 dark:hover:border-zinc-500 dark:hover:text-zinc-100"
            >
              {showEarlierSections
                ? "Hide earlier sections"
                : `Show ${hiddenSectionCount} earlier ${
                    hiddenSectionCount === 1 ? "section" : "sections"
                  }`}
            </button>
            <span
              aria-hidden="true"
              className="h-px flex-1 bg-zinc-200 dark:bg-zinc-800"
            />
          </div>
        )}

        {visibleCategories.map((category) => (
          <TaskSection
            key={category.id}
            board={board}
            category={category}
            isCurrentWeek={category.id === currentWeekCategoryId}
            currentWeekCategoryId={currentWeekCategoryId}
          />
        ))}
        {board.activeTags.length > 0 && board.filteredTaskCount === 0 && (
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            No tasks match these tags.
          </p>
        )}
      </div>
    </div>
  );
}
