export type NoteLine = { level: number; text: string };
export type NoteNode = { text: string; children: NoteNode[] };

// Notes are stored one bullet per line. Leading whitespace sets the nesting
// level (a tab or two spaces per level); bullet markers are optional.
export function parseNoteLines(raw: string): NoteLine[] {
  const lines: NoteLine[] = [];

  for (const rawLine of raw.split("\n")) {
    const indent = rawLine.match(/^[\t ]*/)?.[0] ?? "";
    const text = rawLine
      .slice(indent.length)
      .replace(/^[-*•]\s*/, "")
      .trim();
    if (!text) continue;

    const spaces = indent.replace(/\t/g, "  ").length;
    const level = Math.min(
      Math.ceil(spaces / 2),
      lines.length === 0 ? 0 : lines[lines.length - 1].level + 1,
    );
    lines.push({ level, text });
  }

  return lines;
}

export function notesToTree(lines: NoteLine[]): NoteNode[] {
  const roots: NoteNode[] = [];
  const stack: NoteNode[] = [];

  for (const line of lines) {
    const node: NoteNode = { text: line.text, children: [] };
    if (line.level === 0 || stack.length === 0) {
      roots.push(node);
    } else {
      stack[Math.min(line.level, stack.length) - 1].children.push(node);
    }
    stack[line.level] = node;
    stack.length = line.level + 1;
  }

  return roots;
}

export function cleanNotes(raw: string): string {
  return parseNoteLines(raw)
    .map((line) => `${"  ".repeat(line.level)}${line.text}`)
    .join("\n");
}
