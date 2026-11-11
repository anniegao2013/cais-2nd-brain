import { SPRING_WEEK_COUNT, WEEK_COUNT } from "./calendar";

export type Category = { id: string; label: string };

export type TimelineTabId = "before" | "fall" | "spring";

export type TimelineTab = {
  id: TimelineTabId;
  label: string;
  categoryIds: string[];
};

const BEFORE_CATEGORIES: Category[] = [
  { id: "spring", label: "Before end of spring semester" },
  { id: "summer", label: "Summer" },
];

const FALL_CATEGORIES: Category[] = Array.from(
  { length: WEEK_COUNT },
  (_, index) => ({
    id: `week-${index + 1}`,
    label: `Week ${index + 1}`,
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
];

const CATEGORY_BY_ID = new Map(
  CATEGORIES.map((category) => [category.id, category]),
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
  if (categoryId === "spring" || categoryId === "summer") return "before";
  if (categoryId.startsWith("week-")) return "fall";
  if (categoryId.startsWith("spring-week-")) return "spring";
  return "fall";
}

export function categoryIndex(categoryId: string): number {
  return CATEGORIES.findIndex((category) => category.id === categoryId);
}

export function sectionLabel(categoryId: string): string {
  return (
    CATEGORIES.find((category) => category.id === categoryId)?.label ??
    categoryId
  );
}
