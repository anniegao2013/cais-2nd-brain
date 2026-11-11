"use client";

import { useSyncExternalStore } from "react";
import { currentWeekCategoryId } from "@/lib/calendar";

// Re-check periodically so an open tab notices when the week rolls over.
function subscribe(onChange: () => void): () => void {
  const timer = window.setInterval(onChange, 60_000);
  return () => window.clearInterval(timer);
}

function getSnapshot(): string | null {
  return currentWeekCategoryId();
}

// The page is statically rendered, so render no indicator until hydration.
function getServerSnapshot(): null {
  return null;
}

// Returns the category id (for example `week-12` or `spring-week-3`) whose week
// contains today, or null during a break.
export function useCurrentWeek(): string | null {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
