import { describe, expect, it } from "vitest";
import {
  ANNOUNCE_LEAD_WEEKS,
  ANNOUNCE_TEXT,
  SOCIAL_FOLLOW_UPS,
  SOCIAL_POLL_LEAD_WEEKS,
  SOCIAL_POLL_TEXT,
  START_PLANNING_LEAD_WEEKS,
  START_PLANNING_TEXT,
  announceId,
  socialPollId,
  startPlanningId,
  syncSocialFollowUps,
  togglePollInterest,
} from "../lib/social-polls";
import { findTask } from "../lib/tasks";
import { makeState, makeTask } from "./helpers";

describe("syncSocialFollowUps", () => {
  it("adds a poll, planning step, and announcement before a social event", () => {
    const state = makeState({
      "week-5": [makeTask("welcome", { tags: ["social"] })],
      "week-7": [makeTask("fall-break", { tags: ["social"] })],
    });

    const next = syncSocialFollowUps(state);

    expect(findTask(next, socialPollId("welcome"))).toMatchObject({
      categoryId: "week-1",
      task: {
        text: SOCIAL_POLL_TEXT,
        parentId: "welcome",
        leadWeeks: SOCIAL_POLL_LEAD_WEEKS,
      },
    });
    expect(findTask(next, startPlanningId("welcome"))).toMatchObject({
      categoryId: "week-2",
      task: {
        text: START_PLANNING_TEXT,
        parentId: "welcome",
        leadWeeks: START_PLANNING_LEAD_WEEKS,
      },
    });
    expect(findTask(next, announceId("welcome"))).toMatchObject({
      categoryId: "week-3",
      task: {
        text: ANNOUNCE_TEXT,
        parentId: "welcome",
        leadWeeks: ANNOUNCE_LEAD_WEEKS,
      },
    });
    expect(findTask(next, socialPollId("fall-break"))?.categoryId).toBe("week-3");
  });

  it("leaves tasks without the social tag alone", () => {
    const state = makeState({
      "week-8": [makeTask("retreat")],
      "week-3": [makeTask("interviews", { tags: ["recruitment"] })],
    });

    const next = syncSocialFollowUps(state);

    expect(Object.values(next.tasks).flat()).toHaveLength(2);
    expect(next).toBe(state);
  });

  it("excludes Retreat, the big little reveal, Spring Retreat, and E-ball even when tagged social", () => {
    const state = makeState({
      "week-8": [
        makeTask("default-12", { text: "Retreat", tags: ["social"] }),
      ],
      "week-10": [
        makeTask("default-18", {
          text: "Big little reveal",
          tags: ["social"],
        }),
      ],
      "spring-week-8": [
        makeTask("default-32", { text: "Retreat", tags: ["social"] }),
      ],
      "spring-week-6": [
        makeTask("default-36", { text: "E-ball", tags: ["social"] }),
      ],
    });

    const next = syncSocialFollowUps(state);

    for (const parentId of [
      "default-12",
      "default-18",
      "default-32",
      "default-36",
    ]) {
      for (const followUp of SOCIAL_FOLLOW_UPS) {
        expect(findTask(next, followUp.id(parentId))).toBeNull();
      }
    }
  });

  it("prunes follow-ups and dependency edges generated before an exclusion", () => {
    const parentId = "default-36";
    const state = makeState(
      {
        "spring-week-2": [
          makeTask(socialPollId(parentId), {
            text: SOCIAL_POLL_TEXT,
            parentId,
          }),
        ],
        "spring-week-3": [
          makeTask(startPlanningId(parentId), {
            text: START_PLANNING_TEXT,
            parentId,
          }),
        ],
        "spring-week-4": [
          makeTask(announceId(parentId), {
            text: ANNOUNCE_TEXT,
            parentId,
          }),
        ],
        "spring-week-6": [
          makeTask(parentId, { text: "E-ball", tags: ["social"] }),
        ],
      },
      {
        dependencies: [
          { before: socialPollId(parentId), after: parentId },
          { before: parentId, after: announceId(parentId) },
          { before: "keep", after: "keep" },
        ],
      },
    );

    const next = syncSocialFollowUps(state);

    for (const followUp of SOCIAL_FOLLOW_UPS) {
      expect(findTask(next, followUp.id(parentId))).toBeNull();
    }
    expect(next.dependencies).toEqual([]);
  });

  it("is idempotent", () => {
    const once = syncSocialFollowUps(
      makeState({ "week-5": [makeTask("welcome", { tags: ["social"] })] }),
    );
    const twice = syncSocialFollowUps(once);

    expect(Object.values(twice.tasks).flat()).toHaveLength(
      1 + SOCIAL_FOLLOW_UPS.length,
    );
    expect(twice).toBe(once);
  });

  it("does not recreate a follow-up that was deleted", () => {
    const state = makeState(
      { "week-5": [makeTask("welcome", { tags: ["social"] })] },
      { removedDefaults: [startPlanningId("welcome")] },
    );

    const next = syncSocialFollowUps(state);

    expect(findTask(next, startPlanningId("welcome"))).toBeNull();
    expect(findTask(next, socialPollId("welcome"))).not.toBeNull();
    expect(findTask(next, announceId("welcome"))).not.toBeNull();
  });

  it("clamps a fall event's follow-ups to the start of the timeline", () => {
    const state = makeState({
      "week-2": [makeTask("welcome", { tags: ["social"] })],
    });

    const next = syncSocialFollowUps(state);

    expect(findTask(next, socialPollId("welcome"))).toMatchObject({
      categoryId: "spring",
      task: { leadWeeks: 3 },
    });
    expect(findTask(next, startPlanningId("welcome"))).toMatchObject({
      categoryId: "spring",
      task: { leadWeeks: 3 },
    });
    expect(findTask(next, announceId("welcome"))).toMatchObject({
      categoryId: "summer",
      task: { leadWeeks: 2 },
    });
  });

  it("keeps a spring event's follow-ups inside the spring semester", () => {
    const state = makeState({
      "spring-week-2": [makeTask("early", { tags: ["social"] })],
      "spring-week-6": [makeTask("later", { tags: ["social"] })],
    });

    const next = syncSocialFollowUps(state);

    for (const followUp of SOCIAL_FOLLOW_UPS) {
      expect(findTask(next, followUp.id("early"))).toMatchObject({
        categoryId: "spring-week-1",
        task: { leadWeeks: 1 },
      });
    }

    expect(findTask(next, socialPollId("later"))?.categoryId).toBe(
      "spring-week-2",
    );
    expect(findTask(next, startPlanningId("later"))?.categoryId).toBe(
      "spring-week-3",
    );
    expect(findTask(next, announceId("later"))?.categoryId).toBe(
      "spring-week-4",
    );
  });

  it("does not add follow-ups to subtasks that carry the social tag", () => {
    const state = makeState({
      "week-5": [
        makeTask("parent"),
        makeTask("child", { tags: ["social"], parentId: "parent" }),
      ],
    });

    const next = syncSocialFollowUps(state);

    for (const followUp of SOCIAL_FOLLOW_UPS) {
      expect(findTask(next, followUp.id("child"))).toBeNull();
    }
    expect(Object.values(next.tasks).flat()).toHaveLength(2);
  });
});

function socialEventState(removedDefaults: string[] = []) {
  return syncSocialFollowUps(
    makeState(
      {
        "week-5": [
          makeTask("welcome", { text: "Welcome new members", tags: ["social"] }),
        ],
      },
      { removedDefaults },
    ),
  );
}

describe("togglePollInterest", () => {
  it("marks the poll as interested", () => {
    const state = socialEventState();

    const next = togglePollInterest(state, socialPollId("welcome"));

    expect(findTask(next!, socialPollId("welcome"))?.task.interested).toBe(true);
  });

  it("leaves the planning and announcement tasks in place", () => {
    const next = togglePollInterest(
      socialEventState(),
      socialPollId("welcome"),
    )!;

    expect(findTask(next, startPlanningId("welcome"))?.task.text).toBe(
      START_PLANNING_TEXT,
    );
    expect(findTask(next, announceId("welcome"))?.task.text).toBe(
      ANNOUNCE_TEXT,
    );
  });

  it("keeps every follow-up when interest is removed", () => {
    const on = togglePollInterest(socialEventState(), socialPollId("welcome"))!;
    const off = togglePollInterest(on, socialPollId("welcome"))!;

    expect(
      findTask(off, socialPollId("welcome"))?.task.interested,
    ).toBeUndefined();
    for (const followUp of SOCIAL_FOLLOW_UPS) {
      expect(findTask(off, followUp.id("welcome"))).not.toBeNull();
    }
  });

  it("does not recreate follow-ups that were deleted", () => {
    const state = socialEventState([startPlanningId("welcome")]);

    const next = togglePollInterest(state, socialPollId("welcome"))!;

    expect(findTask(next, startPlanningId("welcome"))).toBeNull();
    expect(findTask(next, announceId("welcome"))).not.toBeNull();
  });

  it("ignores tasks that are not interest polls", () => {
    expect(togglePollInterest(socialEventState(), "welcome")).toBeNull();
    expect(togglePollInterest(socialEventState(), "missing")).toBeNull();
  });
});
