export interface GanttTask { id: string; title: string; startDate?: Date | null; dueDate?: Date | null; }
export interface Dependency { blockingTaskId: string; blockedTaskId: string; }
export function detectCycles(existingDeps: Dependency[], newBlockingId: string, newBlockedId: string): boolean {
  const graph = new Map<string, string[]>();
  for (const dep of existingDeps) {
    if (!graph.has(dep.blockingTaskId)) graph.set(dep.blockingTaskId, []);
    graph.get(dep.blockingTaskId)!.push(dep.blockedTaskId);
  }
  if (!graph.has(newBlockingId)) graph.set(newBlockingId, []);
  graph.get(newBlockingId)!.push(newBlockedId);
  const visited = new Set<string>();
  function dfs(node: string): boolean {
    if (node === newBlockingId) return true;
    if (visited.has(node)) return false;
    visited.add(node);
    for (const n of graph.get(node) || []) { if (dfs(n)) return true; }
    return false;
  }
  visited.add(newBlockingId);
  return dfs(newBlockedId);
}
export function computeCriticalPath(tasks: GanttTask[], deps: Dependency[]): GanttTask[] {
  const taskMap = new Map(tasks.map((t) => [t.id, t]));
  const inDegree = new Map<string, number>();
  const graph = new Map<string, string[]>();
  for (const task of tasks) { inDegree.set(task.id, 0); graph.set(task.id, []); }
  for (const dep of deps) {
    graph.get(dep.blockingTaskId)?.push(dep.blockedTaskId);
    inDegree.set(dep.blockedTaskId, (inDegree.get(dep.blockedTaskId) || 0) + 1);
  }
  const queue = [...inDegree.entries()].filter(([, d]) => d === 0).map(([id]) => id);
  const sorted: GanttTask[] = [];
  while (queue.length > 0) {
    const id = queue.shift()!;
    const task = taskMap.get(id);
    if (task) sorted.push(task);
    for (const n of graph.get(id) || []) {
      const deg = (inDegree.get(n) || 0) - 1;
      inDegree.set(n, deg);
      if (deg === 0) queue.push(n);
    }
  }
  return sorted;
}
