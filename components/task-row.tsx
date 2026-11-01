import { CATEGORIES, categoryIndex } from "@/lib/categories";
import { baseMoveBounds, moveBounds } from "@/lib/placement";
import { findTask, spanLabel } from "@/lib/tasks";
import type { Task } from "@/lib/types";
import type { TaskBoardController } from "@/hooks/use-task-board";
import { SubtaskForm } from "./subtask-form";
import { TaskDescription } from "./task-description";
import { TaskEditPanel } from "./task-edit-panel";

export function TaskRow({
  board,
  task,
  startCategoryId,
  categoryId,
  isStart,
}: {
  board: TaskBoardController;
  task: Task;
  startCategoryId: string;
  categoryId: string;
  isStart: boolean;
}) {
  const parentLocation = task.parentId
    ? findTask(board.state, task.parentId)
    : null;
  const parent = parentLocation?.task;
  const parentMaxIndex = parentLocation
    ? categoryIndex(parentLocation.categoryId)
    : 0;
  const isSubtask = Boolean(task.parentId);
  const rowKey = `${task.id}:${categoryId}`;
  const descriptionId = `description-${task.id}-${categoryId}`;
  const editorId = `editor-${task.id}-${categoryId}`;
  const formOpen = isStart && board.subtaskParentId === task.id;
  const panelOpen = board.expandedRowKey === rowKey;
  const viewing = panelOpen && board.panelMode === "view";
  const editing = panelOpen && board.panelMode === "edit";
  const bounds = moveBounds(board.state, task);
  const spanMaxIndex = Math.max(
    categoryIndex(startCategoryId),
    baseMoveBounds(board.state, task).max,
  );
  const incomingEdges = board.state.dependencies.filter(
    (edge) => edge.after === task.id,
  );
  const outgoingEdges = board.state.dependencies.filter(
    (edge) => edge.before === task.id,
  );
  const afterNames = incomingEdges.flatMap((edge) => {
    const location = findTask(board.state, edge.before);
    return location ? [location.task.text] : [];
  });
  const beforeNames = outgoingEdges.flatMap((edge) => {
    const location = findTask(board.state, edge.after);
    return location ? [location.task.text] : [];
  });

  return (
    <li
      id={`task-${task.id}-${categoryId}`}
      className={`py-2.5 ${isSubtask ? "pl-6" : ""}`}
    >
      <div className="group flex flex-wrap items-center gap-2">
        <input
          type="checkbox"
          checked={task.done}
          onChange={() => board.toggleTask(startCategoryId, task.id)}
          aria-label={`Mark "${task.text}" as ${
            task.done ? "not done" : "done"
          }`}
          className="size-4 shrink-0 accent-zinc-900 dark:accent-zinc-100"
        />
        <button
          type="button"
          onClick={() => board.togglePanel(task.id, categoryId, "view")}
          aria-expanded={viewing}
          aria-controls={descriptionId}
          className={`flex flex-1 items-center text-left text-sm ${
            task.done
              ? "text-zinc-400 line-through dark:text-zinc-500"
              : "text-zinc-700 dark:text-zinc-300"
          }`}
        >
          <span className="min-w-0 flex-1">{task.text}</span>
        </button>
        <button
          type="button"
          onClick={() => board.togglePanel(task.id, categoryId, "view")}
          aria-expanded={viewing}
          aria-controls={descriptionId}
          aria-label={`${viewing ? "Hide" : "Show"} description for "${
            task.text
          }"`}
          title={viewing ? "Hide description" : "Show description"}
          className="flex size-6 shrink-0 items-center justify-center rounded-md border border-zinc-200 text-xs text-zinc-500 transition-colors hover:text-zinc-900 dark:border-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-100"
        >
          {viewing ? "▾" : "▸"}
        </button>
        <button
          type="button"
          onClick={() => board.togglePanel(task.id, categoryId, "edit")}
          aria-expanded={editing}
          aria-controls={editorId}
          aria-label={`${editing ? "Close editor for" : "Edit"} "${task.text}"`}
          className={
            editing
              ? "h-7 shrink-0 rounded-md border border-zinc-900 bg-zinc-900 px-2 text-[11px] font-medium text-white transition-colors hover:bg-zinc-700 dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
              : "h-7 shrink-0 rounded-md border border-zinc-200 px-2 text-[11px] font-medium text-zinc-600 transition-colors hover:border-zinc-400 hover:text-zinc-900 dark:border-zinc-800 dark:text-zinc-400 dark:hover:border-zinc-600 dark:hover:text-zinc-100"
          }
        >
          {editing ? "Done" : "Edit"}
        </button>
        {isStart && !isSubtask && (
          <button
            type="button"
            onClick={() => {
              if (formOpen) {
                board.setSubtaskParentId(null);
                return;
              }
              board.setSubtaskParentId(task.id);
              board.setSubtaskText("");
              board.setSubtaskCategoryId(startCategoryId);
              board.cancelEditingNotes();
            }}
            aria-label={`Add a subtask to "${task.text}"`}
            aria-expanded={formOpen}
            className="flex size-6 shrink-0 items-center justify-center rounded-md border border-zinc-200 text-xs text-zinc-500 transition-colors hover:text-zinc-900 dark:border-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-100"
          >
            +
          </button>
        )}
        {isStart && (
          <select
            value={startCategoryId}
            onChange={(event) =>
              board.moveTask(startCategoryId, task.id, event.target.value)
            }
            aria-label={`Move "${task.text}" to another section`}
            className="h-7 shrink-0 rounded-md border border-zinc-200 bg-transparent px-1.5 text-xs text-zinc-500 transition-colors hover:text-zinc-900 focus:border-zinc-400 focus:outline-none dark:border-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-100 dark:focus:border-zinc-600"
          >
            {CATEGORIES.map((option, optionIndex) => (
              <option
                key={option.id}
                value={option.id}
                disabled={optionIndex < bounds.min || optionIndex > bounds.max}
              >
                {option.label}
              </option>
            ))}
          </select>
        )}
        {isStart && (
          <button
            type="button"
            onClick={() => board.removeTask(task.id)}
            aria-label={`Delete "${task.text}"`}
            className="text-sm text-zinc-400 opacity-0 transition-opacity hover:text-zinc-900 focus:opacity-100 group-hover:opacity-100 dark:text-zinc-500 dark:hover:text-zinc-100"
          >
            ×
          </button>
        )}
      </div>

      {((task.tags?.length ?? 0) > 0 || task.endCategoryId) && (
        <div className="mt-1 flex flex-wrap items-center gap-1 pl-7">
          {task.endCategoryId && (
            <span
              aria-label={`Spans ${spanLabel(
                startCategoryId,
                task.endCategoryId,
              )}`}
              className="rounded-full border border-zinc-300 bg-white px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-zinc-700 dark:border-zinc-600 dark:bg-zinc-950 dark:text-zinc-200"
            >
              ↔ {spanLabel(startCategoryId, task.endCategoryId)}
            </span>
          )}
          {task.tags?.map((tagId) => (
            <span
              key={tagId}
              className="rounded-full border border-zinc-200 bg-zinc-50 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-zinc-600 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300"
            >
              {board.tags.find((tag) => tag.id === tagId)?.label ?? tagId}
            </span>
          ))}
        </div>
      )}

      {(afterNames.length > 0 || beforeNames.length > 0) && (
        <div className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 pl-7 text-xs text-zinc-500 dark:text-zinc-400">
          {afterNames.length > 0 && <span>After {afterNames.join(", ")}</span>}
          {afterNames.length > 0 && beforeNames.length > 0 && (
            <span aria-hidden>·</span>
          )}
          {beforeNames.length > 0 && (
            <span>Before {beforeNames.join(", ")}</span>
          )}
        </div>
      )}

      {parent && (
        <div className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 pl-7 text-xs text-zinc-500 dark:text-zinc-400">
          <span>Subtask of</span>
          <button
            type="button"
            onClick={() => board.goToParent(parent.id)}
            className="font-medium text-zinc-700 underline-offset-2 transition-colors hover:text-zinc-900 hover:underline dark:text-zinc-200 dark:hover:text-zinc-50"
          >
            {parent.text}
          </button>
          <span aria-hidden>·</span>
          <span>
            {task.leadWeeks
              ? `at least ${task.leadWeeks} week${
                  task.leadWeeks === 1 ? "" : "s"
                } before`
              : "can be scheduled the same week or earlier"}
          </span>
        </div>
      )}

      {panelOpen && (
        <div
          id={editing ? editorId : descriptionId}
          className="mt-2 pl-7"
        >
          {editing && (
            <TaskEditPanel
              board={board}
              task={task}
              startCategoryId={startCategoryId}
              parent={parent}
              parentMaxIndex={parentMaxIndex}
              spanMaxIndex={spanMaxIndex}
            />
          )}
          <TaskDescription
            board={board}
            task={task}
            startCategoryId={startCategoryId}
            categoryId={categoryId}
            editing={editing}
          />
        </div>
      )}

      {formOpen && !isSubtask && (
        <SubtaskForm
          board={board}
          parentTask={task}
          startCategoryId={startCategoryId}
        />
      )}
    </li>
  );
}
