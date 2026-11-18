import { describe, expect, it } from "vitest";
import {
  emptyHistory,
  recordHistory,
  redoHistory,
  undoHistory,
} from "../lib/history";

describe("history", () => {
  it("undoes and redoes snapshots in order", () => {
    let history = emptyHistory<string>();
    history = recordHistory(history, "one");
    history = recordHistory(history, "two");

    const undone = undoHistory(history, "three");
    expect(undone?.value).toBe("two");
    if (!undone) return;

    const undoneAgain = undoHistory(undone.history, undone.value);
    expect(undoneAgain?.value).toBe("one");
    if (!undoneAgain) return;

    const redone = redoHistory(undoneAgain.history, undoneAgain.value);
    expect(redone?.value).toBe("two");
  });

  it("clears redo entries when a new change is recorded", () => {
    let history = recordHistory(emptyHistory<string>(), "one");
    const undone = undoHistory(history, "two");
    expect(undone?.history.future).toEqual(["two"]);
    if (!undone) return;

    history = recordHistory(undone.history, "new branch");

    expect(history.future).toEqual([]);
    expect(undoHistory(history, "unused")?.value).toBe("new branch");
  });

  it("drops the oldest snapshots beyond the limit", () => {
    let history = emptyHistory<string>();
    for (const value of ["one", "two", "three"]) {
      history = recordHistory(history, value, 2);
    }

    expect(history.past).toEqual(["two", "three"]);
  });

  it("returns null when there is nothing to undo or redo", () => {
    const history = emptyHistory<string>();

    expect(undoHistory(history, "current")).toBeNull();
    expect(redoHistory(history, "current")).toBeNull();
  });
});
