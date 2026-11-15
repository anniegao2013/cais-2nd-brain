import { describe, expect, it } from "vitest";
import {
  TIMELINE_TABS,
  TODO_CATEGORY_ID,
  categoriesForTab,
} from "../lib/categories";
import {
  agendaEvents,
  agendaTodos,
  meetingWeeks,
  nextMeetingWeek,
  type MeetingWeek,
} from "../lib/eboard-agenda";
import { gmEventId } from "../lib/gm-events";
import { eboardAgendaId } from "../lib/recurring-eboard-tasks";
import { makeState, makeTask } from "./helpers";

function findMeeting(
  weeks: MeetingWeek[],
  categoryId: string,
): MeetingWeek | undefined {
  return weeks.find((meeting) => meeting.categoryId === categoryId);
}

describe("E-board agenda tab", () => {
  it("adds a dedicated tab with no timeline categories", () => {
    expect(TIMELINE_TABS.map((tab) => tab.id)).toContain("eboard-agenda");
    expect(categoriesForTab("eboard-agenda")).toEqual([]);
  });
});

describe("meetingWeeks", () => {
  it("rolls a skipped week into the meeting before it", () => {
    const weeks = meetingWeeks(makeState({}));

    expect(findMeeting(weeks, "week-13")?.coveredCategoryIds).toEqual([
      "week-13",
      "week-14",
    ]);
    expect(findMeeting(weeks, "week-11")?.coveredCategoryIds).toEqual([
      "week-11",
      "week-12",
    ]);
    expect(findMeeting(weeks, "week-12")).toBeUndefined();
    expect(findMeeting(weeks, "week-14")).toBeUndefined();
  });

  it("keeps a Fall Recess week that still has a Wednesday meeting", () => {
    const weeks = meetingWeeks(makeState({}));

    expect(findMeeting(weeks, "week-7")?.coveredCategoryIds).toEqual([
      "week-7",
    ]);
  });

  it("uses the selected meeting day when deciding which weeks are skipped", () => {
    const weeks = meetingWeeks(
      makeState({}, { meetingSchedule: { weekday: 4, time: "19:00" } }),
    );

    // Fall Recess is Thursday-Friday, so Thursday's meeting is skipped. This
    // meeting follows the GM, so it starts with the next week and also covers
    // the following meeting's week because there is no meeting in between.
    expect(findMeeting(weeks, "week-6")?.coveredCategoryIds).toEqual([
      "week-7",
      "week-8",
    ]);
    // Veterans Day is Wednesday, so Thursday still meets and plans Week 13.
    expect(findMeeting(weeks, "week-12")?.coveredCategoryIds).toEqual([
      "week-13",
    ]);
    // Thanksgiving covers Thursday. Week 14 and the next meeting's Week 15
    // both belong to the Week 13 meeting.
    expect(findMeeting(weeks, "week-13")?.coveredCategoryIds).toEqual([
      "week-14",
      "week-15",
    ]);
    expect(findMeeting(weeks, "week-7")).toBeUndefined();
    expect(findMeeting(weeks, "week-14")).toBeUndefined();
  });

  it("groups Spring Recess into the week before it", () => {
    const weeks = meetingWeeks(makeState({}));

    expect(
      findMeeting(weeks, "spring-week-9")?.coveredCategoryIds,
    ).toEqual(["spring-week-9", "spring-week-10"]);
  });
});

describe("nextMeetingWeek", () => {
  it("finds the next meeting on or after today", () => {
    expect(nextMeetingWeek(makeState({}), "2026-11-15")?.categoryId).toBe(
      "week-13",
    );
    expect(nextMeetingWeek(makeState({}), "2026-11-19")?.categoryId).toBe(
      "week-15",
    );
  });

  it("respects the selected meeting day", () => {
    const thursday = makeState(
      {},
      { meetingSchedule: { weekday: 4, time: "19:00" } },
    );

    expect(nextMeetingWeek(thursday, "2026-11-15")?.dateISO).toBe(
      "2026-11-19",
    );
  });
});

describe("agendaEvents", () => {
  const gmId = gmEventId("week-13");
  const state = makeState({
    "week-13": [
      makeTask("open-13"),
      makeTask("spanning", { endCategoryId: "week-14" }),
      makeTask("done-13", { done: true }),
      makeTask("holiday-13", { isHoliday: true }),
      makeTask(gmId, { text: "GM" }),
      makeTask("gm-prep", { parentId: gmId, recurring: true }),
    ],
    "week-14": [makeTask("open-14")],
    "week-15": [makeTask("open-15")],
  });
  const meeting = findMeeting(meetingWeeks(state), "week-13")!;

  it("pulls open events from every covered week", () => {
    expect(
      agendaEvents(state, meeting).map(({ task }) => task.id),
    ).toEqual(["open-13", "spanning", "open-14"]);
  });

  it("leaves out the GM, its prep work, holidays, and done items", () => {
    const ids = agendaEvents(state, meeting).map(({ task }) => task.id);

    expect(ids).not.toContain(gmId);
    expect(ids).not.toContain("gm-prep");
    expect(ids).not.toContain("holiday-13");
    expect(ids).not.toContain("done-13");
    expect(ids).not.toContain("open-15");
  });
});

describe("agendaEvents after the GM", () => {
  it("starts with the following week instead of the meeting's own week", () => {
    const state = makeState(
      {
        "week-6": [makeTask("open-6")],
        "week-7": [makeTask("open-7")],
        "week-8": [makeTask("open-8")],
      },
      { meetingSchedule: { weekday: 4, time: "19:00" } },
    );
    const meeting = findMeeting(meetingWeeks(state), "week-6")!;

    expect(meeting.coveredCategoryIds).toEqual(["week-7", "week-8"]);
    expect(agendaEvents(state, meeting).map(({ task }) => task.id)).toEqual([
      "open-7",
      "open-8",
    ]);
  });
});

describe("agendaTodos", () => {
  it("collects open to-dos due by the end of the covered weeks", () => {
    const state = makeState({
      [TODO_CATEGORY_ID]: [
        makeTask("undated"),
        makeTask("near", { dueDate: "2026-11-20" }),
        makeTask("skipped-week", { dueDate: "2026-11-24" }),
        makeTask("later", { dueDate: "2026-12-10" }),
        makeTask("overdue", { dueDate: "2026-11-01" }),
        makeTask("done", { done: true, dueDate: "2026-11-18" }),
        makeTask(eboardAgendaId("week-13"), {
          dueDate: "2026-11-18",
          recurring: true,
        }),
      ],
    });
    const meeting = findMeeting(meetingWeeks(state), "week-13")!;

    expect(agendaTodos(state, meeting).map((task) => task.id)).toEqual([
      "overdue",
      "near",
      "skipped-week",
      "undated",
    ]);
  });
});
