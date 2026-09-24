import { describe, it, expect } from 'vitest';
import { detectCycles, computeCriticalPath } from '../utils/ganttHelpers';

describe('detectCycles', () => {
  it('allows a dependency into an empty graph', () => {
    expect(detectCycles([], 'a', 'b')).toBe(false);
  });

  it('rejects the direct reverse of an existing edge', () => {
    const existing = [{ blockingTaskId: 'a', blockedTaskId: 'b' }];
    expect(detectCycles(existing, 'b', 'a')).toBe(true);
  });

  it('rejects a cycle closed through an intermediate task', () => {
    const existing = [
      { blockingTaskId: 'a', blockedTaskId: 'b' },
      { blockingTaskId: 'b', blockedTaskId: 'c' },
    ];
    // c -> a would close a -> b -> c -> a
    expect(detectCycles(existing, 'c', 'a')).toBe(true);
  });

  it('allows a diamond, which is not a cycle', () => {
    const existing = [
      { blockingTaskId: 'a', blockedTaskId: 'b' },
      { blockingTaskId: 'a', blockedTaskId: 'c' },
    ];
    expect(detectCycles(existing, 'b', 'd')).toBe(false);
    expect(detectCycles(existing, 'c', 'd')).toBe(false);
  });

  it('allows an edge between two unrelated branches', () => {
    const existing = [
      { blockingTaskId: 'a', blockedTaskId: 'b' },
      { blockingTaskId: 'x', blockedTaskId: 'y' },
    ];
    expect(detectCycles(existing, 'b', 'x')).toBe(false);
  });
});

describe('computeCriticalPath', () => {
  it('orders tasks so every blocker comes before what it blocks', () => {
    const tasks = [
      { id: 'c', title: 'C' },
      { id: 'a', title: 'A' },
      { id: 'b', title: 'B' },
    ];
    const deps = [
      { blockingTaskId: 'a', blockedTaskId: 'b' },
      { blockingTaskId: 'b', blockedTaskId: 'c' },
    ];
    const sorted = computeCriticalPath(tasks, deps).map((t) => t.id);
    expect(sorted.indexOf('a')).toBeLessThan(sorted.indexOf('b'));
    expect(sorted.indexOf('b')).toBeLessThan(sorted.indexOf('c'));
  });

  it('returns every task when there are no dependencies', () => {
    const tasks = [{ id: 'a', title: 'A' }, { id: 'b', title: 'B' }];
    expect(computeCriticalPath(tasks, [])).toHaveLength(2);
  });
});
