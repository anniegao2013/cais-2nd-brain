import { isMeetingTime } from "./meeting";
import type { AppState } from "./types";

// Invalid values are rejected instead of silently falling back so the time
// input cannot leave the saved schedule in a broken state.
export function setMeetingSchedule(
  state: AppState,
  weekday: number,
  time: string,
): AppState | null {
  if (!Number.isInteger(weekday) || weekday < 0 || weekday > 6) return null;
  if (!isMeetingTime(time)) return null;

  return {
    ...state,
    meetingSchedule: { weekday, time },
  };
}
