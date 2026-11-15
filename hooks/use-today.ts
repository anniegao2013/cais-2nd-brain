"use client";

import { useSyncExternalStore } from "react";
import { todayISODate } from "@/lib/calendar";

// Re-check periodically so an open tab notices the day roll over.
function subscribe(onChange: () => void): () => void {
  const timer = window.setInterval(onChange, 60_000);
  return () => window.clearInterval(timer);
}

function getSnapshot(): string {
  return todayISODate();
}

// The page is statically rendered, so render nothing date-dependent until
// hydration to avoid Next.js prerender warnings.
function getServerSnapshot(): null {
  return null;
}

export function useTodayISO(): string | null {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
