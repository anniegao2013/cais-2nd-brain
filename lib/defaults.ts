import { SPRING_SEMESTER, categoryIdForDate } from "./calendar";
import { sortState } from "./dependencies";
import { syncSocialFollowUps } from "./social-polls";
import type { TagId } from "./tags";
import type { AppState, Dependency, TasksByCategory } from "./types";
import { USC_TIMELINE_HOLIDAYS } from "./usc-holidays";

type DefaultEvent = {
  id: string;
  text: string;
  category: string;
  endCategoryId?: string;
  tags?: TagId[];
  parentId?: string;
  leadWeeks?: number;
  suggested?: boolean;
  isHoliday?: boolean;
};

// Places a suggestion in the week that contains its real holiday date.
function weekForDate(iso: string): string {
  const categoryId = categoryIdForDate(iso);
  if (!categoryId) {
    throw new Error(`No semester week contains ${iso}.`);
  }
  return categoryId;
}

// Seeded tasks. Keep each id stable: stored moves and deletions reference it.
const BASE_DEFAULT_EVENTS: DefaultEvent[] = [
  { id: "default-1", text: "Handoffs", category: "spring" },
  { id: "default-2", text: "Introductions", category: "spring" },
  { id: "default-3", text: "First e-board meeting", category: "spring" },
  { id: "default-4", text: "Confirm leads", category: "spring" },
  { id: "default-5", text: "Fall project sourcing", category: "summer" },
  { id: "default-6", text: "Curriculum edits", category: "summer" },
  {
    id: "default-7",
    text: "Recruitment prep",
    category: "summer",
    tags: ["recruitment"],
  },
  { id: "default-8", text: "Sponsorship outreach", category: "summer" },
  { id: "default-9", text: "RSO re-recognition", category: "summer" },
  {
    id: "default-10",
    text: "Open written apps",
    category: "week-1",
    tags: ["recruitment"],
  },
  {
    id: "default-11",
    text: "Classification",
    category: "week-4",
    tags: ["recruitment"],
  },
  { id: "default-12", text: "Retreat", category: "week-8" },
  { id: "default-13", text: "Midsem ShowCAIS", category: "week-11" },
  { id: "default-14", text: "OpenShowCAIS", category: "week-15" },
  {
    id: "default-15",
    text: "Written delibs",
    category: "week-3",
    tags: ["recruitment"],
  },
  {
    id: "default-16",
    text: "Group interviews",
    category: "week-3",
    tags: ["recruitment"],
  },
  {
    id: "default-17",
    text: "Individual interviews",
    category: "week-4",
    tags: ["recruitment"],
  },
  { id: "default-18", text: "Big little reveal", category: "week-10" },
  { id: "default-19", text: "Spring project sourcing", category: "week-7" },
  // Retreat is in week 8, so this lands four weeks earlier in week 4. It must
  // stay at least four sections earlier and shifts along with Retreat.
  {
    id: "default-20",
    text: "Submit gift fund request for Airbnb",
    category: "week-4",
    parentId: "default-12",
    leadWeeks: 4,
  },
  {
    id: "default-21",
    text: "Book a room for classification",
    category: "week-2",
    parentId: "default-11",
  },
  // Social event ideas. These are suggestions: move, rename, or delete them.
  {
    id: "default-22",
    text: "Welcome new members",
    category: "week-5",
    tags: ["social"],
    suggested: true,
  },
  {
    id: "default-23",
    text: "Fall break",
    category: "week-7",
    tags: ["social"],
    suggested: true,
  },
  {
    id: "default-24",
    text: "Halloween",
    category: "week-10",
    tags: ["social"],
    suggested: true,
  },
  {
    id: "default-25",
    text: "Thanksgiving",
    category: "week-14",
    tags: ["social"],
    suggested: true,
  },
  {
    id: "default-26",
    text: "Christmas / end of semester",
    category: "week-15",
    tags: ["social"],
    suggested: true,
  },
  // Spring social ideas, placed in the weeks that contain their real dates.
  {
    id: "default-27",
    text: "Valentine's Day",
    category: weekForDate("2027-02-14"),
    tags: ["social"],
    suggested: true,
  },
  {
    id: "default-28",
    text: "Easter",
    category: weekForDate("2027-03-28"),
    tags: ["social"],
    suggested: true,
  },
  {
    id: "default-29",
    text: "End of the year",
    category: weekForDate(SPRING_SEMESTER.classesEndISO),
    tags: ["social"],
    suggested: true,
  },
  // Spring semester events mirror the fall cadence.
  {
    id: "default-30",
    text: "Start collecting dues",
    category: "spring-week-1",
    endCategoryId: "spring-week-2",
    tags: ["gm"],
  },
  {
    id: "default-31",
    text: "Project reveal",
    category: "spring-week-2",
    endCategoryId: "spring-week-3",
    tags: ["gm"],
  },
  { id: "default-32", text: "Retreat", category: "spring-week-8", tags: ["social"] },
  // Spring Retreat is in week 8, so the Airbnb request stays four weeks ahead
  // in week 4 and shifts along with it.
  {
    id: "default-33",
    text: "Submit gift fund request for Airbnb",
    category: "spring-week-4",
    parentId: "default-32",
    leadWeeks: 4,
  },
  { id: "default-34", text: "OpenShowCAIS", category: "spring-week-16" },
  {
    id: "default-35",
    text: "Book a room for OpenShowCAIS",
    category: "spring-week-7",
    parentId: "default-34",
  },
  {
    id: "default-36",
    text: "E-ball",
    category: "spring-week-6",
    tags: ["social"],
  },
  {
    id: "default-37",
    text: "Update website with fall projects",
    category: "spring-week-1",
  },
  // Spring e-board transition series. The chain runs from grooming future
  // members through election results.
  {
    id: "default-38",
    text: "Grooming future eboard",
    category: "spring-week-1",
    endCategoryId: "spring-week-2",
  },
  {
    id: "default-39",
    text: "Eboard role descriptions",
    category: "spring-week-8",
    tags: ["gm"],
  },
  {
    id: "default-40",
    text: "Town hall",
    category: "spring-week-12",
    tags: ["gm"],
  },
  {
    id: "default-41",
    text: "Election results",
    category: "spring-week-13",
    tags: ["gm"],
  },
];

// USC holidays and recesses are scraped from the academic calendar. Only the
// ones that overlap the instructional weeks make it onto this board.
const USC_HOLIDAY_EVENTS: DefaultEvent[] = USC_TIMELINE_HOLIDAYS.map(
  (holiday) => ({
    id: holiday.id,
    text: holiday.label,
    category: holiday.categoryId,
    isHoliday: true,
  }),
);

export const DEFAULT_EVENTS: DefaultEvent[] = [
  ...BASE_DEFAULT_EVENTS,
  ...USC_HOLIDAY_EVENTS,
];

// Recruitment tasks start out ordered. These edges (and any others) can be
// removed or added from the task editor and are stored with the state.
const RECRUITMENT_CHAIN = [
  "default-7",
  "default-10",
  "default-15",
  "default-16",
  "default-17",
  "default-11",
];

// The spring e-board transition runs in this order.
const SPRING_EBOARD_CHAIN = [
  "default-38",
  "default-39",
  "default-40",
  "default-41",
];

export const DEFAULT_DEPENDENCIES: Dependency[] = [
  ...RECRUITMENT_CHAIN.slice(1).map((id, index) => ({
    before: RECRUITMENT_CHAIN[index],
    after: id,
  })),
  ...SPRING_EBOARD_CHAIN.slice(1).map((id, index) => ({
    before: SPRING_EBOARD_CHAIN[index],
    after: id,
  })),
  // Big little reveal happens after Retreat.
  { before: "default-12", after: "default-18" },
];

export const DEFAULT_BY_ID = new Map(
  DEFAULT_EVENTS.map((event) => [event.id, event]),
);

function buildDefaultState(): AppState {
  const tasks: TasksByCategory = {};
  for (const event of DEFAULT_EVENTS) {
    tasks[event.category] = [
      ...(tasks[event.category] ?? []),
      {
        id: event.id,
        text: event.text,
        done: false,
        isDefault: true,
        endCategoryId: event.endCategoryId,
        isHoliday: event.isHoliday,
        tags: event.tags,
        parentId: event.parentId,
        leadWeeks: event.leadWeeks,
        suggested: event.suggested,
      },
    ];
  }
  return syncSocialFollowUps(
    sortState({
      tasks,
      removedDefaults: [],
      dependencies: DEFAULT_DEPENDENCIES,
    }),
  );
}

export const DEFAULT_STATE: AppState = buildDefaultState();
