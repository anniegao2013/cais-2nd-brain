import { describe, expect, it } from "vitest";
import { isTagId, matchesTagFilter, tagLabel } from "../lib/tags";

describe("tag helpers", () => {
  it("recognizes known tag ids only", () => {
    expect(isTagId("recruitment")).toBe(true);
    expect(isTagId("unknown")).toBe(false);
    expect(isTagId(undefined)).toBe(false);
  });

  it("falls back to the raw id for an unknown label", () => {
    expect(tagLabel("recruitment")).toBe("Recruitment");
    expect(tagLabel("legacy")).toBe("legacy");
  });

  it("matches any selected tag, not every tag", () => {
    expect(matchesTagFilter(["projects"], ["projects", "recruitment"])).toBe(
      true,
    );
    expect(matchesTagFilter(["gm"], ["projects", "recruitment"])).toBe(false);
    expect(matchesTagFilter(undefined, ["projects"])).toBe(false);
  });

  it("keeps every task when no filter is active", () => {
    expect(matchesTagFilter(undefined, [])).toBe(true);
    expect(matchesTagFilter(["gm"], [])).toBe(true);
  });
});
