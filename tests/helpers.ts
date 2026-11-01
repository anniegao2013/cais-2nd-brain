import type { AppState, Task } from "../lib/types";

export function makeTask(id: string, overrides: Partial<Task> = {}): Task {
  return { id, text: id, done: false, ...overrides };
}

export function makeState(
  tasks: Record<string, Task[]>,
  overrides: Partial<Omit<AppState, "tasks">> = {},
): AppState {
  return {
    tasks,
    removedDefaults: overrides.removedDefaults ?? [],
    dependencies: overrides.dependencies ?? [],
  };
}

export function ids(tasks: Task[] | undefined): string[] {
  return (tasks ?? []).map((task) => task.id);
}
