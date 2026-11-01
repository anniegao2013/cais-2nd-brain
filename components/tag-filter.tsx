import type { TaskBoardController } from "@/hooks/use-task-board";

export function TagFilter({ board }: { board: TaskBoardController }) {
  return (
    <>
      <div
        className="mt-6 flex flex-wrap items-center gap-1.5"
        role="group"
        aria-label="Filter tasks by tag"
      >
        <span className="mr-1 text-xs font-medium text-zinc-500 dark:text-zinc-400">
          Filter
        </span>
        <button
          type="button"
          onClick={() => board.clearTagFilter()}
          aria-pressed={board.activeTags.length === 0}
          className={
            board.activeTags.length === 0
              ? "rounded-full bg-zinc-900 px-2.5 py-1 text-[11px] font-medium text-white transition-colors hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
              : "rounded-full border border-zinc-200 px-2.5 py-1 text-[11px] font-medium text-zinc-600 transition-colors hover:border-zinc-400 hover:text-zinc-900 dark:border-zinc-700 dark:text-zinc-400 dark:hover:border-zinc-500 dark:hover:text-zinc-100"
          }
        >
          All
        </button>
        {board.tags.map((tag) => {
          const active = board.activeTags.includes(tag.id);
          return (
            <button
              key={tag.id}
              type="button"
              onClick={() => board.toggleTagFilter(tag.id)}
              aria-pressed={active}
              className={
                active
                  ? "rounded-full bg-zinc-900 px-2.5 py-1 text-[11px] font-medium text-white transition-colors hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
                  : "rounded-full border border-zinc-200 px-2.5 py-1 text-[11px] font-medium text-zinc-600 transition-colors hover:border-zinc-400 hover:text-zinc-900 dark:border-zinc-700 dark:text-zinc-400 dark:hover:border-zinc-500 dark:hover:text-zinc-100"
              }
            >
              {tag.label}
            </button>
          );
        })}
      </div>
      {board.activeTags.length > 0 && (
        <p className="mt-2 text-xs text-zinc-400 dark:text-zinc-500">
          Showing {board.filteredTaskCount} of {board.totalTaskCount} tasks
          {board.activeTags.length > 1 ? " · matching any selected tag" : ""}
        </p>
      )}
    </>
  );
}
