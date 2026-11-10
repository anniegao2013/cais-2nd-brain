"use client";

import { useSyncExternalStore } from "react";
import { currentWeekNumber } from "@/lib/calendar";

// Re-check periodically so an open tab notices when the week rolls over.
function subscribe(onChange: () => void): () => void {
  const timer = window.setInterval(onChange, 60_000);
  return () => window.clearInterval(timer);
}

function getSnapshot(): number | null {
  return currentWeekNumber();
}

// The page is statically rendered, so render no indicator until hydration.
function getServerSnapshot(): null {
  return null;
}

export function useCurrentWeek(): number | null {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
