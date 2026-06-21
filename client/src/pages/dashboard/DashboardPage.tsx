import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { FolderKanban, CheckSquare, Users, Clock, ArrowRight } from 'lucide-react';
import { projectsApi } from '../../api/projectsApi';
import { useAuthStore } from '../../stores/authStore';
import { cn } from '../../utils/cn';
import { format } from 'date-fns';

const STATUS_COLOR: Record<string, string> = {
  PLANNING: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300',
  ACTIVE: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  ON_HOLD: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
  COMPLETED: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  CANCELLED: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
};

export function DashboardPage() {
  const { user } = useAuthStore();
  const { data: projects = [], isLoading } = useQuery({
    queryKey: ['projects'],
    queryFn: projectsApi.list,
  });

  const totalTasks = projects.reduce((sum, p) => sum + (p._count?.tasks ?? 0), 0);
  const totalMembers = new Set(projects.flatMap((p) => p.members?.map((m) => m.userId) ?? [])).size;
  const activeProjects = projects.filter((p) => p.status === 'ACTIVE').length;

  const stats = [
    { label: 'Projects', value: projects.length, icon: FolderKanban, color: 'text-primary-600 bg-primary-50 dark:bg-primary-900/30' },
    { label: 'Active', value: activeProjects, icon: Clock, color: 'text-green-600 bg-green-50 dark:bg-green-900/30' },
    { label: 'Total Tasks', value: totalTasks, icon: CheckSquare, color: 'text-blue-600 bg-blue-50 dark:bg-blue-900/30' },
    { label: 'Collaborators', value: totalMembers, icon: Users, color: 'text-purple-600 bg-purple-50 dark:bg-purple-900/30' },
  ];

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold dark:text-white">
          Welcome back, {user?.displayName?.split(' ')[0]} 👋
        </h1>
        <p className="mt-1 text-sm text-gray-500">Here's what's happening across your projects.</p>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {stats.map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="card flex items-center gap-3">
            <div className={cn('rounded-lg p-2', color)}>
              <Icon size={18} />
            </div>
            <div>
              <p className="text-xl font-bold dark:text-white">{isLoading ? '—' : value}</p>
              <p className="text-xs text-gray-500">{label}</p>
            </div>
          </div>
        ))}
      </div>

      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold dark:text-white">Recent Projects</h2>
          <Link to="/projects" className="text-sm text-primary-600 hover:underline flex items-center gap-1">
            View all <ArrowRight size={14} />
          </Link>
        </div>

        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="card h-16 animate-pulse bg-gray-100 dark:bg-gray-800" />
            ))}
          </div>
        ) : projects.length === 0 ? (
          <div className="card text-center py-10">
            <FolderKanban size={32} className="mx-auto text-gray-300 mb-2" />
            <p className="text-sm text-gray-500">No projects yet.</p>
            <Link to="/projects" className="btn-primary mt-3 inline-flex">Create your first project</Link>
          </div>
        ) : (
          <div className="space-y-3">
            {projects.slice(0, 5).map((project) => (
              <Link
                key={project.id}
                to={`/projects/${project.id}`}
                className="card flex items-center gap-4 hover:border-primary-300 transition-colors group"
              >
                <div className="h-10 w-10 rounded-lg shrink-0 flex items-center justify-center text-white font-bold text-sm" style={{ backgroundColor: project.coverColor || '#6366f1' }}>
                  {project.name[0].toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate dark:text-white group-hover:text-primary-600">{project.name}</p>
                  <p className="text-xs text-gray-500">{project._count?.tasks ?? 0} tasks · {project._count?.members ?? 0} members</p>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className={cn('badge text-xs', STATUS_COLOR[project.status])}>{project.status}</span>
                  <span className="text-xs text-gray-400">{format(new Date(project.updatedAt), 'MMM d')}</span>
                  <ArrowRight size={14} className="text-gray-400 group-hover:text-primary-500" />
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
