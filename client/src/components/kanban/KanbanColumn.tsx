import { useDroppable } from '@dnd-kit/core';
import { Plus } from 'lucide-react';
import { Task } from '../../types';
import { cn } from '../../utils/cn';
import { COLUMNS } from './kanbanColumns';
import { TaskCard } from './TaskCard';
import { AddCardForm } from './AddCardForm';

interface ColumnProps {
  col: (typeof COLUMNS)[number];
  tasks: Task[];
  projectId: string;
  onOpenTask: (taskId: string) => void;
  addingTo: string | null;
  setAddingTo: (id: string | null) => void;
  isDragOver: boolean;
}

export function KanbanColumn({ col, tasks, projectId, addingTo, setAddingTo, isDragOver, onOpenTask }: ColumnProps) {
  const { setNodeRef } = useDroppable({ id: col.id });

  return (
    <div className="flex flex-col w-64 shrink-0">
      <div className="flex items-center gap-2 mb-2.5 px-1">
        <span className={cn('h-2.5 w-2.5 rounded-full', col.color)} />
        <span className="text-xs font-semibold text-ink-muted uppercase tracking-wide">{col.label}</span>
        <span className="ml-auto text-xs text-ink-subtle font-medium bg-sunken px-1.5 py-0.5 rounded-full">
          {tasks.length}
        </span>
      </div>

      <div
        ref={setNodeRef}
        className={cn(
          'flex-1 rounded-xl p-2 space-y-2 overflow-y-auto min-h-32 transition-all duration-150',
          col.light,
          isDragOver && 'ring-2 ring-primary/50 ring-offset-2 ring-offset-page bg-primary/10 scale-[1.01]',
        )}
      >
        {tasks.map((task) => (
          <TaskCard key={task.id} task={task} projectId={projectId} onOpen={onOpenTask} />
        ))}

        {addingTo === col.id ? (
          <AddCardForm projectId={projectId} status={col.id} onClose={() => setAddingTo(null)} />
        ) : (
          <button
            onClick={() => setAddingTo(col.id)}
            className="w-full flex items-center gap-1.5 text-xs text-ink-subtle hover:text-ink-muted dark:hover:text-ink-subtle/70 py-2 px-1 rounded-lg hover:bg-white/60 /60 transition-colors"
          >
            <Plus size={13} /> Add task
          </button>
        )}

        {/* Drop target indicator */}
        {isDragOver && <div className="h-1.5 rounded-full bg-primary-400 opacity-60 animate-pulse mx-1" />}
      </div>
    </div>
  );
}

/* ─── Main board ────────────────────────────────────────────── */
