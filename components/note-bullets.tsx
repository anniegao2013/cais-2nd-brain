import type { NoteNode } from "@/lib/notes";

export function NoteBullets({ nodes }: { nodes: NoteNode[] }) {
  return (
    <ul className="flex list-disc flex-col gap-1 pl-4 marker:text-zinc-400 dark:marker:text-zinc-600">
      {nodes.map((node, index) => (
        <li key={index}>
          {node.text}
          {node.children.length > 0 && <NoteBullets nodes={node.children} />}
        </li>
      ))}
    </ul>
  );
}
