"use client";

import { useEffect, useRef, useState } from "react";
import type { TaskBoardController } from "@/hooks/use-task-board";
import { CATEGORIES } from "@/lib/categories";
import { findTask } from "@/lib/tasks";
import type { Task } from "@/lib/types";

const menuItemClass =
  "flex w-full items-center justify-between gap-3 px-3 py-1.5 text-left text-xs text-zinc-700 transition-colors hover:bg-zinc-100 dark:text-zinc-200 dark:hover:bg-zinc-800";
const quietMenuItemClass =
  "flex w-full items-center gap-3 px-3 py-1.5 text-left text-xs text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100";
const dangerMenuItemClass =
  "flex w-full items-center gap-3 px-3 py-1.5 text-left text-xs text-red-600 transition-colors hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-400/10";

function MenuDivider() {
  return (
    <div
      role="separator"
      className="my-1 h-px bg-zinc-200 dark:bg-zinc-800"
    />
  );
}

// Secondary row actions live behind one button so the row stays quiet. The
// menu closes on an outside press, Escape, or after choosing an action.
export function TaskRowMenu({
  board,
  task,
  categoryId,
  startCategoryId,
  isStart,
  bounds,
  canAddSubtask,
  addSubtaskLabel = "Add subtask",
  canMove,
  canDuplicate,
}: {
  board: TaskBoardController;
  task: Task;
  categoryId: string;
  startCategoryId: string;
  isStart: boolean;
  bounds: { min: number; max: number };
  canAddSubtask: boolean;
  addSubtaskLabel?: string;
  canMove: boolean;
  canDuplicate: boolean;
}) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const linkCategoryId =
    findTask(board.state, task.id)?.categoryId ?? startCategoryId;

  useEffect(() => {
    if (!open) return;

    function handlePress(event: PointerEvent) {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    }
    function handleKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    document.addEventListener("pointerdown", handlePress);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("pointerdown", handlePress);
      document.removeEventListener("keydown", handleKey);
    };
  }, [open]);

  function run(action: () => void) {
    setOpen(false);
    action();
  }

  return (
    <div ref={root} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`More actions for "${task.text}"`}
        title="More actions"
        className={`flex size-7 items-center justify-center rounded-md text-sm leading-none transition-colors ${
          open
            ? "bg-zinc-100 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100"
            : "text-zinc-400 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-500 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
        }`}
      >
        ⋯
      </button>
      {open && (
        <div
          role="menu"
          aria-label={`Actions for "${task.text}"`}
          className="absolute right-0 top-full z-40 mt-1 w-56 overflow-hidden rounded-lg border border-zinc-200 bg-white py-1 shadow-lg dark:border-zinc-700 dark:bg-zinc-900"
        >
          <button
            type="button"
            role="menuitem"
            onClick={() => run(() => board.togglePanel(task.id, categoryId, "edit"))}
            className={menuItemClass}
          >
            Edit
          </button>
          {canAddSubtask && (
            <button
              type="button"
              role="menuitem"
              onClick={() =>
                run(() => {
                  board.setSubtaskParentId(task.id);
                  board.setSubtaskText("");
                  board.setSubtaskCategoryId(startCategoryId);
                  board.cancelEditingNotes();
                })
              }
              className={quietMenuItemClass}
            >
              {addSubtaskLabel}
            </button>
          )}
          {canMove && (
            <label className="flex items-center justify-between gap-2 px-3 py-1.5 text-xs text-zinc-700 dark:text-zinc-200">
              <span>Move to</span>
              <select
                value={startCategoryId}
                onChange={(event) =>
                  run(() =>
                    board.moveTask(startCategoryId, task.id, event.target.value),
                  )
                }
                aria-label={`Move "${task.text}" to another section`}
                className="max-w-32 rounded-md border border-zinc-200 bg-white px-1.5 py-1 text-xs text-zinc-700 focus:border-zinc-400 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:focus:border-zinc-600"
              >
                {CATEGORIES.map((option, optionIndex) => (
                  <option
                    key={option.id}
                    value={option.id}
                    disabled={
                      optionIndex < bounds.min || optionIndex > bounds.max
                    }
                  >
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          )}
          {canDuplicate && isStart && (
            <button
              type="button"
              role="menuitem"
              onClick={() => run(() => board.duplicateTask(startCategoryId, task.id))}
              className={quietMenuItemClass}
            >
              Duplicate
            </button>
          )}
          <button
            type="button"
            role="menuitem"
            onClick={() => run(() => board.copyTaskLink(linkCategoryId, task.id))}
            className={quietMenuItemClass}
          >
            Copy link
          </button>
          {isStart && (
            <>
              <MenuDivider />
              <button
                type="button"
                role="menuitem"
                onClick={() => run(() => board.removeTask(task.id))}
                className={dangerMenuItemClass}
              >
                Delete
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
