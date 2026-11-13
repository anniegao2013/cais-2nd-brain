import { SPRING_WEEK_COUNT, WEEK_COUNT } from "./calendar";

export type Category = { id: string; label: string };

export type TimelineTabId = "before" | "fall" | "spring" | "gm-ideas";

export type TimelineTab = {
  id: TimelineTabId;
  label: string;
  categoryIds: string[];
};

// A backlog rather than a point on the calendar. Ideas live here until they
// are assigned to a specific GM event.
export const GM_IDEAS_CATEGORY_ID = "gm-ideas";
export const GM_IDEAS_CATEGORY: Category = {
  id: GM_IDEAS_CATEGORY_ID,
  label: "GM ideas",
};

export function isGmIdeasCategory(categoryId: string): boolean {
  return categoryId === GM_IDEAS_CATEGORY_ID;
}

const BEFORE_CATEGORIES: Category[] = [
  { id: "spring", label: "Before end of spring semester" },
  { id: "summer", label: "Summer" },
];

const FALL_CATEGORIES: Category[] = Array.from(
  { length: WEEK_COUNT },
  (_, index) => ({
    id: `week-${index + 1}`,
    label: `Fall Week ${index + 1}`,
  }),
);

const SPRING_CATEGORIES: Category[] = Array.from(
  { length: SPRING_WEEK_COUNT },
  (_, index) => ({
    id: `spring-week-${index + 1}`,
    label: `Spring Week ${index + 1}`,
  }),
);

export const CATEGORIES: Category[] = [
  ...BEFORE_CATEGORIES,
  ...FALL_CATEGORIES,
  ...SPRING_CATEGORIES,
];

export const TIMELINE_TABS: TimelineTab[] = [
  {
    id: "before",
    label: "Before the year",
    categoryIds: BEFORE_CATEGORIES.map((category) => category.id),
  },
  {
    id: "fall",
    label: "Fall semester",
    categoryIds: FALL_CATEGORIES.map((category) => category.id),
  },
  {
    id: "spring",
    label: "Spring semester",
    categoryIds: SPRING_CATEGORIES.map((category) => category.id),
  },
  {
    id: "gm-ideas",
    label: GM_IDEAS_CATEGORY.label,
    categoryIds: [GM_IDEAS_CATEGORY_ID],
  },
];

const CATEGORY_BY_ID = new Map(
  [...CATEGORIES, GM_IDEAS_CATEGORY].map((category) => [
    category.id,
    category,
  ]),
);

export function categoriesForTab(tabId: TimelineTabId): Category[] {
  const tab = TIMELINE_TABS.find((candidate) => candidate.id === tabId);
  if (!tab) return [];
  return tab.categoryIds.flatMap((categoryId) => {
    const category = CATEGORY_BY_ID.get(categoryId);
    return category ? [category] : [];
  });
}

export function tabForCategoryId(categoryId: string): TimelineTabId {
  if (isGmIdeasCategory(categoryId)) return "gm-ideas";
  if (categoryId === "spring" || categoryId === "summer") return "before";
  if (categoryId.startsWith("week-")) return "fall";
  if (categoryId.startsWith("spring-week-")) return "spring";
  return "fall";
}

export function categoryIndex(categoryId: string): number {
  return CATEGORIES.findIndex((category) => category.id === categoryId);
}

export function sectionLabel(categoryId: string): string {
  return CATEGORY_BY_ID.get(categoryId)?.label ?? categoryId;
}
