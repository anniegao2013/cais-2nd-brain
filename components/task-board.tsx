"use client";

import { useEffect, useRef, useState } from "react";
import { useCurrentWeek } from "@/hooks/use-current-week";
import { useTaskBoard, type TaskBoardController } from "@/hooks/use-task-board";
import { useTodayISO } from "@/hooks/use-today";
import { boardLocationHash, parseBoardHash, taskAnchorId } from "@/lib/board-location";
import { boardHomeSummary } from "@/lib/home-summary";
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
  sectionLabel,
  tabForCategoryId,
  type BoardSectionId,
  type ScheduleTabId,
  type TimelineTabId,
} from "@/lib/categories";
import { BoardHome } from "./board-home";
import { BoardNav } from "./board-nav";
import { FilteredAddTask } from "./filtered-add-task";
import { SaveStatus } from "./save-status";
import { TagFilter } from "./tag-filter";
import { TaskSection } from "./task-section";
import { MeetingSchedulePicker } from "./meeting-schedule-picker";
import { EboardAgenda } from "./eboard-agenda";
import { HistoryControls } from "./history-controls";
import { DeletedTasks } from "./deleted-tasks";
import { ResetBoard } from "./reset-board";
import { BoardSyncBanner } from "./board-sync-banner";
import { SearchPalette } from "./search-palette";
import { BoardToastView } from "./board-toast";

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
  const todayISO = useTodayISO();
  const [initialLocation] = useState(() =>
    parseBoardHash(
      typeof window === "undefined" ? "" : window.location.hash,
    ),
  );
  const [selectedTabId, setSelectedTabId] = useState<TimelineTabId | null>(
    initialLocation.section === "home"
      ? null
      : initialLocation.section === "schedule"
        ? initialLocation.tab
        : initialLocation.section,
  );
  // Home is the landing view unless the URL names another section. It stands
  // apart from the board tabs, so it keeps its own flag instead of pretending
  // to be a timeline tab.
  const [showHome, setShowHome] = useState(initialLocation.section === "home");
  // Remember the term the viewer last looked at so hopping over to GM ideas or
  // To-do and back to Schedule returns to the same semester.
  const [lastScheduleTabId, setLastScheduleTabId] =
    useState<ScheduleTabId | null>(
      initialLocation.section === "schedule" ? initialLocation.tab : null,
    );
  const [showEarlierSections, setShowEarlierSections] = useState(() => {
    const initialTab = initialLocation.tab;
    if (!initialLocation.categoryId || initialTab === null) return false;
    const ids = categoriesForTab(initialTab);
    const targetIndex = ids.findIndex(
      (category) => category.id === initialLocation.categoryId,
    );
    const currentIndex = currentWeekCategoryId
      ? ids.findIndex((category) => category.id === currentWeekCategoryId)
      : -1;
    return targetIndex >= 0 && currentIndex >= 0 && targetIndex < currentIndex;
  });
  const [jumpToken, setJumpToken] = useState(0);
  const [searchOpen, setSearchOpen] = useState(false);
  const [taskTarget, setTaskTarget] = useState<{
    categoryId: string;
    taskId: string;
    token: number;
  } | null>(() =>
    initialLocation.categoryId && initialLocation.taskId
      ? {
          categoryId: initialLocation.categoryId,
          taskId: initialLocation.taskId,
          token: 0,
        }
      : null,
  );
  const hasAutoScrolled = useRef(initialLocation.taskId !== null);
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
  const homeSummary = todayISO
    ? boardHomeSummary(board.state, todayISO, currentWeekCategoryId)
    : null;

  function writeLocation(section: BoardSectionId, tab: ScheduleTabId) {
    const hash = boardLocationHash(section, tab);
    if (window.location.hash === hash) return;
    window.history.pushState(null, "", hash);
  }

  // Keep the URL in step even on first load, so an empty or stale hash becomes
  // a durable Home or section link without adding a history entry. A hash that
  // names a week or task is left alone so the deep link survives rendering.
  useEffect(() => {
    const raw = window.location.hash;
    if (raw) {
      const current = parseBoardHash(raw);
      const sectionMatches = current.section === activeSection;
      const tabMatches =
        activeSection !== "schedule" ||
        current.tab === null ||
        current.tab === activeScheduleTabId;
      const hasTarget = Boolean(
        current.categoryId ||
          current.taskId ||
          (activeSection === "schedule" && current.tab),
      );
      const canonical = boardLocationHash(
        activeSection,
        activeScheduleTabId,
      );
      if (sectionMatches && tabMatches && (hasTarget || raw === canonical)) {
        return;
      }
    }
    window.history.replaceState(
      null,
      "",
      boardLocationHash(activeSection, activeScheduleTabId),
    );
  }, [activeSection, activeScheduleTabId]);

  // Back, Forward, and a hand-edited hash all restore the same view.
  useEffect(() => {
    function applyLocation() {
      const location = parseBoardHash(window.location.hash);
      setShowEarlierSections(
        Boolean(location.categoryId) && location.section === "schedule",
      );
      scrollIntent.current = location.taskId ? null : "content";
      setTaskTarget(
        location.categoryId && location.taskId
          ? {
              categoryId: location.categoryId,
              taskId: location.taskId,
              token: Date.now(),
            }
          : null,
      );

      if (location.section === "home") {
        setShowHome(true);
        return;
      }

      setShowHome(false);

      if (location.section === "schedule") {
        const inferredTab = location.categoryId
          ? tabForCategoryId(location.categoryId)
          : null;
        const tab =
          location.tab ??
          (inferredTab !== null && isScheduleTab(inferredTab)
            ? inferredTab
            : null) ??
          lastScheduleTabId ??
          currentScheduleTabId;
        setLastScheduleTabId(tab);
        setSelectedTabId(tab);
        return;
      }

      setSelectedTabId(location.section);
    }

    window.addEventListener("popstate", applyLocation);
    window.addEventListener("hashchange", applyLocation);
    return () => {
      window.removeEventListener("popstate", applyLocation);
      window.removeEventListener("hashchange", applyLocation);
    };
  }, [currentScheduleTabId, lastScheduleTabId]);

  // Scroll a deep-linked task into view once its section is rendered, then
  // fade a highlight out so the destination is obvious.
  useEffect(() => {
    if (!taskTarget) return;
    const element = document.getElementById(
      taskAnchorId(taskTarget.categoryId, taskTarget.taskId),
    );
    if (!element) return;

    element.scrollIntoView({ behavior: "smooth", block: "center" });
    element.classList.add("task-highlight");
    const timer = window.setTimeout(() => {
      element.classList.remove("task-highlight");
    }, 2600);
    return () => {
      window.clearTimeout(timer);
      element.classList.remove("task-highlight");
    };
  }, [taskTarget]);

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
  }, [
    activeTabId,
    activeSection,
    showEarlierSections,
    currentWeekCategoryId,
    jumpToken,
  ]);

  useEffect(() => {
    function handleSearchShortcut(event: KeyboardEvent) {
      if (!(event.metaKey || event.ctrlKey) || event.altKey) return;
      if (event.key.toLowerCase() !== "k") return;
      event.preventDefault();
      setSearchOpen((open) => !open);
    }

    window.addEventListener("keydown", handleSearchShortcut);
    return () => window.removeEventListener("keydown", handleSearchShortcut);
  }, []);

  function selectTab(tabId: TimelineTabId, forceContent = false) {
    setShowEarlierSections(false);
    setTaskTarget(null);
    if (isScheduleTab(tabId)) setLastScheduleTabId(tabId);
    writeLocation(
      boardSectionForTab(tabId),
      isScheduleTab(tabId) ? tabId : activeScheduleTabId,
    );

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
      setTaskTarget(null);
      writeLocation("home", activeScheduleTabId);
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

  function goToCurrentWeek() {
    if (currentWeekCategoryId === null) return;
    const tab = tabForCategoryId(currentWeekCategoryId);

    setShowHome(false);
    setShowEarlierSections(false);
    setTaskTarget(null);
    if (isScheduleTab(tab)) setLastScheduleTabId(tab);
    setSelectedTabId(tab);
    writeLocation("schedule", isScheduleTab(tab) ? tab : activeScheduleTabId);

    hasAutoScrolled.current = true;
    scrollIntent.current = "boundary";
    setJumpToken((token) => token + 1);
  }

  return (
    <>
      <BoardNav
        activeSection={activeSection}
        activeScheduleTab={activeScheduleTabId}
        currentWeekLabel={
          currentWeekCategoryId ? sectionLabel(currentWeekCategoryId) : null
        }
        currentWeekCategoryId={currentWeekCategoryId}
        onSelectSection={selectSection}
        onSelectScheduleTab={selectTab}
        onGoToCurrentWeek={goToCurrentWeek}
        onOpenSearch={() => setSearchOpen(true)}
      />
      {searchOpen && (
        <SearchPalette
          board={board}
          open
          onClose={() => setSearchOpen(false)}
        />
      )}
      <BoardToastView toast={board.toast} onDismiss={board.dismissToast} />
      {activeSection === "home" ? (
        <BoardHome summary={homeSummary} onSelectSection={selectSection} />
      ) : (
        <div className="mx-auto w-full max-w-2xl px-6 py-10">
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
            {activeSectionLabel}
          </h1>
          <p className="mt-1 text-xs tabular-nums text-zinc-500 dark:text-zinc-400">
            {tabSummary(activeTabId)}
          </p>

          <BoardSyncBanner />

          <div className="mt-6 flex flex-wrap items-start justify-between gap-3 print:hidden">
            <div className="min-w-0 flex-1">
              <TagFilter board={board} />
            </div>
            <div className="flex flex-wrap items-center justify-end gap-1.5">
              <SaveStatus />
              <DeletedTasks board={board} />
              <HistoryControls board={board} />
              <ResetBoard board={board} />
            </div>
          </div>

          <div className="print:hidden">
            <FilteredAddTask
              key={activeTabId}
              board={board}
              activeTabId={activeTabId}
              currentWeekCategoryId={currentWeekCategoryId}
            />

            <MeetingSchedulePicker board={board} />
          </div>

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
