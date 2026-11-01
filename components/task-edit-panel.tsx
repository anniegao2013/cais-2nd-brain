import type { TaskBoardController } from "@/hooks/use-task-board";
import { CATEGORIES, categoryIndex, sectionLabel } from "@/lib/categories";
import { findTask, spanLabel } from "@/lib/tasks";
import type { Task } from "@/lib/types";

export function TaskEditPanel({
  board,
  task,
  startCategoryId,
  parent,
  parentMaxIndex,
  spanMaxIndex,
}: {
  board: TaskBoardController;
  task: Task;
  startCategoryId: string;
  parent: Task | undefined;
  parentMaxIndex: number;
  spanMaxIndex: number;
}) {
  const incomingEdges = board.state.dependencies.filter(
    (edge) => edge.after === task.id,
  );
  const outgoingEdges = board.state.dependencies.filter(
    (edge) => edge.before === task.id,
  );

  return (
    <>
      {parent && (
        <button
          type="button"
          onClick={() => board.goToParent(parent.id)}
          className="mb-2 inline-flex items-center gap-1 text-xs font-medium text-zinc-600 underline-offset-2 transition-colors hover:text-zinc-900 hover:underline dark:text-zinc-300 dark:hover:text-zinc-50"
        >
          ← Go to {parent.text}
        </button>
      )}
      <div className="mb-3 rounded-md border border-zinc-200 p-3 dark:border-zinc-800">
        <form
          onSubmit={(event) => {
            event.preventDefault();
            board.renameTask(startCategoryId, task.id, board.titleDraft);
          }}
        >
          <label
            htmlFor={`title-${task.id}`}
            className="text-xs font-medium text-zinc-900 dark:text-zinc-100"
          >
            Title
          </label>
          <div className="mt-1.5 flex gap-2">
            <input
              id={`title-${task.id}`}
              value={board.titleDraft}
              onChange={(event) => {
                board.setTitleDraft(event.target.value);
                board.setTitleError(null);
              }}
              className="h-8 flex-1 rounded-md border border-zinc-200 bg-white px-2.5 text-sm text-zinc-900 focus:border-zinc-400 focus:outline-none dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100 dark:focus:border-zinc-600"
            />
            <button
              type="submit"
              className="h-8 shrink-0 rounded-md bg-zinc-900 px-3 text-xs font-medium text-white transition-colors hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
            >
              Save
            </button>
          </div>
          {board.titleError && (
            <p role="alert" className="mt-1 text-xs text-red-600 dark:text-red-400">
              {board.titleError}
            </p>
          )}
        </form>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="text-xs text-zinc-500 dark:text-zinc-400">Tags</span>
          {board.tags.map((tag) => {
            const active = (task.tags ?? []).includes(tag.id);
            return (
              <button
                key={tag.id}
                type="button"
                onClick={() => board.toggleTag(startCategoryId, task.id, tag.id)}
                aria-pressed={active}
                aria-label={`${active ? "Remove" : "Add"} ${tag.label} tag ${
                  active ? "from" : "to"
                } ${task.text}`}
                className={
                  active
                    ? "rounded-full bg-zinc-900 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-white transition-colors hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
                    : "rounded-full border border-dashed border-zinc-300 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-zinc-500 transition-colors hover:border-zinc-400 hover:text-zinc-900 dark:border-zinc-700 dark:text-zinc-400 dark:hover:border-zinc-500 dark:hover:text-zinc-100"
                }
              >
                {active ? `${tag.label} ×` : `+ ${tag.label}`}
              </button>
            );
          })}
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
          <span className="font-medium text-zinc-900 dark:text-zinc-100">
            Span
          </span>
          <span>
            Starts in {sectionLabel(startCategoryId)}, runs through
          </span>
          <select
            id={`span-${task.id}`}
            value={task.endCategoryId ?? startCategoryId}
            onChange={(event) =>
              board.setTaskSpan(startCategoryId, task.id, event.target.value)
            }
            className="h-7 rounded-md border border-zinc-200 bg-transparent px-1.5 text-xs text-zinc-600 focus:border-zinc-400 focus:outline-none dark:border-zinc-800 dark:text-zinc-300 dark:focus:border-zinc-600"
          >
            {CATEGORIES.slice(
              categoryIndex(startCategoryId),
              spanMaxIndex + 1,
            ).map((option, offset) => (
              <option key={option.id} value={option.id}>
                {offset === 0 ? "Same section only" : option.label}
              </option>
            ))}
          </select>
        </div>
        <p className="mt-1 text-xs text-zinc-400 dark:text-zinc-500">
          {task.endCategoryId
            ? `Runs across ${spanLabel(startCategoryId, task.endCategoryId)}.`
            : "Choose a later section to make this task span multiple weeks."}
        </p>
      </div>
      {task.parentId && parent && (
        <div className="mb-3 rounded-md border border-zinc-200 p-3 dark:border-zinc-800">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-zinc-600 dark:text-zinc-300">
            <span className="font-medium text-zinc-900 dark:text-zinc-100">
              Lead time
            </span>
            <label
              htmlFor={`lead-${task.id}`}
              className="flex flex-wrap items-center gap-1.5"
            >
              <span>must be at least</span>
              <input
                id={`lead-${task.id}`}
                type="number"
                inputMode="numeric"
                min={0}
                max={Math.max(0, parentMaxIndex)}
                value={task.leadWeeks ?? 0}
                onChange={(event) =>
                  board.updateSubtaskLead(
                    startCategoryId,
                    task.id,
                    Number(event.target.value),
                  )
                }
                className="h-7 w-14 rounded-md border border-zinc-200 bg-white px-2 text-center text-xs tabular-nums text-zinc-900 focus:border-zinc-400 focus:outline-none dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100 dark:focus:border-zinc-600"
              />
              <span>
                week{task.leadWeeks === 1 ? "" : "s"} before {parent.text}
              </span>
            </label>
          </div>
          <p className="mt-1 text-xs text-zinc-400 dark:text-zinc-500">
            {task.leadWeeks
              ? `Moves with ${parent.text} when it is rescheduled.`
              : `Can be scheduled in the same section as ${parent.text} or earlier.`}
          </p>
        </div>
      )}
      <div className="mb-3 rounded-md border border-zinc-200 p-3 dark:border-zinc-800">
        <div className="text-xs font-medium text-zinc-900 dark:text-zinc-100">
          Ordering
        </div>
        {incomingEdges.length === 0 && outgoingEdges.length === 0 ? (
          <p className="mt-1 text-xs text-zinc-400 dark:text-zinc-500">
            No ordering rules yet.
          </p>
        ) : (
          <ul className="mt-1.5 flex flex-col gap-1 text-xs text-zinc-600 dark:text-zinc-300">
            {incomingEdges.map((edge) => {
              const otherText =
                findTask(board.state, edge.before)?.task.text ?? "Unknown task";
              return (
                <li
                  key={`${edge.before}->${edge.after}`}
                  className="flex items-center gap-2"
                >
                  <span className="min-w-0 flex-1">
                    After{" "}
                    <span className="font-medium text-zinc-900 dark:text-zinc-100">
                      {otherText}
                    </span>
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      board.removeDependency(edge.before, edge.after)
                    }
                    aria-label={`Remove rule that ${otherText} comes before ${task.text}`}
                    className="shrink-0 text-zinc-400 transition-colors hover:text-zinc-900 dark:text-zinc-500 dark:hover:text-zinc-100"
                  >
                    ×
                  </button>
                </li>
              );
            })}
            {outgoingEdges.map((edge) => {
              const otherText =
                findTask(board.state, edge.after)?.task.text ?? "Unknown task";
              return (
                <li
                  key={`${edge.before}->${edge.after}`}
                  className="flex items-center gap-2"
                >
                  <span className="min-w-0 flex-1">
                    Before{" "}
                    <span className="font-medium text-zinc-900 dark:text-zinc-100">
                      {otherText}
                    </span>
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      board.removeDependency(edge.before, edge.after)
                    }
                    aria-label={`Remove rule that ${task.text} comes before ${otherText}`}
                    className="shrink-0 text-zinc-400 transition-colors hover:text-zinc-900 dark:text-zinc-500 dark:hover:text-zinc-100"
                  >
                    ×
                  </button>
                </li>
              );
            })}
          </ul>
        )}

        <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs text-zinc-600 dark:text-zinc-300">
          <span>Must be between</span>
          <select
            value={board.depAfterId}
            onChange={(event) => {
              board.setDepAfterId(event.target.value);
              board.setDepError(null);
            }}
            aria-label={`Task that must come before ${task.text}`}
            className="h-7 max-w-48 rounded-md border border-zinc-200 bg-transparent px-1.5 text-xs text-zinc-600 focus:border-zinc-400 focus:outline-none dark:border-zinc-800 dark:text-zinc-300 dark:focus:border-zinc-600"
          >
            <option value="">Any</option>
            {board.taskOptions
              .filter((option) => option.id !== task.id)
              .map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
          </select>
          <span>and</span>
          <select
            value={board.depBeforeId}
            onChange={(event) => {
              board.setDepBeforeId(event.target.value);
              board.setDepError(null);
            }}
            aria-label={`Task that must come after ${task.text}`}
            className="h-7 max-w-48 rounded-md border border-zinc-200 bg-transparent px-1.5 text-xs text-zinc-600 focus:border-zinc-400 focus:outline-none dark:border-zinc-800 dark:text-zinc-300 dark:focus:border-zinc-600"
          >
            <option value="">Any</option>
            {board.taskOptions
              .filter((option) => option.id !== task.id)
              .map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
          </select>
          <button
            type="button"
            onClick={() => board.addDependency(task.id)}
            className="h-7 rounded-md bg-zinc-900 px-2.5 text-xs font-medium text-white transition-colors hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
          >
            Add
          </button>
        </div>
        {board.depError && (
          <p role="alert" className="mt-1 text-xs text-red-600 dark:text-red-400">
            {board.depError}
          </p>
        )}
      </div>
    </>
  );
}
