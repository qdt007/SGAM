/* Column definitions and card accents for the board. */
export const COLUMNS = [
  { id: 'BACKLOG', label: 'Backlog', color: 'bg-ink-subtle', light: 'bg-sunken/60' },
  { id: 'TODO', label: 'To Do', color: 'bg-blue-400', light: 'bg-blue-50 dark:bg-blue-950/30' },
  { id: 'IN_PROGRESS', label: 'In Progress', color: 'bg-yellow-400', light: 'bg-yellow-50 dark:bg-yellow-950/30' },
  { id: 'IN_REVIEW', label: 'In Review', color: 'bg-purple-400', light: 'bg-purple-50 dark:bg-purple-950/30' },
  { id: 'DONE', label: 'Done', color: 'bg-green-400', light: 'bg-green-50 dark:bg-green-950/30' },
];

export const PRIORITY_DOT: Record<string, string> = {
  CRITICAL: 'bg-red-500',
  HIGH: 'bg-orange-400',
  MEDIUM: 'bg-yellow-400',
  LOW: 'bg-green-400',
};
