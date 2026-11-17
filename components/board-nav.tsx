"use client";

import { useEffect, useRef } from "react";
import {
  BOARD_SECTIONS,
  SCHEDULE_TABS,
  type BoardSectionId,
  type ScheduleTabId,
} from "@/lib/categories";

const sectionClass =
  "shrink-0 rounded-md px-3 py-1.5 text-xs font-medium transition-colors sm:text-sm";
const activeSectionClass =
  "bg-white text-zinc-900 shadow-sm ring-1 ring-zinc-200 dark:bg-zinc-800 dark:text-zinc-100 dark:ring-zinc-700";
const inactiveSectionClass =
  "text-zinc-500 hover:bg-white/70 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800/60 dark:hover:text-zinc-100";

const termClass =
  "shrink-0 rounded-full px-3 py-1 text-[11px] font-medium transition-colors";
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
  onSelectSection,
  onSelectScheduleTab,
}: {
  activeSection: BoardSectionId;
  activeScheduleTab: ScheduleTabId;
  onSelectSection: (section: BoardSectionId) => void;
  onSelectScheduleTab: (tab: ScheduleTabId) => void;
}) {
  const sectionRow = useRef<HTMLDivElement>(null);
  const termRow = useRef<HTMLDivElement>(null);

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
      className="sticky top-0 z-30 border-b border-zinc-200 bg-zinc-50/95 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/95"
    >
      <div className="mx-auto w-full max-w-5xl px-6">
        <div
          ref={sectionRow}
          className="flex items-center gap-1 overflow-x-auto py-2"
        >
          {BOARD_SECTIONS.map((section) => {
            const active = section.id === activeSection;
            return (
              <button
                key={section.id}
                type="button"
                id={`board-nav-${section.id}`}
                aria-current={active ? "page" : undefined}
                onClick={() => onSelectSection(section.id)}
                className={`${sectionClass} ${
                  active ? activeSectionClass : inactiveSectionClass
                }`}
              >
                {section.label}
              </button>
            );
          })}
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
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  id={`timeline-tab-${tab.id}`}
                  aria-selected={active}
                  aria-controls="board-panel"
                  onClick={() => onSelectScheduleTab(tab.id)}
                  className={`${termClass} ${
                    active ? activeTermClass : inactiveTermClass
                  }`}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </nav>
  );
}
