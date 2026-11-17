import type { TaskBoardController } from "@/hooks/use-task-board";
import { toolbarButtonClass } from "./toolbar-button";

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
        className={toolbarButtonClass}
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
        className={toolbarButtonClass}
      >
        <span aria-hidden="true">↷</span>
        Redo
      </button>
    </div>
  );
}
