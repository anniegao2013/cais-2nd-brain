"use client";

import { useEffect, useRef } from "react";
import {
  BOARD_SECTIONS,
  SCHEDULE_TABS,
  isScheduleTab,
  tabForCategoryId,
  type BoardSectionId,
  type ScheduleTabId,
} from "@/lib/categories";
import { boardLocationHash } from "@/lib/board-location";

const sectionClass =
  "inline-flex shrink-0 items-center justify-center rounded-md px-3 py-1.5 text-xs font-medium transition-colors sm:text-sm";
const activeSectionClass =
  "bg-white text-zinc-900 shadow-sm ring-1 ring-zinc-200 dark:bg-zinc-800 dark:text-zinc-100 dark:ring-zinc-700";
const inactiveSectionClass =
  "text-zinc-500 hover:bg-white/70 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800/60 dark:hover:text-zinc-100";

const termClass =
  "inline-flex shrink-0 items-center justify-center rounded-full px-3 py-1 text-[11px] font-medium transition-colors";
const activeTermClass =
  "bg-white text-zinc-900 shadow-sm dark:bg-zinc-700 dark:text-zinc-100";
const inactiveTermClass =
  "text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100";

// Keep the selected control visible in a row that scrolls on narrow screens
// without moving the page vertically.
function revealInRow(row: HTMLElement | null, target: HTMLElement | null) {
  if (!row || !target) return;
  const rowRect = row.getBoundingClientRect();
  const targetRect = target.getBoundingClientRect();
  if (targetRect.left < rowRect.left) {
    row.scrollLeft -= rowRect.left - targetRect.left;
  } else if (targetRect.right > rowRect.right) {
    row.scrollLeft += targetRect.right - rowRect.right;
  }
}

// Sticky top navigation. Schedule owns the term tabs underneath; the other
// sections are flat lists. The nav stays visible while the board scrolls so the
// current section is always one click away.
export function BoardNav({
  activeSection,
  activeScheduleTab,
  currentWeekLabel,
  currentWeekCategoryId,
  onSelectSection,
  onSelectScheduleTab,
  onGoToCurrentWeek,
  onOpenSearch,
}: {
  activeSection: BoardSectionId;
  activeScheduleTab: ScheduleTabId;
  currentWeekLabel: string | null;
  currentWeekCategoryId: string | null;
  onSelectSection: (section: BoardSectionId) => void;
  onSelectScheduleTab: (tab: ScheduleTabId) => void;
  onGoToCurrentWeek: () => void;
  onOpenSearch: () => void;
}) {
  const sectionRow = useRef<HTMLDivElement>(null);
  const termRow = useRef<HTMLDivElement>(null);
  const currentWeekTab =
    currentWeekCategoryId !== null
      ? tabForCategoryId(currentWeekCategoryId)
      : null;
  const thisWeekHref =
    currentWeekCategoryId !== null &&
    currentWeekTab !== null &&
    isScheduleTab(currentWeekTab)
      ? boardLocationHash("schedule", currentWeekTab, {
          categoryId: currentWeekCategoryId,
        })
      : null;

  useEffect(() => {
    revealInRow(
      sectionRow.current,
      sectionRow.current?.querySelector<HTMLElement>(
        `#board-nav-${activeSection}`,
      ) ?? null,
    );
  }, [activeSection]);

  useEffect(() => {
    revealInRow(
      termRow.current,
      termRow.current?.querySelector<HTMLElement>(
        `#timeline-tab-${activeScheduleTab}`,
      ) ?? null,
    );
  }, [activeScheduleTab]);

  return (
    <nav
      id="board-nav"
      aria-label="Board sections"
      className="sticky top-0 z-30 border-b border-zinc-200 bg-zinc-50/95 backdrop-blur print:hidden dark:border-zinc-800 dark:bg-zinc-950/95"
    >
      <div className="mx-auto w-full max-w-5xl px-6">
        <div className="flex items-center gap-2 py-2">
          <div
            ref={sectionRow}
            className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto"
          >
            {BOARD_SECTIONS.map((section) => {
              const active = section.id === activeSection;
              return (
                <a
                  key={section.id}
                  id={`board-nav-${section.id}`}
                  href={boardLocationHash(section.id, activeScheduleTab)}
                  aria-current={active ? "page" : undefined}
                  onClick={(event) => {
                    if (
                      event.metaKey ||
                      event.ctrlKey ||
                      event.shiftKey ||
                      event.altKey
                    ) {
                      return;
                    }
                    event.preventDefault();
                    onSelectSection(section.id);
                  }}
                  className={`${sectionClass} ${
                    active ? activeSectionClass : inactiveSectionClass
                  }`}
                >
                  {section.label}
                </a>
              );
            })}
          </div>

          <button
            type="button"
            onClick={onOpenSearch}
            aria-label="Search the board"
            aria-keyshortcuts="Meta+K Control+K"
            title="Search the board (⌘K / Ctrl+K)"
            className="flex shrink-0 items-center gap-1.5 rounded-full border border-zinc-200 bg-white px-2.5 py-1 text-[11px] font-medium text-zinc-600 transition-colors hover:border-zinc-400 hover:text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400 dark:hover:border-zinc-500 dark:hover:text-zinc-100"
          >
            <svg
              viewBox="0 0 16 16"
              className="size-3.5"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              aria-hidden="true"
            >
              <circle cx="7" cy="7" r="4.5" />
              <path d="m10.5 10.5 3.5 3.5" strokeLinecap="round" />
            </svg>
            <span className="hidden sm:inline">Search</span>
            <kbd className="hidden rounded border border-zinc-200 px-1 text-[9px] text-zinc-400 md:inline dark:border-zinc-700 dark:text-zinc-500">
              ⌘K
            </kbd>
          </button>

          {currentWeekLabel && (
            <a
              href={thisWeekHref ?? "#schedule"}
              onClick={(event) => {
                if (
                  event.metaKey ||
                  event.ctrlKey ||
                  event.shiftKey ||
                  event.altKey
                ) {
                  return;
                }
                event.preventDefault();
                onGoToCurrentWeek();
              }}
              aria-label={`Go to ${currentWeekLabel}`}
              title={`Go to ${currentWeekLabel}`}
              className="shrink-0 rounded-full border border-zinc-200 bg-white px-2.5 py-1 text-[11px] font-medium text-zinc-600 transition-colors hover:border-zinc-400 hover:text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400 dark:hover:border-zinc-500 dark:hover:text-zinc-100"
            >
              This week
            </a>
          )}
        </div>

        {activeSection === "schedule" && (
          <div
            ref={termRow}
            id="timeline-tabs"
            role="tablist"
            aria-label="Schedule terms"
            className="mb-2 flex gap-1 overflow-x-auto rounded-full border border-zinc-200 bg-zinc-100/70 p-1 dark:border-zinc-800 dark:bg-zinc-900"
          >
            {SCHEDULE_TABS.map((tab) => {
              const active = tab.id === activeScheduleTab;
              return (
                <a
                  key={tab.id}
                  role="tab"
                  id={`timeline-tab-${tab.id}`}
                  href={boardLocationHash("schedule", tab.id)}
                  aria-selected={active}
                  aria-controls="board-panel"
                  onClick={(event) => {
                    if (
                      event.metaKey ||
                      event.ctrlKey ||
                      event.shiftKey ||
                      event.altKey
                    ) {
                      return;
                    }
                    event.preventDefault();
                    onSelectScheduleTab(tab.id);
                  }}
                  className={`${termClass} ${
                    active ? activeTermClass : inactiveTermClass
                  }`}
                >
                  {tab.label}
                </a>
              );
            })}
          </div>
        )}
      </div>
    </nav>
  );
}
