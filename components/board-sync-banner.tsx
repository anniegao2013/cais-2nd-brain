"use client";

import { useSaveStatus } from "@/hooks/use-save-status";
import { keepLocalBoard, loadLatestBoard } from "@/lib/storage";

function timeLabel(iso: string | null): string | null {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });
}

// Two states live here: a conflict that needs a decision, and a short-lived
// note that a newer shared copy was loaded on its own.
export function BoardSyncBanner() {
  const { conflict, note, remoteUpdatedAt } = useSaveStatus();
  const time = timeLabel(remoteUpdatedAt);

  if (conflict) {
    return (
      <div
        role="alert"
        className="mt-4 flex flex-wrap items-start justify-between gap-3 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2.5 text-sm text-amber-900 print:hidden dark:border-amber-400/50 dark:bg-amber-400/10 dark:text-amber-200"
      >
        <div className="min-w-0">
          <p className="font-medium">This board changed somewhere else.</p>
          <p className="mt-0.5 text-amber-800 dark:text-amber-200/80">
            Another tab or a teammate saved a newer copy
            {time ? ` at ${time}` : ""}. Your changes are still in this browser.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={loadLatestBoard}
            title="Discard this browser's changes and use the newer shared copy."
            className="rounded-md border border-amber-400 px-2.5 py-1 text-xs font-medium text-amber-900 transition-colors hover:bg-amber-100 dark:border-amber-400/60 dark:text-amber-100 dark:hover:bg-amber-400/15"
          >
            Load latest
          </button>
          <button
            type="button"
            onClick={keepLocalBoard}
            title="Replace the newer shared copy with this browser's board."
            className="rounded-md bg-amber-900 px-2.5 py-1 text-xs font-medium text-amber-50 transition-colors hover:bg-amber-800 dark:bg-amber-300 dark:text-amber-950 dark:hover:bg-amber-200"
          >
            Keep mine
          </button>
        </div>
      </div>
    );
  }

  if (!note) return null;

  return (
    <p
      role="status"
      className="mt-4 rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-600 print:hidden dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300"
    >
      {note}
    </p>
  );
}
