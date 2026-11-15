import { isISODate } from "./calendar";
import type { Task } from "./types";

export type TodoBucketId =
  | "overdue"
  | "urgent"
  | "next-week"
  | "next-month"
  | "later"
  | "completed";

export type TodoGroup = {
  id: TodoBucketId;
  label: string;
  tasks: Task[];
};

export const TODO_GROUPS: { id: TodoBucketId; label: string }[] = [
  { id: "overdue", label: "Overdue" },
  { id: "urgent", label: "Urgent" },
  { id: "next-week", label: "Within the next week" },
  { id: "next-month", label: "Within the next month" },
  { id: "later", label: "Later or no due date" },
  { id: "completed", label: "Completed" },
];

const DAY_MS = 24 * 60 * 60 * 1000;

function daysUntil(dueDate: string, todayISO: string): number {
  return Math.round(
    (Date.parse(`${dueDate}T00:00:00Z`) -
      Date.parse(`${todayISO}T00:00:00Z`)) /
      DAY_MS,
  );
}

// Due dates are optional. Anything due today or tomorrow is urgent; the next
// seven days are "next week"; the rest of the next 30 days are "next month".
export function todoBucketFor(
  dueDate: string | undefined,
  todayISO: string,
): Exclude<TodoBucketId, "completed"> {
  if (!dueDate || !isISODate(dueDate) || !isISODate(todayISO)) {
    return "later";
  }

  const days = daysUntil(dueDate, todayISO);
  if (days < 0) return "overdue";
  if (days <= 1) return "urgent";
  if (days <= 7) return "next-week";
  if (days <= 30) return "next-month";
  return "later";
}

function compareDueDate(a: Task, b: Task): number {
  const aDue = a.dueDate && isISODate(a.dueDate) ? a.dueDate : null;
  const bDue = b.dueDate && isISODate(b.dueDate) ? b.dueDate : null;
  if (aDue && bDue) return aDue.localeCompare(bDue);
  if (aDue) return -1;
  if (bDue) return 1;
  return 0;
}

// Completed items are kept out of the time-based buckets so an old, finished
// to-do does not keep showing up as overdue.
export function groupTodos(tasks: Task[], todayISO: string): TodoGroup[] {
  const buckets = new Map<TodoBucketId, Task[]>(
    TODO_GROUPS.map((group) => [group.id, []]),
  );

  for (const task of tasks) {
    const bucket = task.done
      ? "completed"
      : todoBucketFor(task.dueDate, todayISO);
    buckets.get(bucket)?.push(task);
  }

  return TODO_GROUPS.flatMap((group) => {
    const groupTasks = buckets.get(group.id) ?? [];
    if (groupTasks.length === 0) return [];
    return [
      {
        ...group,
        tasks: groupTasks.sort(compareDueDate),
      },
    ];
  });
}
