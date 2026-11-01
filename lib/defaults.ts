import { sortState } from "./dependencies";
import type { TagId } from "./tags";
import type { AppState, Dependency, TasksByCategory } from "./types";

type DefaultEvent = {
  id: string;
  text: string;
  category: string;
  tags?: TagId[];
  parentId?: string;
  leadWeeks?: number;
};

// Seeded tasks. Keep each id stable: stored moves and deletions reference it.
export const DEFAULT_EVENTS: DefaultEvent[] = [
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

export const DEFAULT_DEPENDENCIES: Dependency[] = [
  ...RECRUITMENT_CHAIN.slice(1).map((id, index) => ({
    before: RECRUITMENT_CHAIN[index],
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
        tags: event.tags,
        parentId: event.parentId,
        leadWeeks: event.leadWeeks,
      },
    ];
  }
  return sortState({
    tasks,
    removedDefaults: [],
    dependencies: DEFAULT_DEPENDENCIES,
  });
}

export const DEFAULT_STATE: AppState = buildDefaultState();
