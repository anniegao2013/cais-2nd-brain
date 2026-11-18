"use client";

import { useEffect, useRef, useState } from "react";
import type { TaskBoardController } from "@/hooks/use-task-board";
import { sectionLabel } from "@/lib/categories";
import type { DeletedBatch } from "@/lib/types";
import { toolbarButtonClass } from "./toolbar-button";

function rootEntry(batch: DeletedBatch) {
  return batch.tasks.find((entry) => !entry.task.parentId) ?? batch.tasks[0];
}

function deletedAtLabel(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "Recently";
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function batchMeta(batch: DeletedBatch): string {
  const root = rootEntry(batch);
  const extras = batch.tasks.length - 1;
  const section = sectionLabel(root?.categoryId ?? "");
  return [
    section,
    extras > 0 ? `${extras} subtask${extras === 1 ? "" : "s"}` : null,
    deletedAtLabel(batch.deletedAt),
  ]
    .filter(Boolean)
    .join(" · ");
}

export function DeletedTasks({ board }: { board: TaskBoardController }) {
  const [open, setOpen] = useState(false);
  const wrapper = useRef<HTMLDivElement>(null);
  const batches = board.deletedTasks;

  useEffect(() => {
    if (!open) return;

    function handlePointerDown(event: PointerEvent) {
      if (!wrapper.current?.contains(event.target as Node)) setOpen(false);
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  return (
    <div ref={wrapper} className="relative">
      <button
        type="button"
        onClick={() => setOpen((shown) => !shown)}
        disabled={batches.length === 0}
        aria-expanded={open}
        aria-controls="deleted-tasks-panel"
        title="See and restore recently deleted events"
        className={toolbarButtonClass}
      >
        Recently deleted
        {batches.length > 0 && (
          <span className="tabular-nums">({batches.length})</span>
        )}
      </button>

      {open && batches.length > 0 && (
        <div
          id="deleted-tasks-panel"
          className="absolute right-0 z-20 mt-1.5 w-[min(22rem,calc(100vw-3rem))] overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-lg dark:border-zinc-700 dark:bg-zinc-900"
        >
          <div className="flex items-center justify-between border-b border-zinc-100 px-3 py-2 dark:border-zinc-800">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
              Recently deleted
            </p>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close recently deleted"
              className="text-base leading-none text-zinc-400 transition-colors hover:text-zinc-900 dark:text-zinc-500 dark:hover:text-zinc-100"
            >
              ×
            </button>
          </div>

          <ul className="max-h-80 divide-y divide-zinc-100 overflow-y-auto dark:divide-zinc-800">
            {batches.map((batch) => (
              <li key={batch.id} className="px-3 py-2.5">
                <div className="flex items-start gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-medium text-zinc-900 dark:text-zinc-100">
                      {rootEntry(batch)?.task.text}
                    </p>
                    <p className="mt-0.5 text-[11px] text-zinc-500 dark:text-zinc-400">
                      {batchMeta(batch)}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      board.restoreDeleted(batch.id);
                      if (batches.length === 1) setOpen(false);
                    }}
                    aria-label={`Restore "${rootEntry(batch)?.task.text}"`}
                    className="shrink-0 rounded-md border border-zinc-200 px-2 py-1 text-[11px] font-medium text-zinc-600 transition-colors hover:border-zinc-400 hover:text-zinc-900 dark:border-zinc-700 dark:text-zinc-400 dark:hover:border-zinc-500 dark:hover:text-zinc-100"
                  >
                    Restore
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
