import type { TaskBoardController } from "@/hooks/use-task-board";

const buttonClass =
  "inline-flex h-7 items-center gap-1 rounded-full border border-zinc-200 bg-white px-2.5 text-[11px] font-medium text-zinc-600 transition-colors hover:border-zinc-400 hover:text-zinc-900 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-zinc-200 disabled:hover:text-zinc-600 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400 dark:hover:border-zinc-500 dark:hover:text-zinc-100 dark:disabled:hover:border-zinc-700 dark:disabled:hover:text-zinc-400";

export function HistoryControls({
  board,
}: {
  board: TaskBoardController;
}) {
  return (
    <div
      className="flex items-center gap-1.5"
      role="group"
      aria-label="Undo and redo"
    >
      <button
        type="button"
        onClick={board.undo}
        disabled={!board.canUndo}
        aria-label="Undo last change"
        aria-keyshortcuts="Meta+Z Control+Z"
        title="Undo (⌘Z / Ctrl+Z)"
        className={buttonClass}
      >
        <span aria-hidden="true">↶</span>
        Undo
      </button>
      <button
        type="button"
        onClick={board.redo}
        disabled={!board.canRedo}
        aria-label="Redo last undone change"
        aria-keyshortcuts="Meta+Shift+Z Control+Shift+Z Control+Y"
        title="Redo (⌘⇧Z / Ctrl+Shift+Z)"
        className={buttonClass}
      >
        <span aria-hidden="true">↷</span>
        Redo
      </button>
    </div>
  );
}
