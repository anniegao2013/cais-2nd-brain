"use client";

import type { BoardToast } from "@/hooks/use-task-board";

// A short-lived confirmation for destructive and far-reaching actions. The
// action button is the same Undo as the toolbar, so it disappears with the
// toast rather than staying in the layout.
export function BoardToastView({
  toast,
  onDismiss,
}: {
  toast: BoardToast | null;
  onDismiss: () => void;
}) {
  if (!toast) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 bottom-4 z-50 flex justify-center px-4 print:hidden"
    >
      <div className="pointer-events-auto flex max-w-md items-center gap-3 rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-xs text-zinc-100 shadow-xl dark:border-zinc-600 dark:bg-zinc-100 dark:text-zinc-900">
        <span className="min-w-0 flex-1">{toast.message}</span>
        {toast.actionLabel && toast.onAction && (
          <button
            type="button"
            onClick={() => {
              toast.onAction?.();
              onDismiss();
            }}
            className="shrink-0 rounded-md bg-white/15 px-2 py-1 text-[11px] font-semibold text-white transition-colors hover:bg-white/25 dark:bg-zinc-900/10 dark:text-zinc-900 dark:hover:bg-zinc-900/20"
          >
            {toast.actionLabel}
          </button>
        )}
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss notification"
          className="shrink-0 rounded-md px-1 text-sm leading-none text-zinc-400 transition-colors hover:text-white dark:text-zinc-500 dark:hover:text-zinc-900"
        >
          ×
        </button>
      </div>
    </div>
  );
}
