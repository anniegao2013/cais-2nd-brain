"use client";

import { useEffect, useRef, useState } from "react";
import { useCurrentWeek } from "@/hooks/use-current-week";
import { useTaskBoard } from "@/hooks/use-task-board";
import {
  WEEK_COUNT,
  timelineRangeLabel,
  weekNumberFromCategoryId,
} from "@/lib/calendar";
import { CATEGORIES } from "@/lib/categories";
import { TagFilter } from "./tag-filter";
import { TaskSection } from "./task-section";

export default function TaskBoard() {
  const board = useTaskBoard();
  const currentWeek = useCurrentWeek();
  const [showEarlierSections, setShowEarlierSections] = useState(false);
  const hasAutoScrolled = useRef(false);
  const previousShowEarlierSections = useRef(showEarlierSections);

  const currentWeekIndex =
    currentWeek === null
      ? -1
      : CATEGORIES.findIndex(
          (category) => weekNumberFromCategoryId(category.id) === currentWeek,
        );
  const hiddenSectionCount = Math.max(0, currentWeekIndex);
  const visibleCategories =
    showEarlierSections || currentWeek === null
      ? CATEGORIES
      : CATEGORIES.slice(Math.max(0, currentWeekIndex));

  // Land on the week the viewer is in instead of making them scroll past the
  // earlier sections every time the board loads. Toggling the mask also moves
  // the view to the new boundary.
  useEffect(() => {
    if (currentWeek === null) return;

    const toggled = previousShowEarlierSections.current !== showEarlierSections;
    previousShowEarlierSections.current = showEarlierSections;

    if (!toggled && hasAutoScrolled.current) return;
    hasAutoScrolled.current = true;

    const target =
      document.getElementById("past-sections-toggle") ??
      document.getElementById(`week-${currentWeek}-section`);
    target?.scrollIntoView({ block: "start" });
  }, [currentWeek, showEarlierSections]);

  return (
    <div className="mx-auto w-full max-w-2xl px-6 py-12">
      <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
        Categories
      </h1>
      <p className="mt-1 text-xs tabular-nums text-zinc-500 dark:text-zinc-400">
        Weeks 1–{WEEK_COUNT} run {timelineRangeLabel()}.
      </p>
      <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
        Add tasks under the part of the year they belong to. Default events are
        already listed and can be moved to another section. Tasks can also span
        several weeks: pick an end section when adding one, or change it while
        editing, and the task will be listed under every week it covers. Use +
        to add a subtask in the same or an earlier section; open a subtask to
        edit its lead time. Click ▸ or the task title to read the description,
        and use Edit to change the title, description, tags, span, and ordering
        rules. Ordering can also be set when adding an event. Use the filter bar
        to show only tasks with selected tags. Tasks marked Suggestion are just
        ideas for social events, not events that are already planned: keep,
        move, rename, or delete them as you like.
      </p>

      <TagFilter board={board} />

      <div className="mt-10 flex flex-col gap-10">
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
              onClick={() => setShowEarlierSections((shown) => !shown)}
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
            isCurrentWeek={weekNumberFromCategoryId(category.id) === currentWeek}
            currentWeek={currentWeek}
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
