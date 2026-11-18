"use client";

import { useSaveStatus } from "@/hooks/use-save-status";

function timeLabel(iso: string | null): string | null {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });
}

// A quiet confirmation that shared saves are working, and a clear warning when
// the server is unreachable and changes are waiting in this browser.
export function SaveStatus() {
  const { status, updatedAt } = useSaveStatus();
  const time = timeLabel(updatedAt);

  const view =
    status === "offline"
      ? {
          label: "Offline · retrying",
          title:
            "Changes are saved in this browser and will be sent when the server is reachable.",
          dot: "bg-amber-500",
          text: "text-amber-700 dark:text-amber-300",
          border: "border-amber-300 dark:border-amber-400/50",
        }
      : status === "conflict"
        ? {
            label: "Changed elsewhere",
            title:
              "Another tab or teammate saved first. Choose which copy to keep below.",
            dot: "bg-amber-500",
            text: "text-amber-700 dark:text-amber-300",
            border: "border-amber-300 dark:border-amber-400/50",
          }
        : status === "saving"
          ? {
            label: "Saving…",
            title: "Sending changes to the shared board.",
            dot: "bg-zinc-400 animate-pulse",
            text: "text-zinc-500 dark:text-zinc-400",
            border: "border-zinc-200 dark:border-zinc-700",
          }
        : status === "saved"
          ? {
              label: time ? `Saved ${time}` : "Saved",
              title: "Every change is on the shared board.",
              dot: "bg-emerald-500",
              text: "text-zinc-500 dark:text-zinc-400",
              border: "border-zinc-200 dark:border-zinc-700",
            }
          : {
              label: "Ready",
              title: "The board is loaded.",
              dot: "bg-zinc-300 dark:bg-zinc-600",
              text: "text-zinc-500 dark:text-zinc-400",
              border: "border-zinc-200 dark:border-zinc-700",
            };

  return (
    <span
      role="status"
      aria-live="polite"
      title={view.title}
      className={`inline-flex h-7 items-center gap-1.5 rounded-full border bg-white px-2.5 text-[11px] font-medium tabular-nums dark:bg-zinc-900 ${view.border} ${view.text}`}
    >
      <span
        aria-hidden="true"
        className={`size-1.5 shrink-0 rounded-full ${view.dot}`}
      />
      {view.label}
    </span>
  );
}
