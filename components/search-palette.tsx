"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { TaskBoardController } from "@/hooks/use-task-board";
import { taskLinkHash } from "@/lib/board-location";
import { searchBoard, type SearchResult } from "@/lib/search";

type ResultGroup = {
  categoryId: string;
  label: string;
  results: { result: SearchResult; index: number }[];
};

function groupResults(results: SearchResult[]): ResultGroup[] {
  const groups: ResultGroup[] = [];
  results.forEach((result, index) => {
    const last = groups[groups.length - 1];
    if (last?.categoryId === result.categoryId) {
      last.results.push({ result, index });
      return;
    }
    groups.push({
      categoryId: result.categoryId,
      label: result.sectionLabel,
      results: [{ result, index }],
    });
  });
  return groups;
}

export function SearchPalette({
  board,
  open,
  onClose,
}: {
  board: TaskBoardController;
  open: boolean;
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const input = useRef<HTMLInputElement>(null);

  const results = useMemo(
    () => searchBoard(board.state, query),
    [board.state, query],
  );
  const groups = useMemo(() => groupResults(results), [results]);
  const active =
    results.length === 0 ? -1 : Math.min(activeIndex, results.length - 1);

  useEffect(() => {
    const timer = window.setTimeout(() => input.current?.focus(), 0);
    return () => window.clearTimeout(timer);
  }, []);

  if (!open) return null;

  function openActive() {
    const result = results[active];
    if (!result) return;
    window.location.hash = taskLinkHash(result.categoryId, result.task.id);
    onClose();
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex items-start justify-center bg-zinc-950/40 p-4 pt-[10vh] backdrop-blur-sm sm:p-8 sm:pt-[12vh]"
      onPointerDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Search the board"
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            event.preventDefault();
            onClose();
          } else if (event.key === "ArrowDown") {
            event.preventDefault();
            if (results.length > 0) {
              setActiveIndex((active + 1) % results.length);
            }
          } else if (event.key === "ArrowUp") {
            event.preventDefault();
            if (results.length > 0) {
              setActiveIndex((active - 1 + results.length) % results.length);
            }
          } else if (event.key === "Enter") {
            event.preventDefault();
            openActive();
          }
        }}
        className="flex max-h-[75vh] w-full max-w-xl flex-col overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-2xl dark:border-zinc-700 dark:bg-zinc-900"
      >
        <div className="flex items-center gap-2 border-b border-zinc-200 px-3 dark:border-zinc-800">
          <svg
            viewBox="0 0 16 16"
            className="size-4 shrink-0 text-zinc-400"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            aria-hidden="true"
          >
            <circle cx="7" cy="7" r="4.5" />
            <path d="m10.5 10.5 3.5 3.5" strokeLinecap="round" />
          </svg>
          <input
            ref={input}
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setActiveIndex(0);
            }}
            placeholder="Search tasks, descriptions, tags…"
            aria-label="Search tasks, descriptions, tags, and sections"
            aria-controls="search-results"
            aria-activedescendant={
              results[active]
                ? `search-result-${results[active].task.id}`
                : undefined
            }
            className="h-11 flex-1 bg-transparent text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none dark:text-zinc-100 dark:placeholder:text-zinc-500"
          />
          <kbd className="hidden shrink-0 rounded border border-zinc-200 px-1.5 py-0.5 text-[10px] font-medium text-zinc-500 sm:block dark:border-zinc-700 dark:text-zinc-400">
            Esc
          </kbd>
        </div>

        <div id="search-results" role="listbox" className="overflow-y-auto p-1.5">
          {query.trim() === "" ? (
            <p className="px-3 py-6 text-center text-xs text-zinc-500 dark:text-zinc-400">
              Search every week, GM idea, to-do, description, and tag.
            </p>
          ) : results.length === 0 ? (
            <p className="px-3 py-6 text-center text-xs text-zinc-500 dark:text-zinc-400">
              No tasks match “{query.trim()}”.
            </p>
          ) : (
            groups.map((group) => (
              <div key={group.categoryId}>
                <div className="px-2.5 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-wide text-zinc-400 dark:text-zinc-500">
                  {group.label}
                </div>
                {group.results.map(({ result, index }) => (
                  <a
                    key={result.task.id}
                    id={`search-result-${result.task.id}`}
                    role="option"
                    aria-selected={index === active}
                    href={taskLinkHash(result.categoryId, result.task.id)}
                    onClick={onClose}
                    onMouseEnter={() => setActiveIndex(index)}
                    className={`block rounded-md px-2.5 py-2 ${
                      index === active
                        ? "bg-zinc-100 dark:bg-zinc-800"
                        : ""
                    }`}
                  >
                    <span
                      className={`block truncate text-sm ${
                        result.task.done
                          ? "text-zinc-400 line-through dark:text-zinc-500"
                          : "text-zinc-800 dark:text-zinc-200"
                      }`}
                    >
                      {result.task.text}
                    </span>
                    {result.snippet && (
                      <span className="mt-0.5 block truncate text-[11px] text-zinc-500 dark:text-zinc-400">
                        {result.snippet}
                      </span>
                    )}
                    {(result.task.tags?.length ?? 0) > 0 && (
                      <span className="mt-1 flex flex-wrap gap-1">
                        {result.task.tags?.map((tagId) => (
                          <span
                            key={tagId}
                            className="rounded-full border border-zinc-200 px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wide text-zinc-500 dark:border-zinc-700 dark:text-zinc-400"
                          >
                            {board.tags.find((tag) => tag.id === tagId)?.label ??
                              tagId}
                          </span>
                        ))}
                      </span>
                    )}
                  </a>
                ))}
              </div>
            ))
          )}
        </div>

        <div className="flex items-center justify-between border-t border-zinc-200 px-3 py-1.5 text-[10px] text-zinc-400 dark:border-zinc-800 dark:text-zinc-500">
          <span>↑↓ to move · Enter to open</span>
          <span>{results.length} result{results.length === 1 ? "" : "s"}</span>
        </div>
      </div>
    </div>
  );
}
