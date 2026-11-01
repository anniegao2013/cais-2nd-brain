import type { TaskBoardController } from "@/hooks/use-task-board";
import { CATEGORIES, categoryIndex } from "@/lib/categories";
import type { Task } from "@/lib/types";

export function SubtaskForm({
  board,
  parentTask,
  startCategoryId,
}: {
  board: TaskBoardController;
  parentTask: Task;
  startCategoryId: string;
}) {
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        board.addSubtask(parentTask.id);
      }}
      className="mt-2 flex flex-col gap-2 pl-7 sm:flex-row sm:items-center"
    >
      <input
        value={board.subtaskText}
        onChange={(event) => board.setSubtaskText(event.target.value)}
        placeholder="Add a subtask…"
        aria-label={`Subtask for ${parentTask.text}`}
        autoComplete="off"
        className="h-8 flex-1 rounded-md border border-zinc-200 bg-white px-2.5 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-400 focus:outline-none dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-500 dark:focus:border-zinc-600"
      />
      <select
        value={board.subtaskCategoryId}
        onChange={(event) => board.setSubtaskCategoryId(event.target.value)}
        aria-label="Subtask section"
        className="h-8 rounded-md border border-zinc-200 bg-transparent px-2 text-xs text-zinc-600 focus:border-zinc-400 focus:outline-none dark:border-zinc-800 dark:text-zinc-300 dark:focus:border-zinc-600"
      >
        {CATEGORIES.map((option, optionIndex) => (
          <option
            key={option.id}
            value={option.id}
            disabled={optionIndex > categoryIndex(startCategoryId)}
          >
            {option.label}
          </option>
        ))}
      </select>
      <div className="flex gap-2">
        <button
          type="submit"
          className="h-8 rounded-md bg-zinc-900 px-3 text-xs font-medium text-white transition-colors hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
        >
          Add
        </button>
        <button
          type="button"
          onClick={() => board.setSubtaskParentId(null)}
          className="h-8 rounded-md px-2 text-xs text-zinc-500 transition-colors hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
