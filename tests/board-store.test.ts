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

    await writeBoard(state, { filePath: file });
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

    await Promise.all([
      writeBoard(first, { filePath: file }),
      writeBoard(second, { filePath: file }),
    ]);
    const loaded = await readBoard(file);

    expect(
      loaded?.state.tasks["week-1"]?.find((task) => task.id === "first")?.text,
    ).toBe("Updated title");
  });

  it("gives each distinct save a new version", async () => {
    const file = await boardFile();
    const first = await writeBoard(
      makeState({ "week-1": [makeTask("first", { text: "First" })] }),
      { filePath: file },
    );
    const second = await writeBoard(
      makeState({ "week-1": [makeTask("first", { text: "Second" })] }),
      { filePath: file },
    );

    expect(first.written).toBe(true);
    expect(second.written).toBe(true);
    if (!first.written || !second.written) return;
    expect(first.board.version).toBeTruthy();
    expect(second.board.version).not.toBe(first.board.version);
    expect((await readBoard(file))?.version).toBe(second.board.version);
  });

  it("refuses a save based on an outdated version", async () => {
    const file = await boardFile();
    const state = makeState({
      "week-1": [makeTask("first", { text: "First" })],
    });
    const initial = await writeBoard(state, { filePath: file });
    if (!initial.written) throw new Error("initial write failed");

    await writeBoard(
      makeState({ "week-1": [makeTask("first", { text: "Theirs" })] }),
      { filePath: file, expectedVersion: initial.board.version },
    );

    const stale = await writeBoard(
      makeState({ "week-1": [makeTask("first", { text: "Mine" })] }),
      { filePath: file, expectedVersion: initial.board.version },
    );

    expect(stale.written).toBe(false);
    if (stale.written) return;
    expect(
      stale.current?.state.tasks["week-1"]?.find((task) => task.id === "first")
        ?.text,
    ).toBe("Theirs");
    expect(
      (await readBoard(file))?.state.tasks["week-1"]?.find(
        (task) => task.id === "first",
      )?.text,
    ).toBe("Theirs");
  });

  it("accepts a save that matches the current version", async () => {
    const file = await boardFile();
    const initial = await writeBoard(
      makeState({ "week-1": [makeTask("first", { text: "First" })] }),
      { filePath: file },
    );
    if (!initial.written) throw new Error("initial write failed");

    const next = await writeBoard(
      makeState({ "week-1": [makeTask("first", { text: "Next" })] }),
      { filePath: file, expectedVersion: initial.board.version },
    );

    expect(next.written).toBe(true);
    const loaded = await readBoard(file);
    expect(
      loaded?.state.tasks["week-1"]?.find((task) => task.id === "first")?.text,
    ).toBe("Next");
  });

  it("only lets one of two equal-version saves win", async () => {
    const file = await boardFile();
    const initial = await writeBoard(
      makeState({ "week-1": [makeTask("first", { text: "First" })] }),
      { filePath: file },
    );
    if (!initial.written) throw new Error("initial write failed");

    const [a, b] = await Promise.all([
      writeBoard(
        makeState({ "week-1": [makeTask("first", { text: "A" })] }),
        { filePath: file, expectedVersion: initial.board.version },
      ),
      writeBoard(
        makeState({ "week-1": [makeTask("first", { text: "B" })] }),
        { filePath: file, expectedVersion: initial.board.version },
      ),
    ]);

    expect([a.written, b.written].filter(Boolean)).toHaveLength(1);
  });
});
