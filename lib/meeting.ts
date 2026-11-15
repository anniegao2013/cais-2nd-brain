import type { AppState, MeetingSchedule } from "./types";

export type { MeetingSchedule };

export const WEEKDAY_LABELS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
] as const;

export const WEEKDAY_SHORT_LABELS = [
  "Sun",
  "Mon",
  "Tue",
  "Wed",
  "Thu",
  "Fri",
  "Sat",
] as const;

// GM events stay on Wednesdays. The e-board meeting can move, and its position
// relative to that GM decides which week its agenda plans.
export const GM_WEEKDAY = 3;

// The board's GM events were already grounded on Wednesdays. Keep that date as
// the default while making the day and time configurable.
export const DEFAULT_MEETING_SCHEDULE: MeetingSchedule = {
  weekday: GM_WEEKDAY,
  time: "19:00",
};

// Weeks run Monday-Sunday, so Sunday (0) is also after Wednesday. A meeting on
// Thursday or later happens after that week's GM and plans the next week.
export function meetingFollowsGm(weekday: number): boolean {
  return weekday === 0 || weekday > GM_WEEKDAY;
}

const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

export function isMeetingTime(value: unknown): value is string {
  return typeof value === "string" && TIME_PATTERN.test(value);
}

export function isMeetingSchedule(value: unknown): value is MeetingSchedule {
  return (
    typeof value === "object" &&
    value !== null &&
    Number.isInteger((value as MeetingSchedule).weekday) &&
    (value as MeetingSchedule).weekday >= 0 &&
    (value as MeetingSchedule).weekday <= 6 &&
    isMeetingTime((value as MeetingSchedule).time)
  );
}

export function resolveMeetingSchedule(
  state: Pick<AppState, "meetingSchedule">,
): MeetingSchedule {
  return isMeetingSchedule(state.meetingSchedule)
    ? state.meetingSchedule
    : DEFAULT_MEETING_SCHEDULE;
}

export function weekdayLabel(weekday: number): string {
  return WEEKDAY_LABELS[weekday] ?? WEEKDAY_LABELS[3];
}

const timeLabel = new Intl.DateTimeFormat("en-US", {
  hour: "numeric",
  minute: "2-digit",
  timeZone: "UTC",
});

export function meetingTimeLabel(time: string): string {
  if (!isMeetingTime(time)) return time;
  return timeLabel.format(new Date(`2000-01-01T${time}:00Z`));
}
