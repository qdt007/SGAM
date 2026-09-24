export type GlobalRole = 'ADMIN' | 'USER';
export type ProjectRole = 'OWNER' | 'MANAGER' | 'MEMBER' | 'VIEWER';
export type ProjectStatus = 'PLANNING' | 'ACTIVE' | 'ON_HOLD' | 'COMPLETED' | 'CANCELLED';
export type TaskStatus = 'BACKLOG' | 'TODO' | 'IN_PROGRESS' | 'IN_REVIEW' | 'DONE' | 'CANCELLED';
export type Priority = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
export type NotificationType =
  | 'TASK_ASSIGNED'
  | 'TASK_UPDATED'
  | 'TASK_COMMENTED'
  | 'MENTIONED'
  | 'DEADLINE_APPROACHING'
  | 'PROJECT_INVITE'
  | 'FILE_UPLOADED';
export interface User {
  id: string;
  email: string;
  username: string;
  displayName: string;
  avatarUrl?: string | null;
  globalRole: GlobalRole;
  createdAt: string;
}
export interface Project {
  id: string;
  name: string;
  description?: string | null;
  status: ProjectStatus;
  priority: Priority;
  startDate?: string | null;
  endDate?: string | null;
  coverColor: string;
  createdAt: string;
  updatedAt: string;
  members?: ProjectMember[];
  _count?: { tasks: number; members: number };
}
export interface ProjectMember {
  id: string;
  projectId: string;
  userId: string;
  role: ProjectRole;
  joinedAt: string;
  user?: User;
}
export interface KanbanColumn {
  id: string;
  projectId: string;
  name: string;
  order: number;
  color?: string | null;
  tasks?: Task[];
}
export interface Task {
  id: string;
  projectId: string;
  columnId?: string | null;
  parentId?: string | null;
  title: string;
  description?: string | null;
  status: TaskStatus;
  priority: Priority;
  assigneeId?: string | null;
  creatorId: string;
  order: number;
  startDate?: string | null;
  dueDate?: string | null;
  completedAt?: string | null;
  estimatedHrs?: number | null;
  createdAt: string;
  updatedAt: string;
  assignee?: User | null;
  creator?: User;
  subtasks?: Task[];
  tags?: Tag[];
  _count?: { comments: number; subtasks: number; timeLogs: number };
}
export interface TaskDependency {
  id: string;
  blockingTaskId: string;
  blockedTaskId: string;
  blockingTask?: Pick<Task, 'id' | 'title' | 'status' | 'dueDate'>;
  blockedTask?: Pick<Task, 'id' | 'title' | 'status' | 'dueDate'>;
}
export interface Tag {
  id: string;
  name: string;
  color: string;
}
export interface Mention {
  mentionedId: string;
  mentioned?: Pick<User, 'id' | 'username' | 'displayName'>;
}
export interface Comment {
  id: string;
  authorId: string;
  taskId?: string | null;
  projectId?: string | null;
  body: string;
  editedAt?: string | null;
  createdAt: string;
  author?: User;
  files?: FileAttachment[];
  mentions?: Mention[];
}
export interface FileAttachment {
  id: string;
  uploaderId: string;
  taskId?: string | null;
  projectId?: string | null;
  filename: string;
  originalName: string;
  mimeType: string;
  size: number;
  url: string;
  createdAt: string;
  uploader?: User;
}
export interface Notification {
  id: string;
  recipientId: string;
  type: NotificationType;
  taskId?: string | null;
  message: string;
  isRead: boolean;
  createdAt: string;
  task?: { id: string; title: string; projectId: string } | null;
}
export interface TimeLog {
  id: string;
  userId: string;
  taskId: string;
  startedAt: string;
  endedAt?: string | null;
  durationMin?: number | null;
  note?: string | null;
  createdAt: string;
  user?: Pick<User, 'id' | 'displayName' | 'avatarUrl'>;
  task?: { id: string; title: string; projectId: string };
}
export interface ApiResponse<T> {
  success: boolean;
  data: T;
  meta?: PaginationMeta;
}
export interface ApiError {
  success: false;
  message: string;
  errors?: Array<{ field: string; message: string }>;
  code?: string;
}
export interface PaginationMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}
export interface ProjectProgress {
  status: TaskStatus;
  count: number;
  percentage: number;
}

/* Report payloads — shapes returned by /api/projects/:id/reports/* */
export interface BurndownPoint {
  date: string;
  remaining: number | null;
  completed: number | null;
  ideal: number;
}
export interface BurndownReport {
  project: { id: string; name: string };
  from: string;
  to: string;
  total: number;
  completed: number;
  points: BurndownPoint[];
}
export interface WorkloadRow {
  user: Pick<User, 'id' | 'displayName' | 'avatarUrl'>;
  role: ProjectRole;
  total: number;
  open: number;
  done: number;
  overdue: number;
  estimatedHrs: number;
  loggedHrs: number;
}
export interface WorkloadReport {
  rows: WorkloadRow[];
  unassigned: { total: number; open: number };
}
export interface ProjectSummary {
  total: number;
  done: number;
  inProgress: number;
  overdue: number;
  progress: number;
  estimatedHrs: number;
  loggedHrs: number;
  byStatus: Partial<Record<TaskStatus, number>>;
  byPriority: Partial<Record<Priority, number>>;
}
