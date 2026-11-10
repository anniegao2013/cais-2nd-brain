import { CATEGORIES, categoryIndex, sectionLabel } from "@/lib/categories";
import { baseMoveBounds, moveBounds } from "@/lib/placement";
import { findTask, spanLabel } from "@/lib/tasks";
import type { Task } from "@/lib/types";
import type { TaskBoardController } from "@/hooks/use-task-board";
import { gmDateLabel } from "@/lib/calendar";
import { isInterestPoll, socialPollId } from "@/lib/social-polls";
import { SubtaskForm } from "./subtask-form";
import { TaskDescription } from "./task-description";
import { TaskEditPanel } from "./task-edit-panel";

export function TaskRow({
  board,
  task,
  startCategoryId,
  categoryId,
  isStart,
  isOverdue = false,
}: {
  board: TaskBoardController;
  task: Task;
  startCategoryId: string;
  categoryId: string;
  isStart: boolean;
  isOverdue?: boolean;
}) {
  const parentLocation = task.parentId
    ? findTask(board.state, task.parentId)
    : null;
  const parent = parentLocation?.task;
  const suggested = Boolean(task.suggested || parent?.suggested);
  const suggestionRow = task.suggested
    ? "my-1 rounded-md border border-dashed border-amber-300 bg-amber-50/60 px-2.5 dark:border-amber-400/40 dark:bg-amber-400/10"
    : parent?.suggested
      ? "border-l-2 border-dashed border-amber-300 bg-amber-50/40 dark:border-amber-400/40 dark:bg-amber-400/5"
      : "";
  const holidayRow = task.isHoliday
    ? "my-1 rounded-md border border-sky-300 bg-sky-50/70 px-2.5 dark:border-sky-400/40 dark:bg-sky-400/10"
    : parent?.isHoliday
      ? "border-l-2 border-sky-300 bg-sky-50/40 dark:border-sky-400/40 dark:bg-sky-400/5"
      : "";
  const overdueRow = isOverdue
    ? "my-1 rounded-md border border-red-300 bg-red-50/60 px-2.5 dark:border-red-400/40 dark:bg-red-400/10"
    : "";
  const parentMaxIndex = parentLocation
    ? categoryIndex(parentLocation.categoryId)
    : 0;
  const isSubtask = Boolean(task.parentId);
  const showInterestToggle = isInterestPoll(task);
  const childPoll = isSubtask
    ? undefined
    : findTask(board.state, socialPollId(task.id))?.task;
  const hasInterest = Boolean(childPoll?.interested);
  const gmDate = task.tags?.includes("gm")
    ? gmDateLabel(isOverdue ? startCategoryId : categoryId)
    : null;
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
      className={`py-2.5 ${isSubtask ? "pl-6" : ""} ${suggestionRow} ${holidayRow} ${overdueRow}`}
    >
      <div className="group flex flex-wrap items-center gap-2">
        {task.isHoliday ? (
          <span
            role="img"
            aria-label={`${task.text} is a USC holiday and cannot be checked off`}
            title="USC holiday — this date can't be checked off"
            className="flex size-4 shrink-0 items-center justify-center rounded-full border border-sky-400 bg-sky-100 text-sky-700 dark:border-sky-400/60 dark:bg-sky-400/20 dark:text-sky-300"
          >
            <svg
              viewBox="0 0 16 16"
              className="size-3"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              aria-hidden="true"
            >
              <rect x="2" y="3.5" width="12" height="10.5" rx="1.5" />
              <path d="M2 6.5h12M5 2v3M11 2v3" strokeLinecap="round" />
            </svg>
          </span>
        ) : (
          <input
            type="checkbox"
            checked={task.done}
            onChange={() => board.toggleTask(startCategoryId, task.id)}
            aria-label={`Mark "${task.text}" as ${
              task.done ? "not done" : "done"
            }`}
            className={`size-4 shrink-0 ${
              suggested
                ? "accent-amber-600 dark:accent-amber-400"
                : isOverdue
                  ? "accent-red-600 dark:accent-red-400"
                  : "accent-zinc-900 dark:accent-zinc-100"
            }`}
          />
        )}
        <button
          type="button"
          onClick={() => board.togglePanel(task.id, categoryId, "view")}
          aria-expanded={viewing}
          aria-controls={descriptionId}
          className={`flex flex-1 items-center text-left text-sm ${
            task.isHoliday
              ? "font-medium text-sky-900 dark:text-sky-200"
              : isOverdue
                ? "font-medium text-red-800 dark:text-red-300"
                : task.done
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

      {((task.tags?.length ?? 0) > 0 ||
        task.endCategoryId ||
        suggested ||
        showInterestToggle ||
        hasInterest ||
        gmDate ||
        task.isHoliday ||
        isOverdue) && (
        <div className="mt-1 flex flex-wrap items-center gap-1 pl-7">
          {isOverdue && (
            <span
              title={`Originally scheduled in ${sectionLabel(startCategoryId)}`}
              className="rounded-full border border-red-300 bg-red-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-red-700 dark:border-red-400/60 dark:bg-red-400/15 dark:text-red-300"
            >
              Overdue · {sectionLabel(startCategoryId)}
            </span>
          )}
          {task.isHoliday && (
            <span
              title="Pulled from the USC academic calendar"
              className="rounded-full border border-sky-300 bg-sky-100 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-sky-700 dark:border-sky-400/60 dark:bg-sky-400/15 dark:text-sky-300"
            >
              USC calendar
            </span>
          )}
          {suggested && (
            <span
              title="An idea you can keep, move, rename, or delete"
              className="rounded-full border border-dashed border-amber-400 bg-amber-100 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-amber-700 dark:border-amber-400/60 dark:bg-amber-400/15 dark:text-amber-300"
            >
              Suggestion
            </span>
          )}
          {showInterestToggle && (
            <button
              type="button"
              onClick={() => board.togglePollInterest(task.id)}
              aria-pressed={Boolean(task.interested)}
              aria-label={`${
                task.interested ? "Remove" : "Mark"
              } interest for ${parent?.text ?? "this event"}`}
              className={
                task.interested
                  ? "rounded-full border border-emerald-300 bg-emerald-100 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-emerald-700 transition-colors hover:bg-emerald-200 dark:border-emerald-400/60 dark:bg-emerald-400/15 dark:text-emerald-300 dark:hover:bg-emerald-400/25"
                  : "rounded-full border border-dashed border-zinc-300 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-zinc-500 transition-colors hover:border-zinc-400 hover:text-zinc-900 dark:border-zinc-700 dark:text-zinc-400 dark:hover:border-zinc-500 dark:hover:text-zinc-100"
              }
            >
              {task.interested ? "Interested ✓" : "Mark interest"}
            </button>
          )}
          {gmDate && (
            <span
              title="GM always happens on Wednesday"
              className="rounded-full border border-zinc-300 bg-white px-2 py-0.5 text-[10px] font-medium tabular-nums text-zinc-700 dark:border-zinc-600 dark:bg-zinc-950 dark:text-zinc-200"
            >
              {gmDate}
            </span>
          )}
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
          {hasInterest && (
            <span className="rounded-full border border-emerald-300 bg-emerald-100 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-emerald-700 dark:border-emerald-400/60 dark:bg-emerald-400/15 dark:text-emerald-300">
              Interest confirmed
            </span>
          )}
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
