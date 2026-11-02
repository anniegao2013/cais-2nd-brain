import type { TaskBoardController } from "@/hooks/use-task-board";
import { notesToTree, parseNoteLines } from "@/lib/notes";
import type { Task } from "@/lib/types";
import { NoteBullets } from "./note-bullets";

export function TaskDescription({
  board,
  task,
  startCategoryId,
  categoryId,
  editing,
}: {
  board: TaskBoardController;
  task: Task;
  startCategoryId: string;
  categoryId: string;
  editing: boolean;
}) {
  const notesOpen = board.notesTaskId === task.id;

  return (
    <div className="mb-3 rounded-md border border-zinc-200 p-3 dark:border-zinc-800">
      <div className="text-xs font-medium text-zinc-900 dark:text-zinc-100">
        Description
      </div>
      {notesOpen ? (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            board.saveNotes(startCategoryId, task.id);
          }}
        >
          <label htmlFor={`notes-${task.id}`} className="sr-only">
            Description for {task.text}
          </label>
          <textarea
            id={`notes-${task.id}`}
            value={board.notesDraft}
            onChange={(event) => board.setNotesDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key !== "Tab") return;
              event.preventDefault();
              const target = event.currentTarget;
              const start = target.selectionStart;
              const end = target.selectionEnd;

              if (event.shiftKey) {
                const lineStart =
                  board.notesDraft.lastIndexOf("\n", start - 1) + 1;
                const prefix = board.notesDraft.slice(lineStart, start);
                const remove = prefix.endsWith("  ")
                  ? 2
                  : prefix.endsWith(" ")
                    ? 1
                    : 0;
                if (remove === 0) return;
                board.setNotesDraft(
                  board.notesDraft.slice(0, start - remove) +
                    board.notesDraft.slice(end),
                );
                requestAnimationFrame(() => {
                  target.selectionStart = target.selectionEnd = start - remove;
                });
                return;
              }

              board.setNotesDraft(
                board.notesDraft.slice(0, start) +
                  "  " +
                  board.notesDraft.slice(end),
              );
              requestAnimationFrame(() => {
                target.selectionStart = target.selectionEnd = start + 2;
              });
            }}
            rows={4}
            placeholder="Add a description — one bullet per line"
            autoFocus
            className="w-full resize-y rounded-md border border-zinc-200 bg-white p-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-400 focus:outline-none dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-500 dark:focus:border-zinc-600"
          />
          <div className="mt-2 flex items-center gap-2">
            <button
              type="submit"
              className="h-8 rounded-md bg-zinc-900 px-3 text-xs font-medium text-white transition-colors hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
            >
              Save
            </button>
            <button
              type="button"
              onClick={() => {
                board.setNotesDraft("");
                board.cancelEditingNotes();
              }}
              className="h-8 rounded-md px-2 text-xs text-zinc-500 transition-colors hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
            >
              Cancel
            </button>
            <span className="text-xs text-zinc-400 dark:text-zinc-500">
              One bullet per line · Tab indents
            </span>
          </div>
        </form>
      ) : (
        <>
          {task.notes ? (
            <div className="pr-2 text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">
              <NoteBullets nodes={notesToTree(parseNoteLines(task.notes))} />
            </div>
          ) : (
            <p className="text-xs italic text-zinc-400 dark:text-zinc-500">
              No description yet.
            </p>
          )}
          {editing && (
            <button
              type="button"
              onClick={() => board.startEditingNotes(task, categoryId)}
              className="mt-2 text-xs font-medium text-zinc-500 underline-offset-2 transition-colors hover:text-zinc-900 hover:underline dark:text-zinc-400 dark:hover:text-zinc-100"
            >
              {task.notes ? "Edit description" : "Add description"}
            </button>
          )}
        </>
      )}
    </div>
  );
}
