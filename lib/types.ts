import type { TagId } from "./tags";

export type Task = {
  id: string;
  text: string;
  done: boolean;
  isDefault?: boolean;
  tags?: TagId[];
  parentId?: string;
  leadWeeks?: number;
  endCategoryId?: string;
  notes?: string;
};

export type TasksByCategory = Record<string, Task[]>;

// An edge means `before` must happen earlier than `after`.
export type Dependency = { before: string; after: string };

export type AppState = {
  tasks: TasksByCategory;
  removedDefaults: string[];
  dependencies: Dependency[];
};

export type TaskOccurrence = {
  task: Task;
  startCategoryId: string;
  isStart: boolean;
};

export type TaskOption = {
  id: string;
  text: string;
  label: string;
};
