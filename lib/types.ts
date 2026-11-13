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
  // Marks a starter idea rather than a real task. Suggestions get their own
  // styling in the timeline until they are deleted.
  suggested?: boolean;
  // Set when an idea from the GM ideas backlog has been assigned to a GM.
  gmIdea?: boolean;
  // Set on an interest poll when enough people said they want the event.
  interested?: boolean;
  // USC academic-calendar dates are shown as reference events, not tasks, so
  // they get their own styling and cannot be checked off.
  isHoliday?: boolean;
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
  // An incomplete task carried forward from an earlier week.
  isOverdue?: boolean;
};

export type TaskOption = {
  id: string;
  text: string;
  label: string;
};
