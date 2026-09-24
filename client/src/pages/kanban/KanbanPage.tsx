import { useState, useCallback } from 'react';
import { useParams, Link, useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Icon } from '@iconify/react';
import { Breadcrumbs } from '../../components/ui/Page';
import { PageLoader } from '../../components/ui/States';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  closestCorners,
  type DragStartEvent,
  type DragEndEvent,
  type DragOverEvent,
} from '@dnd-kit/core';
import { projectsApi } from '../../api/projectsApi';
import { tasksApi } from '../../api/tasksApi';
import { useProjectRealtime } from '../../hooks/useProjectRealtime';
import { TaskDetailPanel } from '../../components/tasks/TaskDetailPanel';
import { COLUMNS } from '../../components/kanban/kanbanColumns';
import { KanbanColumn } from '../../components/kanban/KanbanColumn';
import { TaskCard, DragOverlayCard } from '../../components/kanban/TaskCard';
import { Task } from '../../types';
import { cn } from '../../utils/cn';

export function KanbanPage() {
  const { projectId } = useParams<{ projectId: string }>();
  useProjectRealtime(projectId);
  const [searchParams, setSearchParams] = useSearchParams();
  const [addingTo, setAddingTo] = useState<string | null>(null);

  // Same ?task= contract as the list view, so a notification link works on either screen.
  const openTaskId = searchParams.get('task');
  const openTask = useCallback((taskId: string) => setSearchParams({ task: taskId }), [setSearchParams]);
  const closeTask = useCallback(() => setSearchParams({}, { replace: true }), [setSearchParams]);
  const [activeTask, setActiveTask] = useState<Task | null>(null);
  const [overColumn, setOverColumn] = useState<string | null>(null);
  const qc = useQueryClient();

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const { data: project } = useQuery({
    queryKey: ['project', projectId],
    queryFn: () => projectsApi.get(projectId!),
    enabled: !!projectId,
  });

  const { data: tasks = [], isLoading } = useQuery({
    queryKey: ['tasks', projectId],
    queryFn: () => tasksApi.listByProject(projectId!),
    enabled: !!projectId,
  });

  const moveMutation = useMutation({
    mutationFn: ({ taskId, status }: { taskId: string; status: string }) =>
      tasksApi.update(taskId, { status: status as Task['status'] }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tasks', projectId] }),
  });

  const tasksByStatus = COLUMNS.reduce<Record<string, Task[]>>((acc, col) => {
    acc[col.id] = tasks.filter((t) => t.status === col.id);
    return acc;
  }, {});

  const handleDragStart = useCallback(
    (event: DragStartEvent) => {
      const task = tasks.find((t) => t.id === event.active.id);
      setActiveTask(task ?? null);
    },
    [tasks],
  );

  const handleDragOver = useCallback((event: DragOverEvent) => {
    const { over } = event;
    setOverColumn(over ? String(over.id) : null);
  }, []);

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      setActiveTask(null);
      setOverColumn(null);

      if (!over) return;

      const taskId = String(active.id);
      const newStatus = String(over.id);
      const task = tasks.find((t) => t.id === taskId);

      if (!task || task.status === newStatus) return;
      if (!COLUMNS.find((c) => c.id === newStatus)) return;

      moveMutation.mutate({ taskId, status: newStatus });
    },
    [tasks, moveMutation],
  );

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <header className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-2 border-b border-line bg-surface px-4 py-3 sm:px-6">
        <div className="min-w-0">
          <Breadcrumbs
            items={[
              { label: 'Projects', to: '/projects' },
              { label: project?.name ?? 'Project', to: `/projects/${projectId}` },
            ]}
          />
          <h1 className="mt-0.5 font-display text-subhead font-bold text-ink">Board</h1>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <span className="hidden text-caption text-ink-subtle lg:block">Drag cards between columns</span>
          <Link to={`/projects/${projectId}`} className="btn-secondary btn-sm">
            <Icon icon="ph:list-bullets" width={14} aria-hidden />
            List view
          </Link>
        </div>
      </header>

      {isLoading ? (
        <PageLoader label="Loading board" />
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDragEnd={handleDragEnd}
        >
          <div className="flex-1 overflow-x-auto p-4">
            <div className="flex gap-3 h-full min-w-max">
              {COLUMNS.map((col) => (
                <KanbanColumn
                  key={col.id}
                  col={col}
                  tasks={tasksByStatus[col.id] ?? []}
                  projectId={projectId!}
                  addingTo={addingTo}
                  setAddingTo={setAddingTo}
                  isDragOver={overColumn === col.id && !!activeTask && activeTask.status !== col.id}
                  onOpenTask={openTask}
                />
              ))}
            </div>
          </div>

          {/* Floating card while dragging */}
          <DragOverlay dropAnimation={{ duration: 180, easing: 'cubic-bezier(0.18,0.67,0.6,1.22)' }}>
            {activeTask ? <DragOverlayCard task={activeTask} /> : null}
          </DragOverlay>
        </DndContext>
      )}

      {openTaskId && <TaskDetailPanel taskId={openTaskId} projectId={projectId!} onClose={closeTask} />}
    </div>
  );
}
