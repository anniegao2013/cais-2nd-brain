"use client";

import { useEffect, useRef, useState } from "react";
import type { TaskBoardController } from "@/hooks/use-task-board";
import { toolbarButtonClass } from "./toolbar-button";

export function ResetBoard({ board }: { board: TaskBoardController }) {
  const [open, setOpen] = useState(false);
  const wrapper = useRef<HTMLDivElement>(null);

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
        aria-expanded={open}
        aria-controls="reset-board-panel"
        title="Clear this year's board and restore the default events"
        className={toolbarButtonClass}
      >
        <span aria-hidden="true">↺</span>
        Reset board
      </button>

      {open && (
        <div
          id="reset-board-panel"
          role="group"
          aria-label="Confirm board reset"
          className="absolute right-0 z-20 mt-1.5 w-[min(20rem,calc(100vw-3rem))] rounded-lg border border-zinc-200 bg-white p-3 shadow-lg dark:border-zinc-700 dark:bg-zinc-900"
        >
          <p className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
            Reset the board?
          </p>
          <p className="mt-1 text-[11px] leading-relaxed text-zinc-500 dark:text-zinc-400">
            This removes your events, tasks, descriptions, GM ideas, to-dos, and
            recently deleted items. The default events and the Wednesday
            7:00 PM meeting time come back.
          </p>
          <p className="mt-1 text-[11px] leading-relaxed text-zinc-500 dark:text-zinc-400">
            You can undo this until the page reloads.
          </p>
          <div className="mt-3 flex justify-end gap-1.5">
            <button
              type="button"
              onClick={() => setOpen(false)}
              autoFocus
              className="h-7 rounded-md border border-zinc-200 px-2.5 text-[11px] font-medium text-zinc-600 transition-colors hover:border-zinc-400 hover:text-zinc-900 dark:border-zinc-700 dark:text-zinc-400 dark:hover:border-zinc-500 dark:hover:text-zinc-100"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => {
                board.resetBoard();
                setOpen(false);
              }}
              className="h-7 rounded-md bg-red-600 px-2.5 text-[11px] font-medium text-white transition-colors hover:bg-red-700 dark:bg-red-500 dark:hover:bg-red-400"
            >
              Reset everything
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
