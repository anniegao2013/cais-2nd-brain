export const TAGS = [
  { id: "projects", label: "Projects" },
  { id: "curriculum", label: "Curriculum" },
  { id: "recruitment", label: "Recruitment" },
  { id: "social", label: "Social events" },
  { id: "gm", label: "GM" },
] as const;

export type TagId = (typeof TAGS)[number]["id"];

const TAG_IDS = new Set<string>(TAGS.map((tag) => tag.id));

export function isTagId(value: unknown): value is TagId {
  return typeof value === "string" && TAG_IDS.has(value);
}

export function tagLabel(tagId: string): string {
  return TAGS.find((tag) => tag.id === tagId)?.label ?? tagId;
}

export function matchesTagFilter(
  taskTags: TagId[] | undefined,
  activeTags: TagId[],
): boolean {
  if (activeTags.length === 0) return true;
  return (taskTags ?? []).some((tag) => activeTags.includes(tag));
}
