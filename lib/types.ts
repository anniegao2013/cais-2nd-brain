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
  // A task generated for the current week's GM, such as weekly prep work.
  recurring?: boolean;
  // Optional YYYY-MM-DD suggestion for when an idea should be discussed.
  gmSuggestedMonth?: string;
  // Optional YYYY-MM-DD due date for an undated to-do.
  dueDate?: string;
  // Set on an interest poll when enough people said they want the event.
  interested?: boolean;
  // USC academic-calendar dates are shown as reference events, not tasks, so
  // they get their own styling and cannot be checked off.
  isHoliday?: boolean;
};

export type TasksByCategory = Record<string, Task[]>;

export type MeetingSchedule = {
  // 0 = Sunday, matching Date#getDay().
  weekday: number;
  // 24-hour "HH:MM" from the time input.
  time: string;
};

// An edge means `before` must happen earlier than `after`.
export type Dependency = { before: string; after: string };

// One delete action can remove a parent and its subtasks. Keeping the whole
// group together means one restore puts everything back where it was.
export type DeletedBatch = {
  id: string;
  deletedAt: string;
  tasks: Array<{ categoryId: string; task: Task }>;
  dependencies: Dependency[];
};

export type AppState = {
  tasks: TasksByCategory;
  removedDefaults: string[];
  dependencies: Dependency[];
  // Weekly slot for the GM / e-board meeting. Older saves fall back to the
  // default Wednesday evening slot.
  meetingSchedule?: MeetingSchedule;
  // Recent deletions, newest first, so they can be reviewed and restored.
  deletedTasks?: DeletedBatch[];
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
