import type { AppState, Dependency, Task, TasksByCategory } from "./types";

type Graph = {
  // PRECEDES: id -> tasks that must come after it.
  precedes: Map<string, string[]>;
  // FOLLOWS: id -> tasks that must come before it.
  follows: Map<string, string[]>;
  sequenced: Set<string>;
};

export function buildGraph(dependencies: Dependency[]): Graph {
  const precedes = new Map<string, string[]>();
  const follows = new Map<string, string[]>();
  const sequenced = new Set<string>();

  for (const { before, after } of dependencies) {
    if (!before || !after || before === after) continue;
    const targets = precedes.get(before) ?? [];
    if (targets.includes(after)) continue;
    precedes.set(before, [...targets, after]);
    follows.set(after, [...(follows.get(after) ?? []), before]);
    sequenced.add(before);
    sequenced.add(after);
  }

  return { precedes, follows, sequenced };
}

export function traverse(
  startId: string,
  edges: Map<string, string[]>,
): Set<string> {
  const seen = new Set<string>();
  const stack = [...(edges.get(startId) ?? [])];
  while (stack.length > 0) {
    const id = stack.pop();
    if (id === undefined || seen.has(id)) continue;
    seen.add(id);
    stack.push(...(edges.get(id) ?? []));
  }
  return seen;
}

// Sort only tasks that have ordering rules, leaving other tasks in their slots.
export function sortSequenced(tasks: Task[], graph: Graph): Task[] {
  const positions: number[] = [];
  const nodes: Task[] = [];
  tasks.forEach((task, index) => {
    if (graph.sequenced.has(task.id)) {
      positions.push(index);
      nodes.push(task);
    }
  });
  if (nodes.length < 2) return tasks;

  const nodeIds = new Set(nodes.map((node) => node.id));
  const indegree = new Map(nodes.map((node) => [node.id, 0]));
  const outgoing = new Map<string, Set<string>>();

  for (const [before, targets] of graph.precedes) {
    if (!nodeIds.has(before)) continue;
    for (const after of targets) {
      if (!nodeIds.has(after) || before === after) continue;
      const edges = outgoing.get(before) ?? new Set<string>();
      if (edges.has(after)) continue;
      edges.add(after);
      outgoing.set(before, edges);
      indegree.set(after, (indegree.get(after) ?? 0) + 1);
    }
  }

  const ordered: Task[] = [];
  const remaining = [...nodes];
  while (remaining.length > 0) {
    // Stable choice: earliest task whose predecessors are all placed.
    const pick = remaining.findIndex(
      (node) => (indegree.get(node.id) ?? 0) === 0,
    );
    if (pick === -1) break; // Guard against a cycle.

    const [node] = remaining.splice(pick, 1);
    ordered.push(node);
    for (const target of outgoing.get(node.id) ?? []) {
      indegree.set(target, (indegree.get(target) ?? 0) - 1);
    }
  }
  ordered.push(...remaining);

  const sorted = [...tasks];
  positions.forEach((position, index) => {
    sorted[position] = ordered[index];
  });
  return sorted;
}

export function sortState(state: AppState): AppState {
  const graph = buildGraph(state.dependencies);
  const tasks: TasksByCategory = {};
  for (const [categoryId, list] of Object.entries(state.tasks)) {
    tasks[categoryId] = sortSequenced(list, graph);
  }
  return { ...state, tasks };
}

export function isDependency(value: unknown): value is Dependency {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as Dependency).before === "string" &&
    typeof (value as Dependency).after === "string"
  );
}

// Drop edges for tasks that no longer exist, plus duplicates and self-links.
export function pruneDependencies(
  dependencies: Dependency[],
  tasks: TasksByCategory,
): Dependency[] {
  const present = new Set<string>();
  for (const list of Object.values(tasks)) {
    for (const task of list) present.add(task.id);
  }

  const kept: Dependency[] = [];
  const seen = new Set<string>();
  for (const edge of dependencies) {
    if (!isDependency(edge)) continue;
    if (!present.has(edge.before) || !present.has(edge.after)) continue;
    if (edge.before === edge.after) continue;
    const key = `${edge.before}->${edge.after}`;
    if (seen.has(key)) continue;
    seen.add(key);
    kept.push({ before: edge.before, after: edge.after });
  }
  return kept;
}
