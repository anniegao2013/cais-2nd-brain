import type { TaskBoardController } from "@/hooks/use-task-board";
import { toolbarButtonClass } from "./toolbar-button";

export function HistoryControls({
  board,
}: {
  board: TaskBoardController;
}) {
  const undoTitle = board.canUndo
    ? `Undo ${board.undoLabel ?? "last change"} (⌘Z / Ctrl+Z)`
    : "Nothing to undo";
  const redoTitle = board.canRedo
    ? `Redo ${board.redoLabel ?? "last change"} (⌘⇧Z / Ctrl+Shift+Z)`
    : "Nothing to redo";

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
        aria-label={
          board.canUndo
            ? `Undo ${board.undoLabel ?? "last change"}`
            : "Nothing to undo"
        }
        aria-keyshortcuts="Meta+Z Control+Z"
        title={undoTitle}
        className={toolbarButtonClass}
      >
        <span aria-hidden="true">↶</span>
        Undo
      </button>
      <button
        type="button"
        onClick={board.redo}
        disabled={!board.canRedo}
        aria-label={
          board.canRedo
            ? `Redo ${board.redoLabel ?? "last change"}`
            : "Nothing to redo"
        }
        aria-keyshortcuts="Meta+Shift+Z Control+Shift+Z Control+Y"
        title={redoTitle}
        className={toolbarButtonClass}
      >
        <span aria-hidden="true">↷</span>
        Redo
      </button>
    </div>
  );
}
