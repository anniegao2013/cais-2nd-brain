import { describe, expect, it } from "vitest";
import { categoryIndex } from "../lib/categories";
import {
  ANNOUNCE_TEXT,
  START_PLANNING_TEXT,
  SOCIAL_POLL_LEAD_WEEKS,
  SOCIAL_POLL_TEXT,
  announceId,
  socialPollId,
  startPlanningId,
  syncInterestFollowUps,
  syncSocialPollSubtasks,
  togglePollInterest,
} from "../lib/social-polls";
import { findTask } from "../lib/tasks";
import { makeState, makeTask } from "./helpers";

describe("syncSocialPollSubtasks", () => {
  it("adds a poll four sections before a social event", () => {
    const state = makeState({
      "week-5": [makeTask("welcome", { tags: ["social"] })],
      "week-7": [makeTask("fall-break", { tags: ["social"] })],
    });

    const next = syncSocialPollSubtasks(state);

    expect(findTask(next, socialPollId("welcome"))).toMatchObject({
      categoryId: "week-1",
      task: {
        text: SOCIAL_POLL_TEXT,
        parentId: "welcome",
        leadWeeks: SOCIAL_POLL_LEAD_WEEKS,
      },
    });
    expect(findTask(next, socialPollId("fall-break"))?.categoryId).toBe("week-3");
  });

  it("leaves tasks without the social tag alone", () => {
    const state = makeState({
      "week-8": [makeTask("retreat")],
      "week-3": [makeTask("interviews", { tags: ["recruitment"] })],
    });

    const next = syncSocialPollSubtasks(state);

    expect(Object.values(next.tasks).flat()).toHaveLength(2);
    expect(next).toBe(state);
  });

  it("excludes Retreat and the big little reveal even when tagged social", () => {
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
    });

    const next = syncSocialPollSubtasks(state);

    expect(findTask(next, socialPollId("default-12"))).toBeNull();
    expect(findTask(next, socialPollId("default-18"))).toBeNull();
  });

  it("is idempotent", () => {
    const once = syncSocialPollSubtasks(
      makeState({ "week-5": [makeTask("welcome", { tags: ["social"] })] }),
    );
    const twice = syncSocialPollSubtasks(once);

    expect(Object.values(twice.tasks).flat()).toHaveLength(2);
    expect(twice).toBe(once);
  });

  it("does not recreate a poll that was deleted", () => {
    const state = makeState(
      { "week-5": [makeTask("welcome", { tags: ["social"] })] },
      { removedDefaults: [socialPollId("welcome")] },
    );

    expect(findTask(syncSocialPollSubtasks(state), socialPollId("welcome"))).toBeNull();
  });

  it("clamps the lead time near the start of the timeline", () => {
    const state = makeState({
      "week-2": [makeTask("welcome", { tags: ["social"] })],
    });

    const poll = findTask(
      syncSocialPollSubtasks(state),
      socialPollId("welcome"),
    );

    expect(poll?.categoryId).toBe("spring");
    expect(poll?.task.leadWeeks).toBe(categoryIndex("week-2"));
  });

  it("does not add polls to subtasks that carry the social tag", () => {
    const state = makeState({
      "week-5": [
        makeTask("parent"),
        makeTask("child", { tags: ["social"], parentId: "parent" }),
      ],
    });

    const next = syncSocialPollSubtasks(state);

    expect(findTask(next, socialPollId("child"))).toBeNull();
    expect(Object.values(next.tasks).flat()).toHaveLength(2);
  });
});

function socialEventState(removedDefaults: string[] = []) {
  return syncSocialPollSubtasks(
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

  it("adds planning three weeks ahead and an announcement two weeks ahead", () => {
    const next = togglePollInterest(
      socialEventState(),
      socialPollId("welcome"),
    )!;

    expect(findTask(next, startPlanningId("welcome"))).toMatchObject({
      categoryId: "week-2",
      task: {
        text: START_PLANNING_TEXT,
        parentId: "welcome",
        leadWeeks: 3,
      },
    });
    expect(findTask(next, announceId("welcome"))).toMatchObject({
      categoryId: "week-3",
      task: {
        text: ANNOUNCE_TEXT,
        parentId: "welcome",
        leadWeeks: 2,
      },
    });
  });

  it("clears the flag and removes both follow-ups when interest is removed", () => {
    const on = togglePollInterest(socialEventState(), socialPollId("welcome"))!;
    const off = togglePollInterest(on, socialPollId("welcome"))!;

    expect(
      findTask(off, socialPollId("welcome"))?.task.interested,
    ).toBeUndefined();
    expect(findTask(off, startPlanningId("welcome"))).toBeNull();
    expect(findTask(off, announceId("welcome"))).toBeNull();
  });

  it("does not recreate follow-ups that were deleted", () => {
    const state = socialEventState([startPlanningId("welcome")]);

    const next = togglePollInterest(state, socialPollId("welcome"))!;

    expect(findTask(next, startPlanningId("welcome"))).toBeNull();
    expect(findTask(next, announceId("welcome"))).not.toBeNull();
  });

  it("does not duplicate follow-ups when synced again", () => {
    const on = togglePollInterest(socialEventState(), socialPollId("welcome"))!;
    const again = syncInterestFollowUps(on);

    expect(again).toBe(on);
    expect(
      Object.values(again.tasks)
        .flat()
        .filter(
          (task) =>
            task.id === startPlanningId("welcome") ||
            task.id === announceId("welcome"),
        ),
    ).toHaveLength(2);
  });

  it("clamps early follow-ups to the start of the timeline", () => {
    const state = syncSocialPollSubtasks(
      makeState({
        "week-1": [
          makeTask("early", { text: "Early social", tags: ["social"] }),
        ],
      }),
    );

    const next = togglePollInterest(state, socialPollId("early"))!;

    expect(findTask(next, startPlanningId("early"))).toMatchObject({
      categoryId: "spring",
      task: { leadWeeks: categoryIndex("week-1") },
    });
    expect(findTask(next, announceId("early"))?.categoryId).toBe("spring");
  });

  it("ignores tasks that are not interest polls", () => {
    expect(togglePollInterest(socialEventState(), "welcome")).toBeNull();
    expect(togglePollInterest(socialEventState(), "missing")).toBeNull();
  });
});
