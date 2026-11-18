import { categoryIndex, sectionLabel } from "./categories";
import { parseNoteLines } from "./notes";
import { tagLabel } from "./tags";
import type { AppState, Task } from "./types";

export type SearchResult = {
  task: Task;
  categoryId: string;
  sectionLabel: string;
  // A short piece of the description when the title itself did not match.
  snippet: string | null;
  score: number;
};

export const SEARCH_RESULT_LIMIT = 50;

function notesText(task: Task): string {
  if (!task.notes) return "";
  return parseNoteLines(task.notes)
    .map((line) => line.text)
    .join(" ");
}

function normalize(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function snippetFor(text: string, query: string): string | null {
  const index = text.toLowerCase().indexOf(query);
  if (index === -1) return null;

  const start = Math.max(0, index - 28);
  const end = Math.min(text.length, index + query.length + 48);
  const prefix = start > 0 ? "…" : "";
  const suffix = end < text.length ? "…" : "";
  return `${prefix}${text.slice(start, end).trim()}${suffix}`;
}

function scoreTask(task: Task, categoryId: string, query: string): number {
  const title = task.text.toLowerCase();
  const notes = notesText(task).toLowerCase();
  const tags = (task.tags ?? []).map((tag) => tagLabel(tag).toLowerCase());
  const section = sectionLabel(categoryId).toLowerCase();

  let score = 0;
  if (title === query) score += 100;
  else if (title.startsWith(query)) score += 60;
  else if (title.includes(query)) score += 40;

  if (tags.some((tag) => tag.includes(query))) score += 20;
  if (notes.includes(query)) score += 10;
  if (section.includes(query)) score += 5;

  return score;
}

function groupOrder(categoryId: string): number {
  const category = categoryIndex(categoryId);
  if (category >= 0) return category;
  // Backlog and to-dos follow the calendar weeks.
  return categoryId === "gm-ideas" ? 10_000 : 10_001;
}

// Searches titles, descriptions, tags, and section names. Results stay in
// section order so a global search still reads like the board.
export function searchBoard(
  state: AppState,
  rawQuery: string,
  limit: number = SEARCH_RESULT_LIMIT,
): SearchResult[] {
  const query = normalize(rawQuery);
  if (query.length === 0) return [];

  const results: SearchResult[] = [];
  const seen = new Set<string>();

  for (const [categoryId, tasks] of Object.entries(state.tasks)) {
    for (const task of tasks) {
      if (seen.has(task.id)) continue;
      const score = scoreTask(task, categoryId, query);
      if (score === 0) continue;
      seen.add(task.id);

      const notes = notesText(task);
      results.push({
        task,
        categoryId,
        sectionLabel: sectionLabel(categoryId),
        snippet: task.text.toLowerCase().includes(query)
          ? null
          : snippetFor(notes, query),
        score,
      });
    }
  }

  return results
    .sort((a, b) => {
      const group = groupOrder(a.categoryId) - groupOrder(b.categoryId);
      if (group !== 0) return group;
      if (b.score !== a.score) return b.score - a.score;
      return a.task.text.localeCompare(b.task.text);
    })
    .slice(0, limit);
}
