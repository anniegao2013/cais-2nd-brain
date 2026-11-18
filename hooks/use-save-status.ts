"use client";

import { useSyncExternalStore } from "react";
import {
  getSaveStatusServerSnapshot,
  getSaveStatusSnapshot,
  subscribeSaveStatus,
  type SaveStatusSnapshot,
} from "@/lib/storage";

// Tracks whether the shared server copy is in step with the browser.
export function useSaveStatus(): SaveStatusSnapshot {
  return useSyncExternalStore(
    subscribeSaveStatus,
    getSaveStatusSnapshot,
    getSaveStatusServerSnapshot,
  );
}
