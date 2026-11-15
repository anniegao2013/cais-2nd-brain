import { describe, expect, it } from "vitest";
import { TODO_CATEGORY_ID } from "../lib/categories";
import {
  EBOARD_AGENDA_TEXT,
  eboardAgendaId,
  isEboardAgendaTask,
  syncRecurringEboardAgenda,
} from "../lib/recurring-eboard-tasks";
import { findTask } from "../lib/tasks";
import { makeState, makeTask } from "./helpers";

describe("syncRecurringEboardAgenda", () => {
  it("adds an agenda to-do for a week with a meeting", () => {
    const next = syncRecurringEboardAgenda(makeState({}), "week-13");
    const agenda = next?.tasks[TODO_CATEGORY_ID] ?? [];

    expect(agenda).toHaveLength(1);
    expect(agenda[0]).toMatchObject({
      id: eboardAgendaId("week-13"),
      text: EBOARD_AGENDA_TEXT,
      done: false,
      recurring: true,
      dueDate: "2026-11-18",
    });
  });

  it("due date follows the selected meeting day", () => {
    const next = syncRecurringEboardAgenda(
      makeState({}, { meetingSchedule: { weekday: 2, time: "18:30" } }),
      "week-13",
    );

    expect(next?.tasks[TODO_CATEGORY_ID]?.[0]?.dueDate).toBe("2026-11-17");
  });

  it("skips a meeting that falls on a holiday", () => {
    // Default Wednesday: Veterans Day and Thanksgiving are Wednesday holidays.
    expect(syncRecurringEboardAgenda(makeState({}), "week-12")).toBeNull();
    expect(syncRecurringEboardAgenda(makeState({}), "week-14")).toBeNull();
  });

  it("checks the meeting day, not just the week", () => {
    // Fall Recess is Thursday-Friday, so a Wednesday meeting still happens.
    expect(
      syncRecurringEboardAgenda(makeState({}), "week-7")?.tasks[
        TODO_CATEGORY_ID
      ]?.[0]?.dueDate,
    ).toBe("2026-10-07");

    // The recess dates themselves cancel the meeting.
    expect(
      syncRecurringEboardAgenda(
        makeState({}, { meetingSchedule: { weekday: 4, time: "19:00" } }),
        "week-7",
      ),
    ).toBeNull();
    expect(
      syncRecurringEboardAgenda(
        makeState({}, { meetingSchedule: { weekday: 5, time: "19:00" } }),
        "week-7",
      ),
    ).toBeNull();

    // Veterans Day only cancels a Wednesday meeting; Tuesday still meets.
    expect(
      syncRecurringEboardAgenda(
        makeState({}, { meetingSchedule: { weekday: 2, time: "19:00" } }),
        "week-12",
      )?.tasks[TODO_CATEGORY_ID]?.[0]?.dueDate,
    ).toBe("2026-11-10");

    // Labor Day cancels a Monday meeting but not a Tuesday one.
    expect(
      syncRecurringEboardAgenda(
        makeState({}, { meetingSchedule: { weekday: 1, time: "19:00" } }),
        "week-3",
      ),
    ).toBeNull();
    expect(
      syncRecurringEboardAgenda(
        makeState({}, { meetingSchedule: { weekday: 2, time: "19:00" } }),
        "week-3",
      )?.tasks[TODO_CATEGORY_ID]?.[0]?.dueDate,
    ).toBe("2026-09-08");
  });

  it("does nothing without a current week", () => {
    expect(syncRecurringEboardAgenda(makeState({}), null)).toBeNull();
  });

  it("replaces past agendas instead of collecting them", () => {
    const pastId = eboardAgendaId("week-11");
    const state = makeState({
      [TODO_CATEGORY_ID]: [
        makeTask(pastId, { text: EBOARD_AGENDA_TEXT, recurring: true }),
      ],
    });

    const next = syncRecurringEboardAgenda(state, "week-13");
    const kinds = (next?.tasks[TODO_CATEGORY_ID] ?? []).map((task) => task.id);

    expect(kinds).toEqual([eboardAgendaId("week-13")]);
  });

  it("drops the current agenda when the week has no meeting", () => {
    const id = eboardAgendaId("week-12");
    const state = makeState({
      [TODO_CATEGORY_ID]: [makeTask(id, { recurring: true })],
    });

    const next = syncRecurringEboardAgenda(state, "week-12");

    expect(next?.tasks[TODO_CATEGORY_ID]).toEqual([]);
  });

  it("is idempotent after the agenda has been created", () => {
    const first = syncRecurringEboardAgenda(makeState({}), "week-13");
    expect(first).not.toBeNull();
    expect(syncRecurringEboardAgenda(first!, "week-13")).toBeNull();
  });

  it("does not recreate a deleted agenda", () => {
    const id = eboardAgendaId("week-13");
    const state = makeState({}, { removedDefaults: [id] });

    expect(syncRecurringEboardAgenda(state, "week-13")).toBeNull();
    expect(findTask(state, id)).toBeNull();
  });

  it("recognizes generated agenda ids", () => {
    expect(isEboardAgendaTask({ id: eboardAgendaId("week-13") })).toBe(true);
    expect(isEboardAgendaTask({ id: eboardAgendaId("spring-week-2") })).toBe(
      true,
    );
    expect(isEboardAgendaTask({ id: "recurring-week-13-slides" })).toBe(false);
  });
});
