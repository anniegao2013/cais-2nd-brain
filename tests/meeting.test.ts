import { describe, expect, it } from "vitest";
import { gmDateLabel, weekMeetingISO } from "../lib/calendar";
import { DEFAULT_EVENTS, DEFAULT_STATE } from "../lib/defaults";
import { gmEventOptions } from "../lib/gm-events";
import {
  DEFAULT_MEETING_SCHEDULE,
  isMeetingSchedule,
  isMeetingTime,
  meetingFollowsGm,
  meetingTimeLabel,
  resolveMeetingSchedule,
  weekdayLabel,
} from "../lib/meeting";
import { setMeetingSchedule } from "../lib/meeting-actions";
import { normalizeStorage } from "../lib/storage";
import { makeState } from "./helpers";

describe("meeting schedule", () => {
  it("defaults to Wednesday at 7:00 PM", () => {
    expect(DEFAULT_MEETING_SCHEDULE).toEqual({
      weekday: 3,
      time: "19:00",
    });
    expect(DEFAULT_STATE.meetingSchedule).toEqual(DEFAULT_MEETING_SCHEDULE);
    expect(resolveMeetingSchedule({})).toEqual(DEFAULT_MEETING_SCHEDULE);
    expect(weekdayLabel(3)).toBe("Wednesday");
  });

  it("validates weekdays and 24-hour times", () => {
    expect(isMeetingTime("19:00")).toBe(true);
    expect(isMeetingTime("00:00")).toBe(true);
    expect(isMeetingTime("23:59")).toBe(true);
    expect(isMeetingTime("24:00")).toBe(false);
    expect(isMeetingTime("7:00 PM")).toBe(false);
    expect(isMeetingSchedule({ weekday: 6, time: "08:05" })).toBe(true);
    expect(isMeetingSchedule({ weekday: 7, time: "08:05" })).toBe(false);
    expect(isMeetingSchedule({ weekday: 1, time: "8:05" })).toBe(false);
  });

  it("formats times for display", () => {
    expect(meetingTimeLabel("19:00")).toBe("7:00 PM");
    expect(meetingTimeLabel("00:00")).toBe("12:00 AM");
    expect(meetingTimeLabel("12:30")).toBe("12:30 PM");
  });

  it("places the meeting on the chosen weekday of each week", () => {
    expect(weekMeetingISO("week-1", 1)).toBe("2026-08-24");
    expect(weekMeetingISO("week-1", 3)).toBe("2026-08-26");
    expect(weekMeetingISO("week-1", 5)).toBe("2026-08-28");
    expect(weekMeetingISO("week-1", 0)).toBe("2026-08-30");
    expect(gmDateLabel("week-1", 4)).toBe("Thu, Aug 27");
    expect(weekMeetingISO("spring", 3)).toBeNull();
  });

  it("plans the following week only when the meeting follows Wednesday's GM", () => {
    expect(meetingFollowsGm(0)).toBe(true); // Sunday is the end of the week
    expect(meetingFollowsGm(1)).toBe(false);
    expect(meetingFollowsGm(2)).toBe(false);
    expect(meetingFollowsGm(3)).toBe(false);
    expect(meetingFollowsGm(4)).toBe(true);
    expect(meetingFollowsGm(5)).toBe(true);
    expect(meetingFollowsGm(6)).toBe(true);
  });

  it("sets a valid schedule and rejects invalid values", () => {
    const next = setMeetingSchedule(DEFAULT_STATE, 4, "18:30");
    expect(next?.meetingSchedule).toEqual({ weekday: 4, time: "18:30" });
    expect(setMeetingSchedule(DEFAULT_STATE, 7, "18:30")).toBeNull();
    expect(setMeetingSchedule(DEFAULT_STATE, 4, "6:30 PM")).toBeNull();

    expect(resolveMeetingSchedule(next!)).toEqual({
      weekday: 4,
      time: "18:30",
    });
  });

  it("persists the schedule and drops malformed saved values", () => {
    const saved = normalizeStorage(
      JSON.stringify({
        tasks: {},
        removedDefaults: DEFAULT_EVENTS.map((event) => event.id),
        dependencies: [],
        meetingSchedule: { weekday: 1, time: "08:05" },
      }),
    );
    expect(saved.meetingSchedule).toEqual({ weekday: 1, time: "08:05" });

    const malformed = normalizeStorage(
      JSON.stringify({
        tasks: {},
        removedDefaults: DEFAULT_EVENTS.map((event) => event.id),
        dependencies: [],
        meetingSchedule: { weekday: 8, time: "25:00" },
      }),
    );
    expect(malformed.meetingSchedule).toBeUndefined();
    expect(resolveMeetingSchedule(malformed)).toEqual(DEFAULT_MEETING_SCHEDULE);
  });

  it("reflects the selected day and time in GM choices", () => {
    const state = {
      ...DEFAULT_STATE,
      meetingSchedule: { weekday: 4, time: "18:30" },
    };
    const week8 = gmEventOptions(state).find(
      (option) => option.categoryId === "week-8",
    );

    expect(week8?.label).toBe("Fall Week 8 · Thu, Oct 15 · 6:30 PM");
  });

  it("does not require a schedule when it is missing", () => {
    const state = makeState({});
    expect(resolveMeetingSchedule(state)).toEqual(DEFAULT_MEETING_SCHEDULE);
  });
});
