"use client";

import { useEffect, useRef, useState } from "react";
import { useCurrentWeek } from "@/hooks/use-current-week";
import { useTaskBoard, type TaskBoardController } from "@/hooks/use-task-board";
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
import { MeetingSchedulePicker } from "./meeting-schedule-picker";
import { EboardAgenda } from "./eboard-agenda";
import { HistoryControls } from "./history-controls";
import { DeletedTasks } from "./deleted-tasks";

function tabSummary(tabId: TimelineTabId): string {
  if (tabId === "before") {
    return "Tasks from before the academic year begins.";
  }
  if (tabId === "gm-ideas") {
    return "A running list of ideas for future GMs. Assign an idea to a GM to schedule it.";
  }
  if (tabId === "todos") {
    return "A checklist grouped by due date: overdue, urgent, next week, and next month.";
  }
  if (tabId === "eboard-agenda") {
    return "The next e-board meeting, built from the weeks it covers and open to-dos.";
  }

  const weekCount = tabId === "fall" ? WEEK_COUNT : SPRING_WEEK_COUNT;
  const prefix = tabId === "fall" ? "Fall weeks" : "Spring weeks";
  return `${prefix} 1–${weekCount} run ${semesterRangeLabel(tabId)}.`;
}

function BoardLoading() {
  return (
    <div className="mx-auto w-full max-w-5xl px-6 py-10">
      <p className="text-sm text-zinc-500 dark:text-zinc-400">
        Loading the saved board…
      </p>
    </div>
  );
}

export default function TaskBoard() {
  const board = useTaskBoard();

  if (!board.storageReady) return <BoardLoading />;
  return <TaskBoardContent board={board} />;
}

function TaskBoardContent({ board }: { board: TaskBoardController }) {
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
        to add a subtask in the same or an earlier section; GM events use
        Add task instead. Open a subtask to edit its lead time. Click ▸ or the
        task title to read the description, and use Edit to change the title,
        description, tags, span, and ordering rules. Ordering can also be set
        when adding an event. Use the tabs to switch between the pre-year list,
        each semester, the GM ideas backlog, and the to-do list. Suggest a month
        for an idea to group matching GM weeks first, then assign it to one of
        them; Return to ideas sends it back. To-dos are undated reminders unless
        you add a due date; items are grouped as overdue, urgent (today or
        tomorrow), within the next week, within the next month, or later. When
        the current week has a GM, it also gets Update social points and Make GM
        slides as weekly prep tasks. Weeks with an e-board meeting also add Make
        e-board meeting agenda to the to-do list; the agenda is skipped only
        when the meeting day itself falls on a USC holiday. The filter bar shows
        only tasks with
        selected tags. Tasks marked Suggestion are just ideas for social
        events, not events that are already planned: keep, move, rename, or
        delete them as you like. Set the weekly e-board meeting day and time in
        the meeting card above the tabs; GM rows use that day and time. The
        E-board agenda tab drafts the next meeting from the events and open
        to-dos it covers; meetings after the Wednesday GM start with the
        following week, and weeks without a meeting roll into the meeting before
        them.
      </p>

      <div className="mt-6 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <TagFilter board={board} />
        </div>
        <div className="flex flex-wrap items-center justify-end gap-1.5">
          <DeletedTasks board={board} />
          <HistoryControls board={board} />
        </div>
      </div>

      <MeetingSchedulePicker board={board} />

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
        {activeTabId === "eboard-agenda" ? (
          <EboardAgenda board={board} />
        ) : (
          <>
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
          </>
        )}
      </div>
    </div>
  );
}
