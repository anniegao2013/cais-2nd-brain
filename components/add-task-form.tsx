import type { TaskBoardController } from "@/hooks/use-task-board";
import {
  CATEGORIES,
  categoryIndex,
  isGmIdeasCategory,
  isTodoCategory,
} from "@/lib/categories";

export function AddTaskForm({
  board,
  category,
}: {
  board: TaskBoardController;
  category: { id: string; label: string };
}) {
  if (board.activeTags.length > 0) return null;

  const gmIdeas = isGmIdeasCategory(category.id);
  const todo = isTodoCategory(category.id);
  const plainList = gmIdeas || todo;
  const placeholder = gmIdeas
    ? "Add a GM idea…"
    : todo
      ? "Add a to-do…"
      : "Add a task…";

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        board.addTask(category.id, event.currentTarget);
      }}
      className="mt-3 flex flex-col gap-2"
    >
      <div className="flex gap-2">
        <input
          name="text"
          placeholder={placeholder}
          aria-label={
            gmIdeas
              ? "Add a GM idea"
              : todo
                ? "Add a to-do"
                : `Add a task to ${category.label}`
          }
          autoComplete="off"
          className="h-9 flex-1 rounded-md border border-zinc-200 bg-white px-3 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-400 focus:outline-none dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-500 dark:focus:border-zinc-600"
        />
        <button
          type="submit"
          className="h-9 shrink-0 rounded-md bg-zinc-900 px-3 text-sm font-medium text-white transition-colors hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
        >
          Add
        </button>
      </div>
      {todo && (
        <div className="flex flex-wrap items-center gap-1.5 text-xs text-zinc-500 dark:text-zinc-400">
          <label className="flex items-center gap-1.5">
            <span>Due</span>
            <input
              type="date"
              name="due"
              aria-label="Due date for the new to-do"
              className="h-7 rounded-md border border-zinc-200 bg-transparent px-1.5 text-xs text-zinc-600 focus:border-zinc-400 focus:outline-none dark:border-zinc-800 dark:text-zinc-300 dark:focus:border-zinc-600"
            />
          </label>
          <span className="text-zinc-400 dark:text-zinc-500">optional</span>
        </div>
      )}
      {!plainList && (
        <div className="flex flex-wrap items-center gap-1.5 text-xs text-zinc-500 dark:text-zinc-400">
          <label className="flex items-center gap-1.5">
            <span>Must be after</span>
            <select
              name="after"
              defaultValue=""
              className="h-7 max-w-48 rounded-md border border-zinc-200 bg-transparent px-1.5 text-xs text-zinc-600 focus:border-zinc-400 focus:outline-none dark:border-zinc-800 dark:text-zinc-300 dark:focus:border-zinc-600"
            >
              <option value="">Any</option>
              {board.taskOptions.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-1.5">
            <span>and before</span>
            <select
              name="before"
              defaultValue=""
              className="h-7 max-w-48 rounded-md border border-zinc-200 bg-transparent px-1.5 text-xs text-zinc-600 focus:border-zinc-400 focus:outline-none dark:border-zinc-800 dark:text-zinc-300 dark:focus:border-zinc-600"
            >
              <option value="">Any</option>
              {board.taskOptions.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-1.5">
            <span>spanning through</span>
            <select
              name="end"
              defaultValue=""
              className="h-7 max-w-48 rounded-md border border-zinc-200 bg-transparent px-1.5 text-xs text-zinc-600 focus:border-zinc-400 focus:outline-none dark:border-zinc-800 dark:text-zinc-300 dark:focus:border-zinc-600"
            >
              <option value="">This section only</option>
              {CATEGORIES.slice(categoryIndex(category.id) + 1).map(
                (option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                ),
              )}
            </select>
          </label>
        </div>
      )}
      {board.addError?.categoryId === category.id && (
        <p role="alert" className="text-xs text-red-600 dark:text-red-400">
          {board.addError.message}
        </p>
      )}
    </form>
  );
}
