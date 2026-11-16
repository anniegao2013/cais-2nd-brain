import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { readBoard, writeBoard } from "../lib/server/board-store";
import { TODO_CATEGORY_ID } from "../lib/categories";
import { makeState, makeTask } from "./helpers";

let directory: string | null = null;

async function boardFile(): Promise<string> {
  directory = await mkdtemp(path.join(os.tmpdir(), "second-brain-board-"));
  return path.join(directory, "board.json");
}

afterEach(async () => {
  if (directory) await rm(directory, { recursive: true, force: true });
  directory = null;
});

describe("board store", () => {
  it("returns null before the first save", async () => {
    expect(await readBoard(await boardFile())).toBeNull();
  });

  it("round-trips events, to-dos, and the meeting schedule", async () => {
    const file = await boardFile();
    const state = makeState(
      {
        "week-3": [
          makeTask("event", { text: "Plan the retreat", tags: ["social"] }),
        ],
        [TODO_CATEGORY_ID]: [
          makeTask("todo", { text: "Book the room", dueDate: "2026-11-20" }),
        ],
      },
      { meetingSchedule: { weekday: 4, time: "18:30" } },
    );

    await writeBoard(state, file);
    const loaded = await readBoard(file);

    expect(loaded?.updatedAt).toBeTruthy();
    expect(loaded?.state.tasks["week-3"]).toContainEqual(
      expect.objectContaining({
        id: "event",
        text: "Plan the retreat",
        tags: ["social"],
      }),
    );
    expect(loaded?.state.tasks[TODO_CATEGORY_ID]).toContainEqual(
      expect.objectContaining({
        id: "todo",
        text: "Book the room",
        dueDate: "2026-11-20",
      }),
    );
    expect(loaded?.state.meetingSchedule).toEqual({
      weekday: 4,
      time: "18:30",
    });
  });

  it("keeps the most recent save", async () => {
    const file = await boardFile();
    const first = makeState({
      "week-1": [makeTask("first", { text: "First title" })],
    });
    const second = makeState({
      "week-1": [makeTask("first", { text: "Updated title" })],
    });

    await Promise.all([writeBoard(first, file), writeBoard(second, file)]);
    const loaded = await readBoard(file);

    expect(
      loaded?.state.tasks["week-1"]?.find((task) => task.id === "first")?.text,
    ).toBe("Updated title");
  });
});
