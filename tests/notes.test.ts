import { describe, expect, it } from "vitest";
import {
  cleanNotes,
  notesToTree,
  parseNoteLines,
  type NoteNode,
} from "../lib/notes";

function flatten(nodes: NoteNode[], depth = 0): Array<[number, string]> {
  return nodes.flatMap((node) => [
    [depth, node.text] as [number, string],
    ...flatten(node.children, depth + 1),
  ]);
}

describe("parseNoteLines", () => {
  it("reads bullet levels from indentation", () => {
    const lines = parseNoteLines(
      "- Top\n  - Child\n    - Grandchild\n- Second",
    );

    expect(lines).toEqual([
      { level: 0, text: "Top" },
      { level: 1, text: "Child" },
      { level: 2, text: "Grandchild" },
      { level: 0, text: "Second" },
    ]);
  });

  it("treats tabs as two spaces and makes bullets optional", () => {
    expect(parseNoteLines("Top\n\tChild")).toEqual([
      { level: 0, text: "Top" },
      { level: 1, text: "Child" },
    ]);
    expect(parseNoteLines("* Starred\n• Bulleted")).toEqual([
      { level: 0, text: "Starred" },
      { level: 0, text: "Bulleted" },
    ]);
  });

  it("skips blank lines and never jumps more than one level", () => {
    expect(parseNoteLines("Top\n\n      Deep")).toEqual([
      { level: 0, text: "Top" },
      { level: 1, text: "Deep" },
    ]);
  });
});

describe("notesToTree", () => {
  it("nests children under the nearest shallower line", () => {
    const tree = notesToTree(parseNoteLines("Top\n  Child\n    Grandchild\nSecond"));

    expect(flatten(tree)).toEqual([
      [0, "Top"],
      [1, "Child"],
      [2, "Grandchild"],
      [0, "Second"],
    ]);
  });

  it("returns no roots for empty input", () => {
    expect(notesToTree([])).toEqual([]);
  });
});

describe("cleanNotes", () => {
  it("normalizes markers and indentation to two spaces per level", () => {
    expect(cleanNotes("* Top\n    * Child")).toBe("Top\n  Child");
  });

  it("returns an empty string when there is no text", () => {
    expect(cleanNotes("\n  \n")).toBe("");
  });
});
