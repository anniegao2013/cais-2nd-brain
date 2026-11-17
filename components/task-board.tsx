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
  BOARD_SECTIONS,
  boardSectionForTab,
  categoriesForTab,
  isScheduleTab,
  tabForCategoryId,
  type BoardSectionId,
  type ScheduleTabId,
  type TimelineTabId,
} from "@/lib/categories";
import { BoardHome } from "./board-home";
import { BoardNav } from "./board-nav";
import { TagFilter } from "./tag-filter";
import { TaskSection } from "./task-section";
import { MeetingSchedulePicker } from "./meeting-schedule-picker";
import { EboardAgenda } from "./eboard-agenda";
import { HistoryControls } from "./history-controls";
import { DeletedTasks } from "./deleted-tasks";
import { ResetBoard } from "./reset-board";

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
  // Home is the landing view. It stands apart from the board tabs, so it keeps
  // its own flag instead of pretending to be a timeline tab.
  const [showHome, setShowHome] = useState(true);
  // Remember the term the viewer last looked at so hopping over to GM ideas or
  // To-do and back to Schedule returns to the same semester.
  const [lastScheduleTabId, setLastScheduleTabId] =
    useState<ScheduleTabId | null>(null);
  const [showEarlierSections, setShowEarlierSections] = useState(false);
  const hasAutoScrolled = useRef(false);
  const scrollIntent = useRef<"nav" | "content" | "boundary" | null>(null);

  const currentTabId =
    currentWeekCategoryId === null
      ? null
      : tabForCategoryId(currentWeekCategoryId);
  const currentScheduleTabId: ScheduleTabId =
    currentTabId !== null && isScheduleTab(currentTabId)
      ? currentTabId
      : "fall";
  const activeTabId = selectedTabId ?? currentTabId ?? "fall";
  const activeSection: BoardSectionId = showHome
    ? "home"
    : boardSectionForTab(activeTabId);
  const activeSectionLabel =
    BOARD_SECTIONS.find((section) => section.id === activeSection)?.label ?? "";
  const activeScheduleTabId: ScheduleTabId = isScheduleTab(activeTabId)
    ? activeTabId
    : (lastScheduleTabId ?? currentScheduleTabId);
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
  // earlier sections every time the board loads. Switching sections or terms
  // jumps to the start of the content below the sticky nav, and revealing or
  // hiding the mask stays anchored at the boundary.
  useEffect(() => {
    const intent = scrollIntent.current;
    if (intent) {
      scrollIntent.current = null;
      if (intent === "nav") {
        document.getElementById("board-nav")?.scrollIntoView({ block: "start" });
      } else if (intent === "content") {
        (
          document.getElementById("board-panel") ??
          document.getElementById("board-home")
        )?.scrollIntoView({ block: "start" });
      } else {
        boundaryElement()?.scrollIntoView({ block: "start" });
      }
      return;
    }

    if (hasAutoScrolled.current || currentWeekCategoryId === null) return;
    if (activeSection !== "schedule") return;
    if (tabForCategoryId(currentWeekCategoryId) !== activeTabId) return;

    hasAutoScrolled.current = true;
    boundaryElement()?.scrollIntoView({ block: "start" });
    // boundaryElement reads currentWeekCategoryId from this render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTabId, activeSection, showEarlierSections, currentWeekCategoryId]);

  function selectTab(tabId: TimelineTabId, forceContent = false) {
    setShowEarlierSections(false);
    if (isScheduleTab(tabId)) setLastScheduleTabId(tabId);

    if (tabId === activeTabId && !forceContent) {
      scrollIntent.current = "nav";
      document.getElementById("board-nav")?.scrollIntoView({ block: "start" });
      return;
    }

    scrollIntent.current = "content";
    setSelectedTabId(tabId);
  }

  function selectSection(section: BoardSectionId) {
    if (section === "home") {
      setShowHome(true);
      scrollIntent.current = "content";
      return;
    }

    const wasHome = showHome;
    setShowHome(false);

    if (section === "schedule") {
      // The first time you open Schedule in a session, take you straight to the
      // week you are in rather than the top of the semester.
      const jumpToCurrentWeek =
        wasHome &&
        !hasAutoScrolled.current &&
        currentWeekCategoryId !== null &&
        currentTabId === activeScheduleTabId;
      selectTab(activeScheduleTabId, wasHome);
      if (jumpToCurrentWeek) {
        hasAutoScrolled.current = true;
        scrollIntent.current = "boundary";
      }
      return;
    }

    selectTab(section, wasHome);
  }

  function toggleEarlierSections() {
    scrollIntent.current = "boundary";
    setShowEarlierSections((shown) => !shown);
  }

  return (
    <>
      <BoardNav
        activeSection={activeSection}
        activeScheduleTab={activeScheduleTabId}
        onSelectSection={selectSection}
        onSelectScheduleTab={selectTab}
      />
      {activeSection === "home" ? (
        <BoardHome onSelectSection={selectSection} />
      ) : (
        <div className="mx-auto w-full max-w-2xl px-6 py-10">
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
            {activeSectionLabel}
          </h1>
          <p className="mt-1 text-xs tabular-nums text-zinc-500 dark:text-zinc-400">
            {tabSummary(activeTabId)}
          </p>

          <div className="mt-6 flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <TagFilter board={board} />
            </div>
            <div className="flex flex-wrap items-center justify-end gap-1.5">
              <DeletedTasks board={board} />
              <HistoryControls board={board} />
              <ResetBoard board={board} />
            </div>
          </div>

          <MeetingSchedulePicker board={board} />

          <div
            id="board-panel"
            role={isScheduleTab(activeTabId) ? "tabpanel" : "region"}
            aria-labelledby={
              isScheduleTab(activeTabId)
                ? `timeline-tab-${activeTabId}`
                : `board-nav-${activeSection}`
            }
            className="mt-8 flex scroll-mt-24 flex-col gap-10"
          >
            {activeTabId === "eboard-agenda" ? (
              <EboardAgenda board={board} />
            ) : (
              <>
                {hiddenSectionCount > 0 && (
                  <div
                    id="past-sections-toggle"
                    className="flex scroll-mt-24 items-center gap-3"
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
                {board.activeTags.length > 0 &&
                  board.filteredTaskCount === 0 && (
                    <p className="text-sm text-zinc-500 dark:text-zinc-400">
                      No tasks match these tags.
                    </p>
                  )}
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
