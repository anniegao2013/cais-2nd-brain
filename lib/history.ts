export type History<T> = {
  past: T[];
  future: T[];
};

export const DEFAULT_HISTORY_LIMIT = 50;

export function emptyHistory<T>(): History<T> {
  return { past: [], future: [] };
}

// Recording a new change always invalidates the redo path. When the limit is
// reached the oldest snapshot is dropped, keeping memory bounded.
export function recordHistory<T>(
  history: History<T>,
  current: T,
  limit: number = DEFAULT_HISTORY_LIMIT,
): History<T> {
  const past = [...history.past, current];
  if (past.length > limit) past.splice(0, past.length - limit);
  return { past, future: [] };
}

export function undoHistory<T>(
  history: History<T>,
  current: T,
): { history: History<T>; value: T } | null {
  if (history.past.length === 0) return null;
  const value = history.past[history.past.length - 1] as T;
  return {
    history: {
      past: history.past.slice(0, -1),
      future: [...history.future, current],
    },
    value,
  };
}

export function redoHistory<T>(
  history: History<T>,
  current: T,
): { history: History<T>; value: T } | null {
  if (history.future.length === 0) return null;
  const value = history.future[history.future.length - 1] as T;
  return {
    history: {
      past: [...history.past, current],
      future: history.future.slice(0, -1),
    },
    value,
  };
}
